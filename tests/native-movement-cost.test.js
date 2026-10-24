import test from "node:test";
import assert from "node:assert/strict";
import { MODULE_ID } from "../scripts/atlas-storage.js";
import { defaultTravelPresets } from "../scripts/travel-preset-model.js";
import { availableMovementActions, unavailableMovementActions,
  buildNativeMovementCostBehavior, previewNativeMovementCost, nativeCostSummary } from "../scripts/native-movement-cost.js";
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
    movementAction:"walk",expectedMultiplier:1.5});
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
    presetId:"land-stone",movementAction:"crawl",expectedMultiplier:1.5
  }),/cannot store an independent native Region cost/);
  await assert.rejects(()=>saveGeneratedNativeRegion(scene,plan,{
    presetId:"land-stone",movementAction:"walk",expectedMultiplier:2
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
    presetId:"land-stone",movementAction:"walk",expectedMultiplier:1.5
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
      presetId:"land-stone",movementAction:"swim",expectedMultiplier:1.1
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
