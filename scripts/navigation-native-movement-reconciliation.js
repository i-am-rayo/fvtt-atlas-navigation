/**
 * Pure, fail-closed classification of a pending native Token move after a
 * refresh. Evidence must come from a durable Journal intent and a verified
 * native TokenDocument checkpoint/movement identity, not visual sprites.
 * This module does not itself write Journal, Token, clock, or currency data.
 */
const validPoint=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
const near=(a,b,tolerance)=>validPoint(a)&&validPoint(b)&&
  Math.hypot(a.x-b.x,a.y-b.y)<=tolerance;
const validId=id=>typeof id==="string"&&/^[a-zA-Z0-9_-]{1,128}$/.test(id);
export const PENDING_NATIVE_MOVE_SCHEMA=1;

/** Validate a prospective durable pending-intent record on write and read. */
export function validatePendingNativeMove(raw){
  if(!raw||raw.schemaVersion!==PENDING_NATIVE_MOVE_SCHEMA||
      !validId(raw.operationId)||!validId(raw.tokenId)||
      !Number.isSafeInteger(raw.checkpointIndex)||raw.checkpointIndex<0||
      !validPoint(raw.from)||!validPoint(raw.to)||
      !Number.isFinite(raw.nativeDistance)||raw.nativeDistance<=0||
      !Number.isFinite(raw.movingHours)||raw.movingHours<=0||
      !Number.isSafeInteger(raw.worldTimeBefore)||
      !Number.isSafeInteger(raw.worldAdvanceSeconds)||
      raw.worldAdvanceSeconds<0||
      !Number.isSafeInteger(raw.atlasRevision)||raw.atlasRevision<0)
    throw Error("Invalid pending Atlas native movement checkpoint.");
  return structuredClone(raw);
}

/**
 * 'at-start': No new native travel proved. 'at-end': Token moved, but only
 * when an exact native movement ID and clock state corroborate the saved
 * Journal intent. Otherwise a GM must review the unchanged records.
 */
export function assessPendingNativeMove(raw,{
  tokenId,tokenPoint,recordedMovementIds=[],worldTime,
  atlasRevision,tolerancePixels=.25
}={}){
  const pending=validatePendingNativeMove(raw);
  if(tokenId!==pending.tokenId||atlasRevision!==pending.atlasRevision||
      !validPoint(tokenPoint)||!Number.isSafeInteger(worldTime)||
      !Number.isFinite(tolerancePixels)||tolerancePixels<0||
      tolerancePixels>1)
    return {status:"review",reason:"Recovery identity or native coordinates changed."};
  if(near(tokenPoint,pending.from,tolerancePixels))
    return worldTime===pending.worldTimeBefore?
      {status:"at-start",confirmed:false,worldClockAction:"none"}:
      {status:"review",reason:"World time changed before the pending move completed."};
  if(!near(tokenPoint,pending.to,tolerancePixels))
    return {status:"review",reason:"Token does not match either checkpoint endpoint."};
  if(!Array.isArray(recordedMovementIds)||
      !recordedMovementIds.includes(pending.operationId))
    return {status:"review",reason:"No matching native committed movement ID."};
  if(worldTime===pending.worldTimeBefore)
    return {status:"at-end",confirmed:true,
      worldClockAction:pending.worldAdvanceSeconds?"advance":"none"};
  if(pending.worldAdvanceSeconds>0&&
      worldTime===pending.worldTimeBefore+pending.worldAdvanceSeconds)
    return {status:"at-end",confirmed:true,worldClockAction:"already-advanced"};
  return {status:"review",reason:"World-time state does not match the pending checkpoint."};
}
