import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyAtlas } from "../scripts/atlas-model.js";
import { createNativeRouteMeasurement, calculateSceneRoadRoute }
  from "../scripts/navigation-foundry.js";

const scene = {id:"scene",grid:{type:1,size:100,distance:5,units:"km"}};
const atlas = {
  ...createEmptyAtlas(), enabled:true,
  nodes:[{id:"a",x:0,y:0},{id:"b",x:100,y:0}],
  roads:[{id:"r",name:"Road"}],
  segments:[{id:"ab",roadId:"r",from:"a",to:"b",via:[],bidirectional:true}]
};
const view = {
  ready:true,scene,
  dimensions:{sceneX:240,sceneY:120},
  grid:{measurePath(points) {
    return {distance:points.slice(1).reduce((sum,p,i) =>
      sum+Math.hypot(p.x-points[i].x,p.y-points[i].y)/20,0)};
  }}
};

test("Foundry measurement adapter handles Scene image origin/padding",()=>{
  const called = [];
  const mock = {...view,grid:{measurePath(points){
    called.push(points);
    return {distance:12.5};
  }}};
  const measure = createNativeRouteMeasurement(mock,scene,atlas);
  assert.equal(measure([{x:0,y:0},{x:100,y:0}]),12.5);
  assert.deepEqual(called[0],[{x:240,y:120},{x:340,y:120}]);
});

test("Scene wrapper routes with native unit distances, without writing Atlas flags",()=>{
  const before=JSON.stringify(atlas);
  const result=calculateSceneRoadRoute(view,scene,atlas,{x:20,y:10},{x:80,y:10});
  assert.equal(result.status,"ok");
  assert.equal(result.distance,4);
  assert.equal(JSON.stringify(atlas),before);
});

test("Foundry adapter rejects absent or invalid Grid measurement",()=>{
  assert.throws(()=>createNativeRouteMeasurement({...view,ready:false},scene,atlas),/Open the Scene/);
  assert.throws(()=>createNativeRouteMeasurement({...view,scene:{id:"wrong"}},scene,atlas),/Open the Scene/);
  const invalid={...view,grid:{measurePath:()=>({distance:NaN})}};
  assert.throws(()=>createNativeRouteMeasurement(invalid,scene,atlas)
    ([{x:0,y:0},{x:10,y:0}]),/could not measure/);
});
