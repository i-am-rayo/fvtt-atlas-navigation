import test from "node:test";
import assert from "node:assert/strict";
import { defaultManualFog } from "../scripts/atlas-manual-fog-model.js";
import { defaultAtlasMapFog } from "../scripts/atlas-map-fog-model.js";
import { readManualFog,readAtlasMapFog } from "../scripts/atlas-fog-readers.js";
import { readManualFog as existingManualReader } from "../scripts/atlas-manual-fog-storage.js";
import { readAtlasMapFog as existingMapReader } from "../scripts/atlas-map-fog-storage.js";
import { inspectRepository } from "../tools/architecture-graph.mjs";

const sceneFrom=flags=>({getFlag:(_module,key)=>flags.get(key)});

test("legacy callers retain identical Scene fog readers and validated defaults",()=>{
  assert.equal(existingManualReader,readManualFog);
  assert.equal(existingMapReader,readAtlasMapFog);
  const scene=sceneFrom(new Map());
  assert.deepEqual(readManualFog(scene),defaultManualFog());
  assert.deepEqual(readAtlasMapFog(scene),defaultAtlasMapFog());
  assert.throws(()=>readManualFog(null),/Select an Atlas Scene/);
  assert.throws(()=>readAtlasMapFog(null),/Select an Atlas Scene/);
});

test("legacy map-fog opt-in still keeps undiscovered terrain hidden",()=>{
  const flags=new Map([["mapFog",{...defaultAtlasMapFog(),enabled:true}]]);
  const scene=sceneFrom(flags);
  assert.equal(readManualFog(scene).enabled,true,
    "an old mapFog flag must not expose the Scene when manualFog is absent");
  flags.set("manualFog",{...defaultManualFog(),enabled:false});
  assert.equal(readManualFog(scene).enabled,false,
    "a newer explicit manual setting supersedes the legacy fallback");
  flags.set("manualFog",{...defaultManualFog(),enabled:true,
    revealed:[{x:25,y:25}]});
  assert.deepEqual(readManualFog(scene).revealed,[{x:25,y:25}]);
  assert.deepEqual(readAtlasMapFog(scene).trail,[]);
});

test("fog flags now have no circular storage reader dependencies",async()=>{
  const graph=await inspectRepository();
  assert.deepEqual(graph.cycles,[],
    "do not reintroduce cyclic imports into exploration/persistence modules");
  for(const filename of ["scripts/party-exploration-storage.js",
    "scripts/atlas-map-fog-storage.js","scripts/atlas-manual-fog-storage.js"]){
    assert.ok(graph.edges.get(filename).includes("scripts/atlas-fog-readers.js"));
  }
});
