/** GM-only native Foundry v14 Territory authoring adapter. Editing source
 * controls are Atlas metadata; RegionDocument Shapes remain authoritative. */
import {MODULE_ID} from "./atlas-storage.js";
import {readRegionAtlasLink} from "./region-atlas.js";
import {GEOGRAPHY_FLAG,listSceneGeography} from "./territory-geography-storage.js";
import {validateGeographyFlag,validateGeographyHierarchy} from "./territory-geography-model.js";
import {GENERATED_REGION_FLAG} from "./generated-region-model.js";
import {atlasDebug} from "./atlas-debug.js";
import {BOUNDARY_SOURCE_FLAG,BOUNDARY_SOURCE_VERSION,boundaryFromBlankWalls,polygonShapeFromNodes,
  validateBoundaryNodes,validateGridOffsets,gridCellConflicts} from "./territory-authoring-model.js";
import {smoothClosedBoundary,inspectNativePolygonShape} from "./region-boundary-model.js";
import {sceneImageOrigin} from "./road-coordinates.js";

const clone=v=>structuredClone(v);
const plainShapes=r=>Array.from(r?.shapes??[],s=>s.toObject?.()??clone(s));
const shapeDigest=s=>JSON.stringify(s.map(v=>({type:v.type,
  origin:v.type==="grid"?null:v.origin??null,
  points:v.points??null,offsets:v.type==="grid"?
    [...(v.offsets??[])].sort((a,b)=>a.i-b.i||a.j-b.j):null,hole:v.hole??false})));
const idOk=id=>typeof id==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(id);

function authorize(scene,region=null){
  const user=globalThis.game?.user;
  if(!user?.isGM||!scene?.id||!scene.canUserModify?.(user,"update")||
      (region&&!region.canUserModify?.(user,"update")))
    throw Error("Only a Scene-authorized GM may change native Territory boundaries.");
  if(region?.getFlag?.(MODULE_ID,GENERATED_REGION_FLAG)!=null)
    throw Error("Atlas-generated corridor geometry cannot be edited as a Territory.");
}

export function readBoundarySource(region){
  const data=region?.getFlag?.(MODULE_ID,BOUNDARY_SOURCE_FLAG);
  if(data==null)return null;
  if(!data||typeof data!=="object"||data.schemaVersion!==BOUNDARY_SOURCE_VERSION||
      !["polygon","grid"].includes(data.kind)||typeof data.shapeDigest!=="string"||
      data.shapeDigest.length>120000||!Array.isArray(data.wallIds)||
      data.wallIds.length>256||data.wallIds.some(id=>!idOk(id))||
      data.coordinateSpace!=="scene-image"||
      Object.keys(data).some(k=>!["schemaVersion","kind","coordinateSpace","nodes","offsets",
        "wallIds","smoothing","shapeDigest"].includes(k))||
      ![0,1,2].includes(data.smoothing??0))
    throw Error("Unknown Atlas Territory authoring source; native Region remains unchanged.");
  if(data.kind==="polygon")validateBoundaryNodes(data.nodes);
  else validateGridOffsets(data.offsets);
  return clone(data);
}

/** Native geometry is the source of truth after editing a Region outside Atlas.
 * Reconciliation never moves the Region; it only refreshes Atlas edit controls. */
export function territoryBoundaryNeedsAdoption(region){
  const source=region?.getFlag?.(MODULE_ID,BOUNDARY_SOURCE_FLAG);
  return source!=null&&source.shapeDigest!==shapeDigest(plainShapes(region));
}

function draftFromNativeShapes(shapes,digest){
  if(shapes.length!==1||shapes[0].hole===true)
    throw Error("Only one simple native polygon or grid Shape can be adopted by Atlas.");
  if(shapes[0].type==="grid")return {kind:"grid",points:[],
    offsets:validateGridOffsets(shapes[0].offsets??[]),wallIds:[],smoothing:0,
    sourceDigest:digest};
  if(shapes[0].type!=="polygon"||shapes[0].gridBased===true||
      shapes[0].points?.length%2)
    throw Error("Select a supported ordinary native polygon or grid Shape.");
  const origin=shapes[0].origin??{x:0,y:0};
  const points=[];
  for(let i=0;i<shapes[0].points.length;i+=2)points.push({id:`adopt_${i/2}`,
    x:origin.x+shapes[0].points[i],y:origin.y+shapes[0].points[i+1]});
  validateBoundaryNodes(points);
  return {kind:"polygon",points,offsets:[],wallIds:[],smoothing:0,sourceDigest:digest};
}

export function readTerritoryDraft(scene,regionId,{view=globalThis.canvas}={}){
  const region=scene?.regions?.get?.(regionId);
  authorize(scene,region);
  if(!region||region.parent?.id!==scene.id||!readRegionAtlasLink(region))
    throw Error("Choose an Atlas-linked native Region from this Scene.");
  const source=readBoundarySource(region),shapes=plainShapes(region),digest=shapeDigest(shapes);
  const origin=sceneImageOrigin(view);
  if(view?.scene?.id!==scene.id||!view?.ready)
    throw Error("Open this Scene on the canvas before editing its native Region.");
  if(source&&source.shapeDigest!==digest)
    throw Error("The native Region was edited outside Atlas. Reconcile its source before continuing.");
  if(source){
    const points=(source.nodes??[]).map(node=>({
      ...node,x:node.x+origin.x,y:node.y+origin.y}));
    if(source.kind==="polygon"){
      // A Scene's padding can change independently of a native Region's stored
      // Shape. Reprojecting Atlas image-relative nodes blindly would shift the
      // native Region on the next Save. The native Shape always owns position.
      const projected=shapeForDraft({kind:"polygon",points,smoothing:source.smoothing??0});
      const native=shapes[0];
      if(shapes.length!==1||native.type!=="polygon"||
          native.points.length!==projected.points.length||
          native.points.some((value,i)=>Math.abs(value-projected.points[i])>0.05))
        throw Error("Atlas controls cannot be aligned with this native Region Shape. " +
          "Do not save; inspect the native Region and reconcile its source.");
      const dx=native.origin.x-projected.origin.x;
      const dy=native.origin.y-projected.origin.y;
      for(const point of points){point.x+=dx;point.y+=dy;}
    }
    return {kind:source.kind,points,offsets:source.offsets??[],
      wallIds:source.wallIds,smoothing:source.smoothing??0,sourceDigest:digest};
  }
  return draftFromNativeShapes(shapes,digest);
}

export function planNativeTerritoryAdoption(scene,regionId,{view=globalThis.canvas}={}){
  const region=scene?.regions?.get?.(regionId);
  authorize(scene,region);
  if(!region||region.parent?.id!==scene.id||!readRegionAtlasLink(region))
    throw Error("Choose an Atlas-linked native Territory in this Scene.");
  if(!view?.ready||view.scene?.id!==scene.id)
    throw Error("Open the Region's Scene on the canvas before reconciling.");
  const original=readBoundarySource(region);
  if(!original)throw Error("This native Region has no Atlas control source to reconcile.");
  const shapes=plainShapes(region),digest=shapeDigest(shapes);
  if(original.shapeDigest===digest)
    throw Error("Atlas controls already match the native Region; no reconciliation is needed.");
  const draft=draftFromNativeShapes(shapes,digest);
  const origin=sceneImageOrigin(view);
  return {regionId,regionName:region.name,expectedDigest:digest,
    expectedSource:JSON.stringify(original),kind:draft.kind,
    controls:draft.kind==="grid"?draft.offsets.length:draft.points.length,
    source:{schemaVersion:BOUNDARY_SOURCE_VERSION,kind:draft.kind,
      coordinateSpace:"scene-image",
      nodes:draft.kind==="polygon"?draft.points.map(p=>({...p,
        x:p.x-origin.x,y:p.y-origin.y})):undefined,
      offsets:draft.kind==="grid"?clone(draft.offsets):undefined,
      wallIds:[],smoothing:0,shapeDigest:digest}};
}

export async function adoptNativeTerritoryBoundary(scene,plan,{view=globalThis.canvas}={}){
  const region=scene?.regions?.get?.(plan?.regionId);
  authorize(scene,region);
  if(!region||region.parent?.id!==scene.id||!readRegionAtlasLink(region)||
      !view?.ready||view.scene?.id!==scene.id)
    throw Error("The native Territory or active Scene changed; reopen reconciliation.");
  if(shapeDigest(plainShapes(region))!==plan.expectedDigest||
      JSON.stringify(readBoundarySource(region))!==plan.expectedSource)
    throw Error("The native Region or Atlas source changed; reopen reconciliation without saving.");
  // A Shape was edited natively, so the previous Atlas Blank-Wall provenance and
  // smoothing instructions no longer describe the authoritative Shape.
  await region.update({[`flags.${MODULE_ID}.${BOUNDARY_SOURCE_FLAG}`]:plan.source});
  return region;
}

export function selectedBlankWallBoundary(scene,view=globalThis.canvas){
  authorize(scene);
  if(!view?.ready||view.scene?.id!==scene.id)
    throw Error("Open this Scene on the canvas before importing Blank Walls.");
  const controlled=view.walls?.controlled??[];
  return boundaryFromBlankWalls(controlled.map(w=>({id:w.document?.id,
    c:Array.from(w.document?.c??[]),move:w.document?.move,
    light:w.document?.light,sight:w.document?.sight,sound:w.document?.sound,
    door:w.document?.door})));
}

function shapeForDraft(draft){
  if(draft.kind==="polygon"){
    const shape=polygonShapeFromNodes(draft.points);
    if(![0,1,2].includes(draft.smoothing??0))throw Error("Unsupported smoothing preset.");
    if(draft.smoothing)shape.points=smoothClosedBoundary(shape.points,draft.smoothing);
    inspectNativePolygonShape([shape]);
    return shape;
  }
  if(draft.kind==="grid")return {type:"grid",offsets:validateGridOffsets(draft.offsets),origin:null};
  throw Error("Unknown Territory editor mode.");
}

function validateClassification(scene,draft,regionId){
  const geography=validateGeographyFlag(draft.geography);
  if(!geography)throw Error("Classify the Territory before saving its boundary.");
  const entries=listSceneGeography(scene);
  const map=new Map(entries.map(e=>[e.id,e]));
  const key=regionId??"atlas_pending_territory";
  map.set(key,{id:key,linked:true,invalid:false,geography});
  validateGeographyHierarchy(key,geography,map);
  return {geography,entries};
}

function polygonFor(points){
  if(!globalThis.PIXI?.Polygon)throw Error("Foundry Polygon clipping is unavailable.");
  return new PIXI.Polygon(points.flatMap(p=>[p.x,p.y]));
}
function intersectionArea(region,polygon){
  const result=region?.polygonTree?.intersectPolygon?.(polygon);
  if(!Number.isFinite(result?.area)||result.area<0)
    throw Error("Native polygon overlap calculation is unavailable; no changes saved.");
  return result.area;
}

/** The authoring engine deliberately does not assume grid/polygon exclusivity.
 * Both shapes are compared with the Region's authoritative native geometry. */
export function validateTerritoryCoverage(scene,draft,shape,{regionId=null,view=globalThis.canvas}={}){
  const {geography,entries}=validateClassification(scene,draft,regionId);
  const parent=geography.parentRegionId?scene.regions?.get?.(geography.parentRegionId):null;
  if(geography.parentRegionId&&!parent)
    throw Error("The selected parent Continent is missing.");
  const peers=entries.filter(e=>e.id!==regionId&&e.linked&&!e.invalid&&e.geography&&
    (geography.kind==="continent"?e.geography.kind==="continent":
      ["city","town","village"].includes(geography.kind)&&
      ["city","town","village"].includes(e.geography.kind)));
  // Grid containment/overlap can be exact on both square and hex Scenes.
  if(shape.type==="grid"){
    const grid=view?.grid;
    const bounds=view?.dimensions;
    if(!view?.ready||view.scene?.id!==scene.id||!grid||grid.isGridless||
        typeof grid.getShape!=="function"||typeof grid.getCenterPoint!=="function"||
        ![bounds?.sceneX,bounds?.sceneY,bounds?.sceneWidth,bounds?.sceneHeight]
          .every(Number.isFinite))
      throw Error("Painted Territories require a live square/hex Scene grid.");
    const gridOnlyPeers=peers.filter(e=>{
      const r=scene.regions?.get?.(e.id),s=plainShapes(r);
      return s.length===1&&s[0].type==="grid";
    }).map(e=>({regionId:e.id,offsets:plainShapes(scene.regions.get(e.id))[0].offsets}));
    const conflicts=gridCellConflicts(shape.offsets,gridOnlyPeers);
    if(conflicts.length)throw Error(`Painted cells are already owned by ${conflicts.length} peer Territory/ies.`);
    if(shape.offsets.length*(peers.length+Number(Boolean(parent)))>15000)
      throw Error("This paint would exceed the safe geometry comparison budget; reduce the selection.");
    const cellShape=grid.getShape();
    if(!Array.isArray(cellShape)||cellShape.length<3||
        cellShape.some(p=>!Number.isFinite(p?.x)||!Number.isFinite(p?.y)))
      throw Error("Native Scene grid cell geometry is unavailable.");
    for(const offset of shape.offsets){
      const center=grid.getCenterPoint(offset);
      if(!Number.isFinite(center?.x)||!Number.isFinite(center?.y)||
          center.x<bounds.sceneX||center.x>bounds.sceneX+bounds.sceneWidth||
          center.y<bounds.sceneY||center.y>bounds.sceneY+bounds.sceneHeight)
        throw Error("Painted Territory cells must be centered within this Scene.");
      const poly=polygonFor(cellShape.map(p=>({x:center.x+p.x,y:center.y+p.y})));
      const area=Math.abs(poly.points.reduce((sum,v,i,arr)=>i%2===0?
        sum+v*arr[(i+3)%arr.length]-arr[(i+2)%arr.length]*arr[i+1]:sum,0)/2);
      if(parent&&Math.abs(intersectionArea(parent,poly)-area)>Math.max(0.1,area*1e-5))
        throw Error("A painted cell extends outside its designated parent Territory.");
      for(const peer of peers){
        if(gridOnlyPeers.some(e=>e.regionId===peer.id))continue;
        if(intersectionArea(scene.regions.get(peer.id),poly)>0.1)
          throw Error("A painted cell overlaps an existing peer Territory.");
      }
    }
  }else{
    const nativePoints=[];
    for(let i=0;i<shape.points.length;i+=2)nativePoints.push({
      x:shape.origin.x+shape.points[i],y:shape.origin.y+shape.points[i+1]});
    const area=inspectNativePolygonShape([shape]).area;
    const poly=polygonFor(nativePoints);
    if(parent&&Math.abs(intersectionArea(parent,poly)-area)>Math.max(0.1,area*1e-5))
      throw Error("This boundary extends beyond its designated parent Territory.");
    if(peers.length>40)throw Error("Too many peer Territories to validate safely.");
    for(const peer of peers)if(intersectionArea(scene.regions.get(peer.id),poly)>0.1)
      throw Error("This boundary overlaps an existing peer Territory.");
  }
}

/** Single native Region write; no draft data is stored outside this document.
 * Native Behaviors, Levels, visibility and Region IDs are preserved on edit. */
export async function saveTerritoryDraft(scene,draft,{regionId=null,
  view=globalThis.canvas}={}){
  const region=regionId?scene.regions?.get?.(regionId):null;
  authorize(scene,region);
  if(regionId&&(!region||region.parent?.id!==scene.id))throw Error("Native Region changed or is missing.");
  const name=draft.name?.trim();
  if(!region&&(!name||name.length>120||/[\x00-\x1f\x7f]/.test(name)))
    throw Error("Enter a printable Territory name (1–120 characters).");
  if(!view?.ready||view.scene?.id!==scene.id)
    throw Error("Open this Scene on the canvas before saving a native Territory.");
  const imageOrigin=sceneImageOrigin(view);
  const shape=shapeForDraft(draft);
  validateTerritoryCoverage(scene,draft,shape,{regionId,view});
  if(region&&shapeDigest(plainShapes(region))!==draft.sourceDigest)
    throw Error("The native Region changed during editing. Reload the draft; nothing saved.");
  if(region&&readBoundarySource(region)&&
      readBoundarySource(region).shapeDigest!==draft.sourceDigest)
    throw Error("The native Region diverged from its Atlas source.");
  const source={schemaVersion:BOUNDARY_SOURCE_VERSION,kind:draft.kind,
    coordinateSpace:"scene-image",
    nodes:draft.kind==="polygon"?draft.points.map(p=>({...p,
      x:p.x-imageOrigin.x,y:p.y-imageOrigin.y})):undefined,
    offsets:draft.kind==="grid"?clone(draft.offsets):undefined,
    wallIds:clone(draft.wallIds??[]),smoothing:draft.kind==="polygon"?
      draft.smoothing??0:0,shapeDigest:shapeDigest([shape])};
  const geography=validateGeographyFlag(draft.geography);
  const flags={[MODULE_ID]:{
    atlas:{schemaVersion:1,linked:true},
    [GEOGRAPHY_FLAG]:geography,
    [BOUNDARY_SOURCE_FLAG]:source}};
  let saved;
  if(region){
    await region.update({shapes:[shape],
      [`flags.${MODULE_ID}.${GEOGRAPHY_FLAG}`]:geography,
      [`flags.${MODULE_ID}.${BOUNDARY_SOURCE_FLAG}`]:source});
    saved=region;
  }else{
    const created=await scene.createEmbeddedDocuments("Region",[{name,shapes:[shape],
      flags,behaviors:[]}]);
    saved=created?.[0];
    if(!saved)throw Error("Foundry refused the native Region creation.");
  }
  atlasDebug("territory","Atlas Territory authored",{mode:draft.kind,
    edited:Boolean(region),controlCount:draft.kind==="polygon"?draft.points.length:draft.offsets.length,
    importedBlankWalls:draft.wallIds?.length??0},{level:"verbose"});
  return saved;
}
