import test from "node:test";
import assert from "node:assert/strict";
import {planMixedLandConvoy} from "../scripts/navigation-mixed-land.js";
import {mixedLandTransportMethod} from "../scripts/navigation-transport-journal.js";
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

test("tiered mixed checkpoint recovery retains the original shared schedule and historical fare",()=>{
  const walker={id:"walking",kind:"foot",surface:"land"};
  const coach={...ship,id:"carriage",name:"Carriage",surface:"land",hireUnlimited:true};
  const convoy=planMixedLandConvoy({travelers:[
    {actorId:"pc1",seatsNeeded:1,passengers:1},{actorId:"pc2",seatsNeeded:1,passengers:1}],
    assignments:{pc1:"owned|walking",pc2:"hire|carriage"},
    methods:[{key:"owned|walking",arrangement:"owned",method:walker},
      {key:"hire|carriage",arrangement:"hire",method:coach,checkpointId:"port",serviceLevel:"full"}],
    walkingSpeed:2.5,sceneUnits:"mi",routeDistance:60,weightedDistance:60,distanceMi:60,regularHours:6});
  const mixedLeg=start=>({...leg(start),surface:"land",operation:"normal",convoy,
    selectedOption:{arrangement:"mixed",method:mixedLandTransportMethod}});
  const guided=prepareGuidedTransportLeg(route(),mixedLeg(0));
  const original={...itinerary(guided),convoy};
  const saved=createJourneyRecord({sceneId:"scene",tokenId:"party",atlasRevision:4,itinerary:original});
  saved.status="interrupted";saved.legs[0].completedPercent=50;saved.legs[0].completedMovingHours=12;
  const recovered=restoreApprovedTransportPlan(route(30),{legs:[mixedLeg(30)]},saved,[walker]);
  assert.equal(recovered.legs[0].dailyHours,6);
  assert.equal(recovered.legs[0].overnightHours,18);
  assert.equal(recovered.totalElapsedHours,30);
  assert.equal(recovered.totalCp,0);
  assert.deepEqual(recovered.legs[0].convoy,convoy);
  const resumed=prepareGuidedTransportLeg(route(30),recovered.legs[0]);
  const history=resumeJourneyRecord(saved,{itinerary:{...itinerary(resumed),convoy},atlasRevision:4});
  history.legs[1].completedMovingHours=6;history.legs[1].completedPercent=50;
  const html=formatJourneyJournalHTML(history);
  assert.match(html,/full service · 60 advertised crew per unit · supports 24h\/day; shared 6h\/day/i);
  assert.equal((html.match(/Estimated transportation cost:/g)||[]).length,1);
  assert.match(html,/Continuing previously approved mixed service; no new fare/);
  assert.deepEqual(history.legs[1].convoy,convoy);
});
