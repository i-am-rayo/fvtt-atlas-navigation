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

export function confirmPassengerRest(schedule,request){
  if(!request)return null;
  if(!["short","long"].includes(request.action)||
      !Number.isFinite(request.hours)||request.hours<=0||
      !Number.isFinite(request.startHours)||request.startHours<0||
      !Number.isFinite(schedule?.completedHours))
    throw Error("Invalid underway passenger rest.");
  const finish=request.startHours+request.hours;
  if(schedule.completedHours+EPS<finish)return null;
  if(schedule.events.length>=MAX_GUIDED_TRAVEL_EVENTS)
    throw Error("Too many journey annotations.");
  const event=Object.freeze({action:request.action+"-underway",
    atHours:finish,hours:request.hours,todayHours:schedule.todayHours});
  if(schedule.events.at(-1)?.atHours>finish+EPS)
    throw Error("Voyage rest annotations must remain chronological.");
  schedule.events.push(event);
  return event;
}
