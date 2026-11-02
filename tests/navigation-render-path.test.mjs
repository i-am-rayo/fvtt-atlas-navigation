import assert from "node:assert/strict";
import test from "node:test";
import { navigationCanvasLegPaths } from "../scripts/navigation-render-path.js";

const point=(x,y)=>({x,y});

test("render path reuses the displayed road spline and clips to the route endpoints",()=>{
  const atlas={
    nodes:[{id:"a",...point(0,0)},{id:"b",...point(200,0)}],
    segments:[{id:"s",roadId:"r",from:"a",to:"b",via:[point(60,60),point(140,60)]}],
    roads:[{id:"r"}]
  };
  const route={legs:[{kind:"road",roadId:"r",segmentId:"s",
    points:[point(0,0),point(60,60),point(140,60),point(200,0)]}]};
  const paths=navigationCanvasLegPaths(null,atlas,route,{toCanvas:p=>p,curve:"strong"});
  assert.equal(paths.length,1);
  assert.equal(paths[0].kind,"road");
  assert.deepEqual(paths[0].points[0],point(0,0));
  assert.deepEqual(paths[0].points.at(-1),point(200,0));
  assert.ok(paths[0].points.length>route.legs[0].points.length,
    "native travel and overlay share the already-curved path");
});
