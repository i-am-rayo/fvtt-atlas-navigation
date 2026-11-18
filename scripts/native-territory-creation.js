import {atlasDebug} from "./atlas-debug.js";

/** GM-authorized Foundry v14 Region placement. The native RegionLayer owns the
 * canvas click, preview, creation, and cancellation. Atlas supplies only a
 * one-cell editable polygon starter; no Atlas link or public flag is added. */
export async function placeNativePolygonTerritory(scene,name,{
  view=globalThis.canvas,user=globalThis.game?.user
}={}){
  if(!user?.isGM||!scene?.id||!scene.canUserModify?.(user,"update"))
    throw Error("Only a Scene-authorized GM can create native territory Regions.");
  if(typeof name!=="string"||!name.trim()||name.trim().length>120||
      /[\u0000-\u001f\u007f]/.test(name))
    throw Error("Enter a native Region name of 1–120 printable characters.");
  if(!view?.ready||view.scene?.id!==scene.id||
      typeof view.regions?.placeRegion!=="function")
    throw Error("Open this Scene on the canvas with native Region placement available.");
  const size=scene.grid?.size;
  if(!Number.isFinite(size)||size<=0)
    throw Error("This Scene needs a valid native grid size for the starter polygon.");
  atlasDebug("territory","Native Region polygon placement started",{
    method:"Foundry RegionLayer.placeRegion",shape:"polygon"},{level:"verbose"});
  const created=await view.regions.placeRegion({
    name:name.trim(),shapes:[{type:"polygon",origin:{x:0,y:0},
      points:[0,0,size,0,size,size,0,size],hole:false,gridBased:false}],
    behaviors:[]
  },{allowRotation:false});
  if(created&&created.parent?.id!==scene.id)
    throw Error("The native Region was not created in this Scene; inspect Foundry before retrying.");
  atlasDebug("territory",created?
    "Native Region polygon placed":"Native Region polygon placement cancelled",{
    shape:"polygon",created:Boolean(created),linkedToAtlas:false,
    publiclyNamed:false},{level:"verbose"});
  return created??null;
}
