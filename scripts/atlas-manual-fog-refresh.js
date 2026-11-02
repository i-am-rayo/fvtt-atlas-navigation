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

/** A Scene clock, lighting, or weather change must not rebuild the Atlas fog
 * mask. Native time modules can update the Scene on every guided stretch; a
 * complete mask replacement during those updates caused a visible dark frame.
 * Rebuild only when inputs to the mask actually change. */
export function shouldRefreshManualFogForSceneUpdate(changes){
  if(!changes||typeof changes!=="object")return true;
  for(const field of ["grid","width","height","x","y","padding"]){
    if(Object.hasOwn(changes,field))return true;
  }
  const flags=changes.flags;
  if(flags&&typeof flags==="object"){
    const moduleFlags=flags[MODULE_ID];
    if(moduleFlags&&typeof moduleFlags==="object"){
      if(Object.keys(moduleFlags).some(key=>
        ["manualFog","partyExploration","atlas"].includes(key.replace(/^-=/,""))))return true;
    }
    // Support the flattened form emitted by some Scene.update callers.
    if(Object.keys(flags).some(key=>["manualFog","partyExploration","atlas"].some(field=>
      key===`${MODULE_ID}.${field}`)))return true;
  }
  return Object.keys(changes).some(key=>["manualFog","partyExploration","atlas"].some(field=>
    key===`flags.${MODULE_ID}.${field}`));
}
