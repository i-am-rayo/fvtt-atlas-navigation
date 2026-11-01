import { CHECKPOINT_TYPES } from "./checkpoint-types.js";
import { validateCheckpointAppearance } from "./checkpoint-appearance.js";

export const CHECKPOINT_PRESET_SETTING="checkpointPresets";
export const CHECKPOINT_PRESET_VERSION=1;
export const MAX_CHECKPOINT_PRESETS=160;
const CATEGORIES=new Set(CHECKPOINT_TYPES.map(([id])=>id));
const ID=/^[A-Za-z0-9_-]{1,128}$/;
const METHODS=new Set(["automatic","gm","lore"]);
const HAZARDS=new Set(["falling-rocks","quicksand","moving-sand","avalanche","flood"]);
const ENCOUNTERS=new Set(["event","monster","bandits","thieves","npc"]);

export function defaultCheckpointPresets(){
  const names=new Map(CHECKPOINT_TYPES);
  return {schemaVersion:CHECKPOINT_PRESET_VERSION,presets:CHECKPOINT_TYPES
    .filter(([id])=>id!=="generic"&&id!=="custom")
    .map(([id])=>({id:"checkpoint-"+id,name:names.get(id),category:id,
      appearance:null,elevationMeters:null,discoveryStatus:"unknown",journalUuid:null,
      playerVisible:false,
      discoveryMethod:"automatic",revealRadiusCells:3,
      terrain:{presetId:null,radiusCells:.25},
      event:{kind:HAZARDS.has(id)?"hazard":ENCOUNTERS.has(id)?"encounter":"none",enabled:false}}))};
}

/** A checkpoint preset is a snapshot of editable defaults, not a live link. */
export function validateCheckpointPresets(value){
  if(value==null)return defaultCheckpointPresets();
  if(!value||typeof value!=="object"||Array.isArray(value)||
      value.schemaVersion!==CHECKPOINT_PRESET_VERSION||
      Object.keys(value).some(k=>!["schemaVersion","presets"].includes(k))||
      !Array.isArray(value.presets)||value.presets.length>MAX_CHECKPOINT_PRESETS)
    throw Error("Unsupported Atlas checkpoint preset catalog.");
  const ids=new Set();
  const presets=value.presets.map(p=>{
    if(!p||typeof p!=="object"||Array.isArray(p)||
        Object.keys(p).some(k=>!["id","name","category","appearance","elevationMeters",
          "discoveryStatus","journalUuid","playerVisible",
          "discoveryMethod","revealRadiusCells","terrain","event"].includes(k))||
        typeof p.id!=="string"||!ID.test(p.id)||ids.has(p.id)||
        typeof p.name!=="string"||!p.name.trim()||p.name.length>120||
        !CATEGORIES.has(p.category)||!METHODS.has(p.discoveryMethod)||
        !Number.isFinite(p.revealRadiusCells)||p.revealRadiusCells<0||p.revealRadiusCells>100)
      throw Error("Invalid checkpoint preset identity or defaults.");
    ids.add(p.id);
    if(p.elevationMeters!=null&&(!Number.isFinite(p.elevationMeters)||
      Math.abs(p.elevationMeters)>10000000))throw Error("Invalid checkpoint elevation default.");
    if(p.discoveryStatus!==undefined&&!["unknown","visited","lore"].includes(p.discoveryStatus))
      throw Error("Invalid checkpoint discovery status default.");
    if(p.journalUuid!=null&&(typeof p.journalUuid!=="string"||p.journalUuid.length>300||
      !/^(JournalEntry\.|Compendium\.)[A-Za-z0-9_.-]+$/.test(p.journalUuid)))
      throw Error("Invalid checkpoint Journal UUID default.");
    if(p.playerVisible!==undefined&&typeof p.playerVisible!=="boolean")
      throw Error("Invalid checkpoint player visibility default.");
    const terrain=p.terrain;
    if(!terrain||typeof terrain!=="object"||Array.isArray(terrain)||
        Object.keys(terrain).some(k=>!["presetId","radiusCells"].includes(k))||
        (terrain.presetId!==null&&(typeof terrain.presetId!=="string"||!ID.test(terrain.presetId)))||
        !Number.isFinite(terrain.radiusCells)||terrain.radiusCells<.25||terrain.radiusCells>3)
      throw Error("Invalid checkpoint terrain suggestion.");
    const event=p.event;
    if(!event||typeof event!=="object"||Array.isArray(event)||
        Object.keys(event).some(k=>!["kind","enabled"].includes(k))||
        !["none","hazard","encounter"].includes(event.kind)||event.enabled!==false)
      throw Error("Checkpoint events are configuration-only in this release.");
    return {id:p.id,name:p.name.trim(),category:p.category,
      appearance:p.appearance==null?null:validateCheckpointAppearance(p.appearance),
      elevationMeters:p.elevationMeters??null,discoveryStatus:p.discoveryStatus??"unknown",
      journalUuid:p.journalUuid??null,
      playerVisible:p.playerVisible??false,
      discoveryMethod:p.discoveryMethod,revealRadiusCells:p.revealRadiusCells,
      terrain:{presetId:terrain.presetId,radiusCells:terrain.radiusCells},
      event:{kind:event.kind,enabled:false}};
  });
  return {schemaVersion:CHECKPOINT_PRESET_VERSION,presets};
}

export function upsertCheckpointPreset(catalog,preset){
  const current=validateCheckpointPresets(catalog);
  const index=current.presets.findIndex(p=>p.id===preset.id);
  const presets=[...current.presets];
  if(index>=0)presets[index]=preset;
  else presets.push(preset);
  return validateCheckpointPresets({...current,presets});
}

export function removeCheckpointPreset(catalog,id){
  const current=validateCheckpointPresets(catalog);
  return validateCheckpointPresets({...current,presets:current.presets.filter(p=>p.id!==id)});
}

export function presetForCheckpointType(catalog,category){
  return validateCheckpointPresets(catalog).presets.find(p=>p.category===category)??null;
}
