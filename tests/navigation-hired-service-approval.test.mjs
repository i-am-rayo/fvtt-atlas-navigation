import test from "node:test";
import assert from "node:assert/strict";
import {quoteTransportationService} from "../scripts/navigation-transport-service.js";
import {prepareGuidedTransportLeg} from "../scripts/navigation-guided-transport-leg.js";
import {restoreApprovedTransportPlan} from "../scripts/navigation-transport-recovery.js";
import {createJourneyRecord,resumeJourneyRecord,validateJourneyRecord,formatJourneyJournalHTML} from "../scripts/navigation-journey-journal.js";
const p=x=>({x,y:0});
const ship={id:"warship",name:"Warship",kind:"vehicle",surface:"water",speedMph:2.5,
  capacity:60,crewCount:60,hireEnabled:true,hireCostCp:25000,hireBasis:"day",hireApplies:"unit",
  hireCrewIncluded:true,overtimeEnabled:true,overtimeExtraHours:4,overtimeMultiplier:1.5,continuousEnabled:true};
const route=(start=0)=>({status:"ok",start:p(start),end:p(60),distance:60-start,cost:60-start,
  terrainAware:false,legs:[{kind:"road",points:[p(start),p(60)],distance:60-start,cost:60-start}]});
const leg=(start=0)=>({index:0,firstRouteLeg:0,lastRouteLeg:0,start:p(start),end:p(60),
  distance:60-start,weightedDistance:60-start,hours:(60-start)/2.5,surface:"water",
  errors:[],transferValid:true,roadNames:["Strait"],arrivalCheckpoint:{id:"dock",name:"Dock"},
  selectedOption:{arrangement:"hire",method:ship}});
const itinerary=(guided)=>({schemaVersion:1,scene:{name:"Paedor",units:"mi"},
  endpoints:{departure:guided.start,destination:guided.end},
  measurements:{distance:guided.distance,travelHours:guided.distance/2.5,terrainAware:false},
  travel:{speedPerHour:2.5},directions:[],transport:guided.transport});
test("explicit hired service approval is copied into a checkpoint leg and retained without re-quoting on recovery",()=>{
  const quote=quoteTransportationService(ship,{arrangement:"hire",serviceLevel:"optimal",
    movingHours:24,distanceMi:60,travelers:4});
  const guided=prepareGuidedTransportLeg(route(),{...leg(),operation:quote.operation,costCp:quote.totalCp,serviceQuote:quote});
  const approval=guided.transport.serviceApproval;
  assert.ok(approval,"the approved quote must survive leg preparation");
  assert.equal(approval.serviceLevel,"optimal");assert.equal(approval.advertisedCrew,30);
  assert.equal(approval.dailyHours,12);assert.equal(approval.totalCp,quote.totalCp);
  const saved=createJourneyRecord({sceneId:"scene",tokenId:"party",atlasRevision:4,itinerary:itinerary(guided)});
  assert.deepEqual(saved.legs[0].transport.serviceApproval,approval);
  saved.status="interrupted";saved.legs[0].completedPercent=50;saved.legs[0].completedMovingHours=12;
  const worldChanged={...ship,crewCount:10,hireCostCp:99999,overtimeExtraHours:8,overtimeEnabled:false};
  const recovered=restoreApprovedTransportPlan(route(30),{legs:[leg(30)]},saved,[worldChanged]);
  assert.equal(recovered.legs[0].costCp,0);
  assert.equal(recovered.legs[0].dailyHours,12);
  assert.deepEqual(recovered.legs[0].approvedService,approval);
  const resumed=prepareGuidedTransportLeg(route(30),recovered.legs[0]);
  assert.deepEqual(resumed.transport.serviceApproval,approval);
  assert.equal(resumed.transport.estimatedFareCp,0);
  const history=resumeJourneyRecord(saved,{itinerary:itinerary(resumed),atlasRevision:4});
  assert.deepEqual(history.legs[1].transport.serviceApproval,approval);
  assert.deepEqual(validateJourneyRecord(history),history);
  const tampered=structuredClone(history);tampered.legs[1].transport.serviceApproval.totalCp++;
  assert.throws(()=>validateJourneyRecord(tampered),/invalid/i);
  const changed=structuredClone(resumed);changed.transport.serviceApproval.serviceLevel="full";
  assert.throws(()=>resumeJourneyRecord(saved,{itinerary:itinerary(changed),atlasRevision:4}),/approved|service/i);
  assert.equal(ship.crewCount,60);
});

test("ordinary hired land approval remains historical through interruption and only one fare is displayed",()=>{
  const method={...ship,id:"carriage",surface:"land",name:"Carriage"};
  const quote=quoteTransportationService(method,{arrangement:"hire",serviceLevel:"optimal",
    movingHours:24,distanceMi:60,travelers:4});
  const plan={...itinerary({start:p(0),end:p(60),distance:60}),travel:{
    speedPerHour:2.5,methodId:"carriage",methodName:"Carriage",arrangement:"hire",
    operation:quote.operation,serviceApproval:quote}};
  const saved=createJourneyRecord({sceneId:"scene",tokenId:"party",atlasRevision:4,itinerary:plan});
  const approval=saved.legs[0].travelMethod.serviceApproval;
  assert.equal(approval.dailyHours,12);
  assert.doesNotMatch(formatJourneyJournalHTML(saved),/Approved hired service/);
  saved.status="interrupted";saved.legs[0].completedPercent=50;saved.legs[0].completedMovingHours=12;
  const next={...plan,endpoints:{departure:p(30),destination:p(60)},
    measurements:{distance:30,travelHours:12,terrainAware:false},
    travel:{...plan.travel,serviceApproval:approval}};
  const resumed=resumeJourneyRecord(saved,{itinerary:next,atlasRevision:4});
  assert.deepEqual(resumed.legs[1].travelMethod.serviceApproval,approval);
  resumed.legs[1].completedPercent=50;resumed.legs[1].completedMovingHours=6;
  const html=formatJourneyJournalHTML(resumed);
  assert.equal((html.match(/Approved hired service/g)||[]).length,1);
  assert.match(html,/previously approved service; no new fare/i);
  assert.match(html,/30 advertised crew per unit/);
  assert.match(html,/12h\/day/);
  assert.throws(()=>resumeJourneyRecord(saved,{itinerary:{...next,travel:{...next.travel,
    serviceApproval:undefined}},atlasRevision:4}),/approved hired service/);
  const wrong=structuredClone(resumed);wrong.legs[1].travelMethod.operation="continuous";
  assert.throws(()=>validateJourneyRecord(wrong),/invalid/i);
});

test("historical service discounts render as signed estimates, not invalid negative coins",()=>{
  const quote=quoteTransportationService({...ship,id:"cart",surface:"land"},{
    arrangement:"hire",serviceLevel:"minimum",movingHours:4,distanceMi:10,adjustmentCp:-100});
  const plan={...itinerary({start:p(0),end:p(10),distance:10}),travel:{
    speedPerHour:2.5,methodId:"cart",methodName:"Cart",arrangement:"hire",
    operation:quote.operation,serviceApproval:quote}};
  const saved=createJourneyRecord({sceneId:"scene",tokenId:"party",atlasRevision:4,itinerary:plan});
  saved.legs[0].completedMovingHours=1;saved.legs[0].completedPercent=25;
  assert.match(formatJourneyJournalHTML(saved,{systemId:"dnd5e"}),/adjustment -1 GP/);
  const forged=structuredClone(saved);forged.legs[0].travelMethod.serviceContinuation=true;
  assert.throws(()=>validateJourneyRecord(forged),/invalid|continuation/i);
});
