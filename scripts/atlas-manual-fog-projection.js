import { cellKey,validateManualFog } from "./atlas-manual-fog-model.js";

/** Pure, read-only mask choice. The native Grid adapter owns cell geometry;
 * explicit Hide overrides both authored reveals and checkpoint discovery. */
export function coveredManualFogCells(cells,state,checkpointRevealKeys=new Set()){
  const fog=validateManualFog(state);
  if(!Array.isArray(cells)||!(checkpointRevealKeys instanceof Set))
    throw Error("Atlas fog mask needs valid native cells and checkpoint keys.");
  const revealed=new Set(fog.revealed.map(cellKey));
  const hidden=new Set(fog.hidden.map(cellKey));
  return cells.filter(cell=>{
    const key=cellKey(cell);
    return hidden.has(key)||(!revealed.has(key)&&!checkpointRevealKeys.has(key));
  });
}
