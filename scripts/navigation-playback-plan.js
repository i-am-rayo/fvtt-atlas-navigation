/**
 * Pure, presentation-only projection of an Atlas Journey's real playback.
 * Native travel hours and Journal/World time never depend on this projection.
 */
import {NAVIGATION_PLAYBACK_MIN,NAVIGATION_PLAYBACK_MAX,
  MAX_PLAYBACK_SECONDS,validatePlaybackSetting} from "./navigation-playback.js";

export function projectNavigationRealPlayback({
  travelHours,dailyHours=8,overnightHours=16,longRestHours=8,secondsPerHour
}={}){
  validatePlaybackSetting(secondsPerHour);
  if(!Number.isFinite(travelHours)||travelHours<=0||travelHours>24*365||
      (dailyHours!==null&&(!Number.isFinite(dailyHours)||dailyHours<=0||dailyHours>24))||
      !Number.isFinite(overnightHours)||overnightHours<0||overnightHours>24||
      !Number.isFinite(longRestHours)||longRestHours<0||longRestHours>24)
    throw Error("Playback requires valid travel and rest hours.");
  const stops=dailyHours===null?0:
    Math.max(0,Math.ceil((travelHours-1e-7)/dailyHours)-1);
  const movementSeconds=Math.min(MAX_PLAYBACK_SECONDS,
    Math.max(2,travelHours*secondsPerHour));
  const overnightRestSeconds=stops*overnightHours*secondsPerHour;
  const longRestSeconds=stops*longRestHours*secondsPerHour;
  return Object.freeze({travelHours,stops,secondsPerHour,movementSeconds,
    overnightRestSeconds,longRestSeconds,
    fullOvernightSeconds:movementSeconds+overnightRestSeconds,
    fullLongRestSeconds:movementSeconds+longRestSeconds,
    eachOvernightSeconds:overnightHours*secondsPerHour,
    eachLongRestSeconds:longRestHours*secondsPerHour,
    capped:movementSeconds>=MAX_PLAYBACK_SECONDS});
}

/** Convert a requested real total (including planned 16h overnight stops)
 * into seconds per in-game hour. Impossible targets fail before any state
 * change; do not silently clamp and claim the requested duration.
 */
export function secondsPerHourForTargetMinutes(model,targetMinutes){
  if(!Number.isFinite(targetMinutes)||targetMinutes<=0||targetMinutes>120)
    throw Error("Choose a real-world target between 0 and 120 minutes.");
  const low=projectNavigationRealPlayback({...model,secondsPerHour:NAVIGATION_PLAYBACK_MIN});
  const high=projectNavigationRealPlayback({...model,secondsPerHour:NAVIGATION_PLAYBACK_MAX});
  const target=targetMinutes*60;
  if(target<low.fullOvernightSeconds-0.05||
      target>high.fullOvernightSeconds+0.05)
    throw Error("This trip cannot match that real-world duration with "+
      "the supported 0.5–8 seconds/hour animation range. "+
      "Try a target between "+(low.fullOvernightSeconds/60).toFixed(1)+
      " and "+(high.fullOvernightSeconds/60).toFixed(1)+" minutes.");
  let left=NAVIGATION_PLAYBACK_MIN,right=NAVIGATION_PLAYBACK_MAX;
  for(let i=0;i<48;i++){
    const mid=(left+right)/2;
    if(projectNavigationRealPlayback({...model,secondsPerHour:mid})
      .fullOvernightSeconds<target)left=mid;
    else right=mid;
  }
  const result=(left+right)/2;
  return validatePlaybackSetting(result);
}
