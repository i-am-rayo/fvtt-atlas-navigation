import test from "node:test";
import assert from "node:assert/strict";
import { moveRoutingRegion,orderedRoutingRegions } from "../scripts/navigation-terrain.js";
import { buildNavigationSteps,navigationDirection } from "../scripts/navigation-instructions.js";
import { clipNavigationSpline } from "../scripts/navigation-curvature.js";

test("drag reorder is scene-wide, stable, and moves above/below",()=>{
  const entries=[{id:"a",priority:10},{id:"b",priority:20},{id:"c",priority:0}];
  assert.deepEqual(orderedRoutingRegions(entries).map(x=>x.id),["b","a","c"]);
  assert.deepEqual(moveRoutingRegion(entries,null,"c","b"),["c","b","a"]);
  assert.deepEqual(moveRoutingRegion(entries,null,"b","c"),["a","c","b"]);
  assert.throws(()=>orderedRoutingRegions(entries,["b","b"]),/invalid/);
});
test("eight compass directions match image-local north",()=>{
  const start={x:0,y:0};
  for(const [x,y,name] of [[0,-1,"north"],[1,-1,"northeast"],[1,0,"east"],
    [1,1,"southeast"],[0,1,"south"],[-1,1,"southwest"],[-1,0,"west"],[-1,-1,"northwest"]]){
    assert.equal(navigationDirection([start,{x,y}]),name);
  }
});
test("route instructions split terrain and remove zero-distance sections",()=>{
  const legs=[{kind:"road",roadId:"one",distance:30,points:[{x:0,y:0},{x:30,y:0}],
    terrainSlices:[{terrain:"Dirt",distance:20,multiplier:1},{terrain:"Stone",distance:10,multiplier:.75}]},
    {kind:"road",roadId:"one",distance:0,points:[{x:0,y:0},{x:0,y:0}]}];
  const steps=buildNavigationSteps(legs,id=>id);
  assert.equal(steps.length,2);
  assert.equal(steps[0].terrain,"Dirt");assert.equal(steps[1].terrain,"Stone");
  assert.match(steps[0].instruction,/east/);
});
test("directions retain native Region names and do not merge distinct Regions",()=>{
  const legs=[{kind:"road",roadId:"bridge-road",distance:30,
    points:[{x:0,y:0},{x:30,y:0}],terrainSlices:[
      {regionId:"dirt",regionName:"Dirwest Approach",terrain:"Dirt Road",distance:10,multiplier:1},
      {regionId:"bridge",regionName:"Millstone-Dirwest Northern Bridge",terrain:"Stone Road",distance:15,multiplier:.75},
      {regionId:"other-stone",regionName:"Western Stone Path",terrain:"Stone Road",distance:5,multiplier:.75}
    ]}];
  const steps=buildNavigationSteps(legs,id=>id);
  assert.equal(steps.length,3);
  assert.equal(steps[1].regionName,"Millstone-Dirwest Northern Bridge");
  assert.equal(steps[1].distance,15);
  assert.equal(steps[2].regionName,"Western Stone Path");
});
test("selected navigation route clips the road's already-smoothed shape",()=>{
  const curve=[{x:0,y:0},{x:25,y:-10},{x:50,y:-12},{x:75,y:-5},{x:100,y:0}];
  const clipped=clipNavigationSpline(curve,{x:25,y:-10},{x:75,y:-5});
  assert.equal(clipped.length,3);
  assert.deepEqual(clipped[1],curve[2]);
});
