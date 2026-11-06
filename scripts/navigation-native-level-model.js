/**
 * Read-only native Foundry v14 Level planning. Levels and their elevation ranges
 * belong to the Scene, not Atlas. Atlas adds only an optional semantic label.
 */
export const ATLAS_LEVEL_PLANNER_SETTING="nativeLevelPlannerEnabled";
export const ATLAS_SCENE_LEVELS_FLAG="nativeLevelSetupEnabled";
export const ATLAS_LEVEL_USE_CASES=Object.freeze([
  {id:"surface",name:"Surface",hint:"Land, coastal, sea and ocean routes at the surface",
    meters:{bottom:0,top:300}},
  {id:"aerial",name:"Aerial",hint:"Air routes above the surface",
    meters:{bottom:300,top:3000}},
  {id:"underwater",name:"Underwater",hint:"Submerged routes below the water surface",
    meters:{bottom:-300,top:0}},
  {id:"underground",name:"Underground",hint:"Tunnels and subterranean routes",
    meters:{bottom:-3000,top:0}}
]);
const metersPerSceneUnit={m:1,meter:1,meters:1,metre:1,metres:1,
  km:1000,kilometer:1000,kilometers:1000,kilometre:1000,kilometres:1000,
  ft:.3048,foot:.3048,feet:.3048,
  mi:1609.344,mile:1609.344,miles:1609.344,
  yd:.9144,yard:.9144,yards:.9144};
const validRange=value=>value&&Number.isFinite(value.bottom)&&
  Number.isFinite(value.top)&&Math.abs(value.bottom)<=10000000&&
  Math.abs(value.top)<=10000000&&value.bottom<value.top;
const overlaps=(a,b)=>a.bottom<b.top&&b.bottom<a.top;

/** Null means the Scene's unknown measurement unit cannot be safely guessed. */
export function defaultNativeLevelRanges(sceneUnits){
  const factor=metersPerSceneUnit[String(sceneUnits??"").trim().toLowerCase()];
  if(!factor)return null;
  const result={};
  for(const item of ATLAS_LEVEL_USE_CASES){
    const scaled=value=>Number((value/factor).toPrecision(12));
    result[item.id]={bottom:scaled(item.meters.bottom),top:scaled(item.meters.top)};
  }
  return result;
}

/**
 * The GM may explicitly adopt/update an existing Level by native document ID,
 * preserving its identity and any other native or third-party flags. Overlap is
 * legal in Foundry but ambiguous for automatic elevation-based inference.
 */
export function planAtlasNativeLevels({requested,existing}={}){
  if(!Array.isArray(requested)||requested.length<1||
      requested.length>ATLAS_LEVEL_USE_CASES.length||!Array.isArray(existing))
    throw Error("Select at least one valid native Level template.");
  const allowed=new Map(ATLAS_LEVEL_USE_CASES.map(item=>[item.id,item]));
  const uniqueCategories=new Set(),usedNativeIds=new Set();
  const occupied=existing.map(level=>{
    if(typeof level?.name!=="string"||!level.name.trim()||!validRange(level.elevation))
      throw Error("An existing native Scene Level has incomplete elevation metadata.");
    return {id:level.id??null,name:level.name,elevation:{...level.elevation},
      environment:level.environment??null};
  });
  const create=[],update=[],proposals=[];
  for(const item of requested){
    if(!item||!allowed.has(item.id)||uniqueCategories.has(item.id)||
        !validRange(item.elevation))
      throw Error("Native Level templates need unique categories and valid elevation ranges.");
    uniqueCategories.add(item.id);
    const name=allowed.get(item.id).name;
    const targetId=item.targetLevelId??null;
    const match=targetId?occupied.find(level=>level.id===targetId):null;
    if(targetId&&(!match||usedNativeIds.has(targetId)))
      throw Error("An adopted native Level must have one valid, unique document ID.");
    if(!match&&occupied.some(level=>level.name.trim().toLowerCase()===name.toLowerCase()))
      throw Error("A native Level named "+name+" already exists. Select it for adoption first.");
    if(match)usedNativeIds.add(targetId);
    const category={id:item.id,name,elevation:{...item.elevation}};
    proposals.push(category);
    if(match)update.push({_id:match.id,name,elevation:{...item.elevation},
      "flags.fvtt-atlas-navigation.environment":item.id});
    else create.push({name,elevation:{...item.elevation},
      flags:{"fvtt-atlas-navigation":{environment:item.id}}});
  }
  const warnings=[];
  for(const [index,item] of proposals.entries()){
    for(const other of [...occupied.filter(level=>!usedNativeIds.has(level.id)),
      ...proposals.slice(0,index)]){
      if(overlaps(item.elevation,other.elevation)){
        warnings.push(item.name+" overlaps "+other.name+
          ". These are separate native Levels; use explicit Level IDs for routing.");
      }
    }
  }
  return {create,update,categories:proposals.map(item=>item.id),warnings};
}
