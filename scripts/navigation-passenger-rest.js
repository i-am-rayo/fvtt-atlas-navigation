/**
 * Passenger rests during a continuously operated vessel/aircraft journey.
 * They overlap confirmed movement hours: never create downtime or World-clock
 * credits beyond the native token distance actually traversed.
 */
import {MAX_GUIDED_TRAVEL_EVENTS} from "./navigation-travel-day.js";
const EPS=1e-7;
export const isRestUnderway=action=>action==="short-underway"||action==="long-underway";

export function requestPassengerRest(schedule,action){
  if(!schedule||schedule.rules?.dailyHours!==null||
      !["short","long"].includes(action))
    throw Error("Passenger rest underway requires an active continuous voyage.");
  const hours=action==="short"?schedule.rules.shortRestHours:
    schedule.rules.longRestHours;
  if(!Number.isFinite(hours)||hours<=0||hours>24||
      !Number.isFinite(schedule.completedHours)||
      !Number.isFinite(schedule.remainingHours)||
      hours>schedule.remainingHours+EPS)
    throw Error("Not enough confirmed voyage time remains for that rest.");
  return Object.freeze({action,hours,startHours:schedule.completedHours});
}

/** One eligibility check shared by the voyage buttons and rest regressions.
 * A completed rest must release the pending lock; an unfinished rest must not.
 * This is about starting an Atlas rest annotation, not granting Actor benefits. */
export function canRequestPassengerRest(schedule,pending,action){
  if(pending)return false;
  try{requestPassengerRest(schedule,action);return true;}
  catch{return false;}
}

export function confirmPassengerRest(schedule,request){
  if(!request)return null;
  if(!["short","long"].includes(request.action)||
      !Number.isFinite(request.hours)||request.hours<=0||
      !Number.isFinite(request.startHours)||request.startHours< -request.hours||
      !Number.isFinite(schedule?.completedHours))
    throw Error("Invalid underway passenger rest.");
  const finish=request.startHours+request.hours;
  if(schedule.completedHours+EPS<finish)return null;
  if(schedule.events.length>=MAX_GUIDED_TRAVEL_EVENTS)
    throw Error("Too many journey annotations.");
  const event=Object.freeze({action:request.action+"-underway",
    atHours:Math.max(0,finish),hours:request.hours,todayHours:schedule.todayHours,
    continuedFromEarlierLeg:request.startHours<0});
  if(schedule.events.at(-1)?.atHours>Math.max(0,finish)+EPS)
    throw Error("Voyage rest annotations must remain chronological.");
  schedule.events.push(event);
  return event;
}

/** Schema-one Journal extension. Optional so older journeys remain readable. */
export function validatePassengerRestMetadata(raw){
  if(raw===null||raw===undefined)return null;
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
      !["short","long"].includes(raw.action)||
      !Number.isFinite(raw.hours)||raw.hours<=0||raw.hours>24||
      !Number.isFinite(raw.startedAtMovingHours)||raw.startedAtMovingHours<0||
      raw.startedAtMovingHours>24*365*24||
      Object.keys(raw).some(key=>!["action","hours","startedAtMovingHours"].includes(key)))
    throw Error("Invalid passenger rest recovery metadata.");
  return {action:raw.action,hours:raw.hours,
    startedAtMovingHours:raw.startedAtMovingHours};
}

export function confirmedJourneyMovingHours(record){
  const legs=record?.legs;
  if(!Array.isArray(legs))throw Error("A Journey is required for passenger rest recovery.");
  return legs.reduce((total,leg)=>{
    if(!Number.isFinite(leg.completedMovingHours)||leg.completedMovingHours<0)
      throw Error("Passenger rest recovery requires confirmed movement hours.");
    return total+leg.completedMovingHours;
  },0);
}

export function beginPassengerRestMetadata(record,schedule,request){
  if(!request||!Number.isFinite(schedule?.completedHours))
    throw Error("Cannot record an unconfirmed passenger rest request.");
  const prior=record?.legs?.slice(0,-1)??[];
  const before=confirmedJourneyMovingHours({legs:prior});
  return validatePassengerRestMetadata({
    action:request.action,hours:request.hours,
    startedAtMovingHours:before+request.startHours
  });
}

/** A rest may straddle a Canvas redraw and a new Journal leg. A negative
 * local start only represents confirmed movement already credited in a prior
 * leg; it never results in new World-clock credit or replayed token movement. */
export function recoverPassengerRestRequest(record,schedule){
  const saved=validatePassengerRestMetadata(record?.passengerRest);
  if(!saved)return null;
  if(schedule?.rules?.dailyHours!==null)
    throw Error("A pending passenger rest needs continuous ship operation after recovery.");
  const confirmed=confirmedJourneyMovingHours(record);
  const already=confirmed-saved.startedAtMovingHours;
  if(already< -1e-7||already>saved.hours+1e-4)
    throw Error("The saved passenger rest is inconsistent with confirmed movement.");
  return Object.freeze({action:saved.action,hours:saved.hours,
    startHours:-Math.max(0,already)});
}
