import { MAX_GUIDED_TRAVEL_EVENTS } from "./navigation-travel-day.js";

/**
 * In-memory journey annotations inserted into the existing direction cards.
 * Never edits the saved route, the immutable itinerary, or native documents.
 */
const EPS=1e-7;

export function journeyBreakLabel(action){
  return ({overnight:"Overnight Camp",long:"Long Rest",short:"Short Rest",
    continue:"Continue March"})[action]??"Travel Break";
}

/** Display estimates may follow the visible 100ms playback, but World-clock
 * credits remain tied to confirmed native movement in GuidedJourneyClock. */
export function projectJourneyTiming({travelHours,percent,totalHours,breakHours=0}){
  if(![travelHours,percent,totalHours,breakHours].every(Number.isFinite)||
      travelHours<0||percent<0||percent>100||breakHours<0||
      totalHours+EPS<travelHours+breakHours)
    throw Error("Invalid journey timing projection.");
  const movingHours=travelHours*percent/100;
  const elapsedHours=movingHours+breakHours;
  return {movingHours,elapsedHours,
    etaHours:Math.max(0,totalHours-elapsedHours)};
}

/** A movement-hour boundary is stable even if terrain changes the distance of
 * adjacent direction steps. Consecutive choices at one stop retain their order. */
export function annotateJourneyDirections(steps,events,{travelHours,speed,terrainAware=false}={}){
  if(!Array.isArray(steps)||!Array.isArray(events)||
      steps.length>4096||events.length>MAX_GUIDED_TRAVEL_EVENTS||
      !Number.isFinite(travelHours)||travelHours<=0||
      !Number.isFinite(speed)||speed<=0)
    throw Error("Invalid journey direction timeline.");
  const duration=step=>(terrainAware?step.cost:step.distance)/speed;
  const result=[];
  let traveled=0,eventIndex=0;
  const addEvent=event=>{
    if(!Number.isFinite(event.atHours)||event.atHours<0||
        event.atHours>travelHours+EPS||
        !Number.isFinite(event.hours)||event.hours<0)
      throw Error("Invalid journey event position.");
    result.push({kind:"journey-event",action:event.action,
      label:journeyBreakLabel(event.action),hours:event.hours,
      atHours:event.atHours,todayHours:Number.isFinite(event.todayHours)?
        event.todayHours:null,
      startedTimeLabel:typeof event.startedTimeLabel==="string"?event.startedTimeLabel:null,
      endedTimeLabel:typeof event.endedTimeLabel==="string"?event.endedTimeLabel:null});
  };
  for(const step of steps){
    const hours=duration(step);
    if(!Number.isFinite(hours)||hours<0)throw Error("Invalid journey direction duration.");
    const end=traveled+hours;
    let startFraction=0;
    while(eventIndex<events.length&&events[eventIndex].atHours<=end+EPS){
      const event=events[eventIndex++];
      if(event.atHours<traveled-EPS)throw Error("Journey events must be ordered.");
      const fraction=hours>EPS?Math.max(0,Math.min(1,(event.atHours-traveled)/hours)):0;
      if(fraction>startFraction+EPS){
        result.push(splitStep(step,startFraction,fraction));
        startFraction=fraction;
      }
      addEvent(event);
    }
    if(startFraction<1-EPS)result.push(splitStep(step,startFraction,1));
    traveled=end;
  }
  while(eventIndex<events.length){
    const event=events[eventIndex++];
    if(event.atHours<traveled-EPS)throw Error("Journey event precedes the route's end.");
    addEvent(event);
  }
  return result;
}

/** Present only confirmed travel in a Journal leg. Retain the original full
 * directions in the record for routing metadata and future recovery. */
export function confirmedJourneyDirections(steps,events,{travelHours,speed,
  terrainAware=false,confirmedHours=travelHours}={}){
  if(!Number.isFinite(confirmedHours)||confirmedHours<0||
      confirmedHours>travelHours+EPS)
    throw Error("Invalid confirmed journey duration.");
  const timeline=annotateJourneyDirections(steps,events,{travelHours,speed,terrainAware});
  const output=[];
  let moving=0;
  for(const step of timeline){
    if(step.kind==="journey-event"){
      if(step.atHours<=confirmedHours+EPS)output.push(step);
      continue;
    }
    const hours=(terrainAware?step.cost:step.distance)/speed;
    const left=Math.max(0,confirmedHours-moving);
    if(hours<=EPS){
      if(moving<=confirmedHours+EPS)output.push(step);
    }else if(left>EPS){
      const fraction=Math.min(1,left/hours);
      output.push(fraction>=1-EPS?step:splitStep(step,0,fraction));
    }
    moving+=hours;
  }
  return output;
}

function splitStep(step,from,to){
  const first=from<=EPS;
  let instruction=step.instruction;
  if(!first){
    instruction=instruction.replace(/^Head\b/,"Continue");
    if(step.kind==="road")instruction=instruction.replace(
      /^(Continue(?:\s+\w+)?) to /,"$1 on ");
  }
  return {...step,instruction,distance:step.distance*(to-from),
    cost:step.cost*(to-from)};
}
