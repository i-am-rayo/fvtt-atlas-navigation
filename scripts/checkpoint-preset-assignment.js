import { MODULE_ID } from "./atlas-storage.js";

export const CHECKPOINT_PRESET_ASSIGNMENT_FLAG="checkpointPresetAssignments";
const ID=/^[A-Za-z0-9_-]{1,128}$/;

export function validateCheckpointPresetAssignments(value){
  if(value==null)return {schemaVersion:1,assignments:{}};
  if(value.schemaVersion!==1||!value.assignments||
      typeof value.assignments!=="object"||Array.isArray(value.assignments)||
      Object.keys(value.assignments).length>5000)
    throw Error("Unsupported checkpoint preset assignment data.");
  const assignments={};
  for(const [checkpointId,presetId] of Object.entries(value.assignments)){
    if(!ID.test(checkpointId)||typeof presetId!=="string"||!ID.test(presetId))
      throw Error("Invalid checkpoint preset assignment.");
    Object.defineProperty(assignments,checkpointId,{value:presetId,enumerable:true,
      writable:true,configurable:true});
  }
  return {schemaVersion:1,assignments};
}

export function checkpointAssignedPresetId(scene,checkpointId){
  return validateCheckpointPresetAssignments(
    scene?.getFlag?.(MODULE_ID,CHECKPOINT_PRESET_ASSIGNMENT_FLAG))
    .assignments[checkpointId]??null;
}

/** Metadata only. Never updates a checkpoint appearance or native Region. */
export async function saveCheckpointPresetAssignment(scene,checkpointId,presetId){
  if(!game.user?.isGM||!scene?.canUserModify?.(game.user,"update"))
    throw Error("Only a GM may assign checkpoint presets.");
  if(!ID.test(checkpointId)||!(presetId===null||typeof presetId==="string"&&ID.test(presetId)))
    throw Error("Invalid checkpoint preset selection.");
  const previous=validateCheckpointPresetAssignments(
    scene.getFlag(MODULE_ID,CHECKPOINT_PRESET_ASSIGNMENT_FLAG));
  const assignments={...previous.assignments};
  if(presetId===null)delete assignments[checkpointId];
  else assignments[checkpointId]=presetId;
  await scene.setFlag(MODULE_ID,CHECKPOINT_PRESET_ASSIGNMENT_FLAG,
    {schemaVersion:1,assignments});
}
