import assert from "node:assert/strict";
import test from "node:test";
import { resolveNavigationMethodTravel,assessNavigationMethodRoute,
  NAVIGATION_MOUNTED_SPEED_SETTING,NAVIGATION_SAILING_SPEED_SETTING }
  from "../scripts/navigation-travel-method.js";

const walking={speed:5,actorName:"The Party",pace:"normal",
  source:"party",hoursPerDay:8,mode:"land"};
const settings={get(_module,key){return {
  [NAVIGATION_MOUNTED_SPEED_SETTING]:12.5,
  [NAVIGATION_SAILING_SPEED_SETTING]:7.25
}[key];}};
const atlas={roads:[
  {id:"land",travelPresetId:null},
  {id:"water",travelPresetId:"water-river"},
  {id:"air",travelPresetId:"air-clear"},
  {id:"missing",travelPresetId:"removed"}
]};
const presets=[{id:"water-river",mode:"water"},{id:"air-clear",mode:"air"}];
const route=(...ids)=>({status:"ok",legs:ids.map(roadId=>({kind:"road",roadId}))});

test("walking reads the existing Group Actor travel pace without changing it",()=>{
  const result=resolveNavigationMethodTravel("walking",walking,settings,"km");
  assert.equal(result.speed,5);
  assert.equal(result.hoursPerDay,8);
  assert.equal(result.source,"party");
  assert.equal(result.methodId,"walking");
  assert.deepEqual(walking,{speed:5,actorName:"The Party",pace:"normal",
    source:"party",hoursPerDay:8,mode:"land"});
});

test("mounted and sailing use GM-set speeds, independent of Group Actor pace",()=>{
  const horse=resolveNavigationMethodTravel("mounted",walking,settings,"km");
  const ship=resolveNavigationMethodTravel("sailing",walking,settings,"mi");
  assert.equal(horse.speed,12.5*1.609344);
  assert.equal(ship.speed,7.25);
  assert.equal(horse.hoursPerDay,null);
  assert.equal(ship.hoursPerDay,null);
  assert.equal(horse.source,"atlas-method");
  assert.equal(ship.mode,"water");
  assert.equal(resolveNavigationMethodTravel("sailing",walking,{},"mi").speed,2);
  assert.equal(resolveNavigationMethodTravel("mounted",walking,{},"km").speed,3*1.609344);
  assert.throws(()=>resolveNavigationMethodTravel("mounted",walking,
    {get:()=>0},"mi"),/speed/i);
  assert.throws(()=>resolveNavigationMethodTravel("mounted",walking,settings,"leagues"),/miles or kilometers/);
  assert.throws(()=>resolveNavigationMethodTravel("flying",walking,settings,"mi"),/Unknown/);
});

test("surface checks fail closed on cross-category and dangling-preset routes",()=>{
  assert.equal(assessNavigationMethodRoute("mounted",route("land"),atlas,presets).compatible,true);
  assert.equal(assessNavigationMethodRoute("sailing",route("water"),atlas,presets).compatible,true);
  assert.equal(assessNavigationMethodRoute("sailing",route("water"),atlas,presets).guided,false);
  assert.match(assessNavigationMethodRoute("sailing",route("land"),atlas,presets).reason,/water/);
  assert.equal(assessNavigationMethodRoute("mounted",route("land","water"),atlas,presets).compatible,false);
  assert.equal(assessNavigationMethodRoute("sailing",route("water","air"),atlas,presets).compatible,false);
  assert.match(assessNavigationMethodRoute("mounted",route("missing"),atlas,presets).reason,/unknown/);
  assert.equal(assessNavigationMethodRoute("walking",route("land","water"),atlas,presets).guided,true,
    "legacy walking routes stay navigable");
  assert.equal(assessNavigationMethodRoute("sailing",null,atlas,presets).compatible,false);
});
