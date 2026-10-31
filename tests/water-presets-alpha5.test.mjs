import test from "node:test";
import assert from "node:assert/strict";
import {defaultTravelPresets,addMissingRecommendedWaterPresets,
  validateTravelPresets} from "../scripts/travel-preset-model.js";

test("new Worlds include named river/lake/sea/ocean/canal/marsh surfaces",()=>{
  const items=defaultTravelPresets().presets.filter(p=>p.mode==="water");
  for(const name of ["River","Lake","Sea","Ocean","Canal","Marsh / Swamp"])
    assert.ok(items.some(p=>p.name===name),name);
  for(const body of ["River","Lake","Sea","Ocean","Canal","Marsh / Swamp"])
    for(const weather of ["Calm","Turbulent","Rough"]){
      const variant=items.find(p=>p.name===weather+" "+body);
      assert.ok(variant,weather+" "+body);
      assert.deepEqual(variant.movementCosts,{walk:1,fly:1,swim:1,burrow:1});
    }
});

test("neutral legacy built-in Water costs display per-mode without a World write",()=>{
  const defaults=defaultTravelPresets();
  const river=defaults.presets.find(p=>p.id==="water-river");
  const catalog={...defaults,presets:defaults.presets.map(p=>p.id==="water-river"
    ? {...p,movementCosts:null}:p)};
  assert.deepEqual(validateTravelPresets(catalog).presets.find(p=>p.id==="water-river")
    .movementCosts,{walk:1,fly:1,swim:1,burrow:1});
  assert.equal(catalog.presets.find(p=>p.id==="water-river").movementCosts,null);
  assert.deepEqual(river.movementCosts,{walk:1,fly:1,swim:1,burrow:1});
});

test("existing World catalog gains missing Water surfaces only by explicit update",()=>{
  const current=defaultTravelPresets();
  const trimmed={...current,presets:current.presets.filter(p=>p.id!=="water-river")};
  const existing=trimmed.presets.find(p=>p.id==="land-stone");
  const next=addMissingRecommendedWaterPresets(trimmed);
  assert.deepEqual(next.presets.find(p=>p.id===existing.id),existing);
  assert.ok(next.presets.some(p=>p.id==="water-river"));
  assert.deepEqual(addMissingRecommendedWaterPresets(next),next);
  assert.equal(validateTravelPresets(trimmed).presets.some(p=>p.id==="water-river"),false);
});

test("condition variants use independent per-action deltas without touching existing presets",()=>{
  const catalog=defaultTravelPresets();
  const trimmed={...catalog,presets:catalog.presets
    .filter(p=>!/^water-sea-(calm|turbulent|rough)$/.test(p.id))
    .map(p=>p.id==="water-sea"?{...p,movementCosts:{walk:2,fly:1,swim:1.25,burrow:3}}:p)};
  const modifiers={turbulent:{walk:0,fly:0.25,swim:0.25,burrow:0},
    rough:{walk:0.5,fly:0,swim:0.5,burrow:0}};
  const next=addMissingRecommendedWaterPresets(trimmed,modifiers);
  assert.deepEqual(next.presets.find(p=>p.id==="water-sea").movementCosts,
    {walk:2,fly:1,swim:1.25,burrow:3});
  assert.deepEqual(next.presets.find(p=>p.id==="water-sea-turbulent").movementCosts,
    {walk:2,fly:1.25,swim:1.5,burrow:3});
  assert.deepEqual(next.presets.find(p=>p.id==="water-sea-rough").movementCosts,
    {walk:2.5,fly:1,swim:1.75,burrow:3});
  assert.deepEqual(addMissingRecommendedWaterPresets(next,modifiers),next);
  assert.equal(trimmed.presets.some(p=>p.id==="water-sea-rough"),false);
});

test("condition generation rejects costs that would exceed native preset bounds",()=>{
  const current=defaultTravelPresets();
  const trimmed={...current,presets:current.presets.filter(p=>p.id!=="water-sea-rough")
    .map(p=>p.id==="water-sea"?{...p,movementCosts:{swim:9.75}}:p)};
  assert.throws(()=>addMissingRecommendedWaterPresets(trimmed,
    {rough:{swim:0.5}}),/maximum/);
});
