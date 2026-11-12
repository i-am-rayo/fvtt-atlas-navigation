import test from "node:test";
import assert from "node:assert/strict";
import {createEmptyAtlas,validateAtlas} from "../scripts/atlas-model.js";
import {addRoad} from "../scripts/road-model.js";
import {addIndependentCheckpoint} from "../scripts/checkpoint-model.js";
import {roadCheckpointEditCandidates,attachIndependentCheckpointsToRoad}
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
