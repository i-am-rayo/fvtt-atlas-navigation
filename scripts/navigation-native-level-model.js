/**
 * Native Foundry v14 Scene Level creation proposals. These categories are
 * planning labels, never independent elevation or terrain rules. Aerial and
 * underground/underwater ranges must be supplied by the GM in Scene units.
 */
export const ATLAS_LEVEL_PLANNER_SETTING="nativeLevelPlannerEnabled";
export const ATLAS_LEVEL_USE_CASES=Object.freeze([
  {id:"surface",name:"Surface",hint:"Land, coastal, sea and ocean routes at the surface"},
  {id:"aerial",name:"Aerial",hint:"Air routes above the surface"},
  {id:"underwater",name:"Underwater",hint:"Submerged routes below the water surface"},
  {id:"underground",name:"Underground",hint:"Tunnels and subterranean routes"}
]);

const validRange=value=>value&&Number.isFinite(value.bottom)&&
  Number.isFinite(value.top)&&Math.abs(value.bottom)<=10000000&&
  Math.abs(value.top)<=10000000&&value.bottom<value.top;
const overlaps=(a,b)=>a.bottom<b.top&&b.bottom<a.top;

/**
 * Read-only, pure plan: never writes Levels, Scene flags, Regions, or Tokens.
 * Existing native Levels are authoritative; overlaps and duplicate names
 * require explicit GM editing in the native Foundry Levels tab.
 */
export function planAtlasNativeLevels({requested,existing}={}){
  if(!Array.isArray(requested)||requested.length<1||
      requested.length>ATLAS_LEVEL_USE_CASES.length||!Array.isArray(existing))
    throw Error("Select at least one valid native Level template.");
  const allowed=new Map(ATLAS_LEVEL_USE_CASES.map(item=>[item.id,item]));
  const selected=new Set();
  const proposals=[];
  for(const item of requested){
    if(!item||!allowed.has(item.id)||selected.has(item.id)||
        !validRange(item.elevation))
      throw Error("Native Level templates need unique categories and valid elevation ranges.");
    selected.add(item.id);
    proposals.push({id:item.id,name:allowed.get(item.id).name,
      elevation:{bottom:item.elevation.bottom,top:item.elevation.top}});
  }
  const occupied=existing.map(level=>{
    if(typeof level?.name!=="string"||!level.name.trim()||
        !validRange(level.elevation))
      throw Error("An existing native Scene Level has incomplete elevation metadata.");
    return {name:level.name,elevation:{bottom:level.elevation.bottom,
      top:level.elevation.top}};
  });
  for(let i=0;i<proposals.length;i++){
    for(const native of [...occupied,...proposals.slice(0,i)]){
      if(native.name.trim().toLowerCase()===proposals[i].name.toLowerCase())
        throw Error("A native Level named "+proposals[i].name+
          " already exists. Manage it from Foundry's Levels tab.");
      if(overlaps(native.elevation,proposals[i].elevation))
        throw Error("The proposed "+proposals[i].name+
          " elevation overlaps an existing or selected Level. Review native elevation ranges.");
    }
  }
  return {create:proposals.map(item=>({name:item.name,elevation:item.elevation})),
    categories:proposals.map(item=>item.id)};
}
