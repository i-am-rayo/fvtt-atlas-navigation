/** Read-only, GM-authorized preview of a single native polygon Region becoming
 * a native v14.370+ Grid Shape. The conversion never writes Region documents. */
import {MAX_TERRITORY_CELLS,validateGridOffsets} from "./territory-authoring-model.js";
import {readRegionAtlasLink} from "./region-atlas.js";
import {readRegionGeography,listSceneGeography} from "./territory-geography-storage.js";
import {territoryTier} from "./territory-view-model.js";

const MAX_INSPECTED_CELLS = 30000;
const validBounds=b=>b&&[b.x,b.y,b.width,b.height].every(Number.isFinite)&&
  b.width>0&&b.height>0;

export function planTerritoryGridConversion(scene,regionId,{view=globalThis.canvas}={}){
  const user=globalThis.game?.user;
  const region=scene?.regions?.get?.(regionId);
  if(!user?.isGM||!scene?.id||!scene.canUserModify?.(user,"update")||
      !region||region.parent?.id!==scene.id||
      !region.canUserModify?.(user,"update")||!readRegionAtlasLink(region))
    throw Error("Select an editable, Atlas-linked native Region as GM.");
  if(!view?.ready||view.scene?.id!==scene.id||
      !globalThis.foundry?.data?.GridShapeData||!view.grid||view.grid.isGridless||
      typeof view.grid.getOffsetRange!=="function"||
      !["getCenterPoint","getShape"].every(m=>typeof view.grid[m]==="function"))
    throw Error("Grid conversion preview requires native v14.370+ and an open square/hex Scene.");
  const geography=readRegionGeography(region);
  const tier=territoryTier({linked:true,invalid:false,geography});
  if(tier==="unclassified")
    throw Error("Classify the selected native Region as a Continent, Area or Settlement first.");
  const shapes=Array.from(region.shapes??[],s=>s.toObject?.()??s);
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
    offsets,cellCount:offsets.length,cellArea,nativeArea:nativeTree.area,
    netAreaChangePercent:Math.round(areaDelta*1000)/10,
    peerCenterOverlaps,sourceShapeCount:shapes.length,
    inclusionRule:"Grid cell center inside native polygon (holes excluded)",
    writes:0
  };
}
