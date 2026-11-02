import { MODULE_ID } from "./atlas-storage.js";

/** Explorer survey writes only fog cells, not roads. Skip costly GM road
 * redraws for these isolated Scene changes; player views still reproject roads
 * to their newly revealed cells. Unknown/mixed updates always redraw. */
export function isManualFogOnlySceneUpdate(changes){
  if(!changes||typeof changes!=="object"||Object.keys(changes).length!==1||
      !changes.flags||Object.keys(changes.flags).length!==1)return false;
  const moduleFlags=changes.flags[MODULE_ID];
  return !!moduleFlags&&typeof moduleFlags==="object"&&
    Object.keys(moduleFlags).length===1&&
    Object.hasOwn(moduleFlags,"manualFog");
}
