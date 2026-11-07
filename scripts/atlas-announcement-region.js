import {toCanvasPoint} from "./road-coordinates.js";
import {readPublicTerritory} from "./region-narration.js";
import {mostSpecificPublicTerritoryLabel} from "./region-narration-model.js";
import {readRegionGeography} from "./territory-geography-storage.js";
import {readRegionAtlasLink} from "./region-atlas.js";
import {verifiedJourneyDestinationPoint} from "./atlas-announcement-destination.js";

/** Read-only Foundry v14 Region adapter. Native RegionDocument.testPoint is
 * authoritative for compound Shapes, holes, Scene padding and elevation;
 * Atlas never reimplements those native geometry or elevation semantics. */
export function inspectPublicRegionDestination({scene,view,atlas,record}={}){
  const point=verifiedJourneyDestinationPoint(record,scene?.grid?.size);
  const result=(name,reason,{published=0,containing=0}={})=>({
    name,reason,published,containing});
  if(!point)return result(null,"unverified-point-b");
  if(!view?.ready)return result(null,"canvas-not-ready");
  if(view.scene?.id!==scene?.id)return result(null,"canvas-scene-mismatch");
  if(!record?.tokenId||!scene?.tokens?.get)
    return result(null,"journey-token-unavailable");
  const token=scene.tokens.get(record.tokenId);
  if(!Number.isFinite(token?.elevation))
    return result(null,"token-elevation-unavailable");
  const target=toCanvasPoint(view,atlas,point);
  if(!Number.isFinite(target?.x)||!Number.isFinite(target?.y))
    return result(null,"canvas-point-unavailable");
  const candidates=[];
  let published=0;
  for(const region of scene.regions?.contents??[]){
    if(region.parent?.id!==scene.id||region.hidden===true||
        typeof region.testPoint!=="function")continue;
    let flag=null;
    try{flag=readPublicTerritory(region);}
    catch{continue;} // Unknown private/invalid Region flags never leak.
    if(!flag)continue;
    published++;
    try{
      if(region.testPoint({x:target.x,y:target.y,elevation:token.elevation}))
        candidates.push({id:region.id,label:flag.label});
    }catch{return result(null,"native-region-test-failed",{published});}
    // Native containment failure must not guess.
  }
  const counts={published,containing:candidates.length};
  if(!candidates.length)return result(null,published?
    "point-b-outside-published-regions":"no-published-regions",counts);
  if(candidates.length===1)return result(candidates[0].label,"resolved",counts);
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
  const name=mostSpecificPublicTerritoryLabel(candidates,geographyById);
  return result(name,name?"resolved":"ambiguous-public-region-overlap",counts);
}

/** Preserve the stable, name-only adapter contract for other consumers. */
export function publicRegionDestinationName(options={}){
  return inspectPublicRegionDestination(options).name;
}
