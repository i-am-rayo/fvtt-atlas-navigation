/** GM-only, point-accurate Road hover subtitle. Never persists or publishes names. */
import {listSceneGeography} from "./territory-geography-storage.js";
import {mostSpecificPublicTerritoryLabel} from "./region-narration-model.js";

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
  return mostSpecificPublicTerritoryLabel(matches,byId);
}
