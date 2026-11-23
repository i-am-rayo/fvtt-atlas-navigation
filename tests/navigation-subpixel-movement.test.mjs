import test from "node:test";
import assert from "node:assert/strict";
import {hasNativePixelDisplacement,coalesceSubpixelTravelChunks,
  planGuidedTravelChunks} from "../scripts/navigation-movement-lifecycle.js";
import {planNativeCheckpointPath} from "../scripts/navigation-native-movement-plan.js";
import {GuidedTravelDayTracker,splitGuidedChunkAtDistance}
  from "../scripts/navigation-travel-day.js";
const pt=(x,y=0)=>({x,y});
const chunk=(a,b,distance=b.x-a.x)=>({waypoints:[a,b],distance});
test("subpixel day remainder is held until the next real TokenDocument move",()=>{
 const before=[chunk(pt(100),pt(100.3),.3),chunk(pt(100.3),pt(120),19.7)];
 const copy=structuredClone(before);
 const merged=coalesceSubpixelTravelChunks(before,{allowTailMerge:false});
 assert.equal(merged.length,1);
 assert.equal(merged[0].distance,20);
 assert.deepEqual(merged[0].waypoints,[pt(100),pt(100.3),pt(120)]);
 const native=planNativeCheckpointPath(merged[0].waypoints,{movementSpeed:20,
   gridSize:10,secondsPerCheckpoint:10,totalMovingHours:1});
 assert.equal(native.checkpoints.length,1);
 assert.deepEqual(native.checkpoints[0].from,pt(100));
 assert.deepEqual(native.checkpoints[0].point,pt(120));
 assert.deepEqual(before,copy,"never change approved input coordinates");
});
test("preflight absorbs terminal subpixel tail but live day split never merges backwards",()=>{
 const chunks=[chunk(pt(0),pt(20)),chunk(pt(20),pt(20.3),.3)];
 assert.equal(coalesceSubpixelTravelChunks(chunks).length,1);
 assert.equal(coalesceSubpixelTravelChunks(chunks)[0].distance,20.3);
 assert.equal(coalesceSubpixelTravelChunks(chunks,{allowTailMerge:false}),null);
 assert.equal(hasNativePixelDisplacement([pt(20.1),pt(20.4)]),false);
 assert.equal(hasNativePixelDisplacement([pt(20.1),pt(21.1)]),true);
 assert.equal(coalesceSubpixelTravelChunks([chunk(pt(0.1),pt(.3),.2)]),null,
   "an entire subpixel route cannot claim a trip without native movement");
});
test("day-limit split never grants subpixel movement or overtime implicitly",()=>{
 const full=chunk(pt(0),pt(100));
 const [day,remaining]=splitGuidedChunkAtDistance(full,99.8);
 const suffix=coalesceSubpixelTravelChunks([remaining,chunk(pt(100),pt(120))],
   {allowTailMerge:false});
 assert.equal(suffix.length,1);
 assert.ok(Math.abs(suffix[0].distance-20.2)<1e-7);
 assert.equal(coalesceSubpixelTravelChunks([remaining],
   {allowTailMerge:false}),null);
 const schedule=new GuidedTravelDayTracker({travelHours:9.2,rules:{
   dailyHours:8,overnightHours:16,longRestHours:8,shortRestHours:1,
   forcedMarch:"dnd5e"}});
 schedule.recordMovement(7.99);
 assert.throws(()=>schedule.breakChoice("continue"),/daily travel limit/);
 const early=schedule.breakChoice("continue",{allowEarly:true});
 assert.equal(early.early,true);
 schedule.applyBreak(early);
 assert.ok(schedule.availableHours>1,
   "explicit early GM decision authorizes the full ninth hour, not only 1h from 7:59");
 assert.ok(schedule.availableHours<1.02);
 assert.ok(schedule.events.some(e=>e.action==="continue"));
});
