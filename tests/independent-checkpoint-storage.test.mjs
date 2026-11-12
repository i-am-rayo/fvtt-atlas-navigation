import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyAtlas } from "../scripts/atlas-model.js";
import { saveNewIndependentCheckpoint, saveConnectedIndependentCheckpoint,
  saveDisconnectedIndependentCheckpoint, saveRelocatedIndependentCheckpoint, saveNewRoad } from "../scripts/road-storage.js";

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
