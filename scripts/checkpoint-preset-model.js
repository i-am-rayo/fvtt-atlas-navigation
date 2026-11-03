import { CHECKPOINT_TYPES } from "./checkpoint-types.js";
import { validateCheckpointAppearance,resolveCheckpointAppearance,checkpointFontIcon } from "./checkpoint-appearance.js";
import { defaultCheckpointTransportOffers,validateCheckpointTransportOffers } from "./checkpoint-transportation.js";

export const CHECKPOINT_PRESET_SETTING="checkpointPresets";
export const CHECKPOINT_PRESET_VERSION=4;
export const MAX_CHECKPOINT_PRESETS=160;
const CATEGORIES=new Set(CHECKPOINT_TYPES.map(([id])=>id));
const ID=/^[A-Za-z0-9_-]{1,128}$/;
const METHODS=new Set(["automatic","gm","lore"]);
const HAZARDS=new Set(["falling-rocks","quicksand","moving-sand","avalanche","flood","sea-storm","reef","whirlpool"]);
const ENCOUNTERS=new Set(["event","monster","bandits","thieves","npc","pirates","sea-monster"]);

/** Display defaults only; existing customized appearance objects always win. */
const BUILTIN_ICONS=Object.freeze({
  bridge:"bridge",port:"anchor",dock:"ship",lighthouse:"tower-observation","air-dock":"wind",toll:"coins",security:"shield-halved",
  crossing:"route",settlement:"house",city:"city",town:"building",village:"house-chimney",stables:"horse",
  inn:"hotel",tavern:"beer-mug-empty",rest:"bed",safehouse:"house-lock",
  trading:"store",watchtower:"tower-observation",fort:"shield",
  guard:"shield",outpost:"campground",temple:"place-of-worship",
  shrine:"church",monument:"monument",ruins:"landmark",landmark:"map-pin",
  cave:"dungeon",pass:"mountain",mines:"pickaxe",camp:"tent",
  "falling-rocks":"hill-rockslide",quicksand:"person-falling",
  "moving-sand":"wind",avalanche:"mountain-sun",flood:"water",
  "sea-storm":"cloud-bolt",reef:"water",whirlpool:"water",
  event:"dice-d20",monster:"dragon",bandits:"skull-crossbones",
  thieves:"user-ninja",npc:"user",pirates:"skull-crossbones","sea-monster":"fish-fins"
});
const COLOR_BY_CATEGORY=Object.freeze({
  bridge:"#B2A49A",port:"#46AFC8",dock:"#529DCA",lighthouse:"#E4D29C","air-dock":"#A7B7E8",toll:"#E2B75E",
  security:"#C78C62",crossing:"#D5BA7C",settlement:"#E0B879",
  city:"#D8B49C",town:"#D3BA9D",village:"#C6C89B",stables:"#C6A879",inn:"#DBA56E",tavern:"#D38E69",
  rest:"#7DBD88",safehouse:"#6CB79B",trading:"#DAAF6A",
  watchtower:"#B69C83",fort:"#9A94AB",guard:"#AC98A4",outpost:"#C5AA7C",
  temple:"#B9A0E6",shrine:"#C7ACE8",monument:"#B9B4C9",ruins:"#9C9C9C",
  landmark:"#D7B873",cave:"#A69A82",pass:"#AAB9C8",mines:"#D0AD7B",camp:"#89B985",
  "falling-rocks":"#D4834B",quicksand:"#D6B45E","moving-sand":"#CEAD64",
  avalanche:"#93B9D2",flood:"#5A9CCC","sea-storm":"#587BB3",reef:"#69ADBC",whirlpool:"#5B88C4",event:"#BD95D8",
  monster:"#D86A68",bandits:"#CF665F",pirates:"#B94F4B","sea-monster":"#6C9AA8",thieves:"#B98466",npc:"#8CA4C0"
});

export function checkpointPresetAppearance(category,appearance=null){
  if(appearance!==null)return validateCheckpointAppearance(appearance);
  const slug=BUILTIN_ICONS[category];
  const icon=slug&&"solid:"+slug;
  return icon&&(icon==="solid:pickaxe"||checkpointFontIcon(icon))
    ?{...resolveCheckpointAppearance(null),type:"fa",icon:icon==="solid:pickaxe"?"pickaxe":icon,
      size:["city","town","village","settlement","port"].includes(category)?24:12,
      color:COLOR_BY_CATEGORY[category]??"#9c7bf0"}
    :null;
}

export function defaultCheckpointPresets(){
  const names=new Map(CHECKPOINT_TYPES);
  return {schemaVersion:CHECKPOINT_PRESET_VERSION,presets:CHECKPOINT_TYPES
    .filter(([id])=>id!=="generic"&&id!=="custom")
    .map(([id])=>({id:"checkpoint-"+id,name:names.get(id),category:id,
      appearance:checkpointPresetAppearance(id),elevationMeters:null,discoveryStatus:"unknown",journalUuid:null,
      playerVisible:false,
      discoveryMethod:"automatic",revealRadiusCells:3,
      terrain:{presetId:null,radiusCells:.25},
      transportation:defaultCheckpointTransportOffers(id),
      event:{kind:HAZARDS.has(id)?"hazard":ENCOUNTERS.has(id)?"encounter":"none",enabled:false}}))};
}

/** A checkpoint preset is a snapshot of editable defaults, not a live link. */
export function validateCheckpointPresets(value){
  if(value==null)return defaultCheckpointPresets();
  if(!value||typeof value!=="object"||Array.isArray(value)||
      ![1,2,3,CHECKPOINT_PRESET_VERSION].includes(value.schemaVersion)||
      Object.keys(value).some(k=>!["schemaVersion","presets"].includes(k))||
      !Array.isArray(value.presets)||value.presets.length>MAX_CHECKPOINT_PRESETS)
    throw Error("Unsupported Atlas checkpoint preset catalog.");
  const ids=new Set();
  const presets=value.presets.map(p=>{
    if(!p||typeof p!=="object"||Array.isArray(p)||
        Object.keys(p).some(k=>!["id","name","category","appearance","elevationMeters",
          "discoveryStatus","journalUuid","playerVisible",
          "discoveryMethod","revealRadiusCells","terrain","transportation","event"].includes(k))||
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
      appearance:p.id==="checkpoint-"+p.category
        ?checkpointPresetAppearance(p.category,p.appearance)
        :(p.appearance==null?null:validateCheckpointAppearance(p.appearance)),
      elevationMeters:p.elevationMeters??null,discoveryStatus:p.discoveryStatus??"unknown",
      journalUuid:p.journalUuid??null,
      playerVisible:p.playerVisible??false,
      discoveryMethod:p.discoveryMethod,revealRadiusCells:p.revealRadiusCells,
      terrain:{presetId:terrain.presetId,radiusCells:terrain.radiusCells},
      transportation:validateCheckpointTransportOffers(p.transportation??
        defaultCheckpointTransportOffers(p.category)),
      event:{kind:event.kind,enabled:false}};
  });
  // Project older Worlds without writes. Town was introduced in v4;
  // once saved as v4, intentional removals remain respected.
  if(value.schemaVersion<CHECKPOINT_PRESET_VERSION){
    const added=value.schemaVersion===1?
      ["stables","mines","lighthouse","sea-storm","reef",
        "whirlpool","pirates","sea-monster","air-dock","town"]:
      value.schemaVersion===2?["air-dock","town"]:["town"];
    const fresh=defaultCheckpointPresets().presets;
    for(const category of added){
      if(!presets.some(p=>p.category===category))
        presets.push(fresh.find(p=>p.category===category));
    }
  }
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
