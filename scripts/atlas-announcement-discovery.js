import {checkpointKnowledge} from "./party-exploration-model.js";

/** Pure eligibility: neither a preview nor a nearby hidden marker is a discovery.
 * Only an unknown -> persisted visited automatic checkpoint is announced. */
export function confirmedAutomaticCheckpointDiscovery(previous,committed,{checkpointId,method,exists}){
  return exists===true&&method==="automatic"&&
    checkpointKnowledge(previous,checkpointId)==="unknown"&&
    checkpointKnowledge(committed,checkpointId)==="visited";
}

/** The GM's explicit 'Show to players' change is a visibility reveal, not
 * automatic proximity discovery. An already-public road cannot reannounce. */
export function confirmedRoadVisibilityReveal(previous,committed,roadId){
  const before=previous?.roads?.find(road=>road.id===roadId);
  const after=committed?.roads?.find(road=>road.id===roadId);
  return Boolean(before&&after&&before.playerVisible!==true&&after.playerVisible===true&&
    Number.isSafeInteger(previous.revision)&&
    Number.isSafeInteger(committed.revision)&&committed.revision>previous.revision);
}
