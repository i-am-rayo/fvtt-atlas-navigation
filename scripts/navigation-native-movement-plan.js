/**
 * Foundry v14 native waypoint planning. Pure geometry only: no TokenDocument,
 * Canvas, Journal, World-time, Actor, or permission access.
 *
 * One TokenDocument.move(path) can traverse all authored bends. Explicit
 * checkpoint waypoints are commit/decision boundaries, not separate calls to
 * TokenDocument.move. Callers must never start the movement until the matching
 * durable pending intent has been saved in the Journey Journal.
 */
import {planGuidedTravelChunks,MAX_GUIDED_CHUNKS}
  from "./navigation-movement-lifecycle.js";

const validPoint=value=>Number.isFinite(value?.x)&&Number.isFinite(value?.y);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const EPS=1e-7;

export const NATIVE_CHECKPOINT_PATH_SCHEMA=1;
// Journal durability checkpoints are not road nodes. A somewhat longer native
// interval avoids writing a Journal flag at every 2-second visual microstep.
export const NATIVE_CONTINUOUS_CHECKPOINT_SECONDS=5;

/**
 * Convert the existing, bounded Atlas movement intervals into a single
 * Foundry move path. Keep every authored bend; only mark safe stops, never
 * insert teleporting points or infer a new surface/action.
 */
export function planNativeCheckpointPath(waypoints,{
  movementSpeed,gridSize,secondsPerCheckpoint=2,totalMovingHours
}={}){
  if(!Number.isFinite(totalMovingHours)||totalMovingHours<=0)
    throw Error("A native movement path requires approved travel hours.");
  const intervals=planGuidedTravelChunks(waypoints,{movementSpeed,gridSize,
    secondsPerChunk:secondsPerCheckpoint});
  if(intervals.length>MAX_GUIDED_CHUNKS)
    throw Error("Too many native movement checkpoints.");
  const totalDistance=intervals.reduce((n,part)=>n+part.distance,0);
  if(!Number.isFinite(totalDistance)||totalDistance<=EPS)
    throw Error("The native movement path must have positive length.");
  // Native TokenMovementWaypoint coordinates are integer top-left pixels.
  // Record the actual submitted endpoints, not unrounded Atlas curve points.
  const nativePoint=p=>({x:Math.round(p.x),y:Math.round(p.y)});
  const path=[nativePoint(waypoints[0])];
  let completedDistance=0;
  const checkpoints=[];
  for(const [index,interval] of intervals.entries()){
    const from=path.at(-1);
    for(const next of interval.waypoints.slice(1)){
      if(!validPoint(next))throw Error("Invalid native path waypoint.");
      const prior=path.at(-1);
      if(distance(prior,next)<=EPS)continue;
      const target=nativePoint(next);
      if(distance(prior,target)<=EPS)continue;
      path.push(target);
    }
    const end=path.at(-1);
    if(distance(from,end)<=EPS)
      throw Error("A native movement checkpoint collapses to one pixel. Use a longer interval.");
    completedDistance+=interval.distance;
    // Foundry's final waypoint is inherently a checkpoint; marking it
    // explicitly keeps the same uniform contract for the host adapter.
    end.checkpoint=true;
    checkpoints.push({index,point:{x:end.x,y:end.y},
      from:{x:from.x,y:from.y},distance:interval.distance,
      completedDistance,
      completedMovingHours:totalMovingHours*completedDistance/totalDistance});
  }
  if(path.length>4096)
    throw Error("Too many native TokenDocument movement waypoints.");
  return {schemaVersion:NATIVE_CHECKPOINT_PATH_SCHEMA,path,checkpoints,
    totalDistance,totalMovingHours};
}
