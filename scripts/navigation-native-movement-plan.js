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
 * The Atlas route starts at the graph projection of Point A, which may be
 * inside the same hex as (but not on top of) the actual TokenDocument.
 * Native movement starts at the Document, never the graph projection. Keep
 * the short approach to the route as an explicit waypoint when necessary.
 */
export function anchorNativeTokenWaypoints(waypoints,{x,y},gridSize){
  if(!Array.isArray(waypoints)||waypoints.length<2||
      waypoints.some(point=>!validPoint(point))||
      !validPoint({x,y})||!Number.isFinite(gridSize)||gridSize<=0)
    throw Error("A native movement requires a valid TokenDocument origin.");
  const nativeStart={x:Math.round(x),y:Math.round(y)};
  const gap=distance(nativeStart,waypoints[0]);
  if(gap>gridSize*.75+1)
    throw Error("The party token is too far from the approved route origin.");
  const continuation=gap<=1?waypoints.slice(1):waypoints;
  return [nativeStart,...continuation.map(point=>({...point}))];
}

const segmentDistance=(point,a,b)=>{
  const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
  if(length<=EPS)return distance(point,a);
  const along=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/length));
  return distance(point,{x:a.x+along*dx,y:a.y+along*dy});
};

/**
 * Read-only identification for GM diagnostics. Atlas road/segment IDs are
 * associated by proximity to the rendered path, not treated as movement proof.
 * An intermediate native durability checkpoint is not an authored checkpoint.
 */
export function describeNativeCheckpointSources(plan,{legPaths,token,gridSize,
  arrivalCheckpointId=null}={}){
  if(!Array.isArray(plan?.checkpoints)||!Array.isArray(legPaths)||
      !Number.isFinite(token?.width)||!Number.isFinite(token?.height)||
      !Number.isFinite(gridSize)||gridSize<=0)
    throw Error("Native checkpoint diagnostics require valid route geometry.");
  const halfWidth=token.width*gridSize/2;
  const halfHeight=token.height*gridSize/2;
  const eligible=legPaths.filter(leg=>leg.kind==="road"&&
    Array.isArray(leg.points)&&leg.points.length>=2);
  return {...plan,checkpoints:plan.checkpoints.map((checkpoint,index)=>{
    const center={x:checkpoint.point.x+halfWidth,y:checkpoint.point.y+halfHeight};
    let nearest=null;
    for(const leg of eligible){
      let separation=Infinity;
      for(let i=1;i<leg.points.length;i++)
        separation=Math.min(separation,segmentDistance(center,leg.points[i-1],leg.points[i]));
      if(!nearest||separation<nearest.separation)
        nearest={separation,roadId:leg.roadId??null,segmentId:leg.segmentId??null};
    }
    const onRoad=nearest&&nearest.separation<=Math.max(2,gridSize/20);
    return {...checkpoint,roadId:onRoad?nearest.roadId:null,
      segmentId:onRoad?nearest.segmentId:null,
      nearestRoadId:nearest?.roadId??null,
      nearestSegmentId:nearest?.segmentId??null,
      atlasCheckpointId:index===plan.checkpoints.length-1?arrivalCheckpointId:null,
      routeSeparationPixels:nearest?nearest.separation:null};
  })};
}

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
    const pathStartIndex=path.length-1;
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
    checkpoints.push({index,pathStartIndex,pathEndIndex:path.length-1,
      point:{x:end.x,y:end.y},
      from:{x:from.x,y:from.y},distance:interval.distance,
      completedDistance,
      completedMovingHours:totalMovingHours*completedDistance/totalDistance});
  }
  if(path.length>4096)
    throw Error("Too many native TokenDocument movement waypoints.");
  return {schemaVersion:NATIVE_CHECKPOINT_PATH_SCHEMA,path,checkpoints,
    totalDistance,totalMovingHours};
}
