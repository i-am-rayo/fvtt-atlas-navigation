import test from "node:test";
import assert from "node:assert/strict";
import {CHECKPOINT_TYPES,validateCheckpointCategories} from "../scripts/checkpoint-types.js";
import {defaultCheckpointPresets,validateCheckpointPresets,
  upsertCheckpointPreset,removeCheckpointPreset,presetForCheckpointType}
  from "../scripts/checkpoint-preset-model.js";
import {checkpointTerrainSuggestion} from "../scripts/checkpoint-preset-snapshot.js";

test("expanded checkpoint category catalog preserves existing stable type IDs",()=>{
  const types=new Set(CHECKPOINT_TYPES.map(([id])=>id));
  for(const type of ["bridge","toll","settlement","crossing","landmark","event",
    "port","security","temple","safehouse","rest","watchtower",
    "falling-rocks","moving-sand","monster","thieves"])assert.ok(types.has(type),type);
  assert.deepEqual(validateCheckpointCategories({a:"bridge",b:"moving-sand"}),
    {a:"bridge",b:"moving-sand"});
});

test("new Worlds include editable checkpoint templates with disabled event automation",()=>{
  const initial=defaultCheckpointPresets();
  assert.deepEqual(validateCheckpointPresets(initial),initial);
  const bridge=presetForCheckpointType(initial,"bridge");
  assert.equal(bridge.terrain.radiusCells,.25);
  assert.equal(bridge.discoveryMethod,"automatic");
  assert.equal(presetForCheckpointType(initial,"falling-rocks").event.kind,"hazard");
  assert.equal(presetForCheckpointType(initial,"monster").event.enabled,false);
});

test("checkpoint presets use stable IDs, snapshots and never permit active event triggers",()=>{
  const initial=defaultCheckpointPresets();
  const before=structuredClone(initial);
  const newPreset={id:"custom-bridge",name:"Old Stone Bridge",category:"bridge",
    appearance:null,discoveryMethod:"gm",revealRadiusCells:2,
    terrain:{presetId:"land-stone",radiusCells:.5},
    event:{kind:"none",enabled:false}};
  const edited=upsertCheckpointPreset(initial,newPreset);
  assert.equal(presetForCheckpointType(edited,"bridge")?.id,"checkpoint-bridge");
  assert.deepEqual(edited.presets.at(-1),newPreset);
  assert.deepEqual(initial,before);
  assert.equal(removeCheckpointPreset(edited,newPreset.id).presets.length,initial.presets.length);
  assert.throws(()=>upsertCheckpointPreset(initial,{...newPreset,
    event:{kind:"hazard",enabled:true}}),/configuration-only/);
  assert.throws(()=>upsertCheckpointPreset(initial,{...newPreset,
    terrain:{presetId:"land-stone",radiusCells:100}}),/terrain suggestion/);
});

test("checkpoint terrain suggestion reads only valid opt-in Scene snapshots",()=>{
  const scene={getFlag:()=>({schemaVersion:1,entries:{a:{presetId:"land-stone",radiusCells:.5}}})};
  assert.deepEqual(checkpointTerrainSuggestion(scene,"a"),{presetId:"land-stone",radiusCells:.5});
  assert.equal(checkpointTerrainSuggestion(scene,"missing"),null);
  assert.equal(checkpointTerrainSuggestion({getFlag:()=>({schemaVersion:9,entries:{}})},"a"),null);
  assert.equal(checkpointTerrainSuggestion({getFlag:()=>({schemaVersion:1,
    entries:{a:{presetId:"bad id",radiusCells:99}}})},"a"),null);
});
