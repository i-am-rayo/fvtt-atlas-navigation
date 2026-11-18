import test from "node:test";
import assert from "node:assert/strict";
import {defaultCheckpointPresets,validateCheckpointPresets,
  upsertCheckpointPreset} from "../scripts/checkpoint-preset-model.js";
import {withCheckpointBanner} from "../scripts/checkpoint-appearance.js";

test("World presets keep portable type/elevation controls but reject local Region ID",()=>{
  const catalog=defaultCheckpointPresets();
  const city=catalog.presets.find(p=>p.category==="city");
  assert.ok(city);
  const portable=withCheckpointBanner(city.appearance,{
    showType:true,showElevation:true,territoryRegionId:null});
  const modified=upsertCheckpointPreset(catalog,{...city,appearance:portable});
  const saved=modified.presets.find(p=>p.id===city.id);
  assert.equal(saved.appearance.banner.showType,true);
  assert.equal(saved.appearance.banner.territoryRegionId,null);
  const leaked=withCheckpointBanner(city.appearance,{
    showType:true,showElevation:true,territoryRegionId:"city-other-scene",territorySceneId:"scene-1"});
  assert.throws(()=>validateCheckpointPresets({
    ...catalog,presets:catalog.presets.map(p=>
      p.id===city.id?{...p,appearance:leaked}:p)
  }),/World Checkpoint presets cannot store Scene Territory IDs/);
  assert.equal(city.appearance.banner,undefined,
    "existing World preset snapshot is not silently mutated");
});
