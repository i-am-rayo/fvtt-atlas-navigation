import assert from "node:assert/strict";
import test from "node:test";
import { atlasCurrencyChoices,coinFromCopper,copperFromCoin,projectedGroupFare,dndCurrencyBreakdown }
  from "../scripts/navigation-currency.js";

test("currency adapter exposes native D&D5e denomination options",()=>{
  const currencyConfig={gp:{label:"Gold",icon:"coin"},cp:{label:"Copper"},sp:{label:"Silver"}};
  assert.deepEqual(atlasCurrencyChoices("dnd5e",currencyConfig).map(c=>c.id),
    ["cp","sp","gp"]);
  assert.deepEqual(atlasCurrencyChoices("pf2e").map(c=>c.id),["cp","gp"]);
});
test("recurring CP and purchase GP retain canonical values across UI denominations",()=>{
  assert.equal(copperFromCoin(1,"gp"),100);
  assert.equal(copperFromCoin(1,"sp"),10);
  assert.equal(copperFromCoin(1,"ep"),50);
  assert.equal(copperFromCoin(1,"pp"),1000);
  assert.equal(coinFromCopper(500,"gp"),5);
  assert.equal(coinFromCopper(3,"cp"),3);
  assert.throws(()=>copperFromCoin(-1,"sp"),/currency/i);
  assert.throws(()=>coinFromCopper(2,"unknown"),/currency/i);
});
test("upkeep multiplies by physical units; fares by travelers",()=>{
  const feed={costCp:5,costBasis:"day",costApplies:"unit"};
  assert.equal(projectedGroupFare(feed,{quantity:2,passengers:5,hours:24}),10);
  assert.equal(projectedGroupFare(feed,{quantity:2,passengers:5,hours:25}),20);
  const coach={costCp:3,costBasis:"mile",costApplies:"passenger"};
  assert.equal(projectedGroupFare(coach,{quantity:1,passengers:5,distanceMi:10}),150);
  assert.equal(projectedGroupFare({...feed,costBasis:"none"},{quantity:10,hours:12}),0);
  assert.throws(()=>projectedGroupFare(feed,{quantity:-1}),/factors/i);
});

test("display-only fare converts to highest denominations using integer copper",()=>{
  const fare=dndCurrencyBreakdown(4305);
  assert.equal(fare.label,"4 PP · 3 GP · 5 CP");
  assert.equal(fare.payableCopper,4305);
  assert.equal(fare.roundedUp,false);
  assert.deepEqual(fare.coins,[{id:"pp",quantity:4},{id:"gp",quantity:3},
    {id:"cp",quantity:5}]);
});
test("fractional copper quote is rounded upward only for payable coin preview",()=>{
  const fare=dndCurrencyBreakdown(1335.88);
  assert.equal(fare.exactCopper,1335.88);
  assert.equal(fare.payableCopper,1336);
  assert.equal(fare.label,"1 PP · 3 GP · 3 SP · 6 CP");
  assert.equal(fare.roundedUp,true);
});
test("active native denominations and conversion rates shape the breakdown",()=>{
  const config={gp:{conversion:1},sp:{conversion:10},cp:{conversion:100}};
  assert.equal(dndCurrencyBreakdown(1335.88,config).label,"13 GP · 3 SP · 6 CP");
  const noCopper={gp:{conversion:1},sp:{conversion:10}};
  const estimate=dndCurrencyBreakdown(1335.88,noCopper);
  assert.equal(estimate.payableCopper,1340);
  assert.equal(estimate.label,"13 GP · 4 SP");
  assert.throws(()=>dndCurrencyBreakdown(-1),/currency/i);
  assert.throws(()=>dndCurrencyBreakdown(Number.POSITIVE_INFINITY),/currency/i);
});

test("D&D overland mount feed bills by eight-hour travel days, not 24 moving hours",()=>{
  const horse={costCp:5,costBasis:"day",costApplies:"unit"};
  const movingHours=31+34/60;
  assert.equal(projectedGroupFare(horse,{quantity:3,hours:movingHours}),30,
    "legacy 24-hour rate is retained for methods without a daily travel policy");
  assert.equal(projectedGroupFare(horse,{quantity:3,hours:movingHours,dayHours:8}),60,
    "four eight-hour travel days at five CP for each of three horses");
  assert.equal(projectedGroupFare(horse,{quantity:3,hours:8,dayHours:8}),15);
  assert.equal(projectedGroupFare(horse,{quantity:3,hours:8.01,dayHours:8}),30);
  assert.equal(projectedGroupFare(horse,{quantity:3,hours:0,dayHours:8}),0);
  assert.throws(()=>projectedGroupFare(horse,{quantity:1,hours:10,dayHours:0}),/factors/);
  assert.throws(()=>projectedGroupFare(horse,{quantity:1,hours:10,dayHours:25}),/factors/);
});
