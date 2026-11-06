import {MODULE_ID} from "./atlas-storage.js";
import {PUBLIC_TERRITORY_FLAG,validatePublicTerritoryFlag,
  validatedPublicTerritoryLabel} from "./region-narration-model.js";

/** Foundry-document adapter. No read ever saves or migrates native Regions. */
export function readPublicTerritory(region){
  return validatePublicTerritoryFlag(region?.getFlag?.(MODULE_ID,PUBLIC_TERRITORY_FLAG));
}

export function listPublicTerritorySettings(scene){
  return Array.from(scene?.regions?.contents??scene?.regions?.values?.()??[],region=>{
    let setting=null,invalid=false;
    try{setting=readPublicTerritory(region);}
    catch{invalid=true;}
    return {id:region.id,name:region.name??"Unnamed Region",
      hidden:region.hidden===true,label:setting?.label??null,invalid};
  }).sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
}

/** One explicit GM write scoped to Atlas's public-name Region flag. The
 * caller supplies the exact snapshot seen when the GM opened the editor. */
export async function savePublicTerritory(scene,regionId,{enabled,label="",
  expected,expectedName,expectedHidden}={}){
  const me=globalThis.game?.user;
  if(!me?.isGM||!scene?.canUserModify?.(me,"update"))
    throw Error("Only a Scene-authorized GM can change public territory labels.");
  const region=scene.regions?.get?.(regionId);
  if(!region||region.parent?.id!==scene.id||
      !region.canUserModify?.(me,"update"))
    throw Error("This native Region is unavailable or not editable.");
  if(typeof enabled!=="boolean"||expected===undefined||
      typeof expectedName!=="string"||typeof expectedHidden!=="boolean")
    throw Error("Reopen the public territory editor before saving.");
  const prior=readPublicTerritory(region);
  if(JSON.stringify(prior)!==JSON.stringify(validatePublicTerritoryFlag(expected))||
      region.name!==expectedName||(region.hidden===true)!==expectedHidden)
    throw Error("This Region changed since you opened the editor. Review and retry.");
  if(enabled){
    if(region.hidden===true)
      throw Error("Unhide this native Region before publishing a territory label.");
    const next={schemaVersion:1,enabled:true,
      label:validatedPublicTerritoryLabel(label.trim())};
    if(JSON.stringify(next)!==JSON.stringify(prior))
      await region.setFlag(MODULE_ID,PUBLIC_TERRITORY_FLAG,next);
  }else if(prior)await region.unsetFlag(MODULE_ID,PUBLIC_TERRITORY_FLAG);
  return true;
}
