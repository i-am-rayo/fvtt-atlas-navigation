import { navigationHours } from "./navigation-time.js";

/** Visual time compression only: this never changes the world clock or Actor pace. */
export const NAVIGATION_PLAYBACK_SETTING="guidedTravelSecondsPerHour";
export const NAVIGATION_PLAYBACK_DEFAULT=2;
export const NAVIGATION_PLAYBACK_MIN=0.5;
export const NAVIGATION_PLAYBACK_MAX=8;
export const MAX_PLAYBACK_SECONDS=600;
const MIN_PLAYBACK_SECONDS=2;

export function validatePlaybackSetting(value){
  if(!Number.isFinite(value)||value<NAVIGATION_PLAYBACK_MIN||value>NAVIGATION_PLAYBACK_MAX)
    throw Error("Guided travel playback must be between 0.5 and 8 real seconds per game travel hour.");
  return value;
}

export function readGuidedPlaybackSetting(settings){
  try{
    const value=settings?.get?.("fvtt-atlas-navigation",NAVIGATION_PLAYBACK_SETTING);
    return validatePlaybackSetting(value==null?NAVIGATION_PLAYBACK_DEFAULT:Number(value));
  }catch{return NAVIGATION_PLAYBACK_DEFAULT;}
}

/** Sum the displayed curve geometry, not the straight-line road segment distances. */
export function navigationVisualDistance(paths){
  if(!Array.isArray(paths)||!paths.length||paths.length>4096)
    throw Error("A valid visible navigation path is required for travel playback.");
  let length=0,pointsSeen=0;
  for(const leg of paths){
    const points=leg?.points;
    if(!Array.isArray(points)||points.length<2||points.length>8192)
      throw Error("The navigation path has invalid geometry.");
    pointsSeen+=points.length;
    if(pointsSeen>20000)throw Error("The navigation path is too complex for playback.");
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i];
      if(!Number.isFinite(a?.x)||!Number.isFinite(a?.y)||
          !Number.isFinite(b?.x)||!Number.isFinite(b?.y))
        throw Error("The navigation path has invalid coordinates.");
      length+=Math.hypot(b.x-a.x,b.y-a.y);
    }
  }
  if(!Number.isFinite(length)||length<=0)
    throw Error("The navigation route has no visible distance to animate.");
  return length;
}

/** Derive Foundry v14 movementSpeed (grid cells / real second) from travel hours. */
export function calculateGuidedPlayback({route,travel,paths,gridSize,secondsPerHour}){
  const compression=validatePlaybackSetting(secondsPerHour);
  if(!Number.isFinite(gridSize)||gridSize<=0)
    throw Error("Scene Grid size is unavailable for guided travel playback.");
  const weighted=route?.terrainAware?route?.cost:route?.distance;
  const travelHours=navigationHours(weighted,travel?.speed);
  const visualDistance=navigationVisualDistance(paths);
  const durationSeconds=Math.max(MIN_PLAYBACK_SECONDS,
    Math.min(MAX_PLAYBACK_SECONDS,travelHours*compression));
  const movementSpeed=visualDistance/gridSize/durationSeconds;
  if(!Number.isFinite(movementSpeed)||movementSpeed<=0)
    throw Error("The calculated token animation speed is invalid.");
  return {travelHours,durationSeconds,movementSpeed,visualDistance,secondsPerHour:compression};
}

export function formatPlaybackDuration(seconds){
  if(!Number.isFinite(seconds)||seconds<0)throw Error("Invalid playback duration.");
  const rounded=Math.round(seconds);
  const minutes=Math.floor(rounded/60),remainder=rounded%60;
  return minutes?`${minutes}m ${remainder}s`:`${remainder}s`;
}
