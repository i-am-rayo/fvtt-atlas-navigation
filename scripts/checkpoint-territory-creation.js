/** Optional one-cell native Territory offered only AFTER a Checkpoint commit.
 * A pending offer is client-local; no native document is written until the GM
 * confirms. Geographic identity and the Checkpoint link share one Region write.
 */
import {readAtlas,MODULE_ID} from "./atlas-storage.js";
import {checkpointCategory} from "./checkpoint-types.js";
import {toCanvasPoint} from "./road-coordinates.js";
import {listSceneGeography} from "./territory-geography-storage.js";
import {territoryCheckpointLinks} from "./territory-checkpoint-link.js";
import {saveTerritoryDraft,validateTerritoryCoverage} from "./territory-authoring.js";

const SETTLEMENT_KINDS=new Set(["city","town","village","settlement"]);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const normalized=value=>String(value??"").normalize("NFKC").trim().toLocaleLowerCase();

function authorize(scene,view){
  const user=globalThis.game?.user;
  if(!user?.isGM||!scene?.canUserModify?.(user,"update"))
    throw Error("Only a Scene-authorized GM may create a Checkpoint Territory.");
  if(!view?.ready||view.scene?.id!==scene.id||!view.grid||view.grid.isGridless||
      !globalThis.foundry?.data?.GridShapeData||
      typeof view.grid.getOffset!=="function"||
      typeof view.grid.getCenterPoint!=="function"||
      typeof view.grid.getShape!=="function")
    throw Error("One-cell Territories require a live square/hex Scene and Foundry v14 native Grid Shapes.");
}

export function checkpointTerritoryCellDraft(plan){
  return {kind:"grid",name:plan.name,points:[],offsets:[{...plan.offset}],
    wallIds:[],smoothing:0,geography:{schemaVersion:1,kind:plan.kind,
      parentRegionId:null,roadOverrides:{}}};
}

/** Preflight reads the authoritative saved Checkpoint and its native grid cell.
 * It never infers identity merely from a nearby road label or staged form. */
export function planCheckpointTerritory(scene,checkpointId,{view=globalThis.canvas}={}){
  authorize(scene,view);
  const atlas=readAtlas(scene);
  const checkpoint=atlas.checkpoints?.find(cp=>cp.id===checkpointId);
  if(!checkpoint)throw Error("The new Checkpoint is no longer in this Scene.");
  const kind=checkpointCategory(scene,checkpointId);
  if(!SETTLEMENT_KINDS.has(kind))return null;
  const node=atlas.nodes?.find(item=>item.id===checkpoint.nodeId);
  if(!node||!Number.isFinite(node.x)||!Number.isFinite(node.y))
    throw Error("The Checkpoint has no valid saved road-node position.");
  const point=toCanvasPoint(view,atlas,node);
  const offset=view.grid.getOffset(point);
  const center=view.grid.getCenterPoint(offset);
  const bounds=view.dimensions;
  const cellShape=view.grid.getShape();
  if(![point.x,point.y,center?.x,center?.y,bounds?.sceneX,bounds?.sceneY,
      bounds?.sceneWidth,bounds?.sceneHeight].every(Number.isFinite)||
      bounds.sceneWidth<=0||bounds.sceneHeight<=0||
      !Array.isArray(cellShape)||cellShape.length<3||
      cellShape.length>12||cellShape.some(v=>!Number.isFinite(v.x)||!Number.isFinite(v.y))||
      !Number.isSafeInteger(offset?.i)||!Number.isSafeInteger(offset?.j)||
      point.x<bounds.sceneX||point.x>bounds.sceneX+bounds.sceneWidth||
      point.y<bounds.sceneY||point.y>bounds.sceneY+bounds.sceneHeight||
      center.x<bounds.sceneX||center.x>bounds.sceneX+bounds.sceneWidth||
      center.y<bounds.sceneY||center.y>bounds.sceneY+bounds.sceneHeight)
    throw Error("The Checkpoint is outside a fully supported native Scene cell.");
  const links=territoryCheckpointLinks(scene);
  if(links.some(item=>item.invalid))
    throw Error("Resolve invalid native Territory checkpoint flags before creating another association.");
  if(links.some(item=>item.link?.checkpointId===checkpointId))return null;
  const entries=listSceneGeography(scene);
  const compatible=entries.filter(item=>item.linked&&!item.invalid&&
      item.geography?.kind===kind&&
      !scene.regions?.get?.(item.id)?.getFlag?.(MODULE_ID,"generatedRegion"))
    .map(item=>{
      const region=scene.regions.get(item.id);
      const shapes=Array.from(region?.shapes??[],s=>s.toObject?.()??s);
      const onCell=shapes.some(s=>s.type==="grid"&&s.offsets?.some(o=>
        o.i===offset.i&&o.j===offset.j))||
        region?.polygonTree?.testPoint?.(center)===true;
      const a=normalized(checkpoint.name),b=normalized(item.name);
      const nameMatch=a===b?"exact":b.startsWith(a+" ")||b.startsWith(a+" -")?
        "leading":a.startsWith(b+" ")||a.startsWith(b+" -")?"leading":null;
      return {...item,onCell,nameMatch};
    }).sort((a,b)=>Number(b.onCell)-Number(a.onCell)||
      Number(b.nameMatch==="exact")-Number(a.nameMatch==="exact")||
      Number(b.nameMatch==="leading")-Number(a.nameMatch==="leading")||
      a.name.localeCompare(b.name));
  const plan={sceneId:scene.id,checkpointId,name:checkpoint.name,kind,
    nodeId:checkpoint.nodeId,node:{x:node.x,y:node.y},atlasRevision:atlas.revision,
    offset:{i:offset.i,j:offset.j},center:{x:center.x,y:center.y},
    cellShape:cellShape.map(vertex=>({x:vertex.x,y:vertex.y})),
    regionIds:Array.from(scene.regions?.keys?.()??[]).sort(),compatible,
    createBlocked:null};
  try{
    validateTerritoryCoverage(scene,checkpointTerritoryCellDraft(plan),
    {type:"grid",offsets:[plan.offset],origin:null},{view});
    // Reuse the native authoring overlap/containment preflight, not a relaxed
    // point-in-polygon approximation for production writes.
    if(compatible.some(item=>item.nameMatch==="exact"))
      plan.createBlocked="A Territory of this geographic kind already has the exact name. Link it instead.";
  }catch(error){plan.createBlocked=error.message??String(error);}
  return plan;
}

/** Commit rechecks position, type, revision and the Scene's Region inventory.
 * saveTerritoryDraft performs the final native geometry/overlap validation. */
export async function createCheckpointTerritory(scene,plan,{view=globalThis.canvas}={}){
  if(!plan||plan.createBlocked||plan.sceneId!==scene?.id)
    throw Error(plan?.createBlocked??"Reopen the Checkpoint Territory offer.");
  const current=planCheckpointTerritory(scene,plan.checkpointId,{view});
  if(!current||current.createBlocked||current.name!==plan.name||
      current.kind!==plan.kind||current.nodeId!==plan.nodeId||
      current.atlasRevision!==plan.atlasRevision||
      !same(current.node,plan.node)||!same(current.offset,plan.offset)||
      !same(current.center,plan.center)||!same(current.cellShape,plan.cellShape)||
      !same(current.regionIds,plan.regionIds))
    throw Error("The Checkpoint, native Regions or grid changed during review. Reopen the Territory offer.");
  return saveTerritoryDraft(scene,checkpointTerritoryCellDraft(current),{
    view,checkpointAssociation:{checkpointId:plan.checkpointId,
      expectedAtlasRevision:plan.atlasRevision}});
}

/** Disposable, non-interactive GM preview above the canvas, never shown to players. */
export class CheckpointTerritoryCellPreview{
  layer=null;
  clear(){
    const layer=this.layer;this.layer=null;
    if(layer){layer.parent?.removeChild?.(layer);layer.destroy?.({children:true});}
  }
  show(scene,plan,{view=globalThis.canvas}={}){
    this.clear();authorize(scene,view);
    const vertices=plan.cellShape,pixi=globalThis.PIXI;
    if(!Array.isArray(vertices)||vertices.length<3||
        vertices.some(v=>!Number.isFinite(v.x)||!Number.isFinite(v.y))||
        !pixi?.Graphics||!view.interface?.addChild)
      throw Error("Foundry cannot preview this native Scene cell.");
    const points=vertices.flatMap(v=>[v.x+plan.center.x,v.y+plan.center.y]);
    const graphics=new pixi.Graphics();graphics.eventMode="none";
    try{
      if(typeof graphics.poly==="function"){
        graphics.poly(points,true).fill({color:0xf7ba4f,alpha:.26})
          .stroke({color:0xffd889,width:3,alpha:1,join:"round"});
      }else if(typeof graphics.drawPolygon==="function"){
        graphics.lineStyle(3,0xffd889,1);
        graphics.beginFill(0xf7ba4f,.26);graphics.drawPolygon(points);graphics.endFill();
      }else throw Error("Foundry cannot draw the native cell preview.");
      view.interface.addChild(graphics);this.layer=graphics;
      return graphics;
    }catch(error){graphics.destroy?.();throw error;}
  }
}
