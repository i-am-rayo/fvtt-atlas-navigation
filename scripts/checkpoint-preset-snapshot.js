import { MODULE_ID } from "./atlas-storage.js";

export const CHECKPOINT_TEMPLATE_FLAG="checkpointTemplateDefaults";
const ID=/^[A-Za-z0-9_-]{1,128}$/;

/** Optional per-checkpoint copy of a World template's *suggestion*, not geometry. */
export function checkpointTerrainSuggestion(scene,checkpointId){
  const data=scene?.getFlag?.(MODULE_ID,CHECKPOINT_TEMPLATE_FLAG);
  if(!data||data.schemaVersion!==1||!data.entries||typeof data.entries!=="object")return null;
  const terrain=data.entries[checkpointId];
  if(!terrain||typeof terrain!=="object"||
      !Number.isFinite(terrain.radiusCells)||terrain.radiusCells<.25||terrain.radiusCells>3||
      (terrain.presetId!==null&&(typeof terrain.presetId!=="string"||!ID.test(terrain.presetId))))return null;
  return {presetId:terrain.presetId,radiusCells:terrain.radiusCells};
}

export async function saveCheckpointTerrainSuggestion(scene,checkpointId,suggestion){
  if(!game.user?.isGM||!scene?.canUserModify?.(game.user,"update"))
    throw Error("Only a GM can save checkpoint terrain suggestions.");
  if(!ID.test(checkpointId))throw Error("Invalid checkpoint identifier.");
  if(suggestion!==null&&(!Number.isFinite(suggestion?.radiusCells)||
      suggestion.radiusCells<.25||suggestion.radiusCells>3||
      (suggestion.presetId!==null&&(typeof suggestion.presetId!=="string"||
       !ID.test(suggestion.presetId)))))throw Error("Invalid terrain suggestion.");
  const previous=scene.getFlag(MODULE_ID,CHECKPOINT_TEMPLATE_FLAG);
  if(previous && (previous.schemaVersion!==1 || !previous.entries ||
    typeof previous.entries!=="object" || Array.isArray(previous.entries)))
    throw Error("Unsupported checkpoint template data. Nothing was changed.");
  const entries={...(previous?.entries??{})};
  if(suggestion===null)delete entries[checkpointId];
  else entries[checkpointId]={presetId:suggestion.presetId,radiusCells:suggestion.radiusCells};
  await scene.setFlag(MODULE_ID,CHECKPOINT_TEMPLATE_FLAG,{schemaVersion:1,entries});
}
