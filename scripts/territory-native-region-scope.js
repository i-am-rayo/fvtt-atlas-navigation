/** Read-only Foundry v14 native Region scope comparison. Native Scene Level
 * IDs and Region elevation are separate. Unknown metadata is never proof that
 * cells can be shared or safely transferred. No Atlas-owned level mirror. */
function selectedLevelIds(region){
  const levels=region?.levels;
  if(levels==null)return [];
  if(!Array.isArray(levels)&&!(levels instanceof Set))return null;
  const ids=[...levels];
  if(ids.some(id=>typeof id!=="string"||!id))return null;
  return [...new Set(ids)].sort();
}
function nativeRange(region){
  const elevation=region?.elevation;
  if(elevation==null)return [null,null,false];
  if(typeof elevation!=="object"||Array.isArray(elevation)||
      elevation.bottom!=null&&!Number.isFinite(elevation.bottom)||
      elevation.top!=null&&!Number.isFinite(elevation.top)||
      elevation.topInclusive!=null&&typeof elevation.topInclusive!=="boolean")
    return null;
  return [elevation.bottom??null,elevation.top??null,elevation.topInclusive===true];
}
function knownLevel(scene,id){
  const collection=scene?.levels;
  if(typeof collection?.get==="function")return Boolean(collection.get(id));
  if(Array.isArray(collection?.contents))
    return collection.contents.some(level=>level?.id===id);
  return false;
}
function rangeDisjoint(a,b){
  const [aLow,aHigh,aTopInclusive]=a,[bLow,bHigh,bTopInclusive]=b;
  const before=(top,topInclusive,bottom)=>top!==null&&bottom!==null&&
    (top<bottom||top===bottom&&!topInclusive);
  return before(aHigh,aTopInclusive,bLow)||before(bHigh,bTopInclusive,aLow);
}

/** "separate" = can coexist at same XY without changing another Region.
 * "same" = an existing same-scope transfer may be considered.
 * "mixed" = overlapping or unverifiable scope; never auto-transfer cells. */
export function nativeRegionScopeRelation(scene,a,b){
  const left=selectedLevelIds(a),right=selectedLevelIds(b);
  const aRange=nativeRange(a),bRange=nativeRange(b);
  if(left===null||right===null||aRange===null||bRange===null)
    return "mixed";
  if([...left,...right].some(id=>!knownLevel(scene,id)))return "mixed";
  if(left.length&&right.length&&!left.some(id=>right.includes(id)))
    return "separate";
  if(rangeDisjoint(aRange,bRange))return "separate";
  return JSON.stringify(left)===JSON.stringify(right)&&
    JSON.stringify(aRange)===JSON.stringify(bRange)?"same":"mixed";
}

/** Capture a mutable existing Region's native scope when opening its editor.
 * Recheck before Save; missing/all-Levels and unbounded elevation remain
 * distinct from an explicitly selected Level or bounded range. */
export function nativeRegionScopeSnapshot(region){
  return JSON.stringify({levels:selectedLevelIds(region),
    elevation:nativeRange(region)});
}
