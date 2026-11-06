/** Pure policy: only committed Journal transitions may request a live banner.
 * A canvas, animation, progress preview, or pending TokenDocument move cannot. */
export const ATLAS_JOURNEY_ANNOUNCEMENTS=Object.freeze([
  "journey.started","checkpoint.arrived","destination.reached",
  "journey.ended","journey.paused","break.started","break.ended",
  "journey.awaiting-gm","journey.interrupted"
]);

export function committedJourneyAnnouncement(previous,current,{
  type,manualPause=false,checkpointId=null,canvasRecovery=false,
  gmReviewRequired=false
}={}){
  const reviewBanner=type==="journey.awaiting-gm"||type==="journey.interrupted";
  if(!ATLAS_JOURNEY_ANNOUNCEMENTS.includes(type)||
      !current||(!reviewBanner&&current.pendingNativeMove)||
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
  }else if(reviewBanner){
    // Only a separate canvas recovery decision can advertise a GM review.
    // An unresolved native intent is acceptable for "interrupted" only:
    // the banner makes no claim of committed movement or a completed leg.
    if(!canvasRecovery||!gmReviewRequired||
        (type==="journey.awaiting-gm"&&
          (current.status!=="paused"||current.pendingNativeMove))||
        (type==="journey.interrupted"&&current.status!=="interrupted"))return null;
  }else if(type==="break.started"||type==="break.ended"){
    // Both visual phases follow a single approved, persisted rest event. The
    // World clock may already have advanced, but no uncommitted rest is shown.
    const earlier=previous?.legs?.at(-1)?.events??[];
    const later=last.events;
    if(previous?.legs?.length!==current.legs.length||
        !Array.isArray(earlier)||!Array.isArray(later)||
        later.length!==earlier.length+1||
        JSON.stringify(later.slice(0,-1))!==JSON.stringify(earlier)||
        !["long","short","overnight"].includes(later.at(-1)?.action)||
        !(later.at(-1)?.hours>0)||!Number.isFinite(last.worldRestSeconds))return null;
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
export function matchesSavedJourneyAnnouncement(expected,stored,{
  verifyRest=false,allowPendingInterruption=false
}={}){
  if(!Array.isArray(expected?.legs)||!Array.isArray(stored?.legs)||
      !expected.legs.length||!stored.legs.length)return false;
  const a=expected?.legs?.at?.(-1),b=stored?.legs?.at?.(-1);
  return Boolean(expected&&stored&&
    (!stored.pendingNativeMove||(allowPendingInterruption&&
      expected.status==="interrupted"&&
      JSON.stringify(expected.pendingNativeMove)===
        JSON.stringify(stored.pendingNativeMove)))&&
    expected.createdAt===stored.createdAt&&
    expected.updatedAt===stored.updatedAt&&
    expected.status===stored.status&&
    expected.legs.length===stored.legs.length&&
    a?.completedPercent===b?.completedPercent&&
    (!verifyRest||(a?.worldRestSeconds===b?.worldRestSeconds&&
      JSON.stringify(a?.events??[])===JSON.stringify(b?.events??[]))));
}
