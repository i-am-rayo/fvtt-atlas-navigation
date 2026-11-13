/**
 * Foundry's TokenDocument.move() settles authoritative movement, while the
 * visible Canvas Token may still be animating. Keep Atlas's journey lock until
 * the public Token.movementAnimationPromise settles as well. This is read-only:
 * never starts another move or manipulates native animation internals.
 */
export async function waitForTokenTravelAnimation(token){
  // Let movement-update microtasks expose the current Canvas animation chain.
  await Promise.resolve();
  const animation=token?.object?.movementAnimationPromise;
  if(animation&&typeof animation.then==="function")await animation;
}

/** Limit each native move to a short visible stretch, so Atlas can reliably
 * pause or end a journey at the next boundary even if Foundry has already
 * completed the authoritative move while its Canvas animation is running.
 * All intermediate positions lie on the existing (simplified) road polyline.
 */
export const GUIDED_CHUNK_SECONDS=2;
export const MAX_GUIDED_CHUNKS=320;

export function planGuidedTravelChunks(waypoints,{movementSpeed,gridSize,
  secondsPerChunk=GUIDED_CHUNK_SECONDS}={}){
  if(!Array.isArray(waypoints)||waypoints.length<2||waypoints.length>4096||
      !Number.isFinite(movementSpeed)||movementSpeed<=0||
      !Number.isFinite(gridSize)||gridSize<=0||
      !Number.isFinite(secondsPerChunk)||secondsPerChunk<=0||secondsPerChunk>10||
      waypoints.some(p=>!Number.isFinite(p?.x)||!Number.isFinite(p?.y)))
    throw Error("The guided travel path or playback speed is invalid.");
  const maxDistance=movementSpeed*gridSize*secondsPerChunk;
  if(!Number.isFinite(maxDistance)||maxDistance<=0)
    throw Error("The guided travel segment length is invalid.");
  const chunks=[];
  let points=[{...waypoints[0]}],distance=0;
  for(let index=1;index<waypoints.length;index++){
    const goal=waypoints[index];
    let from=points.at(-1);
    let remaining=Math.hypot(goal.x-from.x,goal.y-from.y);
    while(remaining>1e-7){
      const available=maxDistance-distance;
      const portion=Math.min(remaining,available);
      const ratio=portion/remaining;
      const next=portion>=remaining-1e-7?{...goal}:{
        x:from.x+(goal.x-from.x)*ratio,
        y:from.y+(goal.y-from.y)*ratio
      };
      points.push(next);
      distance+=portion;
      remaining-=portion;
      from=next;
      if(distance>=maxDistance-1e-7){
        chunks.push({waypoints:points,distance});
        if(chunks.length>MAX_GUIDED_CHUNKS)
          throw Error("The journey is too long for safe pauseable movement.");
        points=[next];
        distance=0;
      }
    }
  }
  if(distance>1e-7)chunks.push({waypoints:points,distance});
  if(!chunks.length||chunks.length>MAX_GUIDED_CHUNKS)
    throw Error("The journey cannot be divided into safe movement stretches.");
  return chunks;
}

/**
 * TokenMovementWaypoint.x/y are INTEGER top-left pixels in Foundry v14.
 * Atlas's road geometry uses fractional, image-relative coordinates. Preserve
 * that authoritative geometry and its measured distance, but quantize only
 * the transient waypoints passed to public TokenDocument.move().
 *
 * Never snap to the nearest grid cell, which could create a wall-crossing
 * shortcut. Consecutive subpixel duplicates may be discarded; a path whose
 * endpoints collapse to one pixel must fail safely, not earn travel progress.
 */
export function toNativeIntegerWaypoints(waypoints){
  if(!Array.isArray(waypoints)||waypoints.length<2||waypoints.length>4096)
    throw Error("Native movement requires at least two bounded waypoints.");
  const result=[];
  for(const point of waypoints){
    if(!Number.isFinite(point?.x)||!Number.isFinite(point?.y))
      throw Error("Native movement waypoint coordinates are invalid.");
    const x=Math.round(point.x),y=Math.round(point.y);
    if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y))
      throw Error("Native movement waypoint is outside integer pixel bounds.");
    if(result.length&&result.at(-1).x===x&&result.at(-1).y===y)continue;
    result.push({x,y});
  }
  if(result.length<2)
    throw Error("Native movement stretch collapses to one pixel after rounding.");
  return result;
}

/**
 * Diagnose a rejected public TokenDocument.move result without interpreting
 * why Foundry stopped it. In particular, false is never treated as success
 * even if an external module moved the TokenDocument to the endpoint.
 * This is read-only: the Journal's last confirmed anchor is unchanged.
 */
export function describeRejectedNativeTravelMove({waypoints,position,gridSize,chunkIndex}={}){
  const first=waypoints?.[0],last=waypoints?.at(-1);
  const finite=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
  const tolerance=Number.isFinite(gridSize)&&gridSize>0?
    Math.max(0.5,gridSize/100):0.5;
  const valid=finite(first)&&finite(last)&&finite(position);
  const drift=valid?Math.hypot(position.x-first.x,position.y-first.y):null;
  const remaining=valid?Math.hypot(last.x-position.x,last.y-position.y):null;
  const moved=drift!==null&&drift>tolerance;
  const label=Number.isInteger(chunkIndex)&&chunkIndex>=0?
    `Native movement stretch ${chunkIndex+1}`:"Native movement stretch";
  const diagnostic=moved?
    "Foundry stopped native movement after the token position changed. " +
    "Atlas has not confirmed this stretch, World time or the Journey anchor. " +
    "Inspect the TokenDocument and saved Journey before resuming; do not replay automatically.":
    "Foundry refused or stopped the native move before confirmed progress. " +
    "Check the first stretch for walls, native Region movement constraints, " +
    "Token movement action, and preMoveToken hooks. Atlas will not bypass native constraints.";
  return {kind:moved?"unconfirmed-partial":"blocked-at-origin",
    message:`${label}: ${diagnostic}`,
    startedAt:valid?{x:first.x,y:first.y}:null,
    target:valid?{x:last.x,y:last.y}:null,
    position:finite(position)?{x:position.x,y:position.y}:null,
    movedPixels:drift,remainingPixels:remaining};
}
