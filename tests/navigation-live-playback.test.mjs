import assert from "node:assert/strict";
import test from "node:test";
import {liveJourneyPlayback,canAdjustLiveJourneyVisuals,
  expectedAdditionalTravelBreaks} from "../scripts/navigation-live-playback.js";

const base={travelHours:20,movementSpeed:.4,durationSeconds:160};
test("9–30 seconds/hour actually changes the speed passed to the next native move",()=>{
  const slow=liveJourneyPlayback(base,30);
  const earlier=liveJourneyPlayback(base,8);
  assert.equal(slow.secondsPerHour,30);
  assert.equal(slow.durationSeconds,600);
  assert.ok(slow.movementSpeed<earlier.movementSpeed);
  assert.equal(slow.animate,true);
  assert.equal(earlier.durationSeconds,160);
  assert.equal(liveJourneyPlayback(base,9).durationSeconds,180);
  assert.equal(liveJourneyPlayback(base,15).durationSeconds,300);
  assert.equal(liveJourneyPlayback(base,30,{skip:true}).animate,false);
  for(const invalid of [0,-1,31,Infinity,NaN])
    assert.throws(()=>liveJourneyPlayback(base,invalid));
});

test("in-flight continuous native v14 movement cannot be rescaled or skipped",()=>{
  const session={phase:"moving",nativeActive:false,
    schedule:{travelHours:24,completedHours:3,rules:{dailyHours:8}}};
  assert.equal(canAdjustLiveJourneyVisuals(session),true);
  assert.equal(expectedAdditionalTravelBreaks(session),2);
  session.nativeActive=true;
  assert.equal(canAdjustLiveJourneyVisuals(session),false);
  session.nativeActive=false;
  session.transportLeg={transport:{operation:"continuous"}};
  assert.equal(canAdjustLiveJourneyVisuals(session),false);
  session.transportLeg=null;session.phase="rest-error";
  assert.equal(canAdjustLiveJourneyVisuals(session),false);
  assert.equal(canAdjustLiveJourneyVisuals(null),false);
});
