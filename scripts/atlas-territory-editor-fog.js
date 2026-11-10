/** Reversible, client-only fog-free GM view while authoring Atlas Territories.
 * Never modify Scene vision settings, FogExploration documents or Atlas fog flags.
 * Foundry's CanvasVisibility is the local rendering group for native fog.
 */
export function acquireAtlasTerritoryEditorFog({view=globalThis.canvas,manualFog=null}={}){
  if(!globalThis.game?.user?.isGM||!view?.ready)
    throw Error("Only a GM may hide fog for Territory editing.");
  const visibility=view.visibility;
  const originalVisible=visibility?.visible;
  const sceneId=view.scene?.id;
  const hideNative=()=>{
    if(globalThis.game?.user?.isGM&&globalThis.canvas===view&&
        view.scene?.id===sceneId&&visibility&&typeof visibility.visible==="boolean")
      visibility.visible=false;
  };
  let released=false;
  // Reassert only on this client's redraw hooks; never alter another client's
  // Canvas or perform a persisted fog operation.
  const hooks=globalThis.Hooks;
  const hookIds=[];
  try{
    manualFog?.setEditorHidden?.(true);
    hideNative();
    for(const name of ["sightRefresh","visibilityRefresh"]){
      if(typeof hooks?.on==="function")hookIds.push([name,hooks.on(name,hideNative)]);
    }
  }catch(error){
    for(const [name,id] of hookIds)hooks?.off?.(name,id);
    if(typeof originalVisible==="boolean"&&visibility)visibility.visible=originalVisible;
    manualFog?.setEditorHidden?.(false);
    throw error;
  }
  return ()=>{
    if(released)return;
    released=true;
    for(const [name,id] of hookIds)hooks?.off?.(name,id);
    if(typeof originalVisible==="boolean"&&visibility)
      visibility.visible=originalVisible;
    try{manualFog?.setEditorHidden?.(false);}
    catch(error){
      console.warn("[fvtt-atlas-navigation] Could not refresh GM fog after Territory editing",error);
    }
  };
}
