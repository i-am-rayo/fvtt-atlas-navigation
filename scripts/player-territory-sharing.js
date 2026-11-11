/** Explicit, per-native-Region permission for a player-facing map outline.
 * The separately approved public Journey name controls player label text. */
import {MODULE_ID} from "./atlas-storage.js";
import {readRegionAtlasLink} from "./region-atlas.js";
import {readRegionGeography} from "./territory-geography-storage.js";
import {readPublicTerritory} from "./region-narration.js";

export const PLAYER_TERRITORY_FLAG="playerTerritory";
export const PLAYER_TERRITORY_SCHEMA=1;
const KINDS=new Set(["continent","area","city","town","village"]);

export function validatePlayerTerritorySharing(value){
  if(value==null)return null;
  if(!value||typeof value!=="object"||Array.isArray(value)||
      Object.keys(value).sort().join(",")!=="schemaVersion,visible"||
      value.schemaVersion!==PLAYER_TERRITORY_SCHEMA||value.visible!==true)
    throw Error("Unsupported player Territory sharing permission; no data was changed.");
  return {schemaVersion:PLAYER_TERRITORY_SCHEMA,visible:true};
}

export function readPlayerTerritorySharing(region){
  return validatePlayerTerritorySharing(region?.getFlag?.(MODULE_ID,PLAYER_TERRITORY_FLAG));
}

/** The projection contains neither native Region names nor unpublished labels,
 * parentage, Road corrections, native Shapes or Behavior metadata. */
export function listPlayerTerritories(scene){
  const result=[];
  for(const region of scene?.regions?.values?.()??[]){
    if(region.hidden===true||region.parent?.id!==scene.id)continue;
    try{
      if(!readPlayerTerritorySharing(region)||!readRegionAtlasLink(region))continue;
      const geography=readRegionGeography(region);
      if(!KINDS.has(geography?.kind))continue;
      const publicName=readPublicTerritory(region)?.label??null;
      result.push({id:region.id,name:publicName??"",publicName,
        linked:true,invalid:false,playerShared:true,geography:{kind:geography.kind}});
    }catch{/* Unknown metadata must not publish native geometry or labels. */}
  }
  return result.sort((a,b)=>a.id.localeCompare(b.id));
}

/** Exact-snapshot, GM-authorized write of one permission flag only. */
export async function savePlayerTerritorySharing(scene,regionId,{visible,expected,
  expectedName,expectedHidden}={}){
  const user=globalThis.game?.user;
  if(!user?.isGM||!scene?.canUserModify?.(user,"update"))
    throw Error("Only a Scene-authorized GM may share Territory boundaries.");
  const region=scene.regions?.get?.(regionId);
  if(!region||region.parent?.id!==scene.id||
      !region.canUserModify?.(user,"update"))
    throw Error("The native Territory is unavailable or not editable.");
  if(typeof visible!=="boolean"||expected===undefined||
      typeof expectedName!=="string"||typeof expectedHidden!=="boolean")
    throw Error("Reopen this Territory's sharing control before saving.");
  const prior=readPlayerTerritorySharing(region);
  if(JSON.stringify(prior)!==JSON.stringify(validatePlayerTerritorySharing(expected))||
      region.name!==expectedName||(region.hidden===true)!==expectedHidden)
    throw Error("This native Territory changed. Reopen sharing before saving.");
  if(visible){
    if(region.hidden===true||!readRegionAtlasLink(region)||
        !KINDS.has(readRegionGeography(region)?.kind))
      throw Error("Only visible, Atlas-linked, classified Territories can be shared.");
    if(!prior)await region.setFlag(MODULE_ID,PLAYER_TERRITORY_FLAG,
      {schemaVersion:PLAYER_TERRITORY_SCHEMA,visible:true});
  }else if(prior)await region.unsetFlag(MODULE_ID,PLAYER_TERRITORY_FLAG);
  return Boolean(prior)!==visible;
}
