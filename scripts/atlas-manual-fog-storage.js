import { MODULE_ID } from "./atlas-storage.js";
import { MANUAL_FOG_FLAG, validateManualFog, paintManualFog } from "./atlas-manual-fog-model.js";
import { nativeFogCells } from "./atlas-manual-fog-geometry.js";
import { readAtlasMapFog } from "./atlas-map-fog-storage.js";
export function readManualFog(scene) {
  if(!scene?.getFlag)throw new Error("Select an Atlas Scene.");
  return validateManualFog(scene.getFlag(MODULE_ID,MANUAL_FOG_FLAG));
}
function permit(scene) {
  if(!globalThis.game?.user?.isGM || !scene?.canUserModify?.(game.user,"update"))
    throw new Error("Only a GM can edit Atlas manual exploration.");
}
function activeView(scene) {
  const view=globalThis.canvas;
  if(!view?.ready||view.scene?.id!==scene.id)throw new Error("Open the Scene canvas.");
  nativeFogCells(view);
  return view;
}
const pending=new Map();
function enqueue(scene, action) {
  const old=pending.get(scene.id)??Promise.resolve();
  const next=old.catch(()=>{}).then(action);
  pending.set(scene.id,next);
  void next.finally(()=>{if(pending.get(scene.id)===next)pending.delete(scene.id);}).catch(()=>{});
  return next;
}
export function setManualFogEnabled(scene, enabled) {
  permit(scene); activeView(scene);
  if(typeof enabled!=="boolean")throw new Error("Invalid Atlas fog mode.");
  if(!enabled&&scene.tokenVision===false)
    throw new Error("Re-enable native Token Vision before disabling Atlas fog.");
  return enqueue(scene,async()=>{
    const previous=readManualFog(scene);
    const updated={...previous,enabled};
    await scene.setFlag(MODULE_ID,MANUAL_FOG_FLAG,updated);
    return updated;
  });
}
export function applyManualFogBrush(scene, positions,mode) {
  permit(scene); activeView(scene);
  return enqueue(scene,async()=>{
    const previous=readManualFog(scene);
    if(!previous.enabled)throw new Error("Enable Atlas manual fog before painting.");
    const updated=paintManualFog(previous,positions,mode);
    await scene.setFlag(MODULE_ID,MANUAL_FOG_FLAG,updated);
    return updated;
  });
}
/** Explicit, non-destructive import. Old travel flags are never deleted. */
export function importLegacyExploredCells(scene) {
  permit(scene);
  const view=activeView(scene);
  return enqueue(scene,async()=>{
    const previous=readManualFog(scene);
    const legacy=readAtlasMapFog(scene);
    if(legacy.schemaVersion!==2 || !legacy.cells.length)
      throw new Error("No saved legacy cell projection is available.");
    const possible=nativeFogCells(view);
    const scale=Number(scene.grid?.size);
    const projected=[];
    for(const old of legacy.cells) {
      const candidate=possible.reduce((best,c)=>{
        const dist=Math.hypot(c.x-old.x,c.y-old.y);
        return dist<best.dist?{cell:c,dist}:best;
      },{cell:null,dist:Infinity});
      if(candidate.cell&&candidate.dist<scale*.26)
        projected.push({x:candidate.cell.x,y:candidate.cell.y});
    }
    const updated=paintManualFog(previous,projected,"reveal");
    await scene.setFlag(MODULE_ID,MANUAL_FOG_FLAG,updated);
    return { ...updated, imported:projected.length };
  });
}
