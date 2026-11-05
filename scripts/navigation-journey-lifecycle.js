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
    ["moving","rest-applying"].includes(session?.phase)&&
    !session.manualRestApplying&&Boolean(session.journal?.id)&&
    Boolean(session.journeyRecord);
}
