import test from "node:test";
import assert from "node:assert/strict";
import {defaultTransportationCatalog,findTransportationPreset,setTransportationPreset}
  from "../scripts/navigation-transport-catalog.js";
import {resolveTransportationOperation,quoteTransportationService}
  from "../scripts/navigation-transport-service.js";
import {summarizeTransportationOperatingSchedule}
  from "../scripts/navigation-transport-transitions.js";

const world=(catalog,key)=>({get:(_module,name)=>
  name==="guidedTransportationCatalog"?catalog:
  name==="guidedTravelRulesProfile"?"dnd5e2024":undefined});
const carriage={id:"carriage",name:"Carriage",kind:"vehicle",surface:"land",
  speedMph:3,capacity:4,hireEnabled:true,hireCostCp:400,hireBasis:"day",
  hireApplies:"unit",hireUnlimited:true,hireCrewIncluded:true,
  overtimeEnabled:true,overtimeExtraHours:8,overtimeMultiplier:1.5,
  continuousEnabled:true};
const leg=(index,surface,hours,costCp,operation,dailyHours,overnightHours)=>({
  index,surface,selectedOption:{value:"hire|vehicle"},operation,hours,costCp,
  errors:[],dailyHours,overnightHours
});

test("land vehicles opt into the same continuous schedule as water and air",()=>{
  const saved=setTransportationPreset(defaultTransportationCatalog(),"dnd5e2024",carriage);
  assert.equal(saved.version>0,true);
  assert.equal(resolveTransportationOperation(carriage,"continuous",8).dailyHours,24);
  assert.equal(resolveTransportationOperation({...carriage,surface:"water"},"continuous").dailyHours,24);
  assert.equal(resolveTransportationOperation({...carriage,surface:"air"},"continuous").dailyHours,24);
  assert.throws(()=>resolveTransportationOperation({...carriage,kind:"mount"},"continuous"),
    /Continuous/);
  assert.throws(()=>resolveTransportationOperation({...carriage,continuousEnabled:false},"continuous"),
    /Continuous/);
});

test("the same carriage estimates standard, overtime and continuous without inventing breaks",()=>{
  const normal=quoteTransportationService(carriage,{arrangement:"hire",operation:"normal",
    movingHours:26,distanceMi:78,travelers:3,regularHours:8});
  const overtime=quoteTransportationService(carriage,{arrangement:"hire",operation:"overtime",
    movingHours:26,distanceMi:78,travelers:3,regularHours:8});
  const continuous=quoteTransportationService(carriage,{arrangement:"hire",operation:"continuous",
    movingHours:26,distanceMi:78,travelers:3,regularHours:8});
  assert.equal(normal.dailyHours,8);
  assert.equal(overtime.dailyHours,16);
  assert.equal(continuous.dailyHours,24);
  assert.equal(continuous.overnightHours,0);
  assert.equal(continuous.extraHours,0);
  assert.equal(normal.travelDays,4);
  assert.equal(continuous.travelDays,2);
});

test("one global read-only schedule carries daily duty between land, water and air legs",()=>{
  const legs=[leg(0,"land",5,100,"normal",8,16),
    leg(1,"water",4,200,"normal",8,16),
    leg(2,"air",2,300,"normal",8,16)];
  const before=structuredClone(legs);
  const summary=summarizeTransportationOperatingSchedule(legs);
  assert.equal(summary.complete,true);
  assert.equal(summary.knownMovingHours,11);
  assert.equal(summary.plannedDowntimeHours,16);
  assert.equal(summary.knownElapsedHours,27);
  assert.equal(summary.knownFareCp,600);
  assert.deepEqual(legs,before,"a forecast never alters an approved route");
});

test("continuous operations keep the route moving and do not create automatic rest events",()=>{
  const summary=summarizeTransportationOperatingSchedule([
    leg(0,"land",5,100,"normal",8,16),
    leg(1,"water",48,200,"continuous",24,0),
    leg(2,"air",3,300,"normal",8,16)]);
  assert.equal(summary.complete,true);
  assert.equal(summary.knownMovingHours,56);
  assert.equal(summary.plannedDowntimeHours,0);
  assert.equal(summary.knownElapsedHours,56);
});

test("a missing future ship choice blocks full-trip totals without discarding known legs",()=>{
  const unknown={index:1,surface:"water",selectedOption:null,operation:"normal",
    hours:null,costCp:null,errors:["Choose a ship"]};
  const summary=summarizeTransportationOperatingSchedule([
    leg(0,"land",5,100,"normal",8,16),unknown,
    leg(2,"land",6,300,"normal",8,16)]);
  assert.equal(summary.complete,false);
  assert.equal(summary.knownMovingHours,5,
    "do not silently add noncontiguous travel from after an unplanned transfer");
  assert.equal(summary.knownFareCp,100);
  assert.deepEqual(summary.pendingLegIndices,[1,2]);
  assert.equal(summary.totalElapsedHours,null);
  assert.equal(summary.totalFareCp,null);
});
