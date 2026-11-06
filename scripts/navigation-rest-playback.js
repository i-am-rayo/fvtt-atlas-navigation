/** Visual-only resting interval. World time and Journal events must be
 * confirmed before a hold begins; this timer never advances either. */
export function visualRestDurationMs(hours,secondsPerHour){
  if(!Number.isFinite(hours)||hours<0||hours>24||
      !Number.isFinite(secondsPerHour)||secondsPerHour<0.5||secondsPerHour>8)
    throw Error("Rest playback requires valid hours and visual speed.");
  return Math.round(hours*secondsPerHour*1000);
}

/** A cancellable UI delay. Canvas teardown/end must release its waiter. */
export function createVisualRestHold(durationMs,{schedule=(fn,ms)=>
  globalThis.setTimeout(fn,ms),cancelTimer=id=>globalThis.clearTimeout(id)}={}){
  if(!Number.isInteger(durationMs)||durationMs<0||durationMs>192000)
    throw Error("Rest playback duration is invalid.");
  if(durationMs===0)return {finished:Promise.resolve(true),cancel(){}};
  let timer=null,settle=null;
  const finished=new Promise(resolve=>{settle=resolve;});
  const complete=success=>{
    if(!settle)return;
    const resolve=settle;settle=null;
    resolve(success);
  };
  timer=schedule(()=>{timer=null;complete(true);},durationMs);
  return {finished,cancel(){
    if(timer!==null){cancelTimer(timer);timer=null;}
    complete(false);
  }};
}
