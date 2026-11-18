/** GM-only, point-accurate Road hover subtitle. Never persists or publishes names. */
import {listSceneGeography} from "./territory-geography-storage.js";
import {mostSpecificPublicTerritoryLabel,uniquePublicTerritoryLabel}
  from "./region-narration-model.js";

const MAX_CANDIDATES=256;

/** The point is already in Foundry canvas coordinates (Road label anchor).
 * Only native Region polygonTree containment is authoritative for 2D geography.
 * Reuse the existing fail-closed geographic ancestor policy, but pass GM native
 * names only after the GM guard; this never enters the player read model. */
export function gmRoadTerritoryAtPoint(scene,view,point){
  if(!globalThis.game?.user?.isGM||!scene?.id||!view?.ready||
      view.scene?.id!==scene.id||
      !Number.isFinite(point?.x)||!Number.isFinite(point?.y))return null;
  let entries;
  try{entries=listSceneGeography(scene).filter(entry=>
    entry.linked&&!entry.invalid&&entry.geography);}
  catch{return null;}
  // ponytail: bounded read on a hovered Road; if an Atlas has >256 classified
  // native Regions, profile before adding a spatial index. Fail closed today.
  if(entries.length>MAX_CANDIDATES)return null;
  const byId=new Map(entries.map(entry=>[entry.id,entry]));
  const matches=[];
  for(const entry of entries){
    const region=scene.regions?.get?.(entry.id);
    if(region?.parent?.id!==scene.id||
        typeof region.polygonTree?.testPoint!=="function")return null;
    let contains=false;
    try{contains=region.polygonTree.testPoint(point);}
    catch{return null;}
    if(contains)matches.push({id:entry.id,label:region.name});
  }
  const deepest=mostSpecificPublicTerritoryLabel(matches,byId);
  const continents=matches.filter(item=>byId.get(item.id).geography.kind==="continent");
  if(continents.length!==1||matches.length===1)return deepest;
  const local=matches.filter(item=>item.id!==continents[0].id);
  // A unique native co-containing local Region and continent may be shown
  // together even without an authored parent. Never override a conflicting
  // explicit parent or guess between multiple overlapping local Regions.
  const fallback=!deepest&&local.length===1&&
    !byId.get(local[0].id).geography.parentRegionId?
    uniquePublicTerritoryLabel([local[0].label]):null;
  const name=deepest??fallback;
  const continentName=uniquePublicTerritoryLabel([continents[0].label]);
  return name&&continentName?`${name}, ${continentName}`:null;
}
