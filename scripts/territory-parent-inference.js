/** Read-only, GM-facing geographic hierarchy inference using public Foundry
 * v14 native RegionDocument area/polygons and PolygonTree intersections.
 * Native geometry and persisted geography flags remain authoritative. */

import {atlasDebug} from "./atlas-debug.js";

const CHILD_KINDS=new Set(["city","town","village"]);
const MAX_COMPARISONS=128;
const MIN_MAJORITY=.5;
const MIN_LEAD=.05;

/** Pure policy: require a strict majority and a clear lead over any rival.
 * No name, ID ordering or native layer order may break a tie. */
export function chooseDominantContinent(coverages,{majority=MIN_MAJORITY,
  lead=MIN_LEAD}={}){
  if(!Array.isArray(coverages)||!coverages.length)return null;
  if(![majority,lead].every(Number.isFinite)||majority<=0||majority>=1||
      lead<0||lead>=1)return null;
  if(coverages.some(item=>!item||typeof item.id!=="string"||!item.id||
      !Number.isFinite(item.fraction)||item.fraction<0||item.fraction>1))return null;
  if(new Set(coverages.map(item=>item.id)).size!==coverages.length)return null;
  const ranked=[...coverages].sort((a,b)=>b.fraction-a.fraction);
  if(ranked[0].fraction<=majority+1e-6||
      (ranked[1]&&ranked[0].fraction-ranked[1].fraction<lead))return null;
  return {parentId:ranked[0].id,
    coveragePercent:Number((ranked[0].fraction*100).toFixed(1))};
}

function nativeRegions(scene){
  const collection=scene?.regions;
  return Array.from(collection?.values?.()??collection?.contents??[]);
}

function intersectsBounds(a,b){
  if(!a||!b||![a.x,a.y,a.width,a.height,b.x,b.y,b.width,b.height]
    .every(Number.isFinite))return true; // missing bounds cannot exclude overlap
  return a.x < b.x+b.width && a.x+a.width > b.x &&
    a.y < b.y+b.height && a.y+a.height > b.y;
}

/** Infer a continent parent ONLY where no explicit parent ID exists.
 * A child must have one ordinary native Shape (no holes); the containing
 * continent may have complex native shapes and holes. On invalid/unknown
 * geometry or too many comparisons, fail closed without changing any flag. */
export function inferSceneContinentParents(scene,geographyById,{log=true}={}){
  const result=new Map();
  if(!(geographyById instanceof Map)||!scene?.id)return result;
  const all=nativeRegions(scene).filter(region=>region?.parent?.id===scene.id);
  const byId=new Map(all.map(region=>[region.id,region]));
  const entries=[...geographyById.entries()];
  const continents=entries.filter(([id,data])=>data?.linked&&!data.invalid&&
    data.geography?.kind==="continent"&&byId.has(id));
  const children=entries.filter(([id,data])=>data?.linked&&!data.invalid&&
    CHILD_KINDS.has(data.geography?.kind)&&
    !data.geography.parentRegionId&&byId.has(id));
  if(!continents.length||!children.length)return result;
  if(continents.length*children.length>MAX_COMPARISONS){
    if(log)atlasDebug("territory","Automatic parent inference skipped",{
      reason:"comparison-budget",continentCount:continents.length,
      childCount:children.length},{level:"verbose"});
    return result;
  }
  let unsupported=0;
  for(const [childId] of children){
    const child=byId.get(childId);
    // This feature is strictly 2D geography, independent of token elevation.
    // Native polygonTree computes actual clipped area, not coarse grid samples.
    const area=child?.area,polygon=child?.polygons?.[0];
    if(child?.isSingleShape!==true||!Number.isFinite(area)||area<=0||!polygon||
        child.polygons.length!==1){unsupported++;continue;}
    const coverage=[];
    let failed=false;
    for(const [continentId] of continents){
      const continent=byId.get(continentId);
      if(!Number.isFinite(continent?.area)||continent.area<=0||
          typeof continent?.polygonTree?.intersectPolygon!=="function"){
        failed=true;break;
      }
      let overlap=0;
      if(intersectsBounds(child.bounds,continent.bounds)){
        try{overlap=continent.polygonTree.intersectPolygon(polygon)?.area;}
        catch{failed=true;break;}
      }
      if(!Number.isFinite(overlap)||overlap< -1e-6||overlap>area*1.001){
        failed=true;break;
      }
      coverage.push({id:continentId,fraction:Math.max(0,Math.min(1,overlap/area))});
    }
    if(failed){unsupported++;continue;}
    const chosen=chooseDominantContinent(coverage);
    if(chosen)result.set(childId,chosen);
  }
  if(log)atlasDebug("territory","Automatic parent overlap evaluated",{
    childCount:children.length,continentCount:continents.length,
    inferredCount:result.size,unsupportedCount:unsupported,
    method:"native polygon intersection",majorityThresholdPercent:50,
    runnerUpMarginPercent:5},{level:"verbose"});
  return result;
}

/** Transient projection only. Manual parent IDs remain authoritative; other
 * consumers may still read the original unmodified geography flag. */
export function withInferredContinentParents(scene,entries,{log=true}={}){
  const byId=new Map(entries.map(entry=>[entry.id,entry]));
  const inferred=inferSceneContinentParents(scene,byId,{log});
  return entries.map(entry=>{
    const suggestion=inferred.get(entry.id);
    return suggestion?{...entry,geography:{...entry.geography,
      parentRegionId:suggestion.parentId},inferredParent:suggestion}:entry;
  });
}
