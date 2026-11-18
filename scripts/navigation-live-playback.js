/**
 * Pure boundary-safe changes to the visual pacing of an approved Journey.
 * Tokens, Journal checkpoints, World time and planned route geometry are
 * controlled elsewhere. Speed changes are for the NEXT native move only.
 */
import {MAX_PLAYBACK_SECONDS,validatePlaybackSetting}
  from "./navigation-playback.js";

export function liveJourneyPlayback(base,secondsPerHour,{skip=false}={}){
  const speed=validatePlaybackSetting(secondsPerHour);
  if(!Number.isFinite(base?.travelHours)||base.travelHours<=0||
      !Number.isFinite(base?.movementSpeed)||base.movementSpeed<=0||
      !Number.isFinite(base?.durationSeconds)||base.durationSeconds<=0)
    throw Error("A validated approved visual playback plan is required.");
  const durationSeconds=Math.max(2,Math.min(MAX_PLAYBACK_SECONDS,
    base.travelHours*speed));
  const movementSpeed=base.movementSpeed*base.durationSeconds/durationSeconds;
  if(!Number.isFinite(movementSpeed)||movementSpeed<=0)
    throw Error("Live Journey animation speed is unavailable.");
  return Object.freeze({secondsPerHour:speed,durationSeconds,movementSpeed,
    animate:!skip});
}

/** Continuous native TokenDocument movement is one authoritative operation
 * and may not be retimed or visually skipped after it begins. */
export function canAdjustLiveJourneyVisuals(session){
  return Boolean(session&&
    !["ending","rest-applying","checkpoint-arrival","rest-checkpointing",
      "rest-error"].includes(session.phase)&&
    session.transportLeg?.transport?.operation!=="continuous"&&
    !session.nativeActive);
}

export function expectedAdditionalTravelBreaks(session){
  const hours=session?.schedule?.travelHours;
  const completed=session?.schedule?.completedHours??0;
  const daily=session?.schedule?.rules?.dailyHours;
  if(!Number.isFinite(hours)||!Number.isFinite(completed)||
    !Number.isFinite(daily)||daily<=0||daily>24)return 0;
  return Math.max(0,Math.ceil((hours-completed-1e-6)/daily)-1);
}
