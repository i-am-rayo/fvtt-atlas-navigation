/** Foundry v14 adapter for read-only native Territory overlap analysis and a
 * narrowly guarded, GM-approved one-sided polygon trim. */
import {MODULE_ID} from "./atlas-storage.js";
import {GENERATED_REGION_FLAG} from "./generated-region-model.js";
import {listSceneGeography} from "./territory-geography-storage.js";
import {readRegionAtlasLink} from "./region-atlas.js";
import {inspectNativePolygonShape} from "./region-boundary-model.js";
import {atlasDebug} from "./atlas-debug.js";
import {competingTerritories,boundsNear,nearestPolygonBorderDistance,
  validateBorderTrim,MAX_BORDER_REGIONS,MAX_NATIVE_OVERLAP_TESTS}
  from "./territory-border-model.js";

function assertGM(scene){
  const user=globalThis.game?.user;
  if(!user?.isGM||!scene?.id||!scene.canUserModify?.(user,"update"))
    throw Error("Only a Scene-authorized GM can analyze or reconcile Territory boundaries.");
}
function plainShapes(region){
  return Array.from(region?.shapes??[],shape=>
    typeof shape.toObject==="function"?shape.toObject():structuredClone(shape));
}
function eligibleRegion(scene,id){
  assertGM(scene);
  const region=scene.regions?.get?.(id);
  if(!region||region.parent?.id!==scene.id||
      !region.canUserModify?.(game.user,"update"))
    throw Error("Native Region is unavailable or not editable. Refresh Atlas.");
  if(region.getFlag?.(MODULE_ID,GENERATED_REGION_FLAG)!=null)
    throw Error("Atlas-generated corridor Regions cannot be trimmed as political territories.");
  if(!readRegionAtlasLink(region))throw Error("Both native Regions must be Atlas-linked.");
  const entry=listSceneGeography(scene).find(item=>item.id===id);
  if(!entry?.linked||entry.invalid||!entry.geography)
    throw Error("Both Regions must have valid Atlas geographic classifications.");
  return {region,entry};
}
function nativePolygon(region,{validate=false}={}){
  const shapes=plainShapes(region);
  if(validate)inspectNativePolygonShape(shapes);
  else if(shapes.length!==1||shapes[0]?.type!=="polygon"||shapes[0]?.hole===true||
      shapes[0]?.gridBased===true)throw Error("Unsupported native Region Shape.");
  if(region.isSingleShape!==true||region.polygons?.length!==1||
      !Number.isFinite(region.area)||region.area<=0||
      typeof region.polygonTree?.intersectPolygon!=="function")
    throw Error("This boundary requires one simple native polygon with supported clipping geometry.");
  const points=region.polygons[0]?.points;
  if(!Array.isArray(points)||points.length<6||points.length%2||
      !points.every(Number.isFinite))
    throw Error("The native polygon projection is unavailable; no changes were made.");
  return {shapes,points};
}

/** Bounded comparison of peers only. Nearby borders are a diagnostic hint;
 * actual enclosed gaps cannot be proven from two polygons alone. */
export function analyzeSceneTerritoryBorders(scene,{nearPixels=null}={}){
  assertGM(scene);
  const entries=listSceneGeography(scene).filter(e=>e.linked&&!e.invalid&&e.geography&&
    ["continent","city","town","village"].includes(e.geography.kind));
  if(entries.length>MAX_BORDER_REGIONS)
    throw Error(`This first boundary analyzer supports at most ${MAX_BORDER_REGIONS} classified geographic Regions per Scene. No changes were made; use native Foundry editing for larger sets until scoped analysis is available.`);
  const tolerance=nearPixels??Math.max(2,Math.min(48,Number(scene.grid?.size)||20)/4);
  if(!Number.isFinite(tolerance)||tolerance<0||tolerance>100)
    throw Error("Invalid native boundary proximity tolerance.");
  const overlaps=[],nearby=[];
  let checks=0,unsupported=0;
  const geometry=new Map();
  const readGeometry=region=>{
    if(!geometry.has(region.id)){
      try{geometry.set(region.id,{value:nativePolygon(region)});}
      catch(error){geometry.set(region.id,{error});}
    }
    const result=geometry.get(region.id);
    if(result.error)throw result.error;
    return result.value;
  };
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
    const a=entries[i],b=entries[j];
    if(!competingTerritories(a,b))continue;
    const first=scene.regions?.get?.(a.id),second=scene.regions?.get?.(b.id);
    if(!first||!second||first.parent?.id!==scene.id||second.parent?.id!==scene.id)
      {unsupported++;continue;}
    if(!boundsNear(first.bounds,second.bounds,tolerance))continue;
    try{
      const ap=readGeometry(first),bp=readGeometry(second);
      if(++checks>MAX_NATIVE_OVERLAP_TESTS)
        throw Error("Too many native Region intersections for one safe synchronous analysis.");
      const intersection=first.polygonTree.intersectPolygon(second.polygons[0]);
      const area=intersection?.area;
      if(!Number.isFinite(area)||area< -1e-5||area>Math.min(first.area,second.area)*1.001)
        throw Error("Invalid native Region intersection area.");
      if(area>Math.max(1e-4,Math.min(first.area,second.area)*1e-6)){
        overlaps.push({firstId:a.id,secondId:b.id,firstName:a.name,secondName:b.name,
          area,smallerCoveragePercent:Number((100*area/Math.min(first.area,second.area)).toFixed(1))});
      }else{
        const distance=nearestPolygonBorderDistance(ap.points,bp.points);
        if(distance!==null&&distance>1e-4&&distance<=tolerance)
          nearby.push({firstId:a.id,secondId:b.id,firstName:a.name,
            secondName:b.name,distancePixels:Number(distance.toFixed(2))});
      }
    }catch(error){
      if(/Too many native Region intersections/.test(error.message))throw error;
      unsupported++;
    }
  }
  overlaps.sort((a,b)=>b.area-a.area);
  nearby.sort((a,b)=>a.distancePixels-b.distancePixels);
  atlasDebug("territory","Peer boundary analysis completed",{
    eligibleRegions:entries.length,comparedPairs:checks,overlapPairs:overlaps.length,
    nearbyBorderPairs:nearby.length,unsupportedPairs:unsupported},{level:"verbose"});
  return {overlaps,nearby,unsupportedPairs:unsupported,comparedPairs:checks,
    eligibleRegions:entries.length,tolerancePixels:tolerance};
}

function inspectPair(scene,trimId,keepId){
  if(trimId===keepId)throw Error("Choose two different native Territory Regions.");
  const trim=eligibleRegion(scene,trimId),keep=eligibleRegion(scene,keepId);
  if(!competingTerritories(trim.entry,keep.entry))
    throw Error("Continent-to-settlement nesting is intentional; choose peer territories.");
  const source=nativePolygon(trim.region,{validate:true});
  const protectedShape=nativePolygon(keep.region,{validate:true});
  return {trim,keep,source,protectedShape};
}

/** Clip only the selected losing Region; its winning neighbor is untouched.
 * Complex output (holes, disjoint parts) is refused rather than guessing. */
export function planNativeTerritoryTrim(scene,trimId,keepId){
  const pair=inspectPair(scene,trimId,keepId);
  const {trim,keep,source,protectedShape}=pair;
  const intersection=trim.region.polygonTree.intersectPolygon(keep.region.polygons[0]);
  const area=intersection?.area;
  if(!Number.isFinite(area)||area<=1e-4)
    throw Error("These peer Regions do not have a measurable native overlap.");
  const clipType=globalThis.ClipperLib?.ClipType?.ctDifference;
  if(!Number.isInteger(clipType))
    throw Error("Foundry's native Clipper difference operation is unavailable. No Region was changed.");
  const difference=trim.region.polygonTree.intersectPolygon(
    keep.region.polygons[0],{clipType});
  const roots=difference?.children;
  const ring=Array.from(roots??[]);
  const node=ring[0],polygon=difference?.polygons?.[0];
  const globalPoints=polygon?.points;
  const vertexCount=Array.isArray(globalPoints)?globalPoints.length/2:0;
  const trimSummary=validateBorderTrim({sourceArea:trim.region.area,
    resultArea:difference?.area,overlapArea:area,resultingPolygonCount:ring.length,
    hasHoles:ring.some(item=>item.isHole||item.children?.length)||
      difference?.polygons?.length!==1,vertexCount});
  if(!Array.isArray(globalPoints)||!globalPoints.every(Number.isFinite)||
      !node||node.isHole)throw Error("The clipped native boundary has unsupported geometry.");
  const shape=source.shapes[0],origin=shape.origin;
  if(!Number.isFinite(origin?.x)||!Number.isFinite(origin?.y))
    throw Error("Native Region shape origin is invalid; cannot safely trim.");
  const localPoints=globalPoints.map((p,i)=>p-(i%2?origin.y:origin.x));
  inspectNativePolygonShape([{...shape,points:localPoints}]);
  const plan=Object.freeze({sceneId:scene.id,trimRegionId:trimId,
    keepRegionId:keepId,trimName:trim.region.name,keepName:keep.region.name,
    trimSnapshot:JSON.stringify(source.shapes),
    keepSnapshot:JSON.stringify(protectedShape.shapes),
    trimGeographySnapshot:JSON.stringify(trim.entry.geography),
    keepGeographySnapshot:JSON.stringify(keep.entry.geography),
    sourcePoints:[...source.points],keepPoints:[...protectedShape.points],
    resultPoints:[...globalPoints],shapes:[{...shape,points:localPoints}],
    overlapPercent:Number((100*area/trim.region.area).toFixed(2)),
    removedPercent:trimSummary.removedPercent,
    sourceVertices:source.points.length/2,resultVertices:vertexCount});
  atlasDebug("territory","Single-side boundary trim preview prepared",{
    sourceVertices:plan.sourceVertices,resultVertices:vertexCount,
    overlapPercent:plan.overlapPercent,removedPercent:plan.removedPercent},
  {level:"verbose"});
  return plan;
}

/** Stale guards protect both neighbors. Only ONE Region's native Shapes are
 * written, avoiding a partial two-document boundary transaction. */
export async function saveNativeTerritoryTrim(scene,plan){
  if(!plan||plan.sceneId!==scene?.id||!plan.trimRegionId||!plan.keepRegionId)
    throw Error("Reopen the Territory boundary preview.");
  const pair=inspectPair(scene,plan.trimRegionId,plan.keepRegionId);
  if(pair.trim.region.name!==plan.trimName||pair.keep.region.name!==plan.keepName||
      JSON.stringify(pair.source.shapes)!==plan.trimSnapshot||
      JSON.stringify(pair.protectedShape.shapes)!==plan.keepSnapshot||
      JSON.stringify(pair.trim.entry.geography)!==plan.trimGeographySnapshot||
      JSON.stringify(pair.keep.entry.geography)!==plan.keepGeographySnapshot)
    throw Error("One of the native Territories changed during preview. No shapes were updated.");
  const fresh=planNativeTerritoryTrim(scene,plan.trimRegionId,plan.keepRegionId);
  if(JSON.stringify(fresh.shapes)!==JSON.stringify(plan.shapes))
    throw Error("The clipping result changed since preview; no shapes were updated.");
  await pair.trim.region.update({shapes:fresh.shapes});
  atlasDebug("territory","Single-side native Territory trim committed",{
    resultVertices:fresh.resultVertices,removedPercent:fresh.removedPercent},
  {level:"verbose"});
  return pair.trim.region.id;
}
