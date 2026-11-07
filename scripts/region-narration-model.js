/** An explicitly GM-approved public name for a native Region.
 * This flag is only presentation metadata; native Region shapes, elevation,
 * Behaviors, visibility and document name remain Foundry-owned. */
export const PUBLIC_TERRITORY_FLAG="publicTerritory";
export const PUBLIC_TERRITORY_SCHEMA=1;

export function validatedPublicTerritoryLabel(value){
  if(typeof value!=="string"||!value.trim()||value.trim()!==value||
      value.length>120||/[\u0000-\u001f\u007f]/.test(value))
    throw Error("A public territory label must be 1–120 printable characters.");
  return value;
}

export function validatePublicTerritoryFlag(value){
  if(value==null)return null;
  if(!value||Array.isArray(value)||typeof value!=="object"||
      Object.keys(value).sort().join(",")!=="enabled,label,schemaVersion"||
      value.schemaVersion!==PUBLIC_TERRITORY_SCHEMA||value.enabled!==true)
    throw Error("Unsupported Atlas public territory flag; no changes were made.");
  return Object.freeze({schemaVersion:PUBLIC_TERRITORY_SCHEMA,enabled:true,
    label:validatedPublicTerritoryLabel(value.label)});
}

/** Without validated geographic parentage, overlapping public territories are
 * ambiguous. Never guess by kind, native draw order, or stable Region ID. */
export function uniquePublicTerritoryLabel(labels){
  if(!Array.isArray(labels)||labels.length!==1)return null;
  try{return validatedPublicTerritoryLabel(labels[0]);}
  catch{return null;}
}

/** Pure, fail-closed tie-breaker for nested public geographic territories.
 * A descendant wins only when every other matching public Region is one of
 * its verified ancestors. Two overlapping sibling/unrelated Regions remain
 * ambiguous, irrespective of kind, native draw order, or display name. */
export function mostSpecificPublicTerritoryLabel(candidates,geographyById){
  if(!Array.isArray(candidates)||!candidates.length)return null;
  if(candidates.length===1)return uniquePublicTerritoryLabel([candidates[0]?.label]);
  if(!(geographyById instanceof Map)||candidates.some(item=>
    typeof item?.id!=="string"||!item.id))return null;
  const ids=candidates.map(item=>item.id);
  if(new Set(ids).size!==ids.length)return null;
  const ancestorById=new Map();
  for(const candidate of candidates){
    const ancestors=new Set(),visited=new Set([candidate.id]);
    let region=geographyById.get(candidate.id);
    if(!region?.linked||region.invalid||!region.geography)return null;
    while(region.geography.parentRegionId){
      if(region.geography.kind==="continent")return null;
      const parentId=region.geography.parentRegionId;
      if(visited.has(parentId))return null;
      visited.add(parentId);
      region=geographyById.get(parentId);
      if(!region?.linked||region.invalid||!region.geography||
          !["continent","area"].includes(region.geography.kind))return null;
      ancestors.add(parentId);
    }
    ancestorById.set(candidate.id,ancestors);
  }
  const mostSpecific=candidates.filter(item=>candidates.every(other=>
    other.id===item.id||ancestorById.get(item.id).has(other.id)));
  return mostSpecific.length===1?
    uniquePublicTerritoryLabel([mostSpecific[0].label]):null;
}
