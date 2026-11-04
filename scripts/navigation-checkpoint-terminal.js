/**
 * A confirmed checkpoint may also be the originally selected destination.
 * Token-center snap tolerance is checked separately during native arrival.
 * This is a GM-selected Point B comparison and must be tighter: otherwise a
 * legitimate short land leg after a dock may be mistaken for a completed trip.
 * Never start another tiny journey back to the same selected checkpoint.
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
    record.destination.y-checkpoint.point.y)<=Math.max(.01,Math.min(gridSize*.15,16));
}

/**
 * Never approve another guided leg whose arrival is the checkpoint recorded
 * as the most recently completed leg's arrival. The chosen Point B might be
 * slightly offshore, so destination-distance tolerance alone cannot prevent
 * repeated booking at the same port. A different checkpoint (or an actual
 * land continuation) remains a valid onward destination.
 */
export function isRepeatedArrivalCheckpoint(record,checkpoint){
  if(!record||record.status!=="paused"||!checkpoint?.id)return false;
  const last=record.legs?.at(-1);
  return Boolean(last&&last.completedPercent>=99.999&&
    last.transport?.arrivalCheckpointId===checkpoint.id);
}
