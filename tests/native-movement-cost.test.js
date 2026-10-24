import test from "node:test";
import assert from "node:assert/strict";
import { MODULE_ID } from "../scripts/atlas-storage.js";
import { defaultTravelPresets } from "../scripts/travel-preset-model.js";
import { availableMovementActions, unavailableMovementActions,
  buildNativeMovementCostBehavior, previewNativeMovementCost, nativeCostSummary,
  nativeCostPresetStatus } from "../scripts/native-movement-cost.js";
import { planSceneGeneratedRegion, saveGeneratedNativeRegion,
  applyGeneratedRegionMovementCost } from "../scripts/generated-region.js";

class NativeModel {
  static schema = { fields: { difficulties: {} } };
  constructor(source) { this.source = source; }
  validate() { return true; }
  toObject() { return structuredClone(this.source); }
}

function setup() {
  const regionRecords = [], behaviorRecords = [];
  const regions = new Map();
  let world = defaultTravelPresets();
  world.presets.find(p => p.id === "land-stone").movementCostMultiplier = 1.5;
  const scene = {
    id: "s", grid: {size:100}, regions, canUserModify:()=>true,
    state: {
      schemaVersion:4,coordinateSpace:"image",revision:0,enabled:true,calibration:null,
      roads:[{id:"road",name:"Bridge"}],
      nodes:[{id:"a",x:0,y:0},{id:"b",x:400,y:0}],
      segments:[{id:"s",roadId:"road",from:"a",to:"b",via:[],bidirectional:true}],
      checkpoints:[
        {id:"first",roadId:"road",nodeId:"a",name:"West",elevationMeters:null},
        {id:"last",roadId:"road",nodeId:"b",name:"East",elevationMeters:null}
      ]
    },
    getFlag(){return this.state;},
    async createEmbeddedDocuments(type, items) {
      assert.equal(type, "Region");
      regionRecords.push(...items);
      const item=items[0];
      const region={
        id:"native1", parent:scene, name:item.name,
        shapes:structuredClone(item.shapes), flags:item.flags,
        behaviors:item.behaviors.map(b=>({...b})),
        canUserModify:()=>true,
        getFlag(ns,key){return this.flags[ns]?.[key];},
        async createEmbeddedDocuments(childType, data) {
          assert.equal(childType, "RegionBehavior");
          behaviorRecords.push(...data);
          const docs=data.map(d=>({...d}));
          this.behaviors.push(...docs);
          return docs;
        }
      };
      regions.set(region.id,region);
      return [region];
    }
  };
  globalThis.game={
    user:{isGM:true}, settings:{get:()=>world},
    i18n:{localize:s=>s}
  };
  globalThis.canvas={ready:true,scene,dimensions:{sceneX:0,sceneY:0}};
  globalThis.CONFIG={
    RegionBehavior:{dataModels:{modifyMovementCost:NativeModel}},
    Token:{movement:{actions:{
      walk:{label:"Walk"},
      fly:{label:"Fly"},
      swim:{label:"Swim",terrainAction:null},
      crawl:{label:"Crawl",terrainAction:"walk"},
      jump:{label:"Jump",deriveTerrainDifficulty:()=>1}
    }}}
  };
  const settings={kind:"corridor",roadId:"road",
    checkpointId:"first",endCheckpointId:"last",widthCells:0.5};
  return {scene,regions,regionRecords,behaviorRecords,settings,
    changeWorld:updated=>{world=updated;}};
}

test("v14 movement actions filter derived actions and validate native model",()=>{
  setup();
  assert.deepEqual(availableMovementActions().map(a=>a.id),["walk","fly"]);
  assert.deepEqual(unavailableMovementActions().map(a=>a.id),["swim","crawl","jump"]);
  assert.throws(()=>buildNativeMovementCostBehavior("land-stone","swim"),
    /cannot store an independent native Region cost/);
  const result=buildNativeMovementCostBehavior("land-stone","walk");
  assert.equal(result.type,"modifyMovementCost");
  assert.equal(result.system.difficulties.walk,1.5);
  assert.equal(result.flags[MODULE_ID].nativeMovementCost.multiplier,1.5);
  assert.throws(()=>buildNativeMovementCostBehavior("land-stone","crawl"),
    /cannot store an independent native Region cost/);
  globalThis.CONFIG.RegionBehavior.dataModels.modifyMovementCost=
    class Unknown extends NativeModel { static schema={fields:{}}; };
  assert.throws(()=>buildNativeMovementCostBehavior("land-stone","walk"),/schema is unavailable/);
});

test("native schema roundtrip excludes token actions whose cost field is discarded",()=>{
  setup();
  class WalkOnlyModel extends NativeModel {
    constructor(source) {
      super({difficulties:{walk:source?.difficulties?.walk ?? 1}});
    }
  }
  globalThis.CONFIG.RegionBehavior.dataModels.modifyMovementCost=WalkOnlyModel;
  assert.deepEqual(availableMovementActions().map(a=>a.id),["walk"]);
  assert.ok(unavailableMovementActions().some(a=>a.id==="fly"));
  assert.throws(()=>buildNativeMovementCostBehavior("land-stone","fly"),
    /cannot store an independent native Region cost/);
  assert.equal(buildNativeMovementCostBehavior("land-stone","walk")
    .system.difficulties.walk,1.5);
});

test("creation applies exactly one native Behavior ONLY when checked, and remains atomic",async()=>{
  const {scene,regions,regionRecords,settings}=setup();
  const plan=planSceneGeneratedRegion(scene,settings);
  await saveGeneratedNativeRegion(scene,plan,{presetId:"land-stone",
    movementAction:"walk",expectedMultiplier:1.5,applyNativeCost:true});
  assert.equal(regionRecords[0].behaviors.length,1);
  assert.equal(regionRecords[0].behaviors[0].system.difficulties.walk,1.5);
  assert.equal(nativeCostSummary(regions.get("native1")).managed,true);
});

test("without opt-in corridor creation preserves metadata and no native Behavior",async()=>{
  const {scene,regionRecords,settings}=setup();
  await saveGeneratedNativeRegion(scene,planSceneGeneratedRegion(scene,settings),
    {presetId:"land-stone"});
  assert.deepEqual(regionRecords[0].behaviors,[]);
  assert.equal(regionRecords[0].flags[MODULE_ID].travelPreset.presetId,"land-stone");
});

test("reject invalid action or stale cost before creating any native Region",async()=>{
  const {scene,regionRecords,settings}=setup();
  const plan=planSceneGeneratedRegion(scene,settings);
  await assert.rejects(()=>saveGeneratedNativeRegion(scene,plan,{
    presetId:"land-stone",movementAction:"crawl",expectedMultiplier:1.5,applyNativeCost:true
  }),/cannot store an independent native Region cost/);
  await assert.rejects(()=>saveGeneratedNativeRegion(scene,plan,{
    presetId:"land-stone",movementAction:"walk",expectedMultiplier:2,applyNativeCost:true
  }),/changed since confirmation/);
  assert.equal(regionRecords.length,0);
});

test("existing corridor applies only once; refuses to overwrite native costs",async()=>{
  const {scene,regions,behaviorRecords,settings}=setup();
  const plan=planSceneGeneratedRegion(scene,settings);
  await saveGeneratedNativeRegion(scene,plan,{presetId:"land-stone"});
  const region=regions.get("native1");
  region.behaviors.push({type:"pauseGame",disabled:false});
  await applyGeneratedRegionMovementCost(scene,"native1",{
    expectedPresetId:"land-stone",expectedMultiplier:1.5,movementAction:"fly"
  });
  assert.equal(behaviorRecords.length,1);
  assert.equal(region.behaviors[0].type,"pauseGame");
  assert.equal(region.behaviors[1].system.difficulties.fly,1.5);
  await assert.rejects(()=>applyGeneratedRegionMovementCost(scene,"native1",{
    expectedPresetId:"land-stone",expectedMultiplier:1.5,movementAction:"fly"
  }),/already has a native Modify Movement Cost/);
});

test("manual cost and GM-only boundaries remain protected",async()=>{
  const {scene,regions,settings}=setup();
  await saveGeneratedNativeRegion(scene,planSceneGeneratedRegion(scene,settings),
    {presetId:"land-stone"});
  const region=regions.get("native1");
  region.behaviors=[{type:"modifyMovementCost",disabled:true,system:{difficulties:{walk:2}}}];
  await assert.rejects(()=>applyGeneratedRegionMovementCost(scene,"native1",{
    expectedPresetId:"land-stone",expectedMultiplier:1.5,movementAction:"walk"
  }),/already has a native Modify Movement Cost/);
  region.behaviors=[];
  globalThis.game.user.isGM=false;
  await assert.rejects(()=>applyGeneratedRegionMovementCost(scene,"native1",{
    expectedPresetId:"land-stone",expectedMultiplier:1.5,movementAction:"walk"
  }),/Only a GM/);
});

test("preset edits do not retroactively update already authored costs",async()=>{
  const {scene,regions,settings,changeWorld}=setup();
  await saveGeneratedNativeRegion(scene,planSceneGeneratedRegion(scene,settings),{
    presetId:"land-stone",movementAction:"walk",expectedMultiplier:1.5,applyNativeCost:true
  });
  const saved=regions.get("native1").behaviors[0].system.difficulties.walk;
  const revised=defaultTravelPresets();
  revised.presets.find(p=>p.id==="land-stone").movementCostMultiplier=3;
  changeWorld(revised);
  assert.equal(regions.get("native1").behaviors[0].system.difficulties.walk,saved);
});

test("v14 quarter-step rounding is shown before creation and never silently applied",async()=>{
  const {scene,regionRecords,settings,changeWorld}=setup();
  class RoundedCostModel extends NativeModel {
    constructor(source) {
      super({difficulties:Object.fromEntries(
        Object.entries(source.difficulties ?? {})
          .map(([action,cost])=>[action,Math.round(cost*4)/4]))});
    }
  }
  globalThis.CONFIG.RegionBehavior.dataModels.modifyMovementCost=RoundedCostModel;
  globalThis.CONFIG.Token.movement.actions.swim={label:"Swim"};
  const world=defaultTravelPresets();
  const stone=world.presets.find(p=>p.id==="land-stone");
  stone.movementCostMultiplier=1.1;
  changeWorld(world);
  assert.deepEqual(availableMovementActions().map(a=>a.id),
    ["walk","fly","swim"]);
  const preview=previewNativeMovementCost("land-stone","swim");
  assert.equal(preview.ok,false);
  assert.equal(preview.requested,1.1);
  assert.equal(preview.effective,1);
  assert.match(preview.message,/×1.10.*×1.00/);
  assert.throws(()=>buildNativeMovementCostBehavior("land-stone","swim"),
    /×1.10.*×1.00/);
  await assert.rejects(()=>saveGeneratedNativeRegion(scene,
    planSceneGeneratedRegion(scene,settings),{
      presetId:"land-stone",movementAction:"swim",expectedMultiplier:1.1,applyNativeCost:true
    }),/×1.10.*×1.00/);
  assert.equal(regionRecords.length,0);
  stone.movementCostMultiplier=1.2;
  changeWorld(world);
  const roundedUp=previewNativeMovementCost("land-stone","fly");
  assert.equal(roundedUp.ok,false);
  assert.equal(roundedUp.effective,1.25);
  stone.movementCostMultiplier=1.25;
  changeWorld(world);
  assert.equal(previewNativeMovementCost("land-stone","swim").ok,true);
  assert.equal(buildNativeMovementCostBehavior("land-stone","swim")
    .system.difficulties.swim,1.25);
});


test("multi-action preset creates ONE native Behavior with exact per-mode values",async()=>{
  const {scene,regionRecords,regions,settings,changeWorld}=setup();
  const world=defaultTravelPresets();
  const preset=world.presets.find(p=>p.id==="land-stone");
  preset.movementCosts={walk:0.75,fly:2.5};
  changeWorld(world);
  const preview=previewNativeMovementCost("land-stone");
  assert.equal(preview.ok,true);
  assert.deepEqual(preview.nativeData.difficulties,{walk:0.75,fly:2.5});
  const behavior=buildNativeMovementCostBehavior("land-stone");
  assert.equal(behavior.flags[MODULE_ID].nativeMovementCost.schemaVersion,2);
  await saveGeneratedNativeRegion(scene,planSceneGeneratedRegion(scene,settings),{
    presetId:"land-stone",applyNativeCost:true,expectedCosts:{fly:2.5,walk:0.75}
  });
  assert.equal(regionRecords.length,1);
  assert.equal(regionRecords[0].behaviors.length,1);
  assert.deepEqual(regionRecords[0].behaviors[0].system.difficulties,
    {walk:0.75,fly:2.5});
  assert.equal(nativeCostSummary(regions.get("native1")).managed,true);
  assert.deepEqual(nativeCostSummary(regions.get("native1")).detail.movementCosts,
    {walk:0.75,fly:2.5});
});

test("unselected modes mean No override; 0 blocks nothing and cannot be authored",()=>{
  const {changeWorld}=setup();
  const world=defaultTravelPresets();
  const preset=world.presets.find(p=>p.id==="land-stone");
  preset.movementCosts={walk:2};
  changeWorld(world);
  assert.deepEqual(buildNativeMovementCostBehavior("land-stone").system.difficulties,
    {walk:2});
  preset.movementCosts={};
  assert.match(previewNativeMovementCost("land-stone").message,/no movement-cost overrides/);
});

test("multi-action native preview refuses unsupported or coerced costs atomically",async()=>{
  const {scene,regionRecords,settings,changeWorld}=setup();
  const world=defaultTravelPresets();
  world.presets.find(p=>p.id==="land-stone").movementCosts={walk:0.75,swim:1.25};
  changeWorld(world);
  assert.match(previewNativeMovementCost("land-stone").message,/cannot independently author/);
  await assert.rejects(()=>saveGeneratedNativeRegion(scene,
    planSceneGeneratedRegion(scene,settings),{
      presetId:"land-stone",applyNativeCost:true,
      expectedCosts:{walk:0.75,swim:1.25}
    }),/cannot independently author/);
  assert.equal(regionRecords.length,0);
  class RoundedCostModel extends NativeModel {
    constructor(source) {
      super({difficulties:Object.fromEntries(Object.entries(source.difficulties??{})
        .map(([id,cost])=>[id,Math.round(cost*4)/4]))});
    }
  }
  globalThis.CONFIG.RegionBehavior.dataModels.modifyMovementCost=RoundedCostModel;
  world.presets.find(p=>p.id==="land-stone").movementCosts={walk:0.75,fly:1.1};
  changeWorld(world);
  assert.match(previewNativeMovementCost("land-stone").message,/×1.10.*×1.00/);
  assert.equal(regionRecords.length,0);
});

test("existing corridor applies multi-cost once and rejects stale world edit",async()=>{
  const {scene,regions,behaviorRecords,settings,changeWorld}=setup();
  const world=defaultTravelPresets();
  world.presets.find(p=>p.id==="land-stone").movementCosts={walk:0.75,fly:2};
  changeWorld(world);
  await saveGeneratedNativeRegion(scene,planSceneGeneratedRegion(scene,settings),
    {presetId:"land-stone"});
  const region=regions.get("native1");
  await assert.rejects(()=>applyGeneratedRegionMovementCost(scene,"native1",{
    expectedPresetId:"land-stone",expectedCosts:{walk:1,fly:2}
  }),/changed since confirmation/);
  assert.equal(behaviorRecords.length,0);
  await applyGeneratedRegionMovementCost(scene,"native1",{
    expectedPresetId:"land-stone",expectedCosts:{fly:2,walk:0.75}
  });
  assert.equal(behaviorRecords.length,1);
  assert.equal(region.behaviors.length,1);
  assert.equal(region.behaviors[0].system.difficulties.fly,2);
  await assert.rejects(()=>applyGeneratedRegionMovementCost(scene,"native1",{
    expectedPresetId:"land-stone",expectedCosts:{fly:2,walk:0.75}
  }),/already has a native Modify Movement Cost/);
});

test("Foundry mutating source cannot create a false stale-preset warning", async () => {
  const {scene,regions,behaviorRecords,settings,changeWorld}=setup();
  const world=defaultTravelPresets();
  const preset=world.presets.find(p=>p.id==="water-rough");
  preset.movementCosts={walk:10,fly:1.5,swim:1.5,burrow:10};
  changeWorld(world);
  globalThis.CONFIG.Token.movement.actions.swim={label:"Swim"};
  globalThis.CONFIG.Token.movement.actions.burrow={label:"Burrow"};
  class MutatingNativeModel extends NativeModel {
    constructor(source) {
      // A native schema may insert a neutral default while cleaning its input.
      source.difficulties.nativeDefault=1;
      super(source);
    }
  }
  globalThis.CONFIG.RegionBehavior.dataModels.modifyMovementCost=MutatingNativeModel;
  await saveGeneratedNativeRegion(scene,planSceneGeneratedRegion(scene,settings),{
    presetId:"water-rough"
  });
  const expected={walk:10,fly:1.5,swim:1.5,burrow:10};
  assert.equal(previewNativeMovementCost("water-rough").ok,true);
  await applyGeneratedRegionMovementCost(scene,"native1",{
    expectedPresetId:"water-rough",expectedCosts:structuredClone(expected)
  });
  assert.equal(behaviorRecords.length,1);
  const saved=behaviorRecords[0];
  assert.deepEqual(saved.flags[MODULE_ID].nativeMovementCost.movementCosts,expected);
  assert.deepEqual(world.presets.find(p=>p.id==="water-rough").movementCosts,expected);
  assert.equal(saved.system.difficulties.nativeDefault,1);
  assert.equal(nativeCostSummary(regions.get("native1")).managed,true);
});

test("mutating native normalization still fails exact comparison before any write", async () => {
  const {scene,regionRecords,settings,changeWorld}=setup();
  const world=defaultTravelPresets();
  const preset=world.presets.find(p=>p.id==="water-rough");
  preset.movementCosts={walk:1.1,fly:1.25};
  changeWorld(world);
  class MutatingRoundingModel extends NativeModel {
    constructor(source) {
      for (const id of Object.keys(source.difficulties)) {
        source.difficulties[id]=Math.round(source.difficulties[id]*4)/4;
      }
      super(source);
    }
  }
  globalThis.CONFIG.RegionBehavior.dataModels.modifyMovementCost=MutatingRoundingModel;
  const preview=previewNativeMovementCost("water-rough");
  assert.equal(preview.ok,false);
  assert.equal(preview.requested,1.1);
  assert.equal(preview.effective,1);
  await assert.rejects(()=>saveGeneratedNativeRegion(scene,
    planSceneGeneratedRegion(scene,settings),{
      presetId:"water-rough",applyNativeCost:true,
      expectedCosts:{walk:1.1,fly:1.25}
    }),/×1.10.*×1.00/);
  assert.equal(regionRecords.length,0);

  // The legacy single-action flow must also reject normalization.
  preset.movementCosts=null;
  preset.movementCostMultiplier=1.1;
  changeWorld(world);
  const legacy=previewNativeMovementCost("water-rough","walk");
  assert.equal(legacy.ok,false);
  assert.equal(legacy.effective,1);
});

test("v0.2.18 advisory distinguishes un-applied, matching, stale and GM-edited costs",()=>{
 const world=defaultTravelPresets();
 const preset=world.presets.find(p=>p.id==="land-stone");
 preset.movementCosts={walk:0.75,fly:1.5};
 assert.equal(nativeCostPresetStatus({existing:false},preset).state,"not-applied");
 const managed={
   existing:true,managed:true,count:1,
   detail:{schemaVersion:2,presetId:preset.id,
     movementCosts:{walk:0.75,fly:1.5}},
   actualCosts:{walk:0.75,fly:1.5,swim:1}
 };
 assert.equal(nativeCostPresetStatus(managed,preset).state,"current");
 const changed={...preset,movementCosts:{walk:1,fly:1.5}};
 assert.equal(nativeCostPresetStatus(managed,changed).state,"outdated");
 const edited={...managed,actualCosts:{walk:1,fly:1.5}};
 assert.equal(nativeCostPresetStatus(edited,preset).state,"edited");
 assert.equal(nativeCostPresetStatus({...managed,managed:false},preset).state,"manual");
 assert.equal(nativeCostPresetStatus({...managed,count:2},preset).state,"manual");
 assert.equal(nativeCostPresetStatus({...managed,
   detail:{...managed.detail,presetId:"other"}},preset).state,"different");
 const legacy={...preset,movementCosts:null,movementCostMultiplier:1.5};
 const single={...managed,detail:{schemaVersion:1,presetId:preset.id,
   action:"walk",multiplier:1.5},actualCosts:{walk:1.5,fly:1}};
 assert.equal(nativeCostPresetStatus(single,legacy).state,"current");
 assert.equal(nativeCostPresetStatus(single,{...legacy,movementCostMultiplier:2}).state,"outdated");
});
