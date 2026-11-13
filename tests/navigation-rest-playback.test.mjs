import assert from "node:assert/strict";
import test from "node:test";
import {visualRestDurationMs,createVisualRestHold}
  from "../scripts/navigation-rest-playback.js";

test("rest presentation uses the visual travel speed without changing game hours",()=>{
  assert.equal(visualRestDurationMs(8,4),32000);
  assert.equal(visualRestDurationMs(16,30),480000);
  assert.equal(visualRestDurationMs(1,0.5),500);
  assert.throws(()=>visualRestDurationMs(-1,2),/valid hours/);
  assert.throws(()=>visualRestDurationMs(8,100),/valid hours/);
});

test("a rest hold resolves once on completion or cancellation",async()=>{
  let callback,cleared=[];
  const schedule=(fn,ms)=>{callback=fn;assert.equal(ms,32000);return 11;};
  const cancelTimer=id=>cleared.push(id);
  const a=createVisualRestHold(32000,{schedule,cancelTimer});
  callback();
  assert.equal(await a.finished,true);
  a.cancel();
  assert.deepEqual(cleared,[],"a finished timer has nothing to cancel");
  const b=createVisualRestHold(32000,{schedule,cancelTimer});
  b.cancel();b.cancel();
  assert.equal(await b.finished,false);
  assert.deepEqual(cleared,[11],"cancel is idempotent");
});
