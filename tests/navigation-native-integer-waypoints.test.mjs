import assert from "node:assert/strict";
import test from "node:test";
import {toNativeIntegerWaypoints} from "../scripts/navigation-movement-lifecycle.js";

test("Atlas fractional road point is quantized to public v14 integer TokenMovementWaypoint",()=>{
  const authorPoints=[
    {x:3831,y:2331},{x:3761.1443468848224,y:2346.7204791899035}
  ];
  const before=structuredClone(authorPoints);
  const result=toNativeIntegerWaypoints(authorPoints);
  assert.deepEqual(result,[{x:3831,y:2331},{x:3761,y:2347}]);
  assert.deepEqual(authorPoints,before,"authored route geometry is not mutated");
  assert.ok(result.every(p=>Number.isSafeInteger(p.x)&&Number.isSafeInteger(p.y)));
});

test("consecutive subpixel duplicates are removed without changing path endpoints",()=>{
  assert.deepEqual(toNativeIntegerWaypoints([
    {x:0,y:0},{x:0.11,y:0.21},{x:20.43,y:1.8},{x:50.41,y:3.3}
  ]),[{x:0,y:0},{x:20,y:2},{x:50,y:3}]);
});

test("subpixel-only movement fails closed and cannot earn Journal/World-time progress",()=>{
  assert.throws(()=>toNativeIntegerWaypoints([
    {x:50.2,y:100.1},{x:50.3,y:100.2}
  ]),/collapses to one pixel/);
});

test("invalid and unbounded coordinates never pass to native Document move",()=>{
  for(const waypoints of [
    null,[],[{x:0,y:0}],
    [{x:0,y:0},{x:Infinity,y:0}],
    [{x:0,y:0},{x:1e20,y:0}],
    [{x:0,y:0},{x:NaN,y:5}]
  ])assert.throws(()=>toNativeIntegerWaypoints(waypoints));
});
