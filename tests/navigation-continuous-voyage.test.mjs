import assert from "node:assert/strict";
import test from "node:test";
import {GuidedTravelDayTracker} from "../scripts/navigation-travel-day.js";
import {requestPassengerRest,canRequestPassengerRest,confirmPassengerRest,beginPassengerRestMetadata,
  recoverPassengerRestRequest,validatePassengerRestMetadata}
  from "../scripts/navigation-passenger-rest.js";
import {isJourneyDestinationCheckpoint,isRepeatedArrivalCheckpoint}
  from "../scripts/navigation-checkpoint-terminal.js";
import {restoreApprovedTransportPlan}
  from "../scripts/navigation-transport-recovery.js";
import {prepareGuidedTransportLeg}
  from "../scripts/navigation-guided-transport-leg.js";
import {createJourneyRecord,checkpointJourneyRecord,formatJourneyJournalHTML,
  resumeJourneyRecord,isUnfinishedJourneyLeg,journeyRecoveryRouteDestination}
  from "../scripts/navigation-journey-journal.js";

const p=(x,y)=>({x,y});
const rules={dailyHours:null,overnightHours:0,shortRestHours:1,longRestHours:8,
  forcedMarch:"custom"};
const schedule=()=>new GuidedTravelDayTracker({travelHours:47.74,rules});
const method={id:"ship-passage",name:"Ship passage (hired)",kind:"vehicle",
  surface:"water",continuousEnabled:true};
const route=()=>({status:"ok",start:p(48,0),end:p(100,0),distance:52,
  cost:52,terrainAware:false,legs:[{
    kind:"road",roadId:"water-road",points:[p(48,0),p(100,0)],
    distance:52,cost:52}]});
const projected=()=>({schemaVersion:1,hasTransitions:false,
  legs:[{index:0,surface:"water",firstRouteLeg:0,lastRouteLeg:0,
    start:p(48,0),end:p(100,0),distance:52,weightedDistance:52,
    roadIds:["water-road"],roadNames:["Dirwest-Hearth's Heart"],
    departureCheckpoint:null,
    arrivalCheckpoint:{id:"hearth-dock",name:"Hearth's Heart Dock"},
    transferValid:true}]});
const itinerary=(transport)=>({
  schemaVersion:1,scene:{name:"Caelthor",units:"mi"},
  endpoints:{departure:p(0,0),destination:p(100,0)},
  measurements:{distance:100,travelHours:50,terrainAware:false},
  travel:{speedPerHour:2},directions:[{
    instruction:"Sail to Hearth's Heart Dock",distance:100,cost:100,
    kind:"road",terrain:"Calm Ocean",roadId:"water-road"}],
  transport
});
const voyage=()=>createJourneyRecord({sceneId:"scene",tokenId:"party",
  atlasRevision:3,itinerary:itinerary({
    methodId:method.id,methodName:method.name,kind:"vehicle",arrangement:"hire",
    surface:"water",departureCheckpointName:"Port Barthos",
    arrivalCheckpointId:"hearth-dock",arrivalCheckpointName:"Hearth's Heart Dock",
    roadNames:["Dirwest-Hearth's Heart"],estimatedFareCp:300,
    operation:"continuous",continuation:false
  })});

test("continuous operation crosses 8h and 24h without forced stops",()=>{
  const day=schedule();
  assert.equal(day.availableHours,Infinity);
  assert.equal(day.needsDecision,false);
  day.recordMovement(8);
  assert.equal(day.needsDecision,false);
  day.recordMovement(20);
  assert.equal(day.needsDecision,false);
  assert.equal(day.completedHours,28);
  assert.equal(day.todayHours,4,"persisted day state wraps at 24h");
  assert.equal(day.estimate.overnights,0);
  assert.equal(day.estimate.totalHours,47.74);
  assert.equal(day.breakHours,0);
});

test("passenger rests overlap confirmed sailing; no extra downtime is created",()=>{
  const day=schedule();
  day.recordMovement(8);
  const request=requestPassengerRest(day,"long");
  assert.equal(confirmPassengerRest(day,request),null);
  day.recordMovement(4);
  assert.equal(confirmPassengerRest(day,request),null);
  day.recordMovement(4);
  const completed=confirmPassengerRest(day,request);
  assert.equal(completed.action,"long-underway");
  assert.equal(completed.atHours,16);
  assert.equal(day.breakHours,0);
  assert.equal(day.estimate.totalHours,47.74);
  const saved=checkpointJourneyRecord(voyage(),{schedule:day,
    status:"interrupted",progress:30,worldTravelSeconds:16*3600,
    worldRestSeconds:0});
  const html=formatJourneyJournalHTML(saved);
  assert.match(html,/Long Rest Aboard/);
  assert.match(html,/8h resting while underway/);
  assert.match(html,/confirmed downtime: 0m/);
  assert.match(html,/World time recorded: 16h/);
  assert.equal(saved.legs[0].transport.operation,"continuous");
  assert.throws(()=>requestPassengerRest(day,"overnight"),/continuous voyage/);
});

test("shipboard rest controls unlock after eight confirmed hours when sailing remains",()=>{
  const day=schedule();
  day.recordMovement(22+41/60);
  assert.equal(canRequestPassengerRest(day,null,"long"),true);
  let pending=requestPassengerRest(day,"long");
  assert.equal(canRequestPassengerRest(day,pending,"long"),false);
  assert.equal(canRequestPassengerRest(day,pending,"short"),false);
  day.recordMovement(7);
  assert.equal(confirmPassengerRest(day,pending),null);
  assert.equal(canRequestPassengerRest(day,pending,"long"),false);
  day.recordMovement(1);
  assert.equal(confirmPassengerRest(day,pending)?.action,"long-underway");
  pending=null; // The controller clears this lock after saving the rest event.
  assert.ok(day.remainingHours>17&&day.remainingHours<17.1);
  assert.equal(canRequestPassengerRest(day,pending,"long"),true);
  assert.equal(canRequestPassengerRest(day,pending,"short"),true);
  pending=requestPassengerRest(day,"short");
  assert.equal(canRequestPassengerRest(day,pending,"long"),false);
  day.recordMovement(1);
  assert.equal(confirmPassengerRest(day,pending)?.action,"short-underway");
  pending=null;
  assert.equal(canRequestPassengerRest(day,pending,"long"),true);
  assert.equal(day.breakHours,0,"passenger rests never double-credit World time");
});

test("shipboard rest buttons refuse a new rest when sailing is too short",()=>{
  const day=schedule();
  day.recordMovement(41);
  assert.equal(canRequestPassengerRest(day,null,"long"),false);
  assert.equal(canRequestPassengerRest(day,null,"short"),true);
  day.recordMovement(6);
  assert.equal(canRequestPassengerRest(day,null,"short"),false);
  assert.equal(canRequestPassengerRest(day,null,"long"),false);
  assert.equal(canRequestPassengerRest(day,null,"overnight"),false);
});

test("recovery reuses confirmed vessel and checkpoint without another fare",()=>{
  const prior=voyage(),day=schedule();
  day.recordMovement(24);
  const saved=checkpointJourneyRecord(prior,{schedule:day,
    progress:48,status:"interrupted",worldTravelSeconds:24*3600});
  const plan=restoreApprovedTransportPlan(route(),projected(),saved,[method]);
  assert.equal(plan.hasTransitions,true);
  assert.equal(plan.legs[0].selectedOption.method.id,method.id);
  assert.equal(plan.legs[0].selectedOption.arrangement,"hire");
  assert.equal(plan.legs[0].operation,"continuous");
  assert.equal(plan.legs[0].costCp,0);
  assert.equal(plan.totalElapsedHours,26);
  const leg=prepareGuidedTransportLeg(route(),plan.legs[0]);
  assert.equal(leg.end.x,100);
  assert.equal(leg.transport.continuation,true);
  assert.equal(leg.transport.operation,"continuous");
  assert.equal(leg.transport.estimatedFareCp,0);
  const second=itinerary(leg.transport);
  const continued=resumeJourneyRecord(saved,{itinerary:second,atlasRevision:3});
  assert.equal(continued.legs.length,2);
  assert.equal(continued.legs[0].transport.estimatedFareCp,300);
  assert.equal(continued.legs[1].transport.estimatedFareCp,0);
  assert.match(formatJourneyJournalHTML(
    checkpointJourneyRecord(continued,{schedule:{
      ...day,completedHours:2,events:[],todayHours:2},
      status:"interrupted",progress:3,worldTravelSeconds:2*3600})),
    /continued aboard Ship passage/);
});

test("recovery rejects altered checkpoints, surfaces or retired methods",()=>{
  const day=schedule();day.recordMovement(8);
  const saved=checkpointJourneyRecord(voyage(),{schedule:day,
    progress:16,status:"interrupted"});
  const invalid=projected();
  invalid.legs[0].arrivalCheckpoint={id:"different-port",name:"Other"};
  assert.throws(()=>restoreApprovedTransportPlan(route(),invalid,saved,[method]),
    /approved checkpoint/);
  const wrong=projected();
  wrong.legs[0].surface="land";
  assert.throws(()=>restoreApprovedTransportPlan(route(),wrong,saved,[method]),
    /approved checkpoint/);
  assert.throws(()=>restoreApprovedTransportPlan(route(),projected(),saved,[]),
    /no longer compatible/);
  assert.equal(restoreApprovedTransportPlan(route(),projected(),
    {...saved,status:"completed"},[method]),null);
});

test("legacy saved voyages can explicitly restore continuous crew operation",()=>{
  const day=schedule();day.recordMovement(8);
  const legacy=checkpointJourneyRecord(voyage(),{
    schedule:day,status:"interrupted",progress:16});
  delete legacy.legs[0].transport.operation;
  const standardMethod={...method,continuousEnabled:false};
  const normal=restoreApprovedTransportPlan(route(),projected(),legacy,
    [standardMethod]);
  assert.equal(normal.legs[0].operation,"normal");
  assert.equal(normal.legs[0].operation,"normal");
  const approved=restoreApprovedTransportPlan(route(),projected(),legacy,
    [standardMethod],"continuous");
  assert.equal(approved.legs[0].operation,"continuous");
  assert.equal(approved.totalElapsedHours,26);
  assert.equal(approved.legs[0].selectedOption.method.continuousEnabled,true);
  assert.throws(()=>restoreApprovedTransportPlan(route(),projected(),legacy,
    [standardMethod],"overtime"),/operating override is unavailable/);
  const savedNew=checkpointJourneyRecord(voyage(),{
    schedule:day,status:"interrupted",progress:16});
  assert.throws(()=>restoreApprovedTransportPlan(route(),projected(),savedNew,
    [standardMethod],"continuous"),/operating override is unavailable/);
});

test("unfinished long rest survives native canvas interruption and Journal recovery",()=>{
  const day=schedule(),record=voyage();
  day.recordMovement(6);
  const requested=requestPassengerRest(day,"long");
  record.passengerRest=beginPassengerRestMetadata(record,day,requested);
  assert.deepEqual(record.passengerRest,{action:"long",hours:8,
    startedAtMovingHours:6});
  day.recordMovement(5);
  const interrupted=checkpointJourneyRecord(record,{schedule:day,
    status:"interrupted",progress:20,
    worldTravelSeconds:11*3600,worldRestSeconds:0});
  const pendingHtml=formatJourneyJournalHTML(interrupted);
  assert.match(pendingHtml,/Passenger rest aboard underway/);
  assert.match(pendingHtml,/3h of sailing time remaining/);
  const continuation=resumeJourneyRecord(interrupted,{itinerary:itinerary(
    interrupted.legs[0].transport),atlasRevision:3});
  const resumed=schedule();
  const held=recoverPassengerRestRequest(continuation,resumed);
  assert.equal(held.startHours,-5);
  assert.equal(held.hours,8);
  assert.equal(canRequestPassengerRest(resumed,held,"long"),false,
    "the recovered pending rest keeps both rest actions locked");
  assert.equal(canRequestPassengerRest(resumed,held,"short"),false);
  assert.equal(confirmPassengerRest(resumed,held),null);
  resumed.recordMovement(2);
  assert.equal(confirmPassengerRest(resumed,held),null);
  assert.equal(canRequestPassengerRest(resumed,held,"long"),false);
  resumed.recordMovement(1);
  const event=confirmPassengerRest(resumed,held);
  assert.equal(event.action,"long-underway");
  assert.equal(event.atHours,3);
  assert.equal(event.continuedFromEarlierLeg,true);
  continuation.passengerRest=null;
  assert.equal(canRequestPassengerRest(resumed,null,"long"),true,
    "completed recovered rests must release the availability lock");
  const completed=checkpointJourneyRecord(continuation,{schedule:resumed,
    status:"interrupted",progress:6,worldTravelSeconds:3*3600});
  assert.doesNotMatch(formatJourneyJournalHTML(completed),
    /Passenger rest aboard underway/);
  assert.match(formatJourneyJournalHTML(completed),/Long Rest Aboard/);
  assert.equal(completed.legs[0].worldTravelSeconds,11*3600);
  assert.equal(completed.legs[1].worldTravelSeconds,3*3600);
  assert.equal(completed.legs[0].worldRestSeconds,0);
  assert.equal(completed.legs[1].worldRestSeconds,0);
  assert.throws(()=>validatePassengerRestMetadata({
    action:"long",hours:-1,startedAtMovingHours:2}),/Invalid/);
});

test("destination checkpoint guard stops repeated 0.07-mi legs",()=>{
  const record=voyage();
  record.status="paused";
  record.legs.at(-1).completedPercent=100;
  const destination={id:"hearth-dock",name:"Hearth's Heart Dock",
    point:p(100,0)};
  assert.equal(isJourneyDestinationCheckpoint(record,destination,100),true);
  assert.equal(isJourneyDestinationCheckpoint(record,{
    ...destination,id:"another-checkpoint"},100),false);
  assert.equal(isJourneyDestinationCheckpoint({
    ...record,destination:p(250,0)},destination,100),false);
  assert.equal(isJourneyDestinationCheckpoint({
    ...record,status:"interrupted"},destination,100),false);
  assert.equal(isJourneyDestinationCheckpoint({
    ...record,legs:[{...record.legs.at(-1),completedPercent:99}]},
    destination,100),false);
  // A separate onshore destination only 20% of a grid cell away must still
  // offer Continue, even though the old 75% snap radius called it "complete".
  assert.equal(isJourneyDestinationCheckpoint({
    ...record,destination:p(120,0)},destination,100),false);
  assert.equal(isJourneyDestinationCheckpoint({
    ...record,destination:p(108,0)},destination,100),true,
    "small marker-click offsets should still count as the dock itself");
});

test("completed water arrivals cannot be booked as the next arrival again",()=>{
  const saved=voyage();
  saved.status="paused";
  saved.legs.at(-1).completedPercent=100;
  const dock={id:"hearth-dock",name:"Hearth's Heart Dock",point:p(100,0)};
  assert.equal(isRepeatedArrivalCheckpoint(saved,dock),true);
  assert.equal(isRepeatedArrivalCheckpoint({...saved,
    destination:p(120,0)},dock),true,
  "even a separate nearby Point B cannot justify rebooking the same dock");
  assert.equal(isRepeatedArrivalCheckpoint(saved,{id:"next-port"}),false,
  "travel to a different named checkpoint is still permitted");
  assert.equal(isRepeatedArrivalCheckpoint({...saved,status:"interrupted"},dock),false);
  assert.equal(isRepeatedArrivalCheckpoint({...saved,legs:[{
    ...saved.legs.at(-1),completedPercent:60}]},dock),false);
  assert.equal(isRepeatedArrivalCheckpoint(null,dock),false);
});

test("checkpoint arrival restores original Point B after recovered ship leg",()=>{
  const day=schedule(),saved=voyage();
  saved.destination=p(120,0); // a short, separate land leg after the dock
  day.recordMovement(24);
  const interrupted=checkpointJourneyRecord(saved,{schedule:day,
    progress:48,status:"interrupted",worldTravelSeconds:24*3600});
  assert.deepEqual(journeyRecoveryRouteDestination(interrupted),p(100,0),
    "while underway the safe movement target is the approved dock");
  const resumed=resumeJourneyRecord(interrupted,{atlasRevision:3,
    itinerary:itinerary({...interrupted.legs.at(-1).transport,
      estimatedFareCp:0,continuation:true}),
    journeyDestination:null});
  assert.deepEqual(resumed.destination,p(120,0),
    "resuming cannot replace the original Point B");
  const last=resumed.legs.at(-1);
  last.completedMovingHours=last.movingHours;
  last.completedPercent=100;
  resumed.status="paused";
  const restoredPointB=journeyRecoveryRouteDestination(resumed);
  assert.deepEqual(restoredPointB,p(120,0),
    "at arrival the Navigation decision target must revert to final Point B");
  assert.equal(isJourneyDestinationCheckpoint({...resumed,
    destination:restoredPointB},{
    id:"hearth-dock",name:"Hearth's Heart Dock",point:p(100,0)},100),false,
    "short land continuation may not be hidden by a broad snap tolerance");
});


test("interrupted multi-surface voyage recovers current ship checkpoint, not final Point B",()=>{
  const day=schedule(),original=voyage();
  // The final Point B is inland beyond the approved water-leg checkpoint.
  original.destination=p(155,0);
  day.recordMovement(14);
  const passengerRest=requestPassengerRest(day,"long");
  original.passengerRest=beginPassengerRestMetadata(original,day,passengerRest);
  day.recordMovement(1);
  const saved=checkpointJourneyRecord(original,{schedule:day,
    status:"interrupted",progress:31,worldTravelSeconds:15*3600,
    worldRestSeconds:0});
  assert.equal(isUnfinishedJourneyLeg(saved),true);
  assert.deepEqual(journeyRecoveryRouteDestination(saved),p(100,0));
  assert.deepEqual(saved.destination,p(155,0));
  assert.equal(saved.passengerRest.startedAtMovingHours,14);
  assert.match(formatJourneyJournalHTML(saved),/7h of sailing time remaining/);

  // The old behavior routed to 155 and failed the one-checkpoint guard.
  const unsafeRoute={...route(),end:p(155,0)};
  assert.throws(()=>restoreApprovedTransportPlan(unsafeRoute,projected(),
    saved,[method]),/approved checkpoint/);
  const approved=restoreApprovedTransportPlan(route(),projected(),saved,[method]);
  assert.equal(approved.legs[0].selectedOption.method.id,"ship-passage");
  assert.equal(approved.legs[0].selectedOption.arrangement,"hire");
  assert.equal(approved.legs[0].operation,"continuous");
  assert.equal(approved.legs[0].costCp,0);
  const resumedLeg=prepareGuidedTransportLeg(route(),approved.legs[0]);
  const resumed=resumeJourneyRecord(saved,{
    itinerary:itinerary(resumedLeg.transport),atlasRevision:3,
    journeyDestination:isUnfinishedJourneyLeg(saved)?null:
      journeyRecoveryRouteDestination(saved)});
  assert.deepEqual(resumed.destination,p(155,0),
    "resuming the approved ship leg must retain the original Point B");
  assert.equal(resumed.legs.length,2);
  assert.equal(resumed.legs[1].transport.estimatedFareCp,0);
  assert.deepEqual(resumed.passengerRest,saved.passengerRest);
  const recoverySchedule=schedule();
  const pending=recoverPassengerRestRequest(resumed,recoverySchedule);
  assert.equal(pending.hours,8);
  assert.equal(pending.startHours,-1);
  assert.equal(confirmPassengerRest(recoverySchedule,pending),null);
  assert.equal(resumed.legs[0].worldTravelSeconds,15*3600);
  assert.equal(resumed.legs[0].worldRestSeconds,0);
});

test("completed checkpoint legs return original Point B for onward planning",()=>{
  const record=voyage();
  record.destination=p(155,0);
  record.status="paused";
  record.legs[0].completedPercent=100;
  record.legs[0].completedMovingHours=record.legs[0].movingHours;
  assert.equal(isUnfinishedJourneyLeg(record),false);
  assert.deepEqual(journeyRecoveryRouteDestination(record),p(155,0));
  assert.deepEqual(journeyRecoveryRouteDestination(voyage()),p(100,0),
    "legacy single-destination voyages retain their existing behavior");
  assert.throws(()=>journeyRecoveryRouteDestination({
    ...record,sceneId:""}),/invalid recovery metadata/);
});

