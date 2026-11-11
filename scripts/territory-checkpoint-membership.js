/** Read-only, native-grid-cell Checkpoint containment inspection. Never infers
 * an explicit semantic link or writes a Region/Scene flag. */
import {readAtlas} from "./atlas-storage.js";
import {toCanvasPoint} from "./road-coordinates.js";
import {listSceneGeography} from "./territory-geography-storage.js";
import {readTerritoryCheckpointLink} from "./territory-checkpoint-link.js";

const MAX_REGIONS=100,MAX_CHECKPOINTS=500,MAX_CELLS=200000;
const key=offset=>`${offset.i},${offset.j}`;

/** Returns one candidate per matching native Region, without choosing an
 * arbitrary same-depth winner when several Regions own a Checkpoint cell. */
export function inspectCheckpointTerritoryMembership(scene,{view=globalThis.canvas}={}){
  if(!globalThis.game?.user?.isGM||!scene||!view?.ready||view.scene?.id!==scene.id||
      view.grid?.isGridless||typeof view.grid?.getOffset!=="function"||
      !Number.isFinite(view.dimensions?.sceneX)||!Number.isFinite(view.dimensions?.sceneY))
    return {available:false,reason:"Open this square/hex Scene as GM to inspect native cells.",items:[]};
  const territories=listSceneGeography(scene).filter(entry=>entry.linked);
  const atlas=readAtlas(scene),checkpoints=atlas.checkpoints??[];
  if(territories.length>MAX_REGIONS||checkpoints.length>MAX_CHECKPOINTS)
    return {available:false,reason:"Territory/Checkpoint count exceeds the safe inspection limit.",items:[]};
  const owned=[];let inspectedCells=0;
  for(const entry of territories){
    if(entry.invalid||!entry.geography)continue;
    const region=scene.regions?.get?.(entry.id);
    const shapes=Array.from(region?.shapes??[],s=>s?.toObject?.()??s);
    if(!shapes.length||shapes.some(s=>s?.type!=="grid"||!Array.isArray(s.offsets)))continue;
    const cells=new Set();
    for(const shape of shapes){
      inspectedCells+=shape.offsets.length;
      if(inspectedCells>MAX_CELLS)
        return {available:false,reason:"Native grid-cell inventory exceeds the safe inspection limit.",items:[]};
      for(const offset of shape.offsets){
        if(!Number.isSafeInteger(offset?.i)||!Number.isSafeInteger(offset?.j))
          return {available:false,reason:"Unsupported native grid offsets.",items:[]};
        cells.add(key(offset));
      }
    }
    let explicit=null,invalid=false;
    try{explicit=readTerritoryCheckpointLink(region)?.checkpointId??null;}
    catch{invalid=true;}
    owned.push({...entry,cells,explicit,invalid});
  }
  const nodes=new Map((atlas.nodes??[]).map(node=>[node.id,node]));
  const items=[];
  for(const checkpoint of checkpoints){
    const node=nodes.get(checkpoint.nodeId);
    if(!Number.isFinite(node?.x)||!Number.isFinite(node?.y))continue;
    let offset;
    try{offset=view.grid.getOffset(toCanvasPoint(view,atlas,node));}
    catch{continue;}
    if(!Number.isSafeInteger(offset?.i)||!Number.isSafeInteger(offset?.j))continue;
    const matches=owned.filter(t=>t.cells.has(key(offset)));
    const ids=new Set(matches.map(t=>t.id));
    const byId=new Map(owned.map(t=>[t.id,t]));
    const descendant=(child,parentId)=>{
      const seen=new Set();let id=child.geography.parentRegionId;
      while(id&&!seen.has(id)){
        if(id===parentId)return true;
        seen.add(id);id=byId.get(id)?.geography.parentRegionId;
      }
      return false;
    };
    const leaf=matches.filter(t=>!matches.some(child=>child.id!==t.id&&
      descendant(child,t.id)));
    const ambiguity=leaf.length>1;
    for(const territory of owned){
      if(!ids.has(territory.id)&&territory.explicit!==checkpoint.id)continue;
      items.push({checkpointId:checkpoint.id,checkpointName:checkpoint.name,
        regionId:territory.id,regionName:territory.name,
        contains:ids.has(territory.id),explicit:territory.explicit===checkpoint.id,
        ambiguous:ambiguity&&leaf.some(t=>t.id===territory.id),
        invalid:territory.invalid,cell:{i:offset.i,j:offset.j}});
    }
  }
  return {available:true,reason:null,items};
}
