import test from "node:test";
import assert from "node:assert/strict";
import {planOwnedVehicleService} from "../scripts/navigation-group-transport.js";
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
  const walker={id:"walking",name:"Walking",kind:"foot",surface:"land"};
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

test("owned checkpoint approval requires acknowledgement, preserves staffing and never re-quotes on recovery",()=>{
  const method={...ship,costCp:100,costBasis:"day",costApplies:"unit",
    includeCrewWages:true,crewWageCpPerDay:200,crewWageBasis:"day"};
  const projection={travelers:1,members:[
    {actorId:"pc",actorName:"Navigator",actorType:"character",role:"passenger",quantity:1,needsSeat:true,enabled:true},
    {actorId:"ship",actorName:"Warship",actorType:"vehicle",role:"vehicle",quantity:2,capacity:1,
      surface:"water",profileId:"warship",enabled:true,crewRoster:[{unitIndex:1,named:[],hired:10}]}]};
  const plan=planOwnedVehicleService(projection,method,{operatedUnits:[{actorId:"ship",unitIndex:1}],
    movingHours:24,distanceMi:60,regularHours:6,operation:"normal"});
  assert.equal(plan.approval.belowMinimum,true);
  const selected={...leg(),selectedOption:{arrangement:"owned",method},operation:"normal",
    costCp:plan.approval.totalCp,ownedApproval:plan.approval};
  assert.throws(()=>prepareGuidedTransportLeg(route(),selected),/acknowledg/i);
  const approval={...plan.approval,belowMinimumAcknowledged:true};
  const guided=prepareGuidedTransportLeg(route(),{...selected,ownedApproval:approval});
  assert.deepEqual(guided.transport.ownedApproval,approval);
  const saved=createJourneyRecord({sceneId:"scene",tokenId:"party",atlasRevision:4,itinerary:itinerary(guided)});
  assert.deepEqual(saved.legs[0].transport.ownedApproval,approval);
  saved.status="interrupted";saved.legs[0].completedPercent=50;saved.legs[0].completedMovingHours=12;
  const changed={...method,crewCount:1,crewWageCpPerDay:900,speedMph:1};
  const recovered=restoreApprovedTransportPlan(route(30),{legs:[leg(30)]},saved,[changed]);
  assert.equal(recovered.legs[0].dailyHours,6);
  assert.equal(recovered.legs[0].overnightHours,18);
  assert.equal(recovered.legs[0].hours,12);
  assert.equal(recovered.legs[0].costCp,0);
  const resumed=prepareGuidedTransportLeg(route(30),recovered.legs[0]);
  assert.deepEqual(resumed.transport.ownedApproval,approval);
  const history=resumeJourneyRecord(saved,{itinerary:itinerary(resumed),atlasRevision:4});
  history.legs[1].completedMovingHours=6;history.legs[1].completedPercent=50;
  assert.deepEqual(validateJourneyRecord(history),history);
  const html=formatJourneyJournalHTML(history);
  assert.equal((html.match(/Approved owned service:/g)||[]).length,1);
  assert.match(html,/below-minimum staffing acknowledged/i);
  assert.match(html,/continuing previously approved owned service; no new fare/i);
  assert.throws(()=>resumeJourneyRecord(saved,{itinerary:{...itinerary(resumed),
    transport:{...resumed.transport,ownedApproval:undefined}},atlasRevision:4}),/approved owned/i);
  const omitted=structuredClone(history);
  delete omitted.legs[1].transport.ownedApproval;
  assert.throws(()=>validateJourneyRecord(omitted),/invalid|approved owned/i);
  const displaced=structuredClone(history);
  displaced.legs[1].destination.x++;
  assert.throws(()=>validateJourneyRecord(displaced),/invalid|approved owned/i);
  for(const edit of [a=>a.belowMinimumAcknowledged=false,a=>a.totalCp++,
    a=>a.units[0].unitIndex=2]){
    const bad=structuredClone(history);edit(bad.legs[1].transport.ownedApproval);
    assert.throws(()=>validateJourneyRecord(bad),/invalid|acknowledg/i);
  }
});

test("ordinary owned land approval preserves the exact historical crew, schedule and fare",()=>{
  const method={...ship,id:"carriage",name:"Carriage",surface:"land",costCp:100,
    costBasis:"day",costApplies:"unit",includeCrewWages:true,crewWageCpPerDay:200,crewWageBasis:"day"};
  const roster={travelers:1,members:[
    {actorId:"pc",actorName:"Driver",actorType:"character",role:"passenger",quantity:1,needsSeat:true,enabled:true},
    {actorId:"cart",actorName:"Carriage",actorType:"vehicle",role:"vehicle",quantity:2,capacity:2,
      surface:"land",profileId:"carriage",enabled:true,crewRoster:[{unitIndex:1,named:[{actorId:"pc"}],hired:10}]}]};
  const draft=planOwnedVehicleService(roster,method,{operatedUnits:[{actorId:"cart",unitIndex:1}],
    movingHours:24,distanceMi:60,regularHours:6,operation:"normal"}).approval;
  const approval={...draft,belowMinimumAcknowledged:draft.belowMinimum};
  const participation={schemaVersion:1,checkpointId:null,people:[{
    actorId:"pc",name:"Driver",traveling:true,seats:0,methodKey:"owned|carriage"}]};
  const plan={...itinerary({start:p(0),end:p(60),distance:60}),participation,
    travel:{speedPerHour:2.5,methodId:"carriage",methodName:"Carriage",arrangement:"owned",
      operation:"normal",ownedApproval:approval}};
  const saved=createJourneyRecord({sceneId:"scene",tokenId:"party",atlasRevision:4,itinerary:plan});
  assert.deepEqual(saved.legs[0].travelMethod.ownedApproval,approval);
  assert.doesNotMatch(formatJourneyJournalHTML(saved),/Approved owned service/);
  saved.status="interrupted";saved.legs[0].completedPercent=50;saved.legs[0].completedMovingHours=12;
  const next={...plan,endpoints:{departure:p(30),destination:p(60)},
    measurements:{distance:30,travelHours:12,terrainAware:false}};
  const resumed=resumeJourneyRecord(saved,{itinerary:next,atlasRevision:4});
  assert.deepEqual(resumed.legs[1].travelMethod.ownedApproval,approval);
  assert.equal(resumed.legs[1].travelMethod.ownedContinuation,true);
  assert.deepEqual(resumed.legs[1].participation,participation);
  resumed.legs[1].completedMovingHours=6;resumed.legs[1].completedPercent=50;
  assert.deepEqual(validateJourneyRecord(resumed),resumed);
  const html=formatJourneyJournalHTML(resumed);
  assert.equal((html.match(/Approved owned service:/g)||[]).length,1);
  assert.match(html,/Continuing previously approved owned service; no new fare/);
  for(const edit of [
    q=>delete q.travel.ownedApproval,
    q=>{q.travel.speedPerHour=3;},
    q=>{q.endpoints.destination=p(61);},
    q=>{q.travel.ownedApproval.belowMinimumAcknowledged=false;},
    q=>{q.participation.people[0].seats=1;}
  ]){
    const changed=structuredClone(next);edit(changed);
    assert.throws(()=>resumeJourneyRecord(saved,{itinerary:changed,atlasRevision:4}),/approved|acknowledg|seats/i);
  }
  for(const edit of [
    q=>delete q.legs[1].travelMethod.ownedApproval,
    q=>delete q.legs[1].travelMethod.ownedContinuation,
    q=>{q.legs[1].travelMethod.arrangement="hire";},
    q=>{q.legs[1].destination.x++;},
    q=>{q.legs[1].participation.people[0].seats=1;}
  ]){
    const changed=structuredClone(resumed);edit(changed);
    assert.throws(()=>validateJourneyRecord(changed),/invalid|approved|seats/i);
  }
});

test("mixed owned checkpoint draft is not approval; continuation preserves staffing and one fare",()=>{
  const walking={key:"owned|walking",arrangement:"owned",method:{id:"walking",name:"Walking",kind:"foot",surface:"land"}};
  const cart={...ship,id:"carriage",name:"Carriage",surface:"land",capacity:2,
    costCp:100,costBasis:"day",costApplies:"unit",includeCrewWages:true,crewWageCpPerDay:200};
  const projection={travelers:2,members:[
    {actorId:"pc1",actorName:"Walker",actorType:"character",role:"passenger",quantity:1,needsSeat:true,enabled:true},
    {actorId:"pc2",actorName:"Rider",actorType:"character",role:"passenger",quantity:1,needsSeat:true,enabled:true},
    {actorId:"driver",actorName:"Driver",actorType:"npc",role:"crew",quantity:1,enabled:true},
    {actorId:"cart",actorName:"Carriage",actorType:"vehicle",role:"vehicle",quantity:2,
      capacity:2,surface:"land",profileId:"carriage",enabled:true,
      crewRoster:[{unitIndex:1,named:[{actorId:"driver",duty:"Driver"}],hired:1}]}]};
  const convoy=planMixedLandConvoy({travelers:[{actorId:"pc1",seatsNeeded:1,passengers:1},
    {actorId:"pc2",seatsNeeded:1,passengers:1}],
    assignments:{pc1:"owned|walking",pc2:"owned|carriage"},
    methods:[walking,{key:"owned|carriage",arrangement:"owned",method:cart,
      projection,operatedUnits:[{actorId:"cart",unitIndex:1}]}],
    walkingSpeed:2.5,sceneUnits:"mi",routeDistance:60,weightedDistance:60,distanceMi:60,regularHours:6});
  const mixedLeg=(start,plan)=>({...leg(start),surface:"land",operation:"normal",convoy:plan,
    selectedOption:{arrangement:"mixed",method:mixedLandTransportMethod}});
  assert.throws(()=>prepareGuidedTransportLeg(route(),mixedLeg(0,convoy)),/acknowledg/i);
  const preview=prepareGuidedTransportLeg(route(),mixedLeg(0,convoy),{draft:true});
  const participation={schemaVersion:1,checkpointId:null,people:[
    {actorId:"pc1",name:"Walker",traveling:true,seats:1,methodKey:"owned|walking"},
    {actorId:"pc2",name:"Rider",traveling:true,seats:1,methodKey:"owned|carriage"},
    {actorId:"driver",name:"Driver",traveling:true,seats:0,methodKey:"owned|carriage"}]};
  assert.throws(()=>createJourneyRecord({sceneId:"scene",tokenId:"party",atlasRevision:4,
    itinerary:{...itinerary(preview),convoy,participation}}),/acknowledg/i);
  const approved=structuredClone(convoy);
  approved.methods[1].ownedApproval.belowMinimumAcknowledged=true;
  const guided=prepareGuidedTransportLeg(route(),mixedLeg(0,approved));
  const saved=createJourneyRecord({sceneId:"scene",tokenId:"party",atlasRevision:4,
    itinerary:{...itinerary(guided),convoy:approved,participation}});
  saved.status="interrupted";saved.legs[0].completedPercent=50;saved.legs[0].completedMovingHours=12;
  const recovered=restoreApprovedTransportPlan(route(30),{legs:[mixedLeg(30,approved)]},saved,[walking.method]);
  assert.equal(recovered.totalCp,0);assert.equal(recovered.legs[0].dailyHours,6);
  assert.deepEqual(recovered.legs[0].convoy,approved);
  const resumed=prepareGuidedTransportLeg(route(30),recovered.legs[0]);
  const next={...itinerary(resumed),convoy:approved,participation};
  const history=resumeJourneyRecord(saved,{itinerary:next,atlasRevision:4});
  history.legs[1].completedMovingHours=6;history.legs[1].completedPercent=50;
  assert.deepEqual(validateJourneyRecord(history),history);
  const html=formatJourneyJournalHTML(history);
  assert.match(html,/Driver/);assert.match(html,/Below-minimum staffing acknowledged/i);
  assert.equal((html.match(/Estimated transportation cost:/g)||[]).length,1);
  assert.match(html,/Continuing previously approved mixed service; no new fare/);
  const tampered=structuredClone(history);delete tampered.legs[1].convoy;
  assert.throws(()=>validateJourneyRecord(tampered),/invalid/i);
  assert.throws(()=>resumeJourneyRecord(saved,{itinerary:{...next,convoy:undefined},atlasRevision:4}),/approved owned convoy/i);
});
