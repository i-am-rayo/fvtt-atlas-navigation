/**
 * Immutable, image-local snapshot of the exact authored route approved by a GM.
 * This is Journal recovery evidence, not a second Scene graph or a source of
 * TokenDocument movement authority. Never substitute a current shortest path
 * for the previously approved sequence without checking its geometry.
 */
export const APPROVED_JOURNEY_PATH_SCHEMA=1;
const MAX_LEGS=512;
const MAX_POINTS=4096;
const finite=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const copy=p=>({x:p.x,y:p.y});
const validId=id=>typeof id==="string"&&/^[a-zA-Z0-9_-]{1,128}$/.test(id);

export function validateApprovedJourneyPath(value){
  if(value?.schemaVersion!==APPROVED_JOURNEY_PATH_SCHEMA||
      !Array.isArray(value.legs)||!value.legs.length||value.legs.length>MAX_LEGS)
    throw Error("Invalid approved Journey route snapshot.");
  let points=0;
  const legs=value.legs.map(leg=>{
    if(!["road","off-road"].includes(leg?.kind)||
        (leg.kind==="road"&&(!validId(leg.roadId)||!validId(leg.segmentId)))||
        !Array.isArray(leg.points)||leg.points.length<2||
        !leg.points.every(finite))
      throw Error("Invalid approved Journey route geometry.");
    points+=leg.points.length;
    if(points>MAX_POINTS)throw Error("The approved Journey route is too complex to checkpoint.");
    return {kind:leg.kind,roadId:leg.kind==="road"?leg.roadId:null,
      segmentId:leg.kind==="road"?leg.segmentId:null,
      points:leg.points.map(copy)};
  });
  for(let i=1;i<legs.length;i++){
    if(distance(legs[i-1].points.at(-1),legs[i].points[0])>.01)
      throw Error("The approved Journey route has disconnected legs.");
  }
  return {schemaVersion:APPROVED_JOURNEY_PATH_SCHEMA,legs};
}

export function captureApprovedJourneyPath(route){
  if(route?.status!=="ok")throw Error("Only a routed Journey can be approved.");
  return validateApprovedJourneyPath({schemaVersion:APPROVED_JOURNEY_PATH_SCHEMA,
    legs:route.legs});
}

function segments(path){
  const result=[];
  let offset=0;
  for(const [legIndex,leg] of path.legs.entries()){
    for(let i=1;i<leg.points.length;i++){
      const a=leg.points[i-1],b=leg.points[i],length=distance(a,b);
      if(length>.000001)result.push({a,b,length,offset,legIndex});
      offset+=length;
    }
  }
  return {segments:result,length:offset};
}

function projection(point,parts){
  let closest=null;
  for(const part of parts.segments){
    const dx=part.b.x-part.a.x,dy=part.b.y-part.a.y;
    const fraction=Math.max(0,Math.min(1,
      ((point.x-part.a.x)*dx+(point.y-part.a.y)*dy)/(part.length**2)));
    const match={x:part.a.x+fraction*dx,y:part.a.y+fraction*dy};
    const hit={distance:distance(point,match),offset:part.offset+fraction*part.length,
      legIndex:part.legIndex};
    if(!closest||hit.distance<closest.distance-.000001||
        Math.abs(hit.distance-closest.distance)<=.000001&&hit.offset<closest.offset)
      closest=hit;
  }
  if(!closest)return null;
  // A road may revisit/cross the same coordinate. Never infer which pass was
  // confirmed from spatial proximity alone; require GM review instead. Two
  // linear passes avoid sorting or allocating a hit per segment on large maps.
  let ambiguous=false;
  for(const part of parts.segments){
    const dx=part.b.x-part.a.x,dy=part.b.y-part.a.y;
    const fraction=Math.max(0,Math.min(1,
      ((point.x-part.a.x)*dx+(point.y-part.a.y)*dy)/(part.length**2)));
    const match={x:part.a.x+fraction*dx,y:part.a.y+fraction*dy};
    if(distance(point,match)-closest.distance<=.01&&
        Math.abs(part.offset+fraction*part.length-closest.offset)>1){
      ambiguous=true;
      break;
    }
  }
  return {...closest,ambiguous};
}

const roadSequence=legs=>legs.filter(leg=>leg.kind==="road")
  .map(leg=>leg.segmentId).filter((id,i,a)=>i===0||id!==a[i-1]);

/**
 * Evaluate a *freshly calculated* route against the confirmed original path.
 * A GM may tolerate at most two cells of sideways road/hex discrepancy, but
 * that tolerance NEVER confirms movement, time, rest, or transportation.
 * The independent Journal anchor check must run first.
 */
export function assessApprovedJourneyRecovery({approvedPath,route,anchor,
  tokenPosition,gridSize,marginCells=2}={}){
  const saved=validateApprovedJourneyPath(approvedPath);
  if(route?.status!=="ok"||!Array.isArray(route.legs)||!finite(anchor?.point)||
      !finite(tokenPosition)||!Number.isFinite(gridSize)||gridSize<=0||
      !Number.isFinite(marginCells)||marginCells<0||marginCells>2)
    return {safe:false,reason:"unavailable"};
  if(distance(anchor.point,tokenPosition)>Math.max(2,gridSize*.35))
    return {safe:false,reason:"unconfirmed-native-movement"};
  let current;
  try{current=validateApprovedJourneyPath({schemaVersion:1,legs:route.legs});}
  catch{return {safe:false,reason:"invalid-current-route"};}
  const original=segments(saved),fresh=segments(current);
  if(!original.length||!fresh.length)return {safe:false,reason:"empty-route"};
  const anchorHit=projection(anchor.point,original);
  if(!anchorHit||anchorHit.ambiguous)
    return {safe:false,reason:"ambiguous-approved-position"};
  const corridor=marginCells*gridSize;
  if(anchorHit.distance>corridor)
    return {safe:false,reason:"off-approved-route",lateralCells:anchorHit.distance/gridSize};
  if(distance(saved.legs.at(-1).points.at(-1),current.legs.at(-1).points.at(-1))>.01)
    return {safe:false,reason:"destination-changed"};
  const originalRoads=roadSequence(saved.legs.slice(anchorHit.legIndex));
  const resumedRoads=roadSequence(current.legs);
  const sameSequence=originalRoads.length===resumedRoads.length&&
    originalRoads.every((id,i)=>resumedRoads[i]===id);
  const atLegEnd=distance(anchor.point,saved.legs[anchorHit.legIndex].points.at(-1))<=
    Math.max(.01,gridSize*.35);
  const skipEndpoint=atLegEnd&&originalRoads.length===resumedRoads.length+1&&
    originalRoads.slice(1).every((id,i)=>resumedRoads[i]===id);
  if(!sameSequence&&!skipEndpoint)
    return {safe:false,reason:"road-sequence-changed"};
  // Projection of every new route endpoint onto the original approved path
  // must move monotonically forward. A shortcut/branch is not trusted merely
  // because it ends at the same destination or stays within a broad corridor.
  let lastOffset=anchorHit.offset;
  for(const part of fresh.segments){
    const hit=projection(part.b,original);
    if(!hit||hit.ambiguous||hit.distance>corridor||
        hit.offset+gridSize*.05<lastOffset)
      return {safe:false,reason:"route-deviated"};
    lastOffset=Math.max(lastOffset,hit.offset);
  }
  // Both lengths are *image pixel* polylines, not a mixture of native Grid
  // distance and an unrelated percentage of animated spline distance.
  const expectedPixels=Math.max(0,original.length-anchorHit.offset);
  const difference=Math.abs(fresh.length-expectedPixels);
  const allowance=Math.max(gridSize*marginCells,expectedPixels*.05);
  if(difference>allowance)
    return {safe:false,reason:"route-length-changed",differencePixels:difference};
  return {safe:true,kind:"approved-route",lateralCells:anchorHit.distance/gridSize,
    routeDifferencePixels:difference};
}
