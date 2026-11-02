/** Opt-in Foundry World-clock advancement for confirmed GM-guided travel. */
export const NAVIGATION_WORLD_CLOCK_SETTING="guidedTravelAdvanceWorldTime";
export const NAVIGATION_WORLD_CLOCK_DEFAULT=false;
export const MAX_WORLD_CLOCK_WRITES=60;
export const MAX_GUIDED_WORLD_HOURS=24*365;

export function readNavigationWorldClockSetting(settings){
  try{return settings?.get?.("fvtt-atlas-navigation",NAVIGATION_WORLD_CLOCK_SETTING)===true;}
  catch{return false;}
}

export function guidedWorldTimeSeconds(travelHours){
  if(!Number.isFinite(travelHours)||travelHours<=0||travelHours>MAX_GUIDED_WORLD_HOURS)
    throw Error("The journey has an invalid World-time duration.");
  const seconds=Math.round(travelHours*3600);
  if(!Number.isSafeInteger(seconds)||seconds<=0)
    throw Error("The journey cannot be represented in safe World-time seconds.");
  return seconds;
}

export function formatGuidedWorldTime(seconds){
  if(!Number.isSafeInteger(seconds)||seconds<0)throw Error("Invalid confirmed travel time.");
  // The route estimate rounds to whole minutes. Match that convention when
  // presenting committed time, while the actual game.time.advance ledger keeps
  // every confirmed second, including seconds past whole travel days.
  if(seconds<60)return `0h 0m ${seconds}s`;
  const roundedMinutes=Math.round(seconds/60);
  return `${Math.floor(roundedMinutes/60)}h ${roundedMinutes%60}m`;
}

/**
 * One serialized, per-journey clock ledger. Each target is derived from the
 * *confirmed* visual travel fraction, not elapsed real time or UI progress.
 * Coalesce updates to avoid a World Settings write for every short token move;
 * force a final synchronization on pause, end or arrival. Failed writes never
 * update the ledger or trigger a blind automatic retry.
 */
export class GuidedJourneyClock {
  constructor({travelHours,totalDistance,advance,authorize,maxWrites=MAX_WORLD_CLOCK_WRITES}){
    this.totalSeconds=guidedWorldTimeSeconds(travelHours);
    if(!Number.isFinite(totalDistance)||totalDistance<=0||typeof advance!=="function"||
        typeof authorize!=="function"||!Number.isSafeInteger(maxWrites)||
        maxWrites<1||maxWrites>MAX_WORLD_CLOCK_WRITES)
      throw Error("The guided journey clock configuration is invalid.");
    this.totalDistance=totalDistance;
    this.advance=advance;
    this.authorize=authorize;
    this.advancedSeconds=0;
    this.minimumStep=Math.max(1,Math.ceil(this.totalSeconds/maxWrites));
  }

  /** Never exceed the confirmed token distance or the planned time total. */
  targetSeconds(completedDistance){
    if(!Number.isFinite(completedDistance)||completedDistance<0)
      throw Error("Confirmed travel distance is invalid.");
    const fraction=Math.max(0,Math.min(1,completedDistance/this.totalDistance));
    return Math.round(this.totalSeconds*fraction);
  }

  async commit(completedDistance,{force=false}={}){
    const target=this.targetSeconds(completedDistance);
    const delta=target-this.advancedSeconds;
    if(delta<=0||(!force&&target<this.totalSeconds&&delta<this.minimumStep))return 0;
    if(!this.authorize())throw Error("Only the active GM may advance Atlas travel time.");
    await this.advance(delta);
    this.advancedSeconds=target;
    return delta;
  }
}
