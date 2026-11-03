/**
 * Explicit checkpoint transportation supply. Checkpoint offers are independent
 * snapshots, never live changes to World transportation methods or Group actors.
 * World preset templates and Scene offers use this same constrained schema.
 */
import { MODULE_ID } from "./atlas-storage.js";

export const CHECKPOINT_TRANSPORT_FLAG="checkpointTransportOffers";
export const CHECKPOINT_TRANSPORT_VERSION=1;
export const CHECKPOINT_TRANSPORT_MODES=Object.freeze(["land","water","sea","air"]);
const ID=/^[A-Za-z0-9_-]{1,128}$/;
const KEYS=["speedMph","capacity","costCp","costBasis","costApplies",
  "purchaseGp","crewCount","crewWageCpPerDay","crewWageBasis","includeCrewWages",
  "hireEnabled","hireCostCp","hireBasis","hireApplies","hireCrewIncluded",
  "overtimeEnabled","overtimeExtraHours","overtimeMultiplier",
  "continuousEnabled","note"];
const ENUM={
  costBasis:["none","day","mile"],costApplies:["unit","passenger"],
  hireBasis:["trip","mile","day"],hireApplies:["unit","passenger"],
  crewWageBasis:["day","trip","mile"]
};
const BOOL=new Set(["includeCrewWages","hireEnabled","hireCrewIncluded",
  "overtimeEnabled","continuousEnabled"]);
const NONNEG=new Set(["costCp","purchaseGp","crewWageCpPerDay","hireCostCp"]);
const INTEGER=new Set(["capacity","crewCount","overtimeExtraHours"]);
export function validateCheckpointTransportOffers(value){
  if(value==null)return [];
  if(!Array.isArray(value)||value.length>40)throw Error("Too many checkpoint transportation offers.");
  const seen=new Set();
  return value.map(offer=>{
    if(!offer||typeof offer!=="object"||Array.isArray(offer)||
      Object.keys(offer).some(k=>!["methodId","mode","overrides"].includes(k))||
      !ID.test(offer.methodId)||!CHECKPOINT_TRANSPORT_MODES.includes(offer.mode)||
      seen.has(offer.methodId))throw Error("Invalid or duplicated checkpoint transportation method.");
    seen.add(offer.methodId);
    const patch=offer.overrides??{};
    if(!patch||typeof patch!=="object"||Array.isArray(patch)||
      Object.keys(patch).some(k=>!KEYS.includes(k)))throw Error("Invalid checkpoint transport override fields.");
    const overrides={};
    for(const [key,value] of Object.entries(patch)){
      if(ENUM[key]){if(!ENUM[key].includes(value))throw Error("Invalid "+key+" override.");}
      else if(BOOL.has(key)){if(typeof value!=="boolean")throw Error("Invalid "+key+" toggle.");}
      else if(key==="note"){if(typeof value!=="string"||value.length>240)throw Error("Invalid transport note.");}
      else if(key==="purchaseGp"&&value===null){}
      else if(typeof value!=="number"||!Number.isFinite(value)||
        (NONNEG.has(key)&& (value<0||value>1e8))||
        (INTEGER.has(key)&&!Number.isInteger(value))||
        (key==="capacity"&&(value<1||value>1000))||
        (key==="crewCount"&&(value<0||value>1000))||
        (key==="overtimeExtraHours"&&(value<1||value>8))||
        (key==="overtimeMultiplier"&&(value<1||value>5))||
        (key==="speedMph"&&(value<0.1||value>600)))
        throw Error("Invalid "+key+" transport override.");
      overrides[key]=value;
    }
    if(overrides.continuousEnabled&&offer.mode==="land")
      throw Error("Continuous travel needs a water, sea or air transport.");
    return {methodId:offer.methodId,mode:offer.mode,overrides};
  });
}

/** Estimates are named planning examples, not guaranteed services or RAW prices. */
const RENT_ONLY_WHEN_GM_OPTED_IN=new Set([
  "riding-horse","pony","mule","draft-horse","warhorse","camel","elephant","mastiff"
]);
const DEFAULT_SUPPLY={
  stables:[["riding-horse","land",40],["pony","land",20],
    ["mule","land",15],["draft-horse","land",30]],
  city:[["carriage","land",400],["cart","land",250],
    ["wagon","land",400],["coach-hire","land",3]],
  settlement:[["cart","land",250],["wagon","land",400],
    ["coach-hire","land",3]],
  village:[["cart","land",250],["wagon","land",400]],
  trading:[["wagon","land",400],["cart","land",250]],
  inn:[["coach-hire","land",3]],
  port:[["ship-passage","sea",10],["sailing","sea",6000]],
  dock:[["rowboat","water",100],["keelboat","water",600],
    ["ship-passage","sea",10]],
  "air-dock":[["airship","air",5000]]
};
export function defaultCheckpointTransportOffers(category){
  return validateCheckpointTransportOffers((DEFAULT_SUPPLY[category]??[])
    .map(([methodId,mode,hireCostCp])=>({
      methodId,mode,overrides:{hireEnabled:!RENT_ONLY_WHEN_GM_OPTED_IN.has(methodId),hireCostCp,
        hireBasis:methodId==="ship-passage"||methodId==="coach-hire"?"mile":"day",
        hireApplies:methodId==="ship-passage"||methodId==="coach-hire"?
          "passenger":"unit"}
    })));
}
export function checkpointOfferMethod(offer,worldMethod){
  const checked=validateCheckpointTransportOffers([offer])[0];
  if(!worldMethod||worldMethod.id!==checked.methodId)throw Error("Missing linked World method.");
  if((checked.mode==="land"&&worldMethod.surface!=="land")||
    (checked.mode==="air"&&worldMethod.surface!=="air")||
    ((checked.mode==="water"||checked.mode==="sea")&&worldMethod.surface!=="water"))
    throw Error("Checkpoint offer surface differs from its World method.");
  if(checked.overrides.continuousEnabled&&worldMethod.kind!=="vehicle")
    throw Error("Continuous travel needs a vehicle.");
  return {...worldMethod,...checked.overrides};
}
export function validateCheckpointTransportStore(value){
  if(value==null)return {schemaVersion:CHECKPOINT_TRANSPORT_VERSION,entries:{}};
  if(!value||typeof value!=="object"||Array.isArray(value)||
    value.schemaVersion!==CHECKPOINT_TRANSPORT_VERSION||
    !value.entries||typeof value.entries!=="object"||Array.isArray(value.entries)||
    Object.keys(value.entries).length>5000||
    Object.keys(value).some(k=>!["schemaVersion","entries"].includes(k)))
    throw Error("Unsupported checkpoint transportation data.");
  const entries={};
  for(const [checkpointId,offers] of Object.entries(value.entries)){
    if(!ID.test(checkpointId))throw Error("Invalid checkpoint ID in transportation data.");
    Object.defineProperty(entries,checkpointId,{value:validateCheckpointTransportOffers(offers),
      enumerable:true,writable:true,configurable:true});
  }
  return {schemaVersion:CHECKPOINT_TRANSPORT_VERSION,entries};
}
export function readCheckpointTransportStore(scene){
  return validateCheckpointTransportStore(scene?.getFlag?.(MODULE_ID,CHECKPOINT_TRANSPORT_FLAG));
}
export function checkpointOffers(scene,checkpointId){
  return readCheckpointTransportStore(scene).entries[checkpointId]??[];
}
export async function saveCheckpointOffers(scene,checkpointId,offers){
  if(!globalThis.game?.user?.isGM||!scene?.canUserModify?.(game.user,"update"))
    throw Error("Only a GM may edit checkpoint transportation.");
  if(!ID.test(checkpointId))throw Error("Invalid checkpoint ID.");
  const cleaned=validateCheckpointTransportOffers(offers);
  const snapshot=readCheckpointTransportStore(scene);
  const entries={...snapshot.entries,[checkpointId]:cleaned};
  await scene.setFlag(MODULE_ID,CHECKPOINT_TRANSPORT_FLAG,
    validateCheckpointTransportStore({schemaVersion:CHECKPOINT_TRANSPORT_VERSION,entries}));
}
export function offersAtOrigin(atlas,scene,origin,{maxDistancePx=null}={}){
  if(!origin||!Number.isFinite(origin.x)||!Number.isFinite(origin.y))return [];
  const distance=maxDistancePx??Math.max(12,(scene?.grid?.size??100)*0.75);
  const nodes=new Map((atlas?.nodes??[]).map(n=>[n.id,n]));
  const entries=readCheckpointTransportStore(scene).entries;
  return (atlas?.checkpoints??[]).flatMap(checkpoint=>{
    const point=nodes.get(checkpoint.nodeId);
    if(!point||Math.hypot(point.x-origin.x,point.y-origin.y)>distance)return [];
    return (entries[checkpoint.id]??[]).map(offer=>({...offer,
      checkpointId:checkpoint.id,checkpointName:checkpoint.name}));
  });
}
