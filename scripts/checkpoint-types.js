import { MODULE_ID } from "./atlas-storage.js";

export const CHECKPOINT_TYPE_FLAG="checkpointCategories";
export const CHECKPOINT_TYPE_GROUPS=Object.freeze([
  ["General",[["generic","General / Unspecified"]]],
  ["Infrastructure",[["bridge","Bridge"],["port","Port"],["dock","Dock"],
    ["lighthouse","Lighthouse"],["toll","Toll Gate"],["security","Security Checkpoint"],["crossing","Road Crossing"]]],
  ["Settlements & Services",[["settlement","Settlement"],["city","City"],
    ["village","Village"],["stables","Stables"],["inn","Inn"],["tavern","Tavern"],
    ["rest","Resting Area"],["safehouse","Safehouse"],["trading","Trading Post"]]],
  ["Military & Defense",[["watchtower","Watchtower"],["fort","Fort"],
    ["guard","Guard Post"],["outpost","Outpost"]]],
  ["Religious & Cultural",[["temple","Temple"],["shrine","Shrine"],
    ["monument","Monument"],["ruins","Ruins"]]],
  ["Exploration",[["landmark","Landmark"],["cave","Cave Entrance"],
    ["pass","Mountain Pass"],["mines","Mines"],["camp","Campsite"]]],
  ["Environmental Hazards",[["falling-rocks","Falling Rocks"],
    ["quicksand","Quicksand"],["moving-sand","Moving Sand"],
    ["avalanche","Avalanche"],["flood","Flood"],
    ["sea-storm","Sea Storm"],["reef","Dangerous Reef"],["whirlpool","Whirlpool"]]],
  ["Encounters",[["event","Event / Encounter"],["monster","Monster Attack"],
    ["bandits","Bandit Ambush"],["pirates","Pirate Attack"],
    ["sea-monster","Sea Monster"],["thieves","Thief Attack"],["npc","NPC Encounter"]]],
  ["Custom",[["custom","Custom"]]]
]);
export const CHECKPOINT_TYPES=Object.freeze(CHECKPOINT_TYPE_GROUPS.flatMap(([,types])=>types));
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
