import {toCanvasPoint} from "./road-coordinates.js";
import {readPublicTerritory} from "./region-narration.js";
import {mostSpecificPublicTerritoryLabel} from "./region-narration-model.js";
import {readRegionGeography} from "./territory-geography-storage.js";
import {readRegionAtlasLink} from "./region-atlas.js";
import {verifiedJourneyDestinationPoint} from "./atlas-announcement-destination.js";

/** Read-only Foundry v14 Region adapter. Native RegionDocument.testPoint is
 * authoritative for compound Shapes, holes, Scene padding and elevation;
 * Atlas never reimplements those native geometry or elevation semantics. */
export function publicRegionDestinationName({scene,view,atlas,record}={}){
  const point=verifiedJourneyDestinationPoint(record,scene?.grid?.size);
  if(!point||!view?.ready||view.scene?.id!==scene?.id||
      !record?.tokenId||!scene?.tokens?.get)return null;
  const token=scene.tokens.get(record.tokenId);
  if(!Number.isFinite(token?.elevation))return null;
  const target=toCanvasPoint(view,atlas,point);
  const candidates=[];
  for(const region of scene.regions?.contents??[]){
    if(region.parent?.id!==scene.id||region.hidden===true||
        typeof region.testPoint!=="function")continue;
    let flag=null;
    try{flag=readPublicTerritory(region);}
    catch{continue;} // Unknown private/invalid Region flags never leak.
    if(!flag)continue;
    try{
      if(region.testPoint({x:target.x,y:target.y,elevation:token.elevation}))
        candidates.push({id:region.id,label:flag.label});
    }catch{return null;} // Native containment failure must not guess.
  }
  if(candidates.length<=1)return mostSpecificPublicTerritoryLabel(candidates);
  // The GM has explicitly published multiple overlapping native Regions.
  // Only a valid Atlas parent chain can establish which name is more specific.
  // Geographic kind alone never breaks a tie or publishes a private name.
  const geographyById=new Map();
  for(const region of scene.regions?.contents??scene.regions?.values?.()??[]){
    let linked=false,geography=null,invalid=false;
    try{
      linked=readRegionAtlasLink(region)!==null;
      geography=readRegionGeography(region);
    }catch{invalid=true;}
    geographyById.set(region.id,{linked,geography,invalid});
  }
  return mostSpecificPublicTerritoryLabel(candidates,geographyById);
}
