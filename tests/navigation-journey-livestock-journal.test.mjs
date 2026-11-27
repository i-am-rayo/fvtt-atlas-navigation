import test from "node:test";
import assert from "node:assert/strict";
import {createJourneyRecord,validateJourneyRecord,resumeJourneyRecord,checkpointJourneyRecord,
  formatJourneyJournalHTML} from "../scripts/navigation-journey-journal.js";
import {planJourneyLivestock,projectAccompanyingLivestock}
  from "../scripts/navigation-journey-livestock.js";
import {quoteTransportationService,validateHiredServiceApproval} from "../scripts/navigation-transport-service.js";
const group={members:[
  {actorId:"riders",actorName:"Cassian",role:"passenger",actorType:"character",quantity:1},
  {actorId:"a",actorName:"Warhorse",role:"mount",actorType:"npc",
    quantity:1,enabled:true,assignedTo:null},
  {actorId:"b",actorName:"Riding Horse",role:"mount",actorType:"npc",
    quantity:2,enabled:true,assignedTo:null}
]};
const ship={methodId:"ship-passage",methodName:"Ship passage",kind:"vehicle",
  arrangement:"hire",surface:"water",departureCheckpointName:"Dock",
  arrivalCheckpointId:"port",arrivalCheckpointName:"Port Barthos",
  roadNames:["Harbor Route"],estimatedFareCp:840,operation:"normal"};
const route=(livestock,transport=ship)=>({
  schemaVersion:1,scene:{name:"Paedor",units:"mi"},
  endpoints:{departure:{x:0,y:0},destination:{x:30,y:0}},
  measurements:{distance:30,travelHours:10,terrainAware:false},
  travel:{speedPerHour:3,methodId:"walking",methodName:"Walking",
    arrangement:"owned",operation:"normal"},
  directions:[{kind:"road",instruction:"Harbor",distance:30,cost:30,roadId:"road"}],
  ...(transport?{transport}:{}),...(livestock?{livestock}:{})
});
const create=itinerary=>createJourneyRecord({sceneId:"scene",tokenId:"group",
  atlasRevision:7,itinerary});
test("approved voyage persists and renders separate physical mounts but not on unconfirmed preview",()=>{
 const livestock=planJourneyLivestock(group,{a:1,b:2},{surface:"water",
   methodId:"ship-passage",units:1,capacityPerUnit:3,fareCp:360});
 const saved=create(route(livestock));
 assert.deepEqual(validateJourneyRecord(saved).legs[0].livestock,livestock);
 assert.doesNotMatch(formatJourneyJournalHTML(saved),/Confirmed Mount Movement/);
 const seen=structuredClone(saved);
 seen.legs[0].completedMovingHours=3;
 seen.legs[0].completedPercent=30;
 const html=formatJourneyJournalHTML(seen);
 assert.match(html,/Confirmed Mount Movement/);
 assert.match(html,/Warhorse: 1 of 1 embarked/);
 assert.match(html,/Riding Horse: 2 of 2 embarked/);
 assert.match(html,/Estimated animal fare: 360 CP/);
 assert.deepEqual(saved.legs[0].livestock,livestock,
   "rendering cannot mutate approved Journal state");
 const wrong=structuredClone(saved);
 wrong.legs[0].livestock.methodId="other";
 assert.throws(()=>validateJourneyRecord(wrong),/invalid recovery metadata/);
});
test("D&D5e Journal formats fractional animal fare in payable coins without repricing history",()=>{
  const livestock=planJourneyLivestock(group,{a:1,b:2},{surface:"water",
    methodId:"ship-passage",units:1,capacityPerUnit:3,fareCp:2864.41987927043});
  const saved=create(route(livestock));
  const snapshot=structuredClone(saved);
  saved.legs[0].completedMovingHours=1;
  saved.legs[0].completedPercent=10;
  const exact=saved.legs[0].livestock.estimatedFareCp;
  const html=formatJourneyJournalHTML(saved,{systemId:"dnd5e"});
  assert.match(html,/Estimated animal fare: 2 PP · 8 GP · 1 EP · 1 SP · 5 CP/);
  assert.equal(saved.legs[0].livestock.estimatedFareCp,exact,
    "formatting only; confirmed saved quote remains exact");
  assert.equal(snapshot.legs[0].livestock.estimatedFareCp,exact);
});

test("unfinished saved voyage forbids replacement of approved mount allocations",()=>{
 const livestock=planJourneyLivestock(group,{a:1,b:0},{surface:"water",
   methodId:"ship-passage",units:1,capacityPerUnit:3});
 const saved=create(route(livestock));
 const swapped=planJourneyLivestock(group,{a:0,b:2},{surface:"water",
   methodId:"ship-passage",units:1,capacityPerUnit:3});
 assert.throws(()=>resumeJourneyRecord(saved,{atlasRevision:7,
   itinerary:route(swapped)}),/cannot change the approved livestock boarding/);
 const resumed=resumeJourneyRecord(saved,{atlasRevision:7,itinerary:route(livestock)});
 assert.deepEqual(resumed.legs[1].livestock,livestock);
 const legacy=create(route(null));
 assert.equal(validateJourneyRecord(legacy).legs[0].livestock,undefined);
 assert.throws(()=>resumeJourneyRecord(legacy,{atlasRevision:7,
   itinerary:route(livestock)}),/unapproved livestock manifest/);
});
test("onward land leg retains GM-selected physical quantities with no animal fare",()=>{
 const original=structuredClone(group);
 const traveling=projectAccompanyingLivestock(group,{a:0,b:1});
 assert.equal(traveling.members.some(m=>m.actorId==="a"),false);
 assert.equal(traveling.members.find(m=>m.actorId==="b").quantity,1);
 assert.deepEqual(group,original);
 const land=planJourneyLivestock(group,{a:0,b:1},{surface:"land",
   methodId:"walking",units:1,capacityPerUnit:null,fareCp:0});
 const saved=create(route(land,null));
 assert.deepEqual(validateJourneyRecord(saved).legs[0].livestock,land);
 const seen=structuredClone(saved);
 seen.legs[0].completedMovingHours=2;
 assert.match(formatJourneyJournalHTML(seen),/Riding Horse: 1 of 2 accompanied/);
 assert.doesNotMatch(formatJourneyJournalHTML(seen),/stalls\/vessel/);
});


test("approved land vehicle carriage is readable, immutable, and separate from land accompaniment",()=>{
 const cargo=planJourneyLivestock(group,{a:1,b:1},{surface:"land",
   carried:true,methodId:"coach-hire",units:1,capacityPerUnit:null,fareCp:50});
 const itinerary=route(cargo,null);
 itinerary.travel={...itinerary.travel,methodId:"coach-hire",
   methodName:"Coach (hired)",arrangement:"hire"};
 const rec=create(itinerary);
 assert.deepEqual(validateJourneyRecord(rec).legs[0].livestock,cargo);
 const confirmed=structuredClone(rec);
 confirmed.legs[0].completedMovingHours=1;
 const html=formatJourneyJournalHTML(confirmed);
 assert.match(html,/Warhorse: 1 of 1 carried/);
 assert.match(html,/Riding Horse: 1 of 2 carried/);
 assert.match(html,/Animal accommodation: unlimited by default/);
 assert.match(html,/Estimated animal fare: 50 CP/);
 assert.deepEqual(rec.legs[0].livestock,cargo,
   "rendering must not mutate the previously authorized animal count");
 const tampered=structuredClone(rec);
 tampered.legs[0].livestock.capacityPerUnit=0;
 assert.throws(()=>validateJourneyRecord(tampered),/invalid recovery metadata/);
});

test("hired service Journal shows exact fare components once across mount recovery",()=>{
  const method={id:"ship-passage",name:"Ship passage",kind:"vehicle",surface:"water",
    capacity:6,hireEnabled:true,hireApplies:"passenger",hireBasis:"trip",hireCostCp:10.1,
    crewCount:4,crewThresholds:{minimum:1,optimal:2,excellent:3},
    hireCrewIncluded:true,livestockCapacity:3};
  for(const percent of [0,50,200]){
    const approval=validateHiredServiceApproval(quoteTransportationService(method,{
      arrangement:"hire",serviceLevel:"minimum",movingHours:10,distanceMi:30,
      travelers:2,livestockCount:1,livestockPercent:percent}));
    const mountFare=approval.livestockFareCp;
    const manifest=planJourneyLivestock(group,{a:1,b:0},{surface:"water",
      methodId:method.id,units:1,capacityPerUnit:3,fareCp:mountFare});
    const plan=route(manifest,{...ship,serviceApproval:approval,estimatedFareCp:approval.totalCp});
    const record=create(plan);
    const progress=(record,hours,percent,status="interrupted")=>checkpointJourneyRecord(record,{
      schedule:{completedHours:hours,todayHours:hours,permittedExtraUntil:0,restEvents:0,
        lastForcedCheck:null,events:[]},progress:percent,status});
    const paused=progress(record,4,40);
    const resume=record=>resumeJourneyRecord(record,{atlasRevision:7,itinerary:route(manifest,{
      ...plan.transport,continuation:true,estimatedFareCp:0})});
    const resumed=progress(resume(paused),6,100,"paused");
    const before=structuredClone(resumed);
    const html=formatJourneyJournalHTML(resumed,{systemId:"dnd5e"});
    assert.match(html,/Base transportation: 20\.2 CP/);
    assert.ok(html.includes("Physical mount boarding: "+mountFare+" CP"));
    assert.equal((html.match(/Physical mount boarding:/g)??[]).length,1);
    assert.equal((html.match(/Original estimated total:/g)??[]).length,1);
    assert.doesNotMatch(html,/Estimated animal fare:/,"the saved service already includes the mount component");
    assert.match(html,/Continuing previously approved service; no new fare/);
    assert.equal((html.match(/Warhorse: 1 of 1 embarked/g)??[]).length,2);
    assert.deepEqual(resumed,before,"render never modifies approved fare or mount manifest");
    const zero=progress(resume(progress(record,0,0)),4,40);
    assert.equal((formatJourneyJournalHTML(zero,{systemId:"dnd5e"}).match(/Physical mount boarding:/g)??[]).length,1,
      "no prior confirmed movement means the first visible history still has the original estimate");
    const onward=progress(resumeJourneyRecord(resumed,{atlasRevision:7,itinerary:plan}),10,100,"completed");
    assert.equal((formatJourneyJournalHTML(onward,{systemId:"dnd5e"}).match(/Physical mount boarding:/g)??[]).length,2,
      "a new completed leg with identical terms owns a separate quote");
  }
});

test("legacy mount-only history shows one estimate across an unfinished leg",()=>{
  const manifest=planJourneyLivestock(group,{a:1,b:0},{surface:"water",
    methodId:"ship-passage",units:1,capacityPerUnit:3,fareCp:50});
  const saved=create(route(manifest));
  saved.legs[0].completedMovingHours=4;saved.legs[0].completedPercent=40;saved.status="interrupted";
  const resumed=resumeJourneyRecord(saved,{atlasRevision:7,itinerary:route(manifest,{...ship,
    continuation:true,estimatedFareCp:0})});
  resumed.legs[1].completedMovingHours=6;resumed.legs[1].completedPercent=100;
  const html=formatJourneyJournalHTML(resumed);
  assert.equal((html.match(/Estimated animal fare: 50 CP/g)??[]).length,1);
  assert.match(html,/Previously approved animal accommodation; no new fare/);
  assert.equal((html.match(/Warhorse: 1 of 1 embarked/g)??[]).length,2);
});
