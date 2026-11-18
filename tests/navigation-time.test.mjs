import test from "node:test";
import assert from "node:assert/strict";
import {validateNavigationSpeed,navigationHours,formatNavigationDuration}
  from "../scripts/navigation-time.js";

test("global and route speed support system-neutral Scene units per hour",()=>{
  assert.equal(navigationHours(20,5),4);
  assert.equal(navigationHours(20,10),2);
  assert.equal(formatNavigationDuration(2.75),"2h 45m");
  assert.equal(formatNavigationDuration(0),"0m");
});
test("invalid speed and distance fail closed",()=>{
  assert.throws(()=>validateNavigationSpeed(0),/speed/);
  assert.throws(()=>validateNavigationSpeed(-1),/speed/);
  assert.throws(()=>validateNavigationSpeed(Infinity),/speed/);
  assert.throws(()=>navigationHours(NaN,5),/distance/);
  assert.throws(()=>navigationHours(-2,5),/distance/);
});
