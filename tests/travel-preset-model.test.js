import test from "node:test";
import assert from "node:assert/strict";
import { validateAtlas, upgradeAtlasTravelPresets, TRAVEL_ATLAS_SCHEMA_VERSION }
  from "../scripts/atlas-model.js";
import { addRoadCheckpoint, listRoadCheckpoints } from "../scripts/checkpoint-model.js";
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


test("v1 world catalog upgrades read-only to v2 without editing old cost data or Region flags", () => {
  const old = {schemaVersion:1,presets:[
    {id:"old",mode:"water",name:"Old Sea",movementCostMultiplier:1.1}
  ]};
  const snap = structuredClone(old);
  const upgraded = validateTravelPresets(old);
  assert.equal(upgraded.schemaVersion,2);
  assert.deepEqual(upgraded.presets[0].movementCosts,null);
  assert.equal(upgraded.presets[0].movementCostMultiplier,1.1);
  assert.deepEqual(old,snap);
  assert.deepEqual(validateRegionTravelFlag({schemaVersion:1,presetId:"old"}),
    {schemaVersion:1,presetId:"old"});
});

test("per-action costs support several multipliers and No override without blocking movement", () => {
  const origin=defaultTravelPresets();
  const edited=upsertTravelPreset(origin,{
    ...origin.presets[0], movementCosts:{walk:0.75,fly:1,burrow:2.5}
  });
  const active=edited.presets.find(p=>p.id==="land-stone");
  assert.deepEqual(active.movementCosts,{walk:0.75,fly:1,burrow:2.5});
  assert.equal(Object.hasOwn(active.movementCosts,"swim"),false);
  assert.equal(origin.presets[0].movementCosts,null);
  assert.throws(()=>upsertTravelPreset(edited,{...active,
    movementCosts:{walk:0}}),/between/);
  assert.throws(()=>upsertTravelPreset(edited,{...active,
    movementCosts:{walk:11}}),/between/);
  assert.throws(()=>upsertTravelPreset(edited,{...active,
    movementCosts:{"bad action":1}}),/between/);
  assert.throws(()=>upsertTravelPreset(edited,{...active,
    movementCosts:{"__proto__":2, walk:2,extra:NaN}}),/between/);
  const restored=upsertTravelPreset(edited,{...active,name:"Stone Bridge"});
  assert.deepEqual(restored.presets.find(p=>p.id==="land-stone").movementCosts,
    active.movementCosts);
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

test("v5 roads continue to support checkpoint edits without losing preset IDs", () => {
 const upgraded=upgradeAtlasTravelPresets(roadAtlas());
 const assigned=validateAtlas({ ...upgraded,roads:[
   {...upgraded.roads[0],travelPresetId:"land-stone"}
 ]});
 const withCheckpoint=addRoadCheckpoint(assigned,{
   roadId:"land-road",candidate:{kind:"node",nodeId:"b"},
   name:"Mountain Pass",elevationMeters:80,idFactory:()=>"cp-next"
 });
 assert.equal(withCheckpoint.schemaVersion,5);
 assert.equal(withCheckpoint.roads[0].travelPresetId,"land-stone");
 assert.equal(listRoadCheckpoints(withCheckpoint).length,2);
 assert.deepEqual(withCheckpoint.segments,assigned.segments);
});
