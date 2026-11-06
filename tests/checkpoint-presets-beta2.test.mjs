import test from "node:test";
import assert from "node:assert/strict";
import {CHECKPOINT_TYPES,validateCheckpointCategories} from "../scripts/checkpoint-types.js";
import {defaultCheckpointPresets,validateCheckpointPresets,
  upsertCheckpointPreset,removeCheckpointPreset,presetForCheckpointType}
  from "../scripts/checkpoint-preset-model.js";
import {checkpointTerrainSuggestion} from "../scripts/checkpoint-preset-snapshot.js";

test("expanded checkpoint category catalog preserves existing stable type IDs",()=>{
  const types=new Set(CHECKPOINT_TYPES.map(([id])=>id));
  for(const type of ["bridge","toll","settlement","town","crossing","landmark","event",
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
  assert.equal(bridge.elevationMeters,null);
  assert.equal(bridge.discoveryStatus,"unknown");
  assert.equal(bridge.journalUuid,null);
  assert.ok(initial.presets.every(p=>p.appearance?.type==="fa"),
    "Every built-in checkpoint preset has a Font Awesome icon");
  assert.ok(initial.presets.every(p=>/^#[0-9A-Fa-f]{6}$/.test(p.appearance.color)));
  assert.notEqual(presetForCheckpointType(initial,"port").appearance.color,
    presetForCheckpointType(initial,"bridge").appearance.color);
});

test("legacy built-in dots gain themed icons without overwriting customized presets",()=>{
  const initial=defaultCheckpointPresets();
  const old={...initial,presets:initial.presets.map(p=>({...p,appearance:null}))};
  const upgraded=validateCheckpointPresets(old);
  assert.equal(presetForCheckpointType(upgraded,"port").appearance.icon,"solid:anchor");
  assert.equal(presetForCheckpointType(upgraded,"bridge").appearance.icon,"solid:bridge");
  const custom={...initial.presets.find(p=>p.category==="port"),
    appearance:{...initial.presets.find(p=>p.category==="port").appearance,color:"#FF00AA"}};
  const edited=upsertCheckpointPreset(old,custom);
  assert.equal(presetForCheckpointType(edited,"port").appearance.color,"#FF00AA");
  assert.equal(old.presets[0].appearance,null,"legacy input is never mutated");
});

test("full checkpoint preset defaults round-trip without overwriting legacy catalogs",()=>{
  const old=defaultCheckpointPresets();
  const legacy={...old,presets:old.presets.map(({elevationMeters,discoveryStatus,journalUuid,playerVisible,...rest})=>rest)};
  const upgraded=validateCheckpointPresets(legacy);
  assert.equal(upgraded.presets[0].elevationMeters,null);
  assert.equal(upgraded.presets[0].discoveryStatus,"unknown");
  assert.equal(upgraded.presets[0].journalUuid,null);
  assert.equal(upgraded.presets[0].playerVisible,false);
  const custom={...upgraded.presets[0],elevationMeters:12,
    discoveryStatus:"lore",journalUuid:"JournalEntry.abc123"};
  const changed=upsertCheckpointPreset(upgraded,custom);
  assert.deepEqual(changed.presets[0],custom);
  assert.equal(changed.presets[1].id,upgraded.presets[1].id);
  assert.equal(changed.presets.length,upgraded.presets.length);
  assert.equal(legacy.presets[0].journalUuid,undefined);
  assert.throws(()=>upsertCheckpointPreset(upgraded,{...custom,
    journalUuid:"https://example.com/unsafe"}),/Journal/);
});

test("checkpoint presets use stable IDs, snapshots and never permit active event triggers",()=>{
  const initial=defaultCheckpointPresets();
  const before=structuredClone(initial);
  const newPreset={id:"custom-bridge",name:"Old Stone Bridge",category:"bridge",
    appearance:null,discoveryMethod:"gm",revealRadiusCells:2,
    playerVisible:false,elevationMeters:null,discoveryStatus:"unknown",journalUuid:null,
    terrain:{presetId:"land-stone",radiusCells:.5},
    transportation:[],event:{kind:"none",enabled:false}};
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

test("Town appears in new and existing Worlds without resetting custom presets",()=>{
  const source=defaultCheckpointPresets();
  const town=presetForCheckpointType(source,"town");
  assert.equal(town.name,"Town");
  assert.equal(town.id,"checkpoint-town");
  assert.ok(town.appearance?.icon?.startsWith("solid:"));
  const previous={schemaVersion:3,presets:source.presets
    .filter(p=>p.category!=="town").map(p=>p.category==="city"?
      {...p,name:"Custom City",appearance:{...p.appearance,color:"#998877"}}:p)};
  const upgraded=validateCheckpointPresets(previous);
  assert.equal(upgraded.presets.find(p=>p.category==="town")?.name,"Town");
  assert.equal(upgraded.presets.find(p=>p.category==="city")?.name,"Custom City");
  assert.equal(upgraded.presets.find(p=>p.category==="city")?.appearance.color,"#998877");
  assert.equal(previous.presets.some(p=>p.category==="town"),false,
    "validation does not write into legacy catalogs");
  const removed=removeCheckpointPreset(upgraded,"checkpoint-town");
  assert.equal(removed.presets.some(p=>p.category==="town"),false,
    "version 4 respects intentional removal");
});
