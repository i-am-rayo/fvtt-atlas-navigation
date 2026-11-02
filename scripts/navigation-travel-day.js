/**
 * System-neutral journey calendar projection and reversible day-limit state.
 * No Foundry document access, rest automation or Actor/exhaustion mutation.
 */
export const MAX_GUIDED_REST_EVENTS=48;
export const MAX_GUIDED_TRAVEL_EVENTS=2048;
const EPSILON=1e-7;

const finiteNonnegative=value=>Number.isFinite(value)&&value>=0;

/** One projection used by the Total Trip card, before and during travel. */
export function estimateNavigationTotalTrip(travelHours,rules,{
  completedHours=0,todayHours=0,breakHours=0,permittedExtraHours=0
}={}){
  if(!finiteNonnegative(travelHours)||!finiteNonnegative(completedHours)||
      !finiteNonnegative(todayHours)||!finiteNonnegative(breakHours)||
      !finiteNonnegative(permittedExtraHours)||completedHours>travelHours+EPSILON)
    throw Error("Invalid journey time estimate.");
  const daily=rules?.dailyHours,overnight=rules?.overnightHours;
  if(daily!==null&&(!Number.isFinite(daily)||daily<=0||daily>24))
    throw Error("Invalid daily travel allowance.");
  if(!finiteNonnegative(overnight)||overnight>24)
    throw Error("Invalid overnight downtime.");
  const remaining=Math.max(0,travelHours-completedHours);
  let overnights=0;
  if(daily!==null&&remaining>EPSILON){
    const first=Math.max(0,todayHours<daily-EPSILON?
      daily-todayHours:permittedExtraHours);
    if(remaining>first+EPSILON){
      const afterFirst=remaining-first;
      overnights=Math.ceil((afterFirst-EPSILON)/daily);
    }
  }
  const plannedBreakHours=overnights*overnight;
  return Object.freeze({movingHours:travelHours,completedHours,breakHours,
    plannedBreakHours,overnights,totalHours:travelHours+breakHours+plannedBreakHours});
}

export class GuidedTravelDayTracker {
  constructor({travelHours,rules}){
    if(!Number.isFinite(travelHours)||travelHours<=0||travelHours>24*365)
      throw Error("Guided travel hours are invalid.");
    estimateNavigationTotalTrip(travelHours,rules);
    this.rules=rules;
    this.travelHours=travelHours;
    this.completedHours=0;
    this.todayHours=0;
    this.breakHours=0;
    this.permittedExtraUntil=0;
    this.restEvents=0;
    this.lastForcedCheck=null;
    this.events=[];
  }

  get remainingHours(){return Math.max(0,this.travelHours-this.completedHours);}

  get availableHours(){
    const daily=this.rules.dailyHours;
    if(daily===null)return Infinity;
    if(this.todayHours<daily-EPSILON)return daily-this.todayHours;
    return Math.max(0,this.permittedExtraUntil-this.todayHours);
  }

  get needsDecision(){return this.remainingHours>EPSILON&&this.availableHours<=EPSILON;}

  get estimate(){
    return estimateNavigationTotalTrip(this.travelHours,this.rules,{
      completedHours:this.completedHours,todayHours:this.todayHours,
      breakHours:this.breakHours,permittedExtraHours:Math.max(0,
        this.permittedExtraUntil-this.todayHours)
    });
  }

  recordMovement(hours){
    if(!Number.isFinite(hours)||hours<=0||hours>this.remainingHours+1e-4||
        hours>this.availableHours+1e-4)
      throw Error("Movement exceeds the approved daily travel allowance.");
    const previous=this.todayHours;
    this.todayHours+=hours;
    this.completedHours=Math.min(this.travelHours,this.completedHours+hours);
    const daily=this.rules.dailyHours;
    if(daily===null||this.rules.forcedMarch==="custom")return null;
    const oldExtra=Math.floor(Math.max(0,previous-daily)+EPSILON);
    const newExtra=Math.floor(Math.max(0,this.todayHours-daily)+EPSILON);
    if(newExtra<=oldExtra)return null;
    const count=newExtra;
    const dc=10+count;
    this.lastForcedCheck={extraHour:count,dc,system:this.rules.forcedMarch};
    return this.lastForcedCheck;
  }

  /** Preview before the caller commits any authorized World-time write. */
  breakChoice(action){
    if(!this.needsDecision)throw Error("No daily travel break is due.");
    if(action==="continue"){
      if(this.todayHours>=24-EPSILON)
        throw Error("A journey cannot travel more than 24 hours without a break.");
      return {action,hours:0,resetsDay:false};
    }
    const hours={short:this.rules.shortRestHours,long:this.rules.longRestHours,
      overnight:this.rules.overnightHours}[action];
    if(!Number.isFinite(hours)||hours<0||hours>24||
        (action!=="short"&&action!=="long"&&action!=="overnight"))
      throw Error("Unknown travel break selection.");
    if(this.restEvents>=MAX_GUIDED_REST_EVENTS)
      throw Error("Too many breaks on one journey. End this journey and plan a shorter route.");
    return {action,hours,resetsDay:action!=="short"};
  }

  /** Apply only after any requested World-clock update succeeds. */
  applyBreak(choice){
    const expected=this.breakChoice(choice.action);
    if(expected.hours!==choice.hours||expected.resetsDay!==choice.resetsDay)
      throw Error("The selected travel break changed before confirmation.");
    if(this.events.length>=MAX_GUIDED_TRAVEL_EVENTS)
      throw Error("The journey has too many travel decisions. Plan a shorter route.");
    this.events.push(Object.freeze({action:choice.action,atHours:this.completedHours,
      todayHours:this.todayHours,hours:choice.hours}));
    if(choice.action==="continue"){
      this.permittedExtraUntil=Math.min(24,this.todayHours+1);
      return;
    }
    this.restEvents++;
    this.breakHours+=choice.hours;
    if(choice.resetsDay){
      this.todayHours=0;
      this.permittedExtraUntil=0;
      this.lastForcedCheck=null;
    }
  }
}

/** Split a short native movement at an exact travel-hour boundary, preserving
 * every point on the same visible curve. Neither part teleports the token. */
export function splitGuidedChunkAtDistance(chunk,cut){
  if(!Array.isArray(chunk?.waypoints)||chunk.waypoints.length<2||
      !Number.isFinite(chunk.distance)||!Number.isFinite(cut)||
      cut<=EPSILON||cut>=chunk.distance-EPSILON)
    throw Error("Invalid guided travel-day split.");
  const points=chunk.waypoints;
  const first=[points[0]];
  let walked=0;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    const length=Math.hypot(b.x-a.x,b.y-a.y);
    if(!Number.isFinite(length))throw Error("Invalid guided path coordinates.");
    if(walked+length<cut-EPSILON){first.push(b);walked+=length;continue;}
    if(length<=EPSILON){first.push(b);continue;}
    const fraction=Math.min(1,Math.max(0,(cut-walked)/length));
    const split={x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction};
    if(Math.hypot(split.x-first.at(-1).x,split.y-first.at(-1).y)>EPSILON)
      first.push(split);
    const remainder=fraction>=1-EPSILON?points.slice(i+1):points.slice(i);
    return [
      {waypoints:first,distance:cut},
      {waypoints:[split,...remainder],distance:chunk.distance-cut}
    ];
  }
  throw Error("Guided travel-day split falls outside the path.");
}
