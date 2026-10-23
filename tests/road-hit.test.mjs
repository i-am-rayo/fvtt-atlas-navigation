import assert from "node:assert/strict";
import test from "node:test";
import {createEmptyAtlas} from "../scripts/atlas-model.js";
import {addRoad} from "../scripts/road-model.js";
import {roadHandles,nearestRoadHandle,nearestRoadEdge} from "../scripts/road-hit.js";
function ids(start=0){let n=start;return ()=>"id"+ ++n;}
test("point handles identify bends and junctions; edge projection supports insertion",()=>{
 const a=addRoad(createEmptyAtlas(),{points:[{x:0,y:0},{x:50,y:20},{x:100,y:0}],idFactory:ids()});
 const road=a.roads[0], handles=roadHandles(a,road.id);
 assert.equal(handles.length,3);
 assert.equal(handles.filter(h=>h.kind==="node").length,2);
 assert.deepEqual(nearestRoadHandle(a,road.id,{x:50,y:20}).kind,"bend");
 assert.equal(nearestRoadHandle(a,road.id,{x:500,y:500}),null);
 assert.deepEqual(nearestRoadEdge(a,road.id,{x:25,y:10}),{
  kind:"insert-bend",segmentId:a.segments[0].id,edgeIndex:0,x:25,y:10
 });
});
test("a connected road's shared node gets only one draggable handle",()=>{
 const a=addRoad(createEmptyAtlas(),{points:[{x:0,y:0},{x:100,y:0}],idFactory:ids()});
 const b=addRoad(a,{points:[{x:50,y:3},{x:50,y:100}],idFactory:ids(100)});
 assert.equal(roadHandles(b,b.roads[0].id).length,3);
 assert.equal(roadHandles(b,b.roads[1].id).length,2);
});
