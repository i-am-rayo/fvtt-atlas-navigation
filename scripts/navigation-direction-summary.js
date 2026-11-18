/**
 * Presentation-only direction compacting. Never change planned Road graph,
 * actual Journey directions, confirmed Journal entries or checkpoint state.
 */
const valid=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
const near=(a,b,tolerance=.02)=>valid(a)&&valid(b)&&
  Math.hypot(a.x-b.x,a.y-b.y)<=tolerance;

/** A verified saved Checkpoint is the arrival; otherwise only a uniquely
 * aligned final Route endpoint can provide an arrival name. */
export function navigationDestinationCheckpoint(route,atlas,selectedCheckpointId=null){
  const endpoint=route?.status==="ok"?route.legs?.at(-1)?.points?.at(-1):null;
  if(!valid(endpoint))return null;
  const nodes=new Map((atlas?.nodes??[]).map(n=>[n.id,n]));
  const matches=(atlas?.checkpoints??[]).filter(cp=>
    typeof cp?.name==="string"&&cp.name.trim()&&
    near(nodes.get(cp.nodeId),endpoint));
  const selected=matches.find(cp=>cp.id===selectedCheckpointId);
  return selected??(matches.length===1?matches[0]:null);
}

/** Only a named Atlas Checkpoint at an intermediate route-leg endpoint
 * can produce a "Reach ..." instruction. No speculative discovery implied.
 */
export function navigationRouteMarkers(route,atlas,{destinationLabel=null}={}){
  if(route?.status!=="ok"||!Array.isArray(route.legs))return [];
  const nodes=new Map((atlas?.nodes??[]).map(n=>[n.id,n]));
  const checkpoints=(atlas?.checkpoints??[]).filter(cp=>
    cp.name&&valid(nodes.get(cp.nodeId)));
  let travelled=0;
  const finalCheckpoint=navigationDestinationCheckpoint(route,atlas);
  const seen=new Set(),markers=[];
  for(let index=0;index<route.legs.length-1;index++){
    const leg=route.legs[index],next=route.legs[index+1];
    travelled+=Number.isFinite(leg.distance)?leg.distance:0;
    const end=leg.points?.at(-1),startNext=next.points?.[0];
    if(!near(end,startNext))continue;
    const at=checkpoints.filter(cp=>near(nodes.get(cp.nodeId),end));
    for(const cp of at){
      if(seen.has(cp.id)||cp.id===finalCheckpoint?.id)continue;
      seen.add(cp.id);
      markers.push({kind:"checkpoint",atDistance:travelled,
        label:"Reach "+cp.name,checkpointId:cp.id});
    }
    // Use true adjacent route segments, not visual curve tangents from a
    // single smooth Road. Do not claim a street intersection from a bend.
    const p=leg.points?.at(-2),q=next.points?.[1];
    if(!valid(p)||!valid(q)||leg.roadId===next.roadId)continue;
    const before={x:end.x-p.x,y:end.y-p.y};
    const after={x:q.x-end.x,y:q.y-end.y};
    const cross=before.x*after.y-before.y*after.x;
    const dot=before.x*after.x+before.y*after.y;
    const angle=Math.atan2(cross,dot)*180/Math.PI;
    if(Math.abs(angle)<50||Math.abs(angle)>165)continue;
    const turn=angle>0?"right":"left"; // Screen Y increases toward south.
    const toward=destinationLabel&&String(destinationLabel).startsWith("Road to ")?
      " toward "+String(destinationLabel).slice("Road to ".length):"";
    markers.push({kind:"turn",atDistance:travelled,
      label:"Turn "+turn+toward});
  }
  return markers.sort((a,b)=>a.atDistance-b.atDistance||
    (a.kind==="checkpoint"?-1:1));
}

const normalizeNumber=value=>Number.isFinite(value)&&value>=0?value:null;
export function compactNavigationDirectionRows(rows,{markers=[],
  formatDistance=null,formatHours=null}={}){
  if(!Array.isArray(rows))throw Error("Direction rows must be an array.");
  const sorted=[...markers].filter(m=>Number.isFinite(m.atDistance)&&
    m.atDistance>=0&&typeof m.label==="string")
    .sort((a,b)=>a.atDistance-b.atDistance);
  const result=[];
  let progress=0,markIndex=0;
  for(const row of rows){
    if(row?.kind==="journey-event"){
      result.push({...row});
      continue;
    }
    if(row?.kind!=="direction")continue;
    const distance=normalizeNumber(row.distanceValue);
    const hours=normalizeNumber(row.hoursValue);
    const previous=result.at(-1);
    const canMerge=previous?.kind==="direction"&&
      previous.instruction===row.instruction&&
      previous.direction===row.direction;
    // Only suppress repetition when no milestone lies inside or before the
    // current row. A milestone always separates route instructions.
    const markerInside=sorted[markIndex]&&distance!==null&&
      sorted[markIndex].atDistance>progress+0.02&&
      sorted[markIndex].atDistance<progress+distance-0.02;
    if(canMerge&&!markerInside){
      previous.distanceValue+=distance??0;
      previous.hoursValue+=hours??0;
      previous.segments.push({info:row.info,surface:row.surface});
      previous.info=formatDistance&&formatHours?
        formatDistance(previous.distanceValue)+" · "+formatHours(previous.hoursValue):
        previous.info;
    }else{
      result.push({...row,distanceValue:distance??0,hoursValue:hours??0,
        segments:[{info:row.info,surface:row.surface}]});
    }
    progress+=distance??0;
    while(markIndex<sorted.length&&
        sorted[markIndex].atDistance<=progress+0.02){
      result.push({...sorted[markIndex],kind:"route-marker"});
      markIndex++;
    }
  }
  return result;
}
