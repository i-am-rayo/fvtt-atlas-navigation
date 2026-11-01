import { MODULE_ID } from "./atlas-storage.js";

export const CHECKPOINT_TYPE_FLAG="checkpointCategories";
export const CHECKPOINT_TYPES=Object.freeze([
  ["generic","General / Unspecified"],
  ["bridge","Bridge"],
  ["toll","Toll Gate"],
  ["settlement","Settlement"],
  ["crossing","Crossing"],
  ["landmark","Landmark"],
  ["event","Event / Encounter"]
]);
const VALID_TYPES=new Set(CHECKPOINT_TYPES.map(([id])=>id));
const VALID_ID=/^[A-Za-z0-9_-]{1,128}$/;

export function validateCheckpointCategories(data){
  if(data==null)return {};
  if(typeof data!=="object"||Array.isArray(data)||
      Object.getPrototypeOf(data)!==Object.prototype || Object.keys(data).length>5000)
    throw Error("Invalid checkpoint category data.");
  const result={};
  for(const [id,type] of Object.entries(data)){
    if(!VALID_ID.test(id)||!VALID_TYPES.has(type))
      throw Error("Invalid checkpoint category entry.");
    Object.defineProperty(result,id,{value:type,enumerable:true,configurable:true,writable:true});
  }
  return result;
}

export function checkpointCategory(scene,checkpointId){
  return validateCheckpointCategories(scene?.getFlag?.(MODULE_ID,CHECKPOINT_TYPE_FLAG))[checkpointId]??"generic";
}

/** Informational metadata only: never changes Atlas geometry or travel costs. */
export async function saveCheckpointCategory(scene,checkpointId,type){
  if(!globalThis.game?.user?.isGM||!scene?.canUserModify?.(game.user,"update"))
    throw Error("Only a GM can edit checkpoint categories.");
  if(!VALID_ID.test(checkpointId)||!VALID_TYPES.has(type))
    throw Error("Invalid checkpoint category selection.");
  const current=validateCheckpointCategories(scene.getFlag(MODULE_ID,CHECKPOINT_TYPE_FLAG));
  const next={...current};
  if(type==="generic")delete next[checkpointId];
  else next[checkpointId]=type;
  await scene.setFlag(MODULE_ID,CHECKPOINT_TYPE_FLAG,next);
}
