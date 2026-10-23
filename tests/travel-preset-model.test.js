import test from "node:test";
import assert from "node:assert/strict";
import { validateAtlas, upgradeAtlasTravelPresets, TRAVEL_ATLAS_SCHEMA_VERSION }
  from "../scripts/atlas-model.js";
import { defaultTravelPresets, validateTravelPresets, upsertTravelPreset,
  removeTravelPreset, validateRegionTravelFlag } from "../scripts/travel-preset-model.js";

function roadAtlas() {
  return {
    schemaVersion:4,coordinateSpace:"image",revision:17,enabled:true,calibration:null,
    roads:[{id:"land-road",name:"Western Passage"}],
    nodes:[{id:"a",x:0,y:0},{id:"b",x:90,y:40}],
    segments:[{id:"edge",roadId:"land-road",from:"a",to:"b",
      via:[{x:40,y:15}],bidirectional:true}],
    checkpoints:[{id:"cp",roadId:"land-road",nodeId:"a",
      name:"Toll Gate",elevationMeters:25}]
  };
}

test("world presets are neutral, validated and copy-safe", () => {
  const raw = defaultTravelPresets();
  const data = validateTravelPresets(raw);
  assert.equal(data.presets.some(p => p.mode === "air"), true);
  assert.equal(data.presets.some(p => p.mode === "water"), true);
  assert.ok(data.presets.every(p => p.movementCostMultiplier === 1));
  data.presets[0].name = "Changed";
  assert.notEqual(defaultTravelPresets().presets[0].name, "Changed");
});

test("presets accept 0.75 cost, reject unsafe data and duplicate names", () => {
  const data = upsertTravelPreset(defaultTravelPresets(), {
    id:"tailwind",mode:"air",name:"Tailwind",movementCostMultiplier:0.75
  });
  assert.equal(data.presets.find(p => p.id === "tailwind").movementCostMultiplier,0.75);
  assert.throws(()=>validateTravelPresets({ ...data, presets:[
    ...data.presets, { id:"again", mode:"air",name:"tailwind", movementCostMultiplier:1 }
  ]}),/unique/);
  assert.throws(()=>upsertTravelPreset(data,{ id:"bad", mode:"space",
    name:"Void",movementCostMultiplier:1 }),/Land\/Air\/Water/);
  assert.throws(()=>upsertTravelPreset(data,{ id:"bad",mode:"land",
    name:"Danger",movementCostMultiplier:0 }),/between 0.1 and 10/);
  assert.throws(()=>validateTravelPresets({ schemaVersion:1,presets:[],
    extra:"unknown" }),/unsupported/);
});

test("editing retains stable ID; deleting preserves untouched snapshot", () => {
  const original = defaultTravelPresets();
  const updated = upsertTravelPreset(original, {
    id:"water-rough",mode:"water",name:"High Swells",movementCostMultiplier:1.5
  });
  assert.equal(updated.presets.find(p=>p.id==="water-rough").name,"High Swells");
  assert.equal(original.presets.find(p=>p.id==="water-rough").name,"Rough Seas");
  assert.equal(removeTravelPreset(updated,"water-rough").presets
    .some(p=>p.id==="water-rough"),false);
  assert.throws(()=>removeTravelPreset(original,"missing"),/no longer exists/);
});

test("Region flag is descriptive and strictly validated", () => {
  assert.equal(validateRegionTravelFlag(null),null);
  assert.deepEqual(validateRegionTravelFlag({schemaVersion:1,presetId:"tailwind"}),
    {schemaVersion:1,presetId:"tailwind"});
  assert.throws(()=>validateRegionTravelFlag({schemaVersion:1,presetId:"a",cost:2}),
    /Unsupported/);
});

test("v4 to v5 road preset upgrade is explicit and lossless", () => {
  const old=roadAtlas();
  const oldSnap=structuredClone(old);
  const upgraded=upgradeAtlasTravelPresets(old);
  assert.equal(upgraded.schemaVersion,TRAVEL_ATLAS_SCHEMA_VERSION);
  assert.equal(upgraded.revision,17);
  assert.deepEqual(upgraded.nodes,old.nodes);
  assert.deepEqual(upgraded.segments,old.segments);
  assert.deepEqual(upgraded.checkpoints,old.checkpoints);
  assert.deepEqual(upgraded.roads,[{...old.roads[0],travelPresetId:null}]);
  assert.deepEqual(old,oldSnap);
  assert.equal(validateAtlas(upgraded).schemaVersion,5);
  assert.deepEqual(upgradeAtlasTravelPresets(upgraded),upgraded);
});

test("v3 road-only upgrade adds empty checkpoints; invalid v5 values fail", () => {
  const v3=roadAtlas();
  delete v3.checkpoints;
  v3.schemaVersion=3;
  const out=upgradeAtlasTravelPresets(v3);
  assert.equal(out.schemaVersion,5);
  assert.deepEqual(out.checkpoints,[]);
  const assigned={...out,roads:[{...out.roads[0],travelPresetId:"air-turbulent"}]};
  assert.equal(validateAtlas(assigned).roads[0].travelPresetId,"air-turbulent");
  assert.throws(()=>validateAtlas({...assigned,roads:[
    {...assigned.roads[0],travelPresetId:"bad id"}
  ]}),/invalid travel preset/);
  assert.throws(()=>validateAtlas({...v3,roads:[
    {...v3.roads[0],travelPresetId:"air-turbulent"}
  ]}),/unsupported field/);
});
