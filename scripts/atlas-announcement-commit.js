/** Pure policy: only committed Journal transitions may request a live banner.
 * A canvas, animation, progress preview, or pending TokenDocument move cannot. */
export const ATLAS_JOURNEY_ANNOUNCEMENTS=Object.freeze([
  "journey.started","checkpoint.arrived","destination.reached",
  "journey.ended","journey.paused"
]);

export function committedJourneyAnnouncement(previous,current,{
  type,manualPause=false,checkpointId=null
}={}){
  if(!ATLAS_JOURNEY_ANNOUNCEMENTS.includes(type)||
      !current||current.pendingNativeMove||
      !Array.isArray(current.legs)||!current.legs.length)return null;
  const last=current.legs.at(-1);
  const changed=previous?.status!==current.status;
  if(type==="journey.started"){
    if(previous!==null||current.status!=="moving"||
        !current.lastConfirmedAnchor)return null;
  }else if(type==="checkpoint.arrived"){
    if(!changed||current.status!=="paused"||
        last.completedPercent<99.999||
        !checkpointId||last.transport?.arrivalCheckpointId!==checkpointId||
        !current.lastConfirmedAnchor)return null;
    if(current.routeTargets){
      const {targets,nextTargetIndex}=current.routeTargets;
      if(targets?.[nextTargetIndex-1]?.checkpointId!==checkpointId)return null;
    }
  }else if(type==="destination.reached"){
    if(!changed||current.status!=="completed"||
        last.completedPercent<99.999||!current.lastConfirmedAnchor)return null;
  }else if(type==="journey.ended"){
    if(!changed||current.status!=="ended")return null;
  }else if(type==="journey.paused"){
    if(!changed||current.status!=="paused"||!manualPause)return null;
  }
  if(typeof current.createdAt!=="string"||
      typeof current.updatedAt!=="string")return null;
  return Object.freeze({
    type,
    // Never transmit this private key: it contains Journal identity.
    key:`${current.createdAt}|${current.updatedAt}|${current.legs.length}|${type}`
  });
}

/** Read-only proof of the *saved* Journey status, not a mutable controller
 * cache. Return false when the native Journal is not readable. */
export function matchesSavedJourneyAnnouncement(expected,stored){
  if(!Array.isArray(expected?.legs)||!Array.isArray(stored?.legs)||
      !expected.legs.length||!stored.legs.length)return false;
  const a=expected?.legs?.at?.(-1),b=stored?.legs?.at?.(-1);
  return Boolean(expected&&stored&&!stored.pendingNativeMove&&
    expected.createdAt===stored.createdAt&&
    expected.updatedAt===stored.updatedAt&&
    expected.status===stored.status&&
    expected.legs.length===stored.legs.length&&
    a?.completedPercent===b?.completedPercent);
}
