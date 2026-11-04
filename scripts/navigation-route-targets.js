/**
 * Persistent A/B/C journey intent. Coordinates are Atlas image-local pixels;
 * native TokenDocument and Scene/Grid adapters own live position/elevation.
 * Atlas road/segment/checkpoint IDs are Scene-scoped stable IDs, not UUIDs.
 */
export const JOURNEY_TARGET_SCHEMA=1;
const finite=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
const copy=p=>({x:p.x,y:p.y});
const separation=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const pointOnPolyline=(point,points)=>{
  let best=Infinity;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y;
    const len=dx*dx+dy*dy;
    if(len<=0)continue;
    const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/len));
    best=Math.min(best,separation(point,{x:a.x+dx*t,y:a.y+dy*t}));
  }
  return best;
};
const validId=value=>value===null||(typeof value==="string"&&
  value.length>0&&value.length<=128&&!/[\u0000-\u001f]/.test(value));
const validTarget=target=>target&&typeof target.id==="string"&&
  /^[A-Z]+$/.test(target.id)&&finite(target.point)&&
  ["checkpointId","roadId","segmentId","levelId"].every(key=>validId(target[key]??null))&&
  (target.elevation===null||target.elevation===undefined||Number.isFinite(target.elevation));
const letter=index=>{
  let result="";
  do{result=String.fromCharCode(65+index%26)+result;index=Math.floor(index/26)-1;}
  while(index>=0);
  return result;
};

/** Build stable coordinate stops once, from the approved route proposal. */
export function buildJourneyTargets({route,transitions=null,atlas}={}){
  if(route?.status!=="ok"||!finite(route.start)||!finite(route.end)||
      !Array.isArray(route.legs)||!route.legs.length||!Array.isArray(atlas?.segments))
    throw Error("A routed Atlas graph is required to save A/B/C targets.");
  const targets=[{id:"A",point:copy(route.start),checkpointId:null,
    roadId:null,segmentId:null,levelId:null,elevation:null}];
  const byId=new Map(atlas.segments.map(item=>[item.id,item]));
  for(const transit of transitions?.legs?.slice(0,-1)??[]){
    if(!transit.arrivalCheckpoint?.id||!finite(transit.end))continue;
    const lastRoad=route.legs.slice(0,transit.lastRouteLeg+1).reverse()
      .find(leg=>leg.kind==="road");
    targets.push({id:letter(targets.length),point:copy(transit.end),
      checkpointId:transit.arrivalCheckpoint.id,roadId:lastRoad?.roadId??null,
      segmentId:byId.has(lastRoad?.segmentId)?lastRoad.segmentId:null,
      levelId:null,elevation:null});
  }
  const road=route.legs.slice().reverse().find(leg=>leg.kind==="road");
  const finalCheckpoint=(transitions?.legs?.at(-1)?.arrivalCheckpoint?.id)??null;
  const last=targets.at(-1);
  if(separation(last.point,route.end)>0.01||last.checkpointId!==finalCheckpoint){
    targets.push({id:letter(targets.length),point:copy(route.end),
      checkpointId:finalCheckpoint,roadId:road?.roadId??null,
      segmentId:byId.has(road?.segmentId)?road.segmentId:null,
      levelId:null,elevation:null});
  }
  if(targets.length===1)targets.push({id:"B",point:copy(route.end),
    checkpointId:finalCheckpoint,roadId:road?.roadId??null,
    segmentId:byId.has(road?.segmentId)?road.segmentId:null,
    levelId:null,elevation:null});
  const plan={schemaVersion:JOURNEY_TARGET_SCHEMA,targets,nextTargetIndex:1};
  return validateJourneyTargets(plan);
}

export function validateJourneyTargets(value){
  if(!value||value.schemaVersion!==JOURNEY_TARGET_SCHEMA||
      !Array.isArray(value.targets)||value.targets.length<2||value.targets.length>25||
      !Number.isInteger(value.nextTargetIndex)||value.nextTargetIndex<1||
      value.nextTargetIndex>value.targets.length||
      value.targets.some((target,i)=>!validTarget(target)||target.id!==letter(i)))
    throw Error("Invalid persisted Atlas A/B/C route targets.");
  for(const target of value.targets){
    if(target.approvedTransport!==undefined){
      const info=target.approvedTransport;
      if(!info||typeof info.methodId!=="string"||!validId(info.methodId)||
          !["owned","hire"].includes(info.arrangement))
        throw Error("Invalid approved transportation on an A/B/C target.");
    }
  }
  return structuredClone(value);
}

/** The target advances only after its checkpoint was durably confirmed. */
export function confirmJourneyTarget(plan,{checkpointId,position,transport,
  tolerancePixels=.01}={}){
  const next=validateJourneyTargets(plan);
  const target=next.targets[next.nextTargetIndex];
  if(!Number.isFinite(tolerancePixels)||tolerancePixels<0)
    throw Error("Invalid native checkpoint coordinate tolerance.");
  if(!target||!checkpointId||target.checkpointId!==checkpointId||!finite(position))
    return next;
  if(separation(target.point,position)>Math.max(.01,tolerancePixels))
    throw Error("The confirmed checkpoint is inconsistent with the saved route target.");
  if(transport?.methodId&&["owned","hire"].includes(transport.arrangement)){
    target.approvedTransport={methodId:transport.methodId,arrangement:transport.arrangement};
  }
  next.nextTargetIndex++;
  return next;
}

export function nextJourneyTarget(plan){
  const saved=validateJourneyTargets(plan);
  return saved.targets[saved.nextTargetIndex]??null;
}

/** Read-only fallback: tiny native-position drift or same authored road/segment.
 * A distant relocation is not trusted even if it lands somewhere on that road.
 */
export function assessJourneyAnchor({anchor,position,atlas,gridSize}={}){
  if(!finite(anchor?.point)||!finite(position)||!Number.isFinite(gridSize)||gridSize<=0)
    throw Error("Journey recovery needs a valid last token position and native Grid size.");
  const drift=separation(anchor.point,position);
  if(drift<=Math.max(2,gridSize*.35))return {safe:true,kind:"coordinate",drift};
  if(drift>Math.max(32,gridSize*2))return {safe:false,kind:"distant",drift};
  const nodes=new Map(atlas?.nodes?.map(node=>[node.id,node])??[]);
  const segments=(atlas?.segments??[]).filter(segment=>
    segment.id===anchor.segmentId||segment.roadId===anchor.roadId&&anchor.roadId);
  if(segments.some(segment=>{
    const start=nodes.get(segment.from),end=nodes.get(segment.to);
    if(!start||!end)return false;
    return pointOnPolyline(position,[start,...(segment.via??[]),end])<=gridSize*.75;
  }))return {safe:true,kind:"road",drift};
  const cp=(atlas?.checkpoints??[]).find(item=>item.id===anchor.checkpointId);
  const node=nodes.get(cp?.nodeId);
  if(node&&separation(position,node)<=gridSize*.75)
    return {safe:true,kind:"checkpoint",drift};
  return {safe:false,kind:"unmatched",drift};
}

export function validateJourneyAnchor(anchor){
  if(!anchor||!finite(anchor.point)||
      !["roadId","segmentId","checkpointId","levelId"].every(key=>
        validId(anchor[key]??null))||
      (anchor.elevation!==null&&anchor.elevation!==undefined&&
        !Number.isFinite(anchor.elevation)))
    throw Error("Invalid confirmed Atlas token recovery position.");
  return structuredClone(anchor);
}

/** Identify the nearest authored road using Scene-local graph IDs. */
export function captureJourneyAnchor({point,atlas,gridSize,levelId=null,elevation=null}={}){
  if(!finite(point)||!Number.isFinite(gridSize)||gridSize<=0)
    throw Error("Cannot checkpoint an invalid native token position.");
  const nodes=new Map((atlas?.nodes??[]).map(item=>[item.id,item]));
  let road=null,distance=Infinity;
  for(const segment of atlas?.segments??[]){
    const start=nodes.get(segment.from),end=nodes.get(segment.to);
    if(!start||!end)continue;
    const hit=pointOnPolyline(point,[start,...(segment.via??[]),end]);
    if(hit<distance){road=segment;distance=hit;}
  }
  const nearRoad=distance<=gridSize*.75;
  const checkpoint=(atlas?.checkpoints??[]).find(cp=>{
    const node=nodes.get(cp.nodeId);
    return node&&separation(point,node)<=gridSize*.75;
  });
  return validateJourneyAnchor({point:copy(point),
    roadId:nearRoad?road.roadId:null,
    segmentId:nearRoad?road.id:null,
    checkpointId:checkpoint?.id??null,
    levelId:typeof levelId==="string"?levelId:null,
    elevation:Number.isFinite(elevation)?elevation:null});
}
