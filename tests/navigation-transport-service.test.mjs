import assert from "node:assert/strict";
import test from "node:test";
import {resolveTransportationOperation,quoteTransportationService}
  from "../scripts/navigation-transport-service.js";
import {estimateNavigationTotalTrip} from "../scripts/navigation-travel-day.js";

const wagon={id:"wagon",name:"Wagon",kind:"vehicle",surface:"land",
  speedMph:3,capacity:6,hireEnabled:true,hireCostCp:400,
  hireBasis:"day",hireApplies:"unit",hireCrewIncluded:true,
  crewCount:1,crewWageCpPerDay:200,includeCrewWages:true,
  overtimeEnabled:true,overtimeExtraHours:8,overtimeMultiplier:1.5,
  continuousEnabled:false};
const warship={id:"warship",name:"Warship",kind:"vehicle",surface:"water",
  speedMph:2.5,capacity:60,crewCount:60,crewWageCpPerDay:200,
  includeCrewWages:true,hireEnabled:false,continuousEnabled:true,
  overtimeEnabled:false,overtimeMultiplier:1.5,overtimeExtraHours:8};

test("standard, 16h overtime and continuous modes alter elapsed trip time",()=>{
  const normal=resolveTransportationOperation(wagon);
  const overtime=resolveTransportationOperation(wagon,"overtime");
  const continuous=resolveTransportationOperation(warship,"continuous");
  assert.equal(normal.dailyHours,8);
  assert.equal(overtime.dailyHours,16);
  assert.equal(overtime.overnightHours,8);
  assert.equal(continuous.dailyHours,24);
  assert.equal(continuous.overnightHours,0);
  const hours=30+5/60;
  assert.equal(estimateNavigationTotalTrip(hours,normal).overnights,3);
  assert.equal(estimateNavigationTotalTrip(hours,overtime).overnights,1);
  assert.equal(estimateNavigationTotalTrip(hours,continuous).overnights,0);
  assert.equal(estimateNavigationTotalTrip(hours,normal).totalHours,hours+48);
  assert.equal(estimateNavigationTotalTrip(hours,overtime).totalHours,hours+8);
});

test("hire by day counts transport units and charges only the extra shift",()=>{
  const base=quoteTransportationService(wagon,{arrangement:"hire",
    movingHours:12,distanceMi:36,travelers:3});
  assert.equal(base.units,1);
  assert.equal(base.travelDays,2,"12h at 8h/day includes a second operating day");
  assert.equal(base.baseCp,800);
  assert.equal(base.crewWagesCp,0,"hire with driver included avoids duplicate wages");
  const extra=quoteTransportationService(wagon,{arrangement:"hire",operation:"overtime",
    movingHours:12,distanceMi:36,travelers:3});
  assert.equal(extra.travelDays,1);
  assert.equal(extra.extraHours,4);
  assert.equal(extra.baseCp,400);
  assert.equal(extra.overtimeFareCp,300,"4h × 1.5 times the 8h daily rate");
  assert.equal(extra.totalCp,700);
  assert.equal(extra.driverIncluded,true);
});

test("per-mile passenger hire adds only marginal overtime surcharge",()=>{
  const coach={...wagon,hireCostCp:3,hireBasis:"mile",hireApplies:"passenger"};
  const normal=quoteTransportationService(coach,{arrangement:"hire",
    movingHours:30,distanceMi:90,travelers:3});
  assert.equal(normal.baseCp,810);
  const overtime=quoteTransportationService(coach,{arrangement:"hire",
    operation:"overtime",movingHours:30,distanceMi:90,travelers:3});
  assert.equal(overtime.extraHours,14);
  assert.equal(overtime.baseCp,810);
  assert.equal(overtime.overtimeFareCp,189);
  assert.equal(overtime.totalCp,999);
});

test("flat per-trip fare, multiple units and GM adjustment remain read-only",()=>{
  const charter={...wagon,capacity:2,hireCostCp:5000,hireBasis:"trip",
    hireApplies:"unit",includeCrewWages:false};
  const q=quoteTransportationService(charter,{arrangement:"hire",
    movingHours:5,distanceMi:15,travelers:5,adjustmentCp:-1000});
  assert.equal(q.units,3);
  assert.equal(q.baseCp,15000);
  assert.equal(q.totalCp,14000);
  assert.equal(q.adjustmentCp,-1000);
  const free=quoteTransportationService(charter,{arrangement:"hire",
    movingHours:5,distanceMi:15,travelers:5,adjustmentCp:-1000000});
  assert.equal(free.totalCp,0,"negotiated discount cannot make a negative quote");
});

test("party-owned crew wages and overtime labor are explicit",()=>{
  const ownedQuote={amount:24000,quantity:1,breakdown:[
    {recurringCp:0,crewWagesCp:24000,amount:24000,quantity:1}
  ]};
  const quote=quoteTransportationService({...warship,overtimeEnabled:true},{
    arrangement:"owned",operation:"overtime",movingHours:30,distanceMi:75,
    travelers:3,ownedQuote});
  assert.equal(quote.travelDays,2);
  assert.equal(quote.extraHours,14);
  assert.equal(quote.crewWagesCp,24000);
  assert.equal(quote.overtimeCrewCp,12_000*(14/8)*1.5);
  const cruise=quoteTransportationService(warship,{
    arrangement:"owned",operation:"continuous",movingHours:30,distanceMi:75,
    travelers:3,ownedQuote});
  assert.equal(cruise.travelDays,2);
  assert.equal(cruise.extraHours,0);
  assert.equal(cruise.totalCp,24000);
});

test("unavailable services fail closed without inventing capacity or crew wages",()=>{
  assert.throws(()=>resolveTransportationOperation(wagon,"continuous"),/Continuous/);
  assert.throws(()=>resolveTransportationOperation(warship,"overtime"),/Overtime/);
  assert.throws(()=>quoteTransportationService({...wagon,hireEnabled:false},
    {arrangement:"hire",movingHours:8,distanceMi:24,travelers:3}),/not offered/);
  assert.throws(()=>quoteTransportationService({...wagon,capacity:null},
    {arrangement:"hire",movingHours:8,distanceMi:24,travelers:3}),/capacity/);
  assert.throws(()=>quoteTransportationService(wagon,{
    arrangement:"owned",movingHours:8,distanceMi:24,travelers:3}),/party-owned/);
  assert.throws(()=>quoteTransportationService(wagon,{
    arrangement:"hire",movingHours:8,distanceMi:24,travelers:3,adjustmentCp:Infinity}),/Invalid/);
});

test("custom worlds retain a shorter normal travel day without enabling overtime",()=>{
  const shortDay=resolveTransportationOperation(wagon,"normal",6);
  assert.equal(shortDay.dailyHours,6);
  assert.equal(shortDay.overnightHours,18);
  assert.equal(estimateNavigationTotalTrip(15,shortDay).overnights,2);
  const premium=resolveTransportationOperation(wagon,"overtime",6);
  assert.equal(premium.dailyHours,16);
});

test("24-hour operation has no overnight stop, while nonzero nightly rest does",()=>{
  const continuous=resolveTransportationOperation(warship,"continuous");
  const passage=estimateNavigationTotalTrip(49,continuous);
  assert.equal(passage.overnights,0);
  assert.equal(passage.plannedBreakHours,0);
  assert.equal(passage.totalHours,49);
  const standard=estimateNavigationTotalTrip(49,resolveTransportationOperation(wagon));
  assert.equal(standard.overnights,6);
  assert.equal(standard.totalHours,49+6*16);
});
