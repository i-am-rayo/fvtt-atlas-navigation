import test from "node:test";
import assert from "node:assert/strict";
import {quoteTransportationService} from "../scripts/navigation-transport-service.js";
import {prepareGuidedTransportLeg} from "../scripts/navigation-guided-transport-leg.js";
import {restoreApprovedTransportPlan} from "../scripts/navigation-transport-recovery.js";
import {createJourneyRecord,resumeJourneyRecord,validateJourneyRecord} from "../scripts/navigation-journey-journal.js";
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
