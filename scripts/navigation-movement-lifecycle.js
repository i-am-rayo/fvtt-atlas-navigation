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

/** A positive-distance Atlas fragment can vanish when Foundry rounds Token
 * coordinates to integer pixels. It cannot receive a separate native receipt. */
export function hasNativePixelDisplacement(waypoints){
  if(!Array.isArray(waypoints)||waypoints.length<2||
    waypoints.some(p=>!Number.isFinite(p?.x)||!Number.isFinite(p?.y)))
    throw Error("Invalid native pixel interval.");
  const start=waypoints[0];
  return waypoints.some(point=>Math.round(point.x)!==Math.round(start.x)||
    Math.round(point.y)!==Math.round(start.y));
}

/** Fold unmovable fragments into a future native move, so their elapsed time
 * is credited only when the complete merged movement is confirmed. An initial
 * preflight may also absorb a final subpixel tail into its preceding move.
 * Never merge backwards after a day boundary has already been committed. */
export function coalesceSubpixelTravelChunks(chunks,{allowTailMerge=true}={}){
  if(!Array.isArray(chunks)||!chunks.length||chunks.length>MAX_GUIDED_CHUNKS||
    typeof allowTailMerge!=="boolean")
    throw Error("Invalid native pixel chunk collection.");
  const result=chunks.map(chunk=>{
    if(!Array.isArray(chunk?.waypoints)||chunk.waypoints.length<2||
      !Number.isFinite(chunk.distance)||chunk.distance<=0)
      throw Error("Invalid native pixel chunk.");
    hasNativePixelDisplacement(chunk.waypoints);
    return {waypoints:chunk.waypoints.map(p=>({...p})),distance:chunk.distance};
  });
  const join=(left,right)=>{
    const a=left.waypoints.at(-1),b=right.waypoints[0];
    if(Math.hypot(a.x-b.x,a.y-b.y)>1e-6)
      throw Error("Native movement chunks no longer share a verified boundary.");
    return {waypoints:[...left.waypoints,...right.waypoints.slice(1)],
      distance:left.distance+right.distance};
  };
  for(let i=0;i<result.length;){
    if(hasNativePixelDisplacement(result[i].waypoints)){i++;continue;}
    if(i+1<result.length){
      result.splice(i,2,join(result[i],result[i+1]));
      continue;
    }
    if(allowTailMerge&&i>0){
      result.splice(i-1,2,join(result[i-1],result[i]));
      i--;
      continue;
    }
    return null;
  }
  return result;
}
