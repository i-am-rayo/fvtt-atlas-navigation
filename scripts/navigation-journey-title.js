/** Journal naming uses only the native v14 World calendar and Scene-owned
 * checkpoint coordinates. This is presentation metadata, never route authority. */
const validPoint=point=>Number.isFinite(point?.x)&&Number.isFinite(point?.y);
const cleanLabel=(value,max=65)=>typeof value==="string"?
  value.replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max):"";

export function closestJourneyCheckpoint(atlas,point){
  if(!validPoint(point))return null;
  const nodes=new Map((atlas?.nodes??[]).map(node=>[node.id,node]));
  let closest=null;
  for(const checkpoint of atlas?.checkpoints??[]){
    const node=nodes.get(checkpoint.nodeId);
    const name=cleanLabel(checkpoint.name);
    if(!name||!validPoint(node))continue;
    const distance2=(node.x-point.x)**2+(node.y-point.y)**2;
    if(!Number.isFinite(distance2))continue;
    if(!closest||distance2<closest.distance2||
        (distance2===closest.distance2&&name.localeCompare(closest.name)<0))
      closest={id:checkpoint.id,name,distance2};
  }
  return closest?{id:closest.id,name:closest.name}:null;
}

/** Capture the trip's start date at creation, before Atlas advances World time.
 * CalendarData.format is the public v14 API and respects custom World calendars. */
export function nativeJourneyDate(time=globalThis.game?.time,worldTime=time?.worldTime){
  if(!Number.isFinite(worldTime)||typeof time?.calendar?.format!=="function")
    return null;
  try{return cleanLabel(time.calendar.format(worldTime),65)||null;}
  catch{return null;}
}

/** A single immutable observation of the actual Foundry World clock. */
export function journeyWorldStamp(time=globalThis.game?.time){
  const seconds=Number.isFinite(time?.worldTime)?time.worldTime:null;
  return {seconds,label:seconds===null?null:nativeJourneyDate(time,seconds)};
}

export function navigationJourneyTitle({atlas,departure,destination,
  time=globalThis.game?.time,dateLabel=nativeJourneyDate(time)}={}){
  const from=closestJourneyCheckpoint(atlas,departure)?.name??"Map Point A";
  const to=closestJourneyCheckpoint(atlas,destination)?.name??"Map Point B";
  const route=`${from} to ${to}`;
  return (dateLabel?`${dateLabel} — `:`Atlas Journey — `)+route;
}
