import test from "node:test";
import assert from "node:assert/strict";
import { resolveRoutingRegion, regionContainsPoint, createRegionCostMeasurement,
  routingPriority } from "../scripts/navigation-terrain.js";

const square = (x,y,size) => ({type:"polygon",origin:{x,y},points:[0,0,size,0,size,size,0,size]});
test("highest routing priority overrides overlapping dirt with stone",()=>{
  const dirt={id:"dirt",priority:10,multiplier:1,shapes:[square(0,0,100)]};
  const bridge={id:"bridge",priority:20,multiplier:.75,shapes:[square(40,40,20)]};
  const cost=createRegionCostMeasurement({regions:[dirt,bridge],gridSize:10,
    toCanvasPoint:p=>p,measurePath:p=>Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y)});
  assert.equal(cost([{x:0,y:50},{x:100,y:50}]),95);
});
test("terrain slices preserve the exact native Region identity and name",()=>{
  const bridge={id:"bridge",name:"Millstone-Dirwest Northern Bridge",surface:"Stone Road",
    priority:10,multiplier:1,shapes:[square(0,0,100)]};
  const measure=createRegionCostMeasurement({regions:[bridge],gridSize:10,
    toCanvasPoint:p=>p,measurePath:()=>15});
  assert.deepEqual(measure.describe([{x:0,y:50},{x:100,y:50}]).slices,[{
    regionId:"bridge",regionName:"Millstone-Dirwest Northern Bridge",
    terrain:"Stone Road",multiplier:1,distance:15
  }]);
});
test("road default cost applies only outside higher-priority native Region coverage",()=>{
  const bridge={id:"bridge",name:"Northern Bridge",surface:"Stone Road",
    priority:10,multiplier:1.5,shapes:[square(40,0,20)]};
  const measure=createRegionCostMeasurement({regions:[bridge],gridSize:10,
    fallbackMultiplier:1.25,fallbackSurface:"Dirt Road",
    toCanvasPoint:p=>p,measurePath:()=>100});
  assert.equal(measure([{x:0,y:10},{x:100,y:10}]),130);
});
test("ties are stable and priority rejects malformed values",()=>{
  assert.equal(resolveRoutingRegion([{id:"z",priority:5},{id:"a",priority:5}]).id,"a");
  assert.equal(routingPriority(null),0);
  assert.throws(()=>routingPriority(1.25));
  assert.throws(()=>routingPriority(101));
});
test("polygon holes and ellipses use canvas coordinates",()=>{
  assert.equal(regionContainsPoint([square(100,100,20)],{x:110,y:110}),true);
  assert.equal(regionContainsPoint([square(100,100,20)],{x:10,y:10}),false);
  const generated={type:"polygon",origin:{x:100,y:100},
    points:[95,95,125,95,125,105,95,105]};
  assert.equal(regionContainsPoint([generated],{x:110,y:100}),true);
  assert.equal(regionContainsPoint([generated],{x:10,y:10}),false);
  assert.equal(regionContainsPoint([{type:"ellipse",x:10,y:10,radiusX:5,radiusY:3}],{x:12,y:11}),true);
});
test("bounded samples fail safely",()=>{
  const measure=createRegionCostMeasurement({regions:[],gridSize:10,maxSamples:2,
    toCanvasPoint:p=>p,measurePath:()=>1});
  assert.throws(()=>measure([{x:0,y:0},{x:100,y:0}]),/too long/);
});
