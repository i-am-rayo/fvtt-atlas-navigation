/** Explicit metadata-only native Territory ↔ Atlas Checkpoint association.
 * The Region retains native geometry and Behaviors; the Scene Atlas retains
 * canonical Checkpoint identity, position, road and Journal references.
 */
import {MODULE_ID,readAtlas} from "./atlas-storage.js";
import {REGION_CHECKPOINT_FLAG,readRegionAtlasLink} from "./region-atlas.js";
import {readRegionGeography} from "./territory-geography-storage.js";
import {checkpointCategory} from "./checkpoint-types.js";

const ID=/^[A-Za-z0-9_-]{1,128}$/;

export function validateTerritoryCheckpointLink(value){
  if(value==null)return null;
  if(!value||typeof value!=="object"||Array.isArray(value)||
      value.schemaVersion!==1||typeof value.checkpointId!=="string"||
      !ID.test(value.checkpointId)||
      Object.keys(value).some(key=>!["schemaVersion","checkpointId"].includes(key)))
    throw Error("Unsupported Territory checkpoint association; nothing was changed.");
  return {schemaVersion:1,checkpointId:value.checkpointId};
}

export function readTerritoryCheckpointLink(region){
  return validateTerritoryCheckpointLink(region?.getFlag?.(MODULE_ID,REGION_CHECKPOINT_FLAG));
}

export function territoryCheckpointLinks(scene){
  return Array.from(scene?.regions?.values?.()??[],region=>{
    let link=null,invalid=false;
    try{link=readTerritoryCheckpointLink(region);}catch{invalid=true;}
    return {regionId:region.id,regionName:region.name,link,invalid};
  });
}

/** Guard checkpoint removal paths shared by the Road and Checkpoint editors. */
export function assertNoDeletedTerritoryCheckpoints(scene,previous,next){
  const retained=new Set(next.checkpoints?.map(cp=>cp.id)??[]);
  const removed=new Set(previous.checkpoints?.filter(cp=>!retained.has(cp.id))
    .map(cp=>cp.id)??[]);
  if(!removed.size)return;
  for(const entry of territoryCheckpointLinks(scene)){
    if(entry.invalid)throw Error("Resolve invalid native Territory checkpoint flags " +
      "before deleting Checkpoints.");
    if(removed.has(entry.link?.checkpointId))
      throw Error(`Checkpoint is linked to native Territory ${entry.regionName}; `+
        "unlink it in Territories before deleting the Checkpoint or Road.");
  }
}

/** One separately authorized Region flag write. Never change Scene atlas,
 * Region Shapes, Behaviors, visibility, Levels, or Checkpoint/Journal data. */
export async function saveTerritoryCheckpointLink(scene,regionId,{
  checkpointId,expected,expectedName,expectedAtlasRevision
}={}){
  const gm=globalThis.game?.user;
  if(!gm?.isGM||!scene?.canUserModify?.(gm,"update"))
    throw Error("Only a Scene-authorized GM can link Territories to Checkpoints.");
  const region=scene.regions?.get?.(regionId);
  if(!region||region.parent?.id!==scene.id||
      !region.canUserModify?.(gm,"update"))
    throw Error("This native Territory is unavailable or not editable.");
  if(!readRegionAtlasLink(region)||region.getFlag(MODULE_ID,"generatedRegion")!=null)
    throw Error("Select a manually authored Atlas-linked native Territory.");
  if(expected===undefined||typeof expectedName!=="string"||
      !Number.isSafeInteger(expectedAtlasRevision))
    throw Error("Reopen the Territory checkpoint association editor before saving.");
  const prior=readTerritoryCheckpointLink(region);
  if(JSON.stringify(prior)!==JSON.stringify(validateTerritoryCheckpointLink(expected))||
      region.name!==expectedName)
    throw Error("The native Territory association changed; reopen and review it.");
  const atlas=readAtlas(scene);
  if(atlas.revision!==expectedAtlasRevision)
    throw Error("Atlas Checkpoints changed during review; reopen the association editor.");
  if(checkpointId!==null&&(!ID.test(checkpointId)||
      !atlas.checkpoints?.some(cp=>cp.id===checkpointId)))
    throw Error("Choose a Checkpoint that still exists in this Scene Atlas.");
  if(checkpointId!==null&&readRegionGeography(region)?.kind!==checkpointCategory(scene,checkpointId))
    throw Error("Checkpoint type and geographic Territory kind must match. Reopen the association editor.");
  const next=checkpointId===null?null:{schemaVersion:1,checkpointId};
  if(next){
    for(const entry of territoryCheckpointLinks(scene)){
      if(entry.invalid)throw Error("Resolve invalid native Territory checkpoint flags first.");
      if(entry.regionId!==regionId&&entry.link?.checkpointId===checkpointId)
        throw Error(`Checkpoint is already associated with Territory ${entry.regionName}.`);
    }
  }
  if(JSON.stringify(next)===JSON.stringify(prior))return false;
  if(next)await region.setFlag(MODULE_ID,REGION_CHECKPOINT_FLAG,next);
  else await region.unsetFlag(MODULE_ID,REGION_CHECKPOINT_FLAG);
  return true;
}
