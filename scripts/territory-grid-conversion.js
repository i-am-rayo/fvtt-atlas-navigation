/** GM-authorized single-Region polygon-to-native-grid conversion. Native Shapes
 * remain authoritative; preview is read-only, commit is explicit and backed up. */
import {MODULE_ID} from "./atlas-storage.js";
import {MAX_TERRITORY_CELLS,BOUNDARY_SOURCE_FLAG,GRID_CONVERSION_BACKUP_FLAG,validateGridOffsets}
  from "./territory-authoring-model.js";
import {readRegionAtlasLink} from "./region-atlas.js";
import {readRegionGeography,listSceneGeography} from "./territory-geography-storage.js";
import {territoryTier} from "./territory-view-model.js";
import {GENERATED_REGION_FLAG} from "./generated-region-model.js";
import {readBoundarySource,readTerritoryDraft,nativeTerritoryShapeDigest,
  saveTerritoryDraft,validateTerritoryCoverage} from "./territory-authoring.js";

const MAX_INSPECTED_CELLS = 30000;
const validBounds=b=>b&&[b.x,b.y,b.width,b.height].every(Number.isFinite)&&
  b.width>0&&b.height>0;
const nativeShapes=region=>Array.from(region.shapes??[],s=>
  typeof s.toObject==="function"?s.toObject():structuredClone(s));

function gridIdentity(scene,view){
  const bounds=view?.dimensions;
  return JSON.stringify({type:scene?.grid?.type??view?.grid?.type,
    size:scene?.grid?.size??view?.grid?.size,
    sceneX:bounds?.sceneX,sceneY:bounds?.sceneY,
    sceneWidth:bounds?.sceneWidth,sceneHeight:bounds?.sceneHeight,
    sceneImageWidth:scene?.width??null,sceneImageHeight:scene?.height??null});
}

function authorizedRegion(scene,id){
  const region=scene?.regions?.get?.(id),user=globalThis.game?.user;
  if(!user?.isGM||!scene?.id||!scene.canUserModify?.(user,"update")||
      !region||region.parent?.id!==scene.id||
      !region.canUserModify?.(user,"update")||!readRegionAtlasLink(region)||
      region.getFlag?.(MODULE_ID,GENERATED_REGION_FLAG)!=null)
    throw Error("Select an editable, Atlas-linked manual native Region as GM.");
  return region;
}

export function planTerritoryGridConversion(scene,regionId,{view=globalThis.canvas}={}){
  const region=authorizedRegion(scene,regionId);
  if(!view?.ready||view.scene?.id!==scene.id||
      !globalThis.foundry?.data?.GridShapeData||!view.grid||view.grid.isGridless||
      typeof view.grid.getOffsetRange!=="function"||
      !["getCenterPoint","getShape"].every(m=>typeof view.grid[m]==="function"))
    throw Error("Grid conversion preview requires native v14.370+ and an open square/hex Scene.");
  const geography=readRegionGeography(region);
  const tier=territoryTier({linked:true,invalid:false,geography});
  if(tier==="unclassified")
    throw Error("Classify the selected native Region as a Continent, Area or Settlement first.");
  const shapes=nativeShapes(region);
  if(shapes.length!==1||shapes[0]?.type!=="polygon"||
      shapes[0].hole===true||shapes[0].gridBased===true||
      !Array.isArray(shapes[0].points)||shapes[0].points.length<6||
      shapes[0].points.length%2||!shapes[0].points.every(Number.isFinite))
    throw Error("Conversion preview supports one ordinary native polygon Shape (no holes or multiple Shapes).");
  const nativeTree=region.polygonTree;
  const bounds=region.bounds;
  const grid=view.grid;
  if(!validBounds(bounds)||typeof nativeTree?.testPoint!=="function"||
      !Number.isFinite(nativeTree.area)||nativeTree.area<=0)
    throw Error("Native Region geometry is unavailable; nothing has been changed.");
  const range=grid.getOffsetRange(bounds);
  if(!Array.isArray(range)||range.length!==4||!range.every(Number.isSafeInteger)||
      range[0]>=range[2]||range[1]>=range[3]||
      (range[2]-range[0])*(range[3]-range[1])>MAX_INSPECTED_CELLS)
    throw Error("This Region exceeds the safe grid-conversion preview budget; split the source before converting.");
  const sceneBounds=view.dimensions;
  if(![sceneBounds?.sceneX,sceneBounds?.sceneY,sceneBounds?.sceneWidth,
    sceneBounds?.sceneHeight].every(Number.isFinite))
    throw Error("The native Scene grid bounds are unavailable.");
  const insideScene=p=>p.x>=sceneBounds.sceneX&&
    p.x<=sceneBounds.sceneX+sceneBounds.sceneWidth&&
    p.y>=sceneBounds.sceneY&&p.y<=sceneBounds.sceneY+sceneBounds.sceneHeight;
  const candidates=[];
  for(let i=range[0];i<range[2];i++)for(let j=range[1];j<range[3];j++){
    const center=grid.getCenterPoint({i,j});
    if(!Number.isFinite(center?.x)||!Number.isFinite(center?.y))
      throw Error("The Scene grid produced an invalid cell center; no changes made.");
    if(insideScene(center)&&nativeTree.testPoint(center)){
      candidates.push({i,j});
      if(candidates.length>MAX_TERRITORY_CELLS)
        throw Error("Candidate exceeds 6,000 native grid spaces; reduce the conversion area.");
    }
  }
  if(!candidates.length)
    throw Error("No grid cell centers fall inside the selected polygon; no candidate exists.");
  const offsets=validateGridOffsets(candidates);
  const cellPoints=grid.getShape();
  if(!Array.isArray(cellPoints)||cellPoints.length<3||
      cellPoints.some(p=>!Number.isFinite(p?.x)||!Number.isFinite(p?.y)))
    throw Error("Native grid cell geometry is not available.");
  const cellArea=Math.abs(cellPoints.reduce((total,p,i)=>{
    const next=cellPoints[(i+1)%cellPoints.length];
    return total+p.x*next.y-next.x*p.y;
  },0))/2;
  if(!Number.isFinite(cellArea)||cellArea<=0)
    throw Error("Native grid cell has invalid area.");
  // This measures net area change, not symmetric-difference error. Edge cells
  // may change even if the total area remains similar; the preview shows them.
  const areaDelta=(offsets.length*cellArea-nativeTree.area)/nativeTree.area;
  const entries=listSceneGeography(scene);
  const peers=entries.filter(e=>e.id!==regionId&&e.linked&&!e.invalid&&
    territoryTier(e)===tier);
  if(peers.length>40)
    throw Error("Too many same-tier Regions to preview safely; refine the Scene first.");
  const peerCenterOverlaps=[];
  for(const peer of peers){
    const tree=scene.regions?.get?.(peer.id)?.polygonTree;
    if(typeof tree?.testPoint!=="function")continue;
    let count=0;
    for(const offset of offsets)
      if(tree.testPoint(grid.getCenterPoint(offset)))count++;
    if(count)peerCenterOverlaps.push({regionId:peer.id,name:peer.name,count});
  }
  return {
    sceneId:scene.id,regionId,regionName:region.name,tier,
    gridIdentity:gridIdentity(scene,view),
    originalShapesSnapshot:JSON.stringify(shapes),
    geographySnapshot:JSON.stringify(geography),
    boundarySourceSnapshot:JSON.stringify(region.getFlag(MODULE_ID,BOUNDARY_SOURCE_FLAG)??null),
    offsets,cellCount:offsets.length,cellArea,nativeArea:nativeTree.area,
    netAreaChangePercent:Math.round(areaDelta*1000)/10,
    peerCenterOverlaps,sourceShapeCount:shapes.length,
    inclusionRule:"Grid cell center inside native polygon (holes excluded)",
    writes:0
  };
}

/** Explicitly replace exactly one Region's Shapes + store a reversible backup
 * in the SAME native RegionDocument update. Same-tier peers are never edited. */
export async function commitTerritoryGridConversion(scene,plan,{view=globalThis.canvas}={}){
  if(!plan||plan.sceneId!==scene?.id||!plan.regionId||!Array.isArray(plan.offsets))
    throw Error("Reopen the selected native grid conversion preview.");
  const region=authorizedRegion(scene,plan.regionId);
  if(region.getFlag(MODULE_ID,GRID_CONVERSION_BACKUP_FLAG)!=null)
    throw Error("This Region already has a conversion backup; restore or resolve it first.");
  const fresh=planTerritoryGridConversion(scene,plan.regionId,{view});
  if(fresh.originalShapesSnapshot!==plan.originalShapesSnapshot||
      fresh.geographySnapshot!==plan.geographySnapshot||
      fresh.boundarySourceSnapshot!==plan.boundarySourceSnapshot||
      fresh.gridIdentity!==plan.gridIdentity||
      fresh.regionName!==plan.regionName||
      JSON.stringify(fresh.offsets)!==JSON.stringify(plan.offsets))
    throw Error("The native Region, Scene grid or conversion candidate changed; preview again. No update made.");
  // Reuse Atlas's native geometry validator and exact source-digest checks.
  // In particular, a peer-center preview cannot authorize an overlapping cell.
  const original=readTerritoryDraft(scene,plan.regionId,{view});
  if(original.kind!=="polygon")
    throw Error("Only one reconciled native polygon may be converted.");
  const shape={type:"grid",origin:null,offsets:validateGridOffsets(plan.offsets)};
  const backup={schemaVersion:1,sceneId:scene.id,regionId:plan.regionId,
    gridIdentity:plan.gridIdentity,originalShapes:nativeShapes(region),
    previousBoundarySource:readBoundarySource(region),
    convertedShapeDigest:nativeTerritoryShapeDigest([shape])};
  await saveTerritoryDraft(scene,{...original,kind:"grid",points:[],
    offsets:plan.offsets,wallIds:[],smoothing:0,name:region.name,
    geography:readRegionGeography(region)},
  {regionId:plan.regionId,view,conversionBackup:backup});
  return {regionId:plan.regionId,cellCount:plan.offsets.length};
}

/** The backup is a reversible snapshot, not a competing authoritative Shape. */
export function readTerritoryGridConversionBackup(region){
  const data=region?.getFlag?.(MODULE_ID,GRID_CONVERSION_BACKUP_FLAG);
  if(data==null)return null;
  if(!data||typeof data!=="object"||data.schemaVersion!==1||
      data.regionId!==region.id||data.sceneId!==region.parent?.id||
      typeof data.gridIdentity!=="string"||data.gridIdentity.length>2000||
      typeof data.convertedShapeDigest!=="string"||
      !Array.isArray(data.originalShapes)||data.originalShapes.length!==1||
      data.originalShapes[0]?.type!=="polygon"||
      data.originalShapes[0]?.hole===true||
      JSON.stringify(data).length>120000)
    throw Error("Unsupported Atlas conversion backup; native Shapes were not modified.");
  return structuredClone(data);
}

/** Recover a previously converted Region without touching another Region. */
export async function restoreTerritoryPolygonBackup(scene,regionId,{view=globalThis.canvas}={}){
  const region=authorizedRegion(scene,regionId);
  const backup=readTerritoryGridConversionBackup(region);
  if(!backup)throw Error("There is no native polygon conversion backup to restore.");
  const currentSource=readBoundarySource(region);
  if(!view?.ready||view.scene?.id!==scene.id||
      backup.gridIdentity!==gridIdentity(scene,view)||
      nativeTerritoryShapeDigest(nativeShapes(region))!==backup.convertedShapeDigest||
      currentSource?.kind!=="grid"||
      currentSource.shapeDigest!==backup.convertedShapeDigest||
      currentSource.wallIds.length!==0||currentSource.smoothing!==0||
      nativeTerritoryShapeDigest([{type:"grid",offsets:currentSource.offsets}])!==
        backup.convertedShapeDigest)
    throw Error("The grid or converted Region changed since conversion. Restore was blocked safely.");
  const geography=readRegionGeography(region);
  if(!geography)throw Error("Classify this native Region before restoring its polygon.");
  // Exact parent/peer geometry must still permit the restored boundary.
  validateTerritoryCoverage(scene,{geography},backup.originalShapes[0],{regionId,view});
  const source=backup.previousBoundarySource;
  await region.update({
    shapes:structuredClone(backup.originalShapes),
    ...(source===null?{[`flags.${MODULE_ID}.-=${BOUNDARY_SOURCE_FLAG}`]:null}:
      {[`flags.${MODULE_ID}.${BOUNDARY_SOURCE_FLAG}`]:source}),
    [`flags.${MODULE_ID}.-=${GRID_CONVERSION_BACKUP_FLAG}`]:null
  });
  return regionId;
}
