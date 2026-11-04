import assert from "node:assert/strict";
import test from "node:test";
import {GuidedTravelDayTracker} from "../scripts/navigation-travel-day.js";
import {requestPassengerRest,confirmPassengerRest}
  from "../scripts/navigation-passenger-rest.js";
import {restoreApprovedTransportPlan}
  from "../scripts/navigation-transport-recovery.js";
import {prepareGuidedTransportLeg}
  from "../scripts/navigation-guided-transport-leg.js";
import {createJourneyRecord,checkpointJourneyRecord,formatJourneyJournalHTML,
  resumeJourneyRecord} from "../scripts/navigation-journey-journal.js";

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
