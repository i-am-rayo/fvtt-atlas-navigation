import assert from "node:assert/strict";
import test from "node:test";
import { GuidedJourneyClock, guidedWorldTimeSeconds, formatGuidedWorldTime,
  readNavigationWorldClockSetting,NAVIGATION_WORLD_CLOCK_SETTING }
  from "../scripts/navigation-world-clock.js";

test("World time is opt-in and never enabled by a missing or unrelated setting",()=>{
  assert.equal(readNavigationWorldClockSetting({get:()=>undefined}),false);
  assert.equal(readNavigationWorldClockSetting({get:()=>"true"}),false);
  assert.equal(readNavigationWorldClockSetting({get:()=>true}),true);
  assert.equal(readNavigationWorldClockSetting(null),false);
  assert.equal(NAVIGATION_WORLD_CLOCK_SETTING,"guidedTravelAdvanceWorldTime");
});

test("the clock ledger advances only completed movement and never double-counts it",async()=>{
  let worldTime=1000;
  const calls=[];
  const clock=new GuidedJourneyClock({travelHours:4,totalDistance:100,
    authorize:()=>true,advance:async seconds=>{
      assert.ok(Number.isSafeInteger(seconds)&&seconds>0);
      calls.push(seconds);worldTime+=seconds;return worldTime;
    }});
  assert.equal(await clock.commit(0),0);
  assert.deepEqual(calls,[]);
  assert.equal(await clock.commit(25),3600);
  assert.equal(await clock.commit(25),0,"the same distance cannot add time twice");
  assert.equal(await clock.commit(25.1),0,"tiny increments are coalesced");
  assert.equal(await clock.commit(25.1,{force:true}),14);
  assert.equal(await clock.commit(100),10786);
  assert.equal(clock.advancedSeconds,14400);
  assert.equal(calls.reduce((sum,value)=>sum+value,0),14400);
  assert.equal(await clock.commit(100,{force:true}),0);
  assert.equal(worldTime,15400);
});

test("time authorization and API failures fail closed without crediting time",async()=>{
  let permitted=false,calls=0;
  const clock=new GuidedJourneyClock({travelHours:2,totalDistance:10,
    authorize:()=>permitted,advance:async()=>{calls++;throw Error("Time write rejected");}});
  await assert.rejects(clock.commit(5),/active GM/);
  assert.equal(calls,0);
  assert.equal(clock.advancedSeconds,0);
  permitted=true;
  await assert.rejects(clock.commit(5),/Time write rejected/);
  assert.equal(calls,1);
  assert.equal(clock.advancedSeconds,0);
});

test("World time uses true hours, not display travel-days, and enforces bounds",()=>{
  assert.equal(guidedWorldTimeSeconds(16),57600);
  assert.equal(formatGuidedWorldTime(57600),"16h 0m");
  assert.equal(formatGuidedWorldTime(30),"0h 0m 30s");
  assert.throws(()=>guidedWorldTimeSeconds(Infinity),/invalid/);
  assert.throws(()=>guidedWorldTimeSeconds(0),/invalid/);
  assert.throws(()=>guidedWorldTimeSeconds(24*366),/invalid/);
  assert.throws(()=>formatGuidedWorldTime(-1),/Invalid/);
});
