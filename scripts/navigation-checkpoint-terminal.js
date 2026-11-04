/**
 * A confirmed checkpoint may also be the originally selected destination.
 * Token center and clicked checkpoint nodes can differ slightly because
 * Foundry snaps movement to the Scene grid. Never start another tiny journey
 * back to the same checkpoint once the party has already arrived there.
 */
export function isJourneyDestinationCheckpoint(record,checkpoint,gridSize){
  if(!record||record.status!=="paused"||
      !Number.isFinite(gridSize)||gridSize<=0||
      !Number.isFinite(record.destination?.x)||
      !Number.isFinite(record.destination?.y)||
      !Number.isFinite(checkpoint?.point?.x)||
      !Number.isFinite(checkpoint?.point?.y)||!checkpoint?.id)return false;
  const last=record.legs?.at(-1);
  if(!last||last.completedPercent<99.999||
      last.transport?.arrivalCheckpointId!==checkpoint.id)return false;
  return Math.hypot(record.destination.x-checkpoint.point.x,
    record.destination.y-checkpoint.point.y)<=Math.max(.01,gridSize*.75);
}
