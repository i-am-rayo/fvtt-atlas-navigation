import {describeTransportationLeg} from "./navigation-transport-transitions.js";

const NAME_LIMIT=240;
const validText=(v,limit=NAME_LIMIT)=>typeof v==="string"&&
  v.length<=limit&&!/[\u0000-\u001f]/.test(v);
const optionalText=v=>v===null||validText(v);

/** Optional schema-1 Journal detail, stored only when a GM confirms this leg. */
export function validateTransportJourneyInfo(raw){
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
      !["owned","hire"].includes(raw.arrangement)||
      !["land","water","air","unspecified"].includes(raw.surface)||
      !validText(raw.methodName)||!raw.methodName.trim()||
      !validText(raw.methodId,128)||!validText(raw.kind,24)||
      !optionalText(raw.departureCheckpointName)||
      !(raw.operation==null||["normal","continuous","overtime"].includes(raw.operation))||
      !(raw.continuation==null||typeof raw.continuation==="boolean")||
      !validText(raw.arrivalCheckpointId,128)||
      !validText(raw.arrivalCheckpointName)||
      !Array.isArray(raw.roadNames)||raw.roadNames.length>40||
      !raw.roadNames.every(n=>validText(n))||
      !(raw.estimatedFareCp===null||
        Number.isFinite(raw.estimatedFareCp)&&raw.estimatedFareCp>=0))
    throw Error("Invalid confirmed transportation Journal detail.");
  return {
    methodId:raw.methodId,methodName:raw.methodName,kind:raw.kind,
    arrangement:raw.arrangement,surface:raw.surface,
    departureCheckpointName:raw.departureCheckpointName,
    arrivalCheckpointId:raw.arrivalCheckpointId,
    arrivalCheckpointName:raw.arrivalCheckpointName,
    roadNames:[...raw.roadNames],estimatedFareCp:raw.estimatedFareCp,
    ...(raw.operation!=null?{operation:raw.operation}:{}),
    ...(raw.continuation===true?{continuation:true}:{})
  };
}

/** Never narrate bookings, boarding or arrival until native travel is confirmed. */
export function confirmedTransportJourneyLines(info,{movingHours=0,complete=false}={}){
  if(!info||!Number.isFinite(movingHours)||movingHours<=0)return [];
  const t=validateTransportJourneyInfo(info);
  const leg={
    departureCheckpoint:t.departureCheckpointName?
      {name:t.departureCheckpointName}:null,
    arrivalCheckpoint:complete?{name:t.arrivalCheckpointName}:null,
    roadNames:t.roadNames
  };
  if(t.continuation)return ["The party continued aboard "+t.methodName+
    " toward "+t.arrivalCheckpointName+".",
    ...(complete?["Disembarked at "+t.arrivalCheckpointName+"."]:[])];
  return describeTransportationLeg(leg,{
    name:t.methodName,kind:t.kind,surface:t.surface,arrangement:t.arrangement
  });
}
