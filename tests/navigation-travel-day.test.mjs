import assert from "node:assert/strict";
import test from "node:test";
import { estimateNavigationTotalTrip,GuidedTravelDayTracker,
  splitGuidedChunkAtDistance } from "../scripts/navigation-travel-day.js";
import { resolveNavigationTravelRules,NAVIGATION_RULES_PROFILE_SETTING,
  CUSTOM_DAY_HOURS_SETTING,CUSTOM_OVERNIGHT_HOURS_SETTING,
  CUSTOM_SHORT_REST_HOURS_SETTING,CUSTOM_LONG_REST_HOURS_SETTING }
  from "../scripts/navigation-rules-profile.js";

const settings=(values={})=>({get:(_module,key)=>values[key]});
const dnd=()=>resolveNavigationTravelRules({settings:settings({
  [NAVIGATION_RULES_PROFILE_SETTING]:"dnd5e2024"}),systemId:"dnd5e"});

test("system-specific rules are explicit, and unknown systems do not inherit D&D limits",()=>{
  const generic=resolveNavigationTravelRules({settings:settings(),systemId:"pf2e"});
  assert.equal(generic.dailyHours,null);
  assert.equal(estimateNavigationTotalTrip(17,generic).totalHours,17);
  const system=resolveNavigationTravelRules({settings:settings(),systemId:"dnd5e",
    actorHoursPerDay:10});
  assert.equal(system.dailyHours,10,"the native D&D Group Actor allowance remains available");
  assert.equal(system.forcedMarch,"dnd5e2014");
  const rules2014=resolveNavigationTravelRules({settings:settings({
    [NAVIGATION_RULES_PROFILE_SETTING]:"dnd5e2014"}),systemId:"pf2e"});
  assert.equal(rules2014.dailyHours,8);
  const rules2024=dnd();
  assert.equal(rules2024.dailyHours,8);
  assert.equal(rules2024.forcedMarch,"dnd5e2024");
  const custom=resolveNavigationTravelRules({settings:settings({
    [NAVIGATION_RULES_PROFILE_SETTING]:"custom",
    [CUSTOM_DAY_HOURS_SETTING]:6,[CUSTOM_OVERNIGHT_HOURS_SETTING]:12,
    [CUSTOM_SHORT_REST_HOURS_SETTING]:0.5,[CUSTOM_LONG_REST_HOURS_SETTING]:10
  }),systemId:"pf2e"});
  assert.deepEqual([custom.dailyHours,custom.overnightHours,custom.shortRestHours,
    custom.longRestHours],[6,12,0.5,10]);
  assert.equal(custom.forcedMarch,"custom");
});

test("Total Trip includes full overnight downtime, not just active travel hours",()=>{
  const rules=dnd();
  const hours=17+19/60;
  const plan=estimateNavigationTotalTrip(hours,rules);
  assert.equal(plan.overnights,2);
  assert.ok(Math.abs(plan.totalHours-(49+19/60))<1e-8);
  assert.equal(estimateNavigationTotalTrip(8,rules).overnights,0);
  assert.equal(estimateNavigationTotalTrip(16,rules).overnights,1);
  assert.equal(estimateNavigationTotalTrip(10+39/60,rules).totalHours,26+39/60);
  assert.equal(estimateNavigationTotalTrip(10,rules,{completedHours:8,todayHours:8}).overnights,1);
  const afterRest=estimateNavigationTotalTrip(10,rules,{
    completedHours:8,todayHours:0,breakHours:16});
  assert.equal(afterRest.overnights,0);
  assert.equal(afterRest.totalHours,26);
  assert.equal(estimateNavigationTotalTrip(10,rules,{
    completedHours:8,todayHours:8,permittedExtraHours:2}).overnights,0);
});

test("daily travel stops exactly at its limit; short rest does not reset it",()=>{
  const day=new GuidedTravelDayTracker({travelHours:10,rules:dnd()});
  assert.equal(day.availableHours,8);
  day.recordMovement(8);
  assert.equal(day.needsDecision,true);
  const short=day.breakChoice("short");
  assert.equal(day.breakHours,0,"a proposed rest does not mutate time");
  day.applyBreak(short);
  assert.equal(day.breakHours,1);
  assert.equal(day.todayHours,8);
  assert.equal(day.needsDecision,true);
  day.applyBreak(day.breakChoice("continue"));
  assert.equal(day.availableHours,1);
  assert.deepEqual(day.recordMovement(1),{extraHour:1,dc:11,system:"dnd5e2024"});
  assert.equal(day.needsDecision,true);
  day.applyBreak(day.breakChoice("overnight"));
  assert.equal(day.todayHours,0);
  assert.equal(day.breakHours,17);
  assert.equal(day.needsDecision,false);
  day.recordMovement(1);
  assert.equal(day.completedHours,10);
  assert.equal(day.estimate.totalHours,27);
  assert.equal(day.estimate.overnights,0);
  assert.throws(()=>day.breakChoice("short"),/No daily travel break/);
});

test("custom long rest resets a day's travel but never creates Actor updates",()=>{
  const rules=resolveNavigationTravelRules({settings:settings({
    [NAVIGATION_RULES_PROFILE_SETTING]:"custom",
    [CUSTOM_DAY_HOURS_SETTING]:4,[CUSTOM_LONG_REST_HOURS_SETTING]:10,
    [CUSTOM_OVERNIGHT_HOURS_SETTING]:12
  })});
  const day=new GuidedTravelDayTracker({travelHours:6,rules});
  day.recordMovement(4);
  const long=day.breakChoice("long");
  assert.equal(long.hours,10);
  assert.equal(long.resetsDay,true);
  day.applyBreak(long);
  day.recordMovement(2);
  assert.equal(day.estimate.totalHours,16);
  assert.equal(day.restEvents,1);
  assert.equal(day.lastForcedCheck,null);
});

test("hour boundaries split visible curves without shortcuts or duplicate vertices",()=>{
  const chunk={waypoints:[{x:0,y:0},{x:5,y:0},{x:5,y:5}],distance:10};
  const [first,second]=splitGuidedChunkAtDistance(chunk,6);
  assert.deepEqual(first.waypoints,[{x:0,y:0},{x:5,y:0},{x:5,y:1}]);
  assert.deepEqual(second.waypoints,[{x:5,y:1},{x:5,y:5}]);
  assert.equal(first.distance+second.distance,10);
  const [exact,remaining]=splitGuidedChunkAtDistance(chunk,5);
  assert.deepEqual(exact.waypoints,[{x:0,y:0},{x:5,y:0}]);
  assert.deepEqual(remaining.waypoints,[{x:5,y:0},{x:5,y:5}]);
  assert.throws(()=>splitGuidedChunkAtDistance(chunk,0),/split/);
});
