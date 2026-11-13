import assert from "node:assert/strict";
import test from "node:test";
import {projectNavigationRealPlayback,secondsPerHourForTargetMinutes}
  from "../scripts/navigation-playback-plan.js";

const model={travelHours:35,dailyHours:8,overnightHours:16,longRestHours:8};

test("5 real minutes including 8-hour Long Rest stops derives per-trip seconds/hour",()=>{
  const speed=secondsPerHourForTargetMinutes(model,5);
  assert.ok(speed>=.5&&speed<=30);
  const result=projectNavigationRealPlayback({...model,secondsPerHour:speed});
  assert.equal(result.stops,4);
  assert.ok(Math.abs(result.fullLongRestSeconds-300)<.001);
  assert.ok(result.fullLongRestSeconds<result.fullOvernightSeconds);
  assert.equal(result.eachLongRestSeconds,8*speed);
  assert.equal(result.eachOvernightSeconds,16*speed);
});

test("real runtime projection models same 10 minute native playback cap as guided travel",()=>{
  const result=projectNavigationRealPlayback({
    travelHours:200,dailyHours:8,overnightHours:16,
    longRestHours:8,secondsPerHour:30});
  assert.equal(result.movementSeconds,600);
  assert.equal(result.stops,24);
  assert.equal(result.capped,true);
  assert.equal(result.fullLongRestSeconds,600+24*8*30);
});

test("impossible requested duration is rejected, not silently rounded or committed",()=>{
  assert.throws(()=>secondsPerHourForTargetMinutes({travelHours:1,dailyHours:8,
    overnightHours:16,longRestHours:8},5),/cannot match/);
  for(const value of [-1,0,361,Infinity,NaN])
    assert.throws(()=>secondsPerHourForTargetMinutes(model,value));
  for(const speed of [-1,31,NaN])
    assert.throws(()=>projectNavigationRealPlayback({...model,secondsPerHour:speed}));
});

test("continuous-operation or no-break trips never invent an overnight stop",()=>{
  const preview=projectNavigationRealPlayback({travelHours:36,dailyHours:null,
    overnightHours:0,longRestHours:8,secondsPerHour:2});
  assert.equal(preview.stops,0);
  assert.equal(preview.movementSeconds,72);
  assert.equal(preview.fullLongRestSeconds,72);
});
