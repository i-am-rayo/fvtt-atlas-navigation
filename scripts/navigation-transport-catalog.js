/**
 * Versioned, World-owned transportation options. No Foundry imports, no Actor or
 * Region writes. Built-ins are projected from a selected rules profile; saved
 * overrides and custom methods are independent of the reference tables.
 */
export const TRANSPORT_CATALOG_SETTING = "guidedTransportationCatalog";
export const TRANSPORT_CATALOG_VERSION = 1;
export const TRANSPORT_KINDS = Object.freeze(["foot", "mount", "vehicle"]);
export const TRANSPORT_SURFACES = Object.freeze(["land", "water", "air"]);
export const TRANSPORT_COST_BASES = Object.freeze(["none", "day", "mile"]);
export const TRANSPORT_REFERENCE_PROFILES = Object.freeze(["dnd5e2024", "dnd5e2014", "custom", "neutral"]);
const MODULE_ID = "fvtt-atlas-navigation";

const entry = (id, name, kind, surface, speedMph, costCp = 0, costBasis = "none",
  purchaseGp = null, note = "") =>
  Object.freeze({id, name, kind, surface, speedMph, costCp, costBasis, purchaseGp, note});
const foot = entry("walking", "Walking (party pace)", "foot", "land", null, 0, "none",
  null, "Uses the assigned Group Actor's travel pace; the World walking speed is a fallback.");
const mounted = entry("mounted", "Mounted (general)", "mount", "land", 3, 5, "day",
  null, "2024 normal overland pace is 3 mph. Feed costs 5 CP per mount per day; one-hour bursts need a rest.");
const ship = entry("sailing", "Sailing Ship", "vehicle", "water", 2, 0, "none",
  10000, "Waterborne vehicles use their listed speed. Crew, wind and currents are not automatically applied.");

/**
 * D&D 2024 Basic Rules, Playing the Game (Travel Pace) and Equipment.
 * Land mounts and drawn vehicles use overland travel pace, NOT their tactical
 * creature Speed in feet per 6-second round. 2014 uses the same reference
 * overland speeds for these options; edition-specific revisions stay isolated.
 */
const dnd2024 = Object.freeze([
  foot, mounted,
  entry("camel", "Camel", "mount", "land", 3, 5, "day", 50),
  entry("elephant", "Elephant", "mount", "land", 3, 5, "day", 200),
  entry("draft-horse", "Draft Horse", "mount", "land", 3, 5, "day", 50),
  entry("riding-horse", "Riding Horse", "mount", "land", 3, 5, "day", 75),
  entry("mastiff", "Mastiff", "mount", "land", 3, 5, "day", 25),
  entry("mule", "Mule", "mount", "land", 3, 5, "day", 8),
  entry("pony", "Pony", "mount", "land", 3, 5, "day", 30),
  entry("warhorse", "Warhorse", "mount", "land", 3, 5, "day", 400),
  entry("carriage", "Carriage", "vehicle", "land", 3, 0, "none", 100),
  entry("cart", "Cart", "vehicle", "land", 3, 0, "none", 15),
  entry("chariot", "Chariot", "vehicle", "land", 3, 0, "none", 250),
  entry("sled", "Sled", "vehicle", "land", 3, 0, "none", 20),
  entry("wagon", "Wagon", "vehicle", "land", 3, 0, "none", 35),
  entry("coach-hire", "Coach ride between towns", "vehicle", "land", 3, 3, "mile",
    null, "2024 hired coach fare is 3 CP per mile; no currency is deducted automatically."),
  entry("airship", "Airship", "vehicle", "air", 8, 0, "none", 40000),
  entry("galley", "Galley", "vehicle", "water", 4, 0, "none", 30000),
  entry("keelboat", "Keelboat", "vehicle", "water", 1, 0, "none", 3000),
  entry("longship", "Longship", "vehicle", "water", 3, 0, "none", 10000),
  entry("rowboat", "Rowboat", "vehicle", "water", 1.5, 0, "none", 50),
  ship,
  entry("warship", "Warship", "vehicle", "water", 2.5, 0, "none", 25000),
  entry("ship-passage", "Ship passage (hired)", "vehicle", "water", 2, 10, "mile",
    null, "2024 ship passage is 1 SP per mile; speed uses Sailing Ship as an editable example.")
]);
// 2014 source speeds vary for some vessels; rules profiles never share edits.
const dnd2014 = Object.freeze(dnd2024.map(p => Object.freeze({...p,
  speedMph:p.id==="rowboat"?2:p.id==="warship"?3:p.speedMph})));
export const TRANSPORT_REFERENCE_PRESETS = Object.freeze({
  dnd5e2024:dnd2024, dnd5e2014:dnd2014, custom:dnd2024, neutral:dnd2024
});

/** Optional GM-imported *planning examples* from the supplied 5e workbook.
 * The workbook mixes creature tactical-speed extrapolations, 2014 vehicles,
 * campaign-specific vehicles, magic items and spells. None of these are
 * D&D 2024 RAW sustained mount speeds. Never import without a GM click.
 */
export const OPTIONAL_WORKBOOK_EXAMPLES = Object.freeze([
  ["dire-wolf","Dire Wolf","land",5],["elk","Elk","land",5],
  ["giant-elk","Giant Elk","land",6],["giant-pig","Giant Pig","land",4],
  ["giant-goat","Giant Goat","land",5],["giant-cow","Giant Cow","land",4],
  ["giant-centipede","Giant Centipede","land",3],["giant-boar","Giant Boar","land",4],
  ["giant-bat","Giant Bat","air",6],["giant-scorpion","Giant Scorpion","land",4],
  ["giant-spider","Giant Spider","land",3],["giant-badger","Giant Badger","land",3],
  ["giant-crab","Giant Crab","land",3],["giant-weasel","Giant Weasel","land",4],
  ["displacer-beast","Displacer Beast","land",4],
  ["giant-snapping-turtle","Giant Snapping Turtle","water",4],
  ["sperm-whale","Sperm Whale","water",6],["giant-octopus","Giant Octopus","water",6],
  ["giant-eagle","Giant Eagle","air",8],["giant-owl","Giant Owl","air",6],
  // Additional flying creatures in the workbook.
  ["pegasus","Pegasus","air",9,"mount"],
  ["griffon","Griffon","air",8,"mount"],
  // Spells, special mounts, and magic-item examples.
  ["phantom-steed","Phantom Steed","land",10,"mount"],
  ["carpet-of-flying-3x5","Carpet of Flying (3×5 ft)","air",8,"vehicle"],
  ["carpet-of-flying-4x6","Carpet of Flying (4×6 ft)","air",6,"vehicle"],
  ["carpet-of-flying-5x7","Carpet of Flying (5×7 ft)","air",4,"vehicle"],
  ["carpet-of-flying-6x9","Carpet of Flying (6×9 ft)","air",3,"vehicle"],
  ["broom-of-flying","Broom of Flying","air",5,"vehicle"],
  ["clay-statue-of-flying","Clay Statue of Flying","air",5,"vehicle"],
  ["huge-woven-basket-of-flying","Huge Woven Basket of Flying","air",5,"vehicle"],
  ["cauldron-of-flying","Cauldron of Flying","air",5,"vehicle"],
  ["butter-churn-of-flying","Butter Churn of Flying","air",5,"vehicle"],
  ["birds-nest-of-flying","Bird's Nest of Flying","air",5,"vehicle"],
  ["tombstone-of-flying","Tombstone of Flying","air",5,"vehicle"],
  ["mortar-and-pestle-of-flying","Mortar and Pestle of Flying","air",5,"vehicle"],
  ["wind-walk","Wind Walk","air",30,"vehicle"],
  // Eberron and Acquisitions Incorporated examples supplied by the GM.
  ["lyrandar-airship","Eberron: Lyrandar Airship","air",20,"vehicle"],
  ["lyrandar-galleon","Eberron: Lyrandar Galleon","water",10,"vehicle"],
  ["orien-lightning-rail","Eberron: Orien Lightning Rail","land",30,"vehicle"],
  ["battle-balloon","Acquisitions Inc.: Battle Balloon","air",9,"vehicle"],
  ["mechanical-beholder","Acquisitions Inc.: Mechanical Beholder","air",3,"vehicle"]
].map(([id,name,surface,speedMph,kind="mount"])=>Object.freeze({
  id:"custom-"+id,name,kind,surface,speedMph,
  costCp:0,costBasis:"none",purchaseGp:null,
  note:"Optional workbook estimate, based on an alternate travel scenario. "+
    "Not the 2024 sustained mount rule; GM sets rest and movement conditions."
})));
/** Compatibility alias used by earlier beta tests and imported World catalogs. */
export const OPTIONAL_TIRELESS_EXAMPLES=OPTIONAL_WORKBOOK_EXAMPLES;

export function defaultTransportationCatalog(){
  return {version:TRANSPORT_CATALOG_VERSION, overrides:{}, customs:[]};
}
const text = (value,max=80)=>typeof value==="string" && value.trim().length>0 &&
  value.trim().length<=max;
const money = value => Number.isFinite(value) && value>=0 && value<=100000000;
const speed = value => Number.isFinite(value) && value>=0.1 && value<=600;
const own = (obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
const validCost = value => TRANSPORT_COST_BASES.includes(value);
const validProfile = value=>TRANSPORT_REFERENCE_PROFILES.includes(value);
const validCapacity=value=>value===null||(Number.isInteger(value)&&value>=1&&value<=1000);
const validCostApplies=value=>value==="unit"||value==="passenger";
const defaultCapacity=kind=>kind==="mount"?1:null;
const defaultCostApplies=id=>id==="coach-hire"||id==="ship-passage"?"passenger":"unit";
const immutable = value=>Object.freeze({...value});

/** Strong validation at every write boundary; bad Worlds are never rewritten on load. */
export function validateTransportationCatalog(input){
  if(!input || typeof input!=="object" || Array.isArray(input) ||
      input.version!==TRANSPORT_CATALOG_VERSION ||
      !input.overrides || typeof input.overrides!=="object" ||
      Array.isArray(input.overrides) || !Array.isArray(input.customs) ||
      input.customs.length>150)
    throw new Error("Invalid Atlas transportation catalog version or structure.");
  const result=defaultTransportationCatalog();
  const standardIds=new Set(dnd2024.map(p=>p.id));
  for(const [profile,changes] of Object.entries(input.overrides)){
    if(!validProfile(profile)||!changes||typeof changes!=="object"||Array.isArray(changes))
      throw new Error("Unknown transportation rules profile.");
    result.overrides[profile]={};
    for(const [id,patch] of Object.entries(changes)){
      if(!standardIds.has(id)||!patch||typeof patch!=="object"||Array.isArray(patch) ||
          (id!=="walking" && !speed(patch.speedMph))||
          (id==="walking" && patch.speedMph!==null)||
          !money(patch.costCp)||!validCost(patch.costBasis)||
          !(patch.purchaseGp===null||money(patch.purchaseGp))||
          (patch.capacity!==undefined&&!validCapacity(patch.capacity))||
          (patch.costApplies!==undefined&&!validCostApplies(patch.costApplies)))
        throw new Error("Invalid transportation override for "+id+".");
      result.overrides[profile][id]={
        speedMph:patch.speedMph,costCp:patch.costCp,
        costBasis:patch.costBasis,purchaseGp:patch.purchaseGp,
        ...(patch.capacity===undefined?{}:{capacity:patch.capacity}),
        ...(patch.costApplies===undefined?{}:{costApplies:patch.costApplies})
      };
    }
  }
  const ids=new Set(standardIds);
  for(const item of input.customs){
    if(!item||typeof item!=="object"||Array.isArray(item)||
        !text(item.id,64)||!/^custom-[a-z0-9-]+$/.test(item.id)||
        !text(item.name)||!TRANSPORT_KINDS.includes(item.kind)||
        !TRANSPORT_SURFACES.includes(item.surface)||!speed(item.speedMph)||
        !money(item.costCp)||!validCost(item.costBasis)||
        !(item.purchaseGp===null||money(item.purchaseGp))||
        (item.capacity!==undefined&&!validCapacity(item.capacity))||
        (item.costApplies!==undefined&&!validCostApplies(item.costApplies))||
        (item.note!==undefined && typeof item.note!=="string")||
        (item.note?.length??0)>240||ids.has(item.id))
      throw new Error("Invalid or duplicate custom transportation preset.");
    ids.add(item.id);
    result.customs.push({...item,note:item.note??""});
  }
  return result;
}

export function selectedTransportationProfile(settings,systemId){
  let selected;
  try{selected=settings?.get?.(MODULE_ID,"guidedTravelRulesProfile");}catch{}
  if(selected==="dnd5e2014"||selected==="dnd5e2024"||selected==="custom")return selected;
  return systemId==="dnd5e"?"dnd5e2024":"neutral";
}
export function readTransportationCatalog(settings){
  let saved;
  try{saved=settings?.get?.(MODULE_ID,TRANSPORT_CATALOG_SETTING);}catch{}
  return validateTransportationCatalog(saved??defaultTransportationCatalog());
}
const legacySpeed=(settings,key,fallback)=>{
  let value;
  try{value=settings?.get?.(MODULE_ID,key);}catch{return fallback;}
  if(value==null)return fallback;
  if(!speed(value))throw new Error("Invalid saved transportation speed.");
  return value;
};
/** Existing beta.1 settings remain readable and are never migrated silently. */
export function listTransportationPresets(settings,systemId){
  const catalog=readTransportationCatalog(settings);
  const profile=selectedTransportationProfile(settings,systemId);
  const builtIns=TRANSPORT_REFERENCE_PRESETS[profile]??dnd2024;
  const records=builtIns.map(p=>{
    const change=catalog.overrides[profile]?.[p.id];
    const stored=change?{...p,...change}:p;
    const fallback=p.id==="mounted"?"guidedMountedSpeed":
      p.id==="sailing"?"guidedSailingSpeed":null;
    const speedMph=!change&&fallback?legacySpeed(settings,fallback,p.speedMph):stored.speedMph;
    return immutable({...stored,speedMph,
      capacity:stored.capacity??defaultCapacity(p.kind),
      costApplies:stored.costApplies??defaultCostApplies(p.id),builtIn:true,
      referenceProfile:profile,customized:Boolean(change)||(Boolean(fallback)&&speedMph!==p.speedMph)});
  });
  return [...records,...catalog.customs.map(p=>{
    // Older beta.2 imports include confusing "(optional tireless)" names. Do
    // not mutate the saved World catalog, merely improve the visible label.
    const imported=OPTIONAL_WORKBOOK_EXAMPLES.some(example=>example.id===p.id);
    const name=imported?p.name.replace(/ \(optional tireless\)$/,""):p.name;
    const note=imported&&p.note.startsWith("Optional workbook example:")?
      "Optional workbook planning example. Not a D&D 2024 sustained mount speed.":p.note;
    return immutable({...p,name,note,
      capacity:p.capacity??defaultCapacity(p.kind),
      costApplies:p.costApplies??defaultCostApplies(p.id),
      builtIn:false,customized:true});
  })];
}
export function findTransportationPreset(id,settings,systemId){
  return listTransportationPresets(settings,systemId).find(item=>item.id===id)??null;
}
export function setTransportationPreset(catalog,profile,preset){
  const valid=validateTransportationCatalog(catalog);
  if(!preset||!text(preset.id,64)||!text(preset.name)||
      !TRANSPORT_KINDS.includes(preset.kind)||!TRANSPORT_SURFACES.includes(preset.surface)||
      !(preset.speedMph===null&&preset.id==="walking")&& !speed(preset.speedMph) ||
      !money(preset.costCp)||!validCost(preset.costBasis)||
      !(preset.purchaseGp===null||money(preset.purchaseGp))||
       (preset.capacity!==undefined&&!validCapacity(preset.capacity))||
       (preset.costApplies!==undefined&&!validCostApplies(preset.costApplies)))
    throw new Error("Invalid transportation preset.");
  if(preset.id.startsWith("custom-")){
    const index=valid.customs.findIndex(p=>p.id===preset.id);
    const clean={id:preset.id,name:preset.name.trim(),kind:preset.kind,surface:preset.surface,
      speedMph:preset.speedMph,costCp:preset.costCp,costBasis:preset.costBasis,
      purchaseGp:preset.purchaseGp,
      ...(preset.capacity===undefined?{}:{capacity:preset.capacity}),
      ...(preset.costApplies===undefined?{}:{costApplies:preset.costApplies}),
      note:String(preset.note??"").slice(0,240)};
    if(index===-1)valid.customs.push(clean);else valid.customs[index]=clean;
  }else{
    if(!validProfile(profile)||!dnd2024.some(p=>p.id===preset.id))
      throw new Error("Unknown built-in transportation preset.");
    valid.overrides[profile]??={};
    valid.overrides[profile][preset.id]={
      speedMph:preset.speedMph,costCp:preset.costCp,costBasis:preset.costBasis,
      purchaseGp:preset.purchaseGp,
      ...(preset.capacity===undefined?{}:{capacity:preset.capacity}),
      ...(preset.costApplies===undefined?{}:{costApplies:preset.costApplies})
    };
  }
  return validateTransportationCatalog(valid);
}
export function deleteCustomTransportationPreset(catalog,id){
  const valid=validateTransportationCatalog(catalog);
  if(!id.startsWith("custom-"))throw new Error("Built-in transportation presets cannot be deleted.");
  valid.customs=valid.customs.filter(item=>item.id!==id);
  return valid;
}
export function resetTransportationPreset(catalog,profile,id){
  const valid=validateTransportationCatalog(catalog);
  if(!validProfile(profile)||!dnd2024.some(p=>p.id===id))
    throw new Error("Unknown built-in transportation preset.");
  if(valid.overrides[profile])delete valid.overrides[profile][id];
  return valid;
}
export function addOptionalTirelessExamples(catalog){
  let result=validateTransportationCatalog(catalog);
  for(const example of OPTIONAL_WORKBOOK_EXAMPLES)
    if(!result.customs.some(item=>item.id===example.id))
      result=setTransportationPreset(result,"custom",example);
  return result;
}
export function transportationCostPreview(preset,distanceMi,hours){
  const amount=preset.costBasis==="day"?
    Math.ceil(Math.max(0,hours)/24)*preset.costCp:
    preset.costBasis==="mile"?Math.max(0,distanceMi)*preset.costCp:0;
  return Number.isFinite(amount)?amount:null;
}
