import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyAtlas } from "../scripts/atlas-model.js";
import { createNativeRouteMeasurement, calculateSceneRoadRoute }
  from "../scripts/navigation-foundry.js";
import { defaultTravelPresets } from "../scripts/travel-preset-model.js";

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

test("small checkpoint preset Region overrides road fallback in Atlas estimates",()=>{
  const prior=globalThis.game;
  try{
    const presets=defaultTravelPresets();
    presets.presets.find(item=>item.id==="land-dirt").movementCostMultiplier=1.25;
    presets.presets.find(item=>item.id==="land-stone").movementCostMultiplier=.75;
    globalThis.game={settings:{get:()=>presets}};
    const bridge={id:"bridge",name:"Stone Bridge",behaviors:[],
      shapes:[{type:"ellipse",x:290,y:120,radiusX:25,radiusY:25}],
      getFlag:(module,key)=>key==="travelPreset"?{presetId:"land-stone"}:null};
    const regionScene={...scene,regions:{contents:[bridge]},getFlag:()=>null};
    const regionView={...view,scene:regionScene};
    const withRoad={...atlas,schemaVersion:5,checkpoints:[],
      roads:[{id:"r",name:"Road",travelPresetId:"land-dirt"}]};
    const result=calculateSceneRoadRoute(regionView,regionScene,withRoad,
      {x:0,y:0},{x:100,y:0});
    assert.equal(result.status,"ok");
    assert.equal(result.terrainAware,true);
    assert.ok(result.legs.some(leg=>leg.terrainSlices?.some(slice=>
      slice.terrain==="Stone Road"&&slice.distance>0)));
    assert.ok(result.cost<result.distance*1.25);
  }finally{globalThis.game=prior;}
});
