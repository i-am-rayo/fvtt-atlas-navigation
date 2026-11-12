import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyAtlas } from "../scripts/atlas-model.js";
import { DEFAULT_CHECKPOINT_APPEARANCE } from "../scripts/checkpoint-appearance.js";
import { saveNewIndependentCheckpoint, saveConnectedIndependentCheckpoint,
  saveDisconnectedIndependentCheckpoint, saveRelocatedIndependentCheckpoint, saveNewRoad,
  savePointEdits } from "../scripts/road-storage.js";

function sceneFixture() {
  let stored = { ...createEmptyAtlas(), revision: 5 };
  let writes = 0;
  return { canUserModify: () => true,
    getFlag: () => stored,
    async setFlag(_namespace, _flag, value) { stored = value; writes++; },
    get writes() { return writes; }, get current() { return stored; } };
}

test("GM confirmation creates independent Checkpoint in one revisioned Scene write", async () => {
  const previous = globalThis.game;
  globalThis.game = { user: { isGM: true } };
  try {
    const scene = sceneFixture();
    let next = 0;
    const saved = await saveNewIndependentCheckpoint(scene, {
      at: { x: 72, y: 15 }, name: "Village", expectedRevision: 5,
      idFactory: () => `id${++next}`
    });
    assert.equal(saved.revision, 6);
    assert.equal(saved.schemaVersion, 10);
    assert.equal(saved.roads.length, 0);
    assert.equal(saved.checkpoints[0].roadId, null);
    assert.equal(scene.writes, 1);
    await assert.rejects(saveNewIndependentCheckpoint(scene, {
      at: { x: 74, y: 20 }, name: "Stale", expectedRevision: 5,
      idFactory: () => `other${++next}`
    }), /changed since/);
    assert.equal(scene.writes, 1);
  } finally { globalThis.game = previous; }
});

test("non-GM standalone Checkpoint attempts never write", async () => {
  const previous = globalThis.game;
  globalThis.game = { user: { isGM: false } };
  try {
    const scene = sceneFixture();
    await assert.rejects(saveNewIndependentCheckpoint(scene, {
      at: { x: 1, y: 2 }, name: "Forbidden", expectedRevision: 5,
      idFactory: () => "id"
    }), /Only a GM/);
    assert.equal(scene.writes, 0);
  } finally { globalThis.game = previous; }
});

test("explicit terminal Road connection and disconnection use guarded Scene revisions", async () => {
  const previous = globalThis.game;
  globalThis.game = { user: { isGM: true } };
  try {
    const scene = sceneFixture();
    let index = 0;
    const initial = await saveNewIndependentCheckpoint(scene, {
      at: { x: 40, y: 40 }, name: "Outpost", expectedRevision: 5,
      idFactory: () => `generated${++index}`
    });
    // Add a Road using the existing guarded API; no direct Scene flag mutation.
    const { saveNewRoad } = await import("../scripts/road-storage.js");
    const withRoad = await saveNewRoad(scene, { points: [{ x: 0, y: 0 },
      { x: 20, y: 0 }], name: "Test Road", expectedRevision: 6,
      idFactory: () => `generated${++index}` });
    const connected = await saveConnectedIndependentCheckpoint(scene, {
      checkpointId: initial.checkpoints[0].id, roadId: withRoad.roads[0].id,
      roadNodeId: withRoad.segments[0].to, expectedRevision: 7,
      idFactory: () => `generated${++index}`
    });
    assert.equal(connected.revision, 8);
    assert.equal(connected.checkpoints[0].roadId, withRoad.roads[0].id);
    await assert.rejects(saveDisconnectedIndependentCheckpoint(scene, {
      checkpointId: connected.checkpoints[0].id, segmentId: connected.segments.at(-1).id,
      expectedRevision: 7
    }), /changed since/);
    const disconnected = await saveDisconnectedIndependentCheckpoint(scene, {
      checkpointId: connected.checkpoints[0].id, segmentId: connected.segments.at(-1).id,
      expectedRevision: 8
    });
    assert.equal(disconnected.checkpoints[0].roadId, null);
    assert.equal(disconnected.checkpoints[0].id, initial.checkpoints[0].id);
    assert.equal(scene.writes, 4);
  } finally { globalThis.game = previous; }
});

test("relocation uses one authorized revision-checked Scene flag write",async()=>{
  const prev=globalThis.game;
  globalThis.game={user:{isGM:true}};
  try{
    const scene=sceneFixture();
    let i=0;
    const saved=await saveNewIndependentCheckpoint(scene,{
      at:{x:20,y:30},name:"Free Hamlet",expectedRevision:5,
      idFactory:()=>`move${++i}`
    });
    const checkpointId=saved.checkpoints[0].id;
    const nodeId=saved.checkpoints[0].nodeId;
    const moved=await saveRelocatedIndependentCheckpoint(scene,{
      checkpointId,at:{x:25,y:45},expectedRevision:6
    });
    assert.equal(moved.revision,7);
    assert.equal(scene.writes,2);
    assert.equal(moved.checkpoints[0].id,checkpointId);
    assert.equal(moved.checkpoints[0].nodeId,nodeId);
    assert.equal(moved.nodes.find(n=>n.id===nodeId).y,45);
    await assert.rejects(saveRelocatedIndependentCheckpoint(scene,{
      checkpointId,at:{x:55,y:66},expectedRevision:6
    }),/changed since/);
    assert.equal(scene.writes,2);
    globalThis.game.user.isGM=false;
    await assert.rejects(saveRelocatedIndependentCheckpoint(scene,{
      checkpointId,at:{x:55,y:66},expectedRevision:7
    }),/Only a GM/);
    assert.equal(scene.writes,2);
  }finally{globalThis.game=prev;}
});

test("new Road and selected independent Checkpoint attachments save in one Scene revision",async()=>{
  const prev=globalThis.game;
  globalThis.game={user:{isGM:true}};
  try{
    const scene=sceneFixture();
    let count=0;const ids=()=>"batch"+ ++count;
    const standalone=await saveNewIndependentCheckpoint(scene,{
      at:{x:45,y:0},name:"Crossing",expectedRevision:5,idFactory:ids
    });
    const checkpointId=standalone.checkpoints[0].id;
    const saved=await saveNewRoad(scene,{
      points:[{x:0,y:0},{x:100,y:0}],name:"Market Road",
      checkpointIds:[checkpointId],
      expectedRevision:6,idFactory:ids
    });
    assert.equal(saved.revision,7);
    assert.equal(scene.writes,2,"one Road write also attaches the Checkpoint");
    assert.equal(saved.segments.length,2);
    assert.equal(saved.checkpoints[0].roadId,saved.roads[0].id);
    await assert.rejects(saveNewRoad(scene,{
      points:[{x:0,y:10},{x:100,y:10}],name:"Stale Road",
      checkpointIds:[checkpointId],expectedRevision:6,idFactory:ids
    }),/changed since/);
    assert.equal(scene.writes,2);
  }finally{globalThis.game=prev;}
});

test("full standalone Checkpoint settings preserve appearance and visibility in the first graph write",async()=>{
  const previous=globalThis.game;
  globalThis.game={user:{isGM:true}};
  try{
    const scene=sceneFixture();
    let seq=0;
    const appearance={...DEFAULT_CHECKPOINT_APPEARANCE,size:34};
    const saved=await saveNewIndependentCheckpoint(scene,{
      at:{x:120,y:155},name:"Watchtower",elevationMeters:250,
      appearance,playerVisible:true,expectedRevision:5,
      idFactory:()=>"full"+ ++seq
    });
    assert.equal(scene.writes,1);
    assert.equal(saved.schemaVersion,10);
    assert.equal(saved.checkpoints[0].roadId,null);
    assert.equal(saved.checkpoints[0].elevationMeters,250);
    assert.equal(saved.checkpoints[0].playerVisible,true);
    assert.deepEqual(saved.checkpoints[0].appearance,appearance);
    assert.equal(saved.roads.length,0);
  }finally{globalThis.game=previous;}
});

test("GM-approved Move & Connect snaps existing Checkpoint Node to Road interior in one write",async()=>{
  const prev=globalThis.game;
  globalThis.game={user:{isGM:true}};
  try{
    const scene=sceneFixture();
    let count=0;const idFactory=()=>"attach"+ ++count;
    const road=await saveNewRoad(scene,{
      name:"Main Road",points:[{x:0,y:0},{x:100,y:0}],
      expectedRevision:5,idFactory
    });
    const cpSaved=await saveNewIndependentCheckpoint(scene,{
      at:{x:55,y:30},name:"Watchtower",
      expectedRevision:6,idFactory
    });
    const cp=cpSaved.checkpoints[0];
    const moved=await saveRelocatedIndependentCheckpoint(scene,{
      checkpointId:cp.id,at:{x:55,y:4},
      connection:{segmentId:road.segments[0].id,x:55,y:0},
      expectedRevision:7,idFactory
    });
    assert.equal(scene.writes,3);
    assert.equal(moved.revision,8);
    assert.equal(moved.checkpoints[0].id,cp.id);
    assert.equal(moved.checkpoints[0].nodeId,cp.nodeId);
    assert.equal(moved.checkpoints[0].roadId,road.roads[0].id);
    const anchored=moved.nodes.find(n=>n.id===cp.nodeId);
    assert.equal(anchored.id,cp.nodeId);
    assert.ok(Math.abs(anchored.x-55)<1e-9 && Math.abs(anchored.y)<1e-9,
      "the saved graph Node must coincide with the Road centerline within floating-point precision");
    assert.equal(moved.segments[0].to,anchored.id);
    assert.equal(moved.segments[1].from,anchored.id,
      "both sides of the Road reference the exact same authoritative Node");
    assert.equal(moved.segments.length,2);
    assert.equal(moved.segments[0].id,road.segments[0].id);
    await assert.rejects(saveRelocatedIndependentCheckpoint(scene,{
      checkpointId:cp.id,at:{x:70,y:0},
      connection:{segmentId:road.segments[0].id,x:70,y:0},
      expectedRevision:7,idFactory
    }),/changed since/);
    assert.equal(scene.writes,3);
  }finally{globalThis.game=prev;}
});

test("moving near a Road without connecting leaves graph incidence unchanged",async()=>{
  const prev=globalThis.game;
  globalThis.game={user:{isGM:true}};
  try{
    const scene=sceneFixture();
    let count=0;const idFactory=()=>"alone"+ ++count;
    const road=await saveNewRoad(scene,{
      name:"Main Road",points:[{x:0,y:0},{x:100,y:0}],
      expectedRevision:5,idFactory
    });
    const cpSaved=await saveNewIndependentCheckpoint(scene,{
      at:{x:40,y:30},name:"Hamlet",expectedRevision:6,idFactory
    });
    const moved=await saveRelocatedIndependentCheckpoint(scene,{
      checkpointId:cpSaved.checkpoints[0].id,at:{x:40,y:2},
      connection:null,expectedRevision:7
    });
    assert.equal(moved.checkpoints[0].roadId,null);
    assert.deepEqual(moved.segments,road.segments);
    assert.equal(scene.writes,3);
  }finally{globalThis.game=prev;}
});

test("Road point Save can review and attach an independent Checkpoint in the same revision",async()=>{
  const prev=globalThis.game;
  globalThis.game={user:{isGM:true}};
  try{
    const scene=sceneFixture();
    let count=0;const idFactory=()=>"reshape"+ ++count;
    const road=await saveNewRoad(scene,{
      name:"Bent Road",points:[{x:0,y:0},{x:50,y:40},{x:100,y:0}],
      expectedRevision:5,idFactory
    });
    const cpSaved=await saveNewIndependentCheckpoint(scene,{
      at:{x:50,y:0},name:"Midpoint",expectedRevision:6,idFactory
    });
    const cp=cpSaved.checkpoints[0];
    const saved=await savePointEdits(scene,{
      roadId:road.roads[0].id,
      operations:[{kind:"move-bend",segmentId:road.segments[0].id,
        viaIndex:0,x:50,y:0}],
      checkpointIds:[cp.id],idFactory,expectedRevision:7
    });
    assert.equal(saved.revision,8);
    assert.equal(scene.writes,3);
    assert.equal(saved.checkpoints[0].nodeId,cp.nodeId);
    assert.equal(saved.checkpoints[0].roadId,road.roads[0].id);
    assert.equal(saved.segments.length,2);
    assert.equal(saved.segments[0].id,road.segments[0].id);
  }finally{globalThis.game=prev;}
});

test("GM Move & Connect to Road beginning performs exact terminal merge in one write",async()=>{
  const prior=globalThis.game;
  globalThis.game={user:{isGM:true}};
  try{
    const scene=sceneFixture();
    let seq=0;
    const idFactory=()=>"endpoint"+ ++seq;
    const road=await saveNewRoad(scene,{
      name:"Causeway",points:[{x:200,y:300},{x:400,y:300}],
      expectedRevision:5,idFactory
    });
    const cpAtlas=await saveNewIndependentCheckpoint(scene,{
      at:{x:188,y:293},name:"Port",elevationMeters:9,
      expectedRevision:6,idFactory
    });
    const cp=cpAtlas.checkpoints[0];
    const roadNodeId=road.segments[0].from;
    const result=await saveRelocatedIndependentCheckpoint(scene,{
      checkpointId:cp.id,
      at:{x:199,y:302},expectedRevision:7,
      connection:{kind:"node",nodeId:roadNodeId,x:200,y:300},
      idFactory
    });
    assert.equal(scene.writes,3);
    assert.equal(result.revision,8);
    assert.equal(result.checkpoints[0].id,cp.id);
    assert.equal(result.checkpoints[0].nodeId,roadNodeId);
    assert.equal(result.checkpoints[0].name,"Port");
    assert.equal(result.checkpoints[0].elevationMeters,9);
    assert.equal(result.checkpoints[0].roadId,road.roads[0].id);
    assert.equal(result.segments.length,1);
    assert.equal(result.segments[0].id,road.segments[0].id);
    assert.deepEqual(result.nodes.find(n=>n.id===roadNodeId),{
      id:roadNodeId,x:200,y:300
    });
    assert.equal(result.nodes.some(n=>n.id===cp.nodeId),false);
    await assert.rejects(saveRelocatedIndependentCheckpoint(scene,{
      checkpointId:cp.id,at:{x:200,y:300},expectedRevision:7,
      connection:{kind:"node",nodeId:roadNodeId,x:200,y:300}
    }),/changed since/);
    assert.equal(scene.writes,3);
  }finally{globalThis.game=prior;}
});

test("relocated Checkpoint cannot claim fabricated Road endpoint or stale coordinate",async()=>{
  const prior=globalThis.game;
  globalThis.game={user:{isGM:true}};
  try{
    const scene=sceneFixture();
    let seq=0;const idFactory=()=>"guard"+ ++seq;
    const road=await saveNewRoad(scene,{
      name:"Main",points:[{x:0,y:0},{x:100,y:0}],
      expectedRevision:5,idFactory
    });
    const graph=await saveNewIndependentCheckpoint(scene,{
      at:{x:5,y:5},name:"A",expectedRevision:6,idFactory
    });
    const cp=graph.checkpoints[0];
    for(const connection of [
      {kind:"node",nodeId:"nonexistent",x:0,y:0},
      {kind:"node",nodeId:road.segments[0].from,x:1,y:0}
    ]) {
      await assert.rejects(saveRelocatedIndependentCheckpoint(scene,{
        checkpointId:cp.id,at:{x:0,y:0},
        connection,expectedRevision:7,idFactory
      }),/endpoint|unavailable|changed/);
    }
    assert.equal(scene.writes,2);
    assert.equal(scene.current.checkpoints[0].nodeId,cp.nodeId);
  }finally{globalThis.game=prior;}
});

test("Road edit Save snaps near-miss selected Checkpoint to exact Road centerline",async()=>{
  const prior=globalThis.game;
  globalThis.game={user:{isGM:true}};
  try{
    const scene=sceneFixture();
    let seq=0;const idFactory=()=>"align"+ ++seq;
    const road=await saveNewRoad(scene,{
      name:"Road",points:[{x:0,y:0},{x:100,y:0}],
      expectedRevision:5,idFactory
    });
    const graph=await saveNewIndependentCheckpoint(scene,{
      at:{x:50,y:5},name:"Near Road",expectedRevision:6,idFactory
    });
    // The Road edit changes a bend away from its earlier path, creating a
    // reviewed near intersection without an exact native-grid coincidence.
    const before=graph.checkpoints[0];
    const initial=await savePointEdits(scene,{
      roadId:road.roads[0].id,operations:[
        {kind:"create-junction",segmentId:road.segments[0].id,
          edgeIndex:0,atVertex:false,x:25,y:0,
          newNodeId:"alignJunction",newSegmentId:"alignSection"}
      ],
      checkpointIds:[before.id],expectedRevision:7,idFactory
    });
    const anchored=initial.nodes.find(node=>node.id===before.nodeId);
    assert.deepEqual(anchored,{id:before.nodeId,x:50,y:0});
    assert.equal(initial.checkpoints[0].roadId,road.roads[0].id);
    assert.equal(scene.writes,3);
  }finally{globalThis.game=prior;}
});
