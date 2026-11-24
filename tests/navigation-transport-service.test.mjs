import assert from "node:assert/strict";
import test from "node:test";
import {resolveTransportationOperation,quoteTransportationService,resolveTransportationHireFare,
  assessHiredTransportAvailability}
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


test("one-journey hired fare overrides amount, frequency and charging unit without changing the catalog",()=>{
  const world=Object.freeze({...wagon});
  const original=quoteTransportationService(world,{arrangement:"hire",movingHours:12,
    distanceMi:36,travelers:3});
  assert.equal(original.totalCp,800);
  const fare={hireCostCp:300,hireBasis:"mile",hireApplies:"passenger"};
  const edited=quoteTransportationService(world,{arrangement:"hire",movingHours:12,
    distanceMi:36,travelers:3,hireTerms:fare});
  assert.equal(edited.baseCp,300*36*3);
  assert.equal(edited.totalCp,32400);
  assert.equal(edited.hireTerms.hireBasis,"mile");
  assert.equal(world.hireBasis,"day","World fare is immutable");
  assert.equal(world.hireCostCp,400);
  const reset=quoteTransportationService(world,{arrangement:"hire",movingHours:12,
    distanceMi:36,travelers:3,hireTerms:null});
  assert.equal(reset.totalCp,original.totalCp);
  assert.deepEqual(resolveTransportationHireFare(world),{
    hireCostCp:400,hireBasis:"day",hireApplies:"unit"
  });
});

test("trip-local hire quotes validate bad GM terms without touching world prices",()=>{
  assert.throws(()=>resolveTransportationHireFare(wagon,{hireCostCp:-1}),/Invalid GM/);
  assert.throws(()=>resolveTransportationHireFare(wagon,{hireBasis:"calendar"}),/Invalid GM/);
  assert.throws(()=>resolveTransportationHireFare(wagon,{hireApplies:"crew"}),/Invalid GM/);
  assert.throws(()=>quoteTransportationService(wagon,{arrangement:"hire",
    movingHours:8,distanceMi:24,hireTerms:{hireCostCp:Infinity}}),/Invalid GM/);
});

test("finite hire stock blocks insufficient carts; legacy offers remain unlimited",()=>{
  const cart={...wagon,capacity:2,hireQuantity:1,hireUnlimited:false};
  const inputs={arrangement:"hire",movingHours:5,distanceMi:20,travelers:4};
  assert.deepEqual(assessHiredTransportAvailability(cart,{travelers:4}),{
    requiredUnits:2,availableUnits:1,unlimited:false,
    unknown:false,missing:1,sufficient:false
  });
  assert.throws(()=>quoteTransportationService(cart,inputs),/Not enough hired/);
  const two={...cart,hireQuantity:2};
  assert.equal(quoteTransportationService(two,inputs).units,2);
  assert.equal(quoteTransportationService({...wagon,capacity:2},inputs).units,2,
    "historical checkpoint offers have unlimited supply");
  assert.throws(()=>quoteTransportationService({...cart,hireQuantity:-1},inputs),
    /Not enough hired/);
});

test("one hired cargo cart can accompany walkers at walking speed without using passenger seats",()=>{
  const cart={...wagon,capacity:2,hireUnlimited:false,hireQuantity:1};
  const fast=quoteTransportationService(cart,{arrangement:"hire",
    travelers:0,requestedUnits:1,movingHours:5,distanceMi:20});
  const slow=quoteTransportationService(cart,{arrangement:"hire",
    travelers:0,requestedUnits:1,movingHours:10,distanceMi:20});
  assert.equal(fast.units,1);
  assert.equal(slow.units,1);
  assert.equal(fast.baseCp,400);
  assert.equal(slow.baseCp,800,"per-day hired service must cost more when a convoy is slower");
  assert.throws(()=>quoteTransportationService({...cart,hireQuantity:0},{
    arrangement:"hire",travelers:0,requestedUnits:1,movingHours:10,distanceMi:20}),
    /Not enough hired/);
});

test("continuous carriage daily fare uses fractional normal duty days, not 24h chunks",()=>{
  const carriage={...wagon,continuousEnabled:true,hireCostCp:400};
  const q=quoteTransportationService(carriage,{arrangement:"hire",
    operation:"continuous",movingHours:12,distanceMi:36,travelers:4,regularHours:8});
  assert.equal(q.travelDays,1,"the carriage keeps moving in one 24h operating period");
  assert.equal(q.billableDayUnits,1.5,"fare uses the configured eight-hour normal day");
  assert.equal(q.baseCp,600,"4 GP × 1.5 normal day-units");
  assert.equal(q.totalCp,600);
  assert.equal(q.overtimeFareCp,0);
  const six=quoteTransportationService(carriage,{arrangement:"hire",
    operation:"continuous",movingHours:12,distanceMi:36,travelers:4,regularHours:6});
  assert.equal(six.billableDayUnits,2);
  assert.equal(six.totalCp,800,"custom World regular day is honored");
  assert.equal(quoteTransportationService({...carriage,hireBasis:"trip"},{
    arrangement:"hire",operation:"continuous",movingHours:12,
    distanceMi:36,travelers:4,regularHours:8}).totalCp,400,
  "per-trip fares are not multiplied by duty periods");
  assert.equal(quoteTransportationService({...carriage,hireBasis:"mile",hireCostCp:10},{
    arrangement:"hire",operation:"continuous",movingHours:12,
    distanceMi:36,travelers:4,regularHours:8}).totalCp,360,
  "per-mile fares follow distance, independently of continuous schedule");
});

test("continuous day-based crew wages use proportional normal duty days",()=>{
  const carriage={...wagon,continuousEnabled:true,hireCostCp:400,
    hireCrewIncluded:false,crewWageBasis:"day",crewCount:1,crewWageCpPerDay:200};
  const quote=quoteTransportationService(carriage,{arrangement:"hire",
    operation:"continuous",movingHours:12,distanceMi:36,travelers:4,regularHours:8});
  assert.equal(quote.baseCp,600);
  assert.equal(quote.crewWagesCp,300,"daily wages are 1.5 × 2 GP, not one 24h day");
  assert.equal(quote.totalCp,900);
  assert.equal(quote.driverIncluded,false);
});
