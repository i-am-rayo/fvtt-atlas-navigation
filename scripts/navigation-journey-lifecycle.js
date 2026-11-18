/** Pure policy for Journey terminal, pause, and canvas-recovery boundaries.
 * The controller owns the Foundry lifecycle and all document mutations.
 * A rendered token or a transient animation cannot authorize recovery. */
const TERMINAL_JOURNEY_STATUSES=new Set(["completed","ended"]);

export function mayCheckpointJourneyStatus(currentStatus,nextStatus){
  return !TERMINAL_JOURNEY_STATUSES.has(currentStatus)||
    currentStatus===nextStatus;
}

/** Inspect only the last durably saved Journey status and verified progress. */
export function assessJourneyTeardown(session){
  const record=session?.journeyRecord;
  const terminal=TERMINAL_JOURNEY_STATUSES.has(record?.status);
  const noPendingNativeMove=!record?.pendingNativeMove;
  const completed=Number.isFinite(session?.completedDistance)&&
    Number.isFinite(session?.totalDistance)&&session.totalDistance>0&&
    session.completedDistance/session.totalDistance>=.99999;
  const confirmedArrival=record?.status==="paused"&&noPendingNativeMove&&completed;
  const confirmedPause=session?.phase==="paused"&&
    record?.status==="paused"&&noPendingNativeMove;
  return {terminal,confirmedArrival,confirmedPause,
    interruptedStatus:confirmedArrival||confirmedPause?"paused":"interrupted"};
}

/** The automatic continuation attempt never approves a new checkpoint leg. */
export function mayAttemptCanvasJourneyRecovery(reason,session){
  return reason==="canvasTearDown"&&
    ["moving","rest-applying","rest-holding"].includes(session?.phase)&&
    !session.manualRestApplying&&Boolean(session.journal?.id)&&
    Boolean(session.journeyRecord);
}

/**
 * A fully travelled native stretch is NOT automatically a confirmed Atlas
 * checkpoint. A canvas redraw may fall after the last TokenDocument update
 * but before the Journal's paused/target confirmation. Never infer that
 * missing target decision from the token, a rounded 100%, or a UI preview.
 * This pure read-only check keeps that state visible for GM investigation.
 */
export function classifyRecoveredJourneyBoundary(record,{gridSize=0}={}){
  const leg=record?.legs?.at(-1);
  if(!leg||!Number.isFinite(leg.completedPercent))
    return {kind:"review",reason:"invalid-last-leg"};
  if(leg.completedPercent<99.999)return {kind:"unfinished"};
  if(record.pendingNativeMove)
    return {kind:"review",reason:"unresolved-native-intent"};
  const checkpointId=leg.transport?.arrivalCheckpointId;
  if(!checkpointId)
    return {kind:"review",reason:"completed-leg-without-arrival-decision"};
  if(record.status!=="paused")
    return {kind:"review",reason:"checkpoint-not-finalized"};
  if(record.routeTargets){
    const {targets,nextTargetIndex}=record.routeTargets;
    const previous=targets?.[nextTargetIndex-1];
    if(previous?.checkpointId!==checkpointId)
      return {kind:"review",reason:"checkpoint-target-not-committed"};
    if(Number.isFinite(gridSize)&&gridSize>0&&
        Number.isFinite(previous.point?.x)&&
        Number.isFinite(previous.point?.y)&&
        Number.isFinite(leg.destination?.x)&&
        Number.isFinite(leg.destination?.y)&&
        Math.hypot(previous.point.x-leg.destination.x,
          previous.point.y-leg.destination.y)>Math.max(.01,gridSize*.75))
      return {kind:"review",reason:"checkpoint-target-coordinate-changed"};
  }
  return {kind:"confirmed-transfer",checkpointId};
}
