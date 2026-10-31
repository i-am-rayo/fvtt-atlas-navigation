import test from "node:test";
import assert from "node:assert/strict";
import {defaultTravelPresets,addMissingRecommendedWaterPresets,
  validateTravelPresets} from "../scripts/travel-preset-model.js";

test("new Worlds include named river/lake/sea/ocean/canal/marsh surfaces",()=>{
  const items=defaultTravelPresets().presets.filter(p=>p.mode==="water");
  for(const name of ["River","Lake","Sea","Ocean","Canal","Marsh / Swamp"])
    assert.ok(items.some(p=>p.name===name),name);
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
