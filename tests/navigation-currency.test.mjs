import assert from "node:assert/strict";
import test from "node:test";
import { atlasCurrencyChoices,coinFromCopper,copperFromCoin,projectedGroupFare }
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
