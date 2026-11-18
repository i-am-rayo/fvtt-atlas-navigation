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
