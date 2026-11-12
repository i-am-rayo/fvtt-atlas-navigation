import test from "node:test";
import assert from "node:assert/strict";
import {createEmptyAtlas,validateAtlas} from "../scripts/atlas-model.js";
import {addRoad} from "../scripts/road-model.js";
import {addIndependentCheckpoint} from "../scripts/checkpoint-model.js";
import {roadCheckpointEditCandidates,attachIndependentCheckpointsToRoad,
  attachIndependentCheckpointToRoadEndpoint}
  from "../scripts/road-checkpoint-existing-attachments.js";

const ids=()=>{let n=0;return ()=> "graph"+ ++n;};

test("existing Road gains two explicit independent Checkpoint junctions without changing saved IDs",()=>{
  const factory=ids();
  let graph=addRoad(createEmptyAtlas(),{
    points:[{x:0,y:0},{x:100,y:0}],name:"Main",idFactory:factory
  });
  graph=addIndependentCheckpoint(graph,{
    at:{x:30,y:3},name:"Bridge",idFactory:factory
  });
  graph=addIndependentCheckpoint(graph,{
    at:{x:70,y:0},name:"Waystation",idFactory:factory
  });
  const candidates=roadCheckpointEditCandidates(graph,{roadId:graph.roads[0].id});
  assert.equal(candidates.length,2);
  const priorSegment=graph.segments[0].id;
  const priorNodeIds=graph.checkpoints.map(cp=>cp.nodeId);
  const connected=attachIndependentCheckpointsToRoad(graph,{
    roadId:graph.roads[0].id,
    checkpointIds:graph.checkpoints.map(cp=>cp.id),
    idFactory:factory
  });
  assert.deepEqual(validateAtlas(connected),connected);
  assert.equal(connected.segments.length,3);
  assert.equal(connected.segments[0].id,priorSegment);
  assert.equal(connected.segments[0].to,priorNodeIds[0]);
  assert.equal(connected.segments[1].from,priorNodeIds[0]);
  assert.equal(connected.segments[1].to,priorNodeIds[1]);
  assert.equal(connected.segments[2].from,priorNodeIds[1]);
  assert.deepEqual(connected.checkpoints.map(cp=>cp.id),
    graph.checkpoints.map(cp=>cp.id));
  assert.ok(connected.checkpoints.every(cp=>cp.roadId===graph.roads[0].id));
  assert.equal(connected.nodes.length,graph.nodes.length);
  assert.deepEqual(graph.segments.length,1,"pre-save model stays untouched");
});

test("Road attachment leaves unselected independent Checkpoints detached",()=>{
  const factory=ids();
  let graph=addRoad(createEmptyAtlas(),{
    points:[{x:0,y:0},{x:100,y:0}],name:"Main",idFactory:factory
  });
  for(const [x,name] of [[30,"A"],[70,"B"]]){
    graph=addIndependentCheckpoint(graph,{
      at:{x,y:0},name,idFactory:factory
    });
  }
  const connected=attachIndependentCheckpointsToRoad(graph,{
    roadId:graph.roads[0].id,
    checkpointIds:[graph.checkpoints[0].id],idFactory:factory
  });
  assert.equal(connected.segments.length,2);
  assert.equal(connected.checkpoints[0].roadId,graph.roads[0].id);
  assert.equal(connected.checkpoints[1].roadId,null);
});

test("ambiguous coincident isolated Nodes are not eligible for implicit Road splitting",()=>{
  const factory=ids();
  let graph=addRoad(createEmptyAtlas(),{
    points:[{x:0,y:0},{x:100,y:0}],idFactory:factory
  });
  graph=addIndependentCheckpoint(graph,{at:{x:50,y:0},name:"A",idFactory:factory});
  graph=addIndependentCheckpoint(graph,{at:{x:50,y:0},name:"B",idFactory:factory});
  assert.equal(roadCheckpointEditCandidates(graph,{roadId:graph.roads[0].id}).length,0);
  assert.throws(()=>attachIndependentCheckpointsToRoad(graph,{
    roadId:graph.roads[0].id,
    checkpointIds:[graph.checkpoints[0].id],idFactory:factory
  }),/ambiguous or no longer eligible/);
});

test("Road attachment refuses unsupported legacy graphs and fabricated IDs",()=>{
  const factory=ids();
  const old=addRoad(createEmptyAtlas(),{
    points:[{x:0,y:0},{x:100,y:0}],idFactory:factory
  });
  assert.deepEqual(roadCheckpointEditCandidates(old,{roadId:old.roads[0].id}),[]);
  assert.throws(()=>attachIndependentCheckpointsToRoad(old,{
    roadId:old.roads[0].id,checkpointIds:["missing"],idFactory:factory
  }),/schema v10/);
  const current=addIndependentCheckpoint(old,{
    at:{x:50,y:0},name:"A",idFactory:factory
  });
  assert.throws(()=>attachIndependentCheckpointsToRoad(current,{
    roadId:current.roads[0].id,checkpointIds:["missing"],idFactory:factory
  }),/ambiguous or no longer eligible/);
});

test("Road-edit interior review snaps selected checkpoint Node exactly to projected Road centerline",()=>{
  const factory=ids();
  let atlas=addRoad(createEmptyAtlas(),{
    name:"East Road",points:[{x:0,y:0},{x:100,y:0}],idFactory:factory
  });
  atlas=addIndependentCheckpoint(atlas,{
    at:{x:40,y:8},name:"Bridge",idFactory:factory
  });
  const cp=atlas.checkpoints[0],beforeNode=atlas.nodes.find(n=>n.id===cp.nodeId);
  const cut=attachIndependentCheckpointsToRoad(atlas,{
    roadId:atlas.roads[0].id,checkpointIds:[cp.id],idFactory:factory
  });
  const afterNode=cut.nodes.find(n=>n.id===cp.nodeId);
  assert.deepEqual(beforeNode,{id:cp.nodeId,x:40,y:8});
  assert.deepEqual(afterNode,{id:cp.nodeId,x:40,y:0});
  assert.equal(cut.segments[0].to,cp.nodeId);
  assert.equal(cut.segments[1].from,cp.nodeId);
  assert.equal(cut.segments[0].id,atlas.segments[0].id);
  assert.equal(cut.nodes.find(n=>n.id===atlas.segments[0].from).x,0);
  assert.deepEqual(atlas.nodes.find(n=>n.id===cp.nodeId),beforeNode,
    "a preview cannot mutate stored geometry");
});

test("eligible terminal Road Node can merge with isolated Checkpoint, with exact coordinates",()=>{
  const factory=ids();
  let atlas=addRoad(createEmptyAtlas(),{
    name:"North Road",points:[{x:0,y:0},{x:100,y:0}],idFactory:factory
  });
  atlas=addIndependentCheckpoint(atlas,{
    at:{x:5,y:6},name:"Village",idFactory:factory
  });
  const cp=atlas.checkpoints[0],road=atlas.roads[0],endpointId=atlas.segments[0].from;
  const merged=attachIndependentCheckpointToRoadEndpoint(atlas,{
    checkpointId:cp.id,roadId:road.id,roadNodeId:endpointId
  });
  assert.equal(merged.checkpoints[0].id,cp.id);
  assert.equal(merged.checkpoints[0].nodeId,endpointId);
  assert.equal(merged.checkpoints[0].roadId,road.id);
  assert.equal(merged.nodes.some(n=>n.id===cp.nodeId),false,
    "orphan isolated Node is retired after explicit GM merge");
  assert.deepEqual(merged.nodes.find(n=>n.id===endpointId),{
    id:endpointId,x:0,y:0
  });
  assert.deepEqual(merged.segments,atlas.segments,
    "Road endpoint stable ID and geometry stay authoritative");
  assert.equal(atlas.checkpoints[0].nodeId,cp.nodeId,
    "prior unconfirmed graph stays intact");
});

test("endpoint merge refuses junction/shared endpoint or another Checkpoint ownership",()=>{
  const factory=ids();
  let atlas=addRoad(createEmptyAtlas(),{
    name:"Main Road",points:[{x:0,y:0},{x:100,y:0}],idFactory:factory
  });
  atlas=addIndependentCheckpoint(atlas,{
    at:{x:5,y:5},name:"A",idFactory:factory
  });
  const cp=atlas.checkpoints[0],roadId=atlas.roads[0].id;
  const roadNode=atlas.segments[0].from;
  atlas=addIndependentCheckpoint(atlas,{
    at:{x:0,y:0},name:"B",idFactory:factory
  });
  const first=attachIndependentCheckpointToRoadEndpoint(atlas,{
    checkpointId:cp.id,roadId,roadNodeId:roadNode
  });
  assert.equal(first.checkpoints[0].nodeId,roadNode);
  assert.throws(()=>attachIndependentCheckpointToRoadEndpoint(first,{
    checkpointId:atlas.checkpoints[1].id,roadId,roadNodeId:roadNode
  }),/already has a Checkpoint/);
  const junction={...atlas,segments:[...atlas.segments,{
    ...atlas.segments[0],id:"anotherSection",
    from:roadNode,to:atlas.segments[0].to
  }]};
  assert.throws(()=>attachIndependentCheckpointToRoadEndpoint(junction,{
    checkpointId:cp.id,roadId,roadNodeId:roadNode
  }),/terminal Node/);
});
