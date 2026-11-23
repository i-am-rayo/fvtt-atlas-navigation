/**
 * Pure, fail-closed classification of a pending native Token move after a
 * refresh. Evidence must come from a durable Journal intent and a verified
 * native TokenDocument checkpoint/movement identity, not visual sprites.
 * This module does not itself write Journal, Token, clock, or currency data.
 */
const validPoint=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
const near=(a,b,tolerance)=>validPoint(a)&&validPoint(b)&&
  Math.hypot(a.x-b.x,a.y-b.y)<=tolerance;
const validId=id=>typeof id==="string"&&/^[a-zA-Z0-9_-]{1,128}$/.test(id);
export const PENDING_NATIVE_MOVE_SCHEMA=1;

// Native expansion is calculated before movement and retains every authored waypoint.
export function preservesAuthoredNativePath(path,nativePath){
  if(!Array.isArray(path)||path.length<2||!path.every(validPoint)||
      !Array.isArray(nativePath)||nativePath.length<path.length||
      nativePath.length>4096||!nativePath.every(validPoint)||
      !near(nativePath[0],path[0],0)||!near(nativePath.at(-1),path.at(-1),0))
    return false;
  let next=0;
  for(const p of nativePath)if(near(p,path[next],0))next++;
  return next===path.length;
}

/** Validate a prospective durable pending-intent record on write and read. */
export function validatePendingNativeMove(raw){
  if(!raw||raw.schemaVersion!==PENDING_NATIVE_MOVE_SCHEMA||
      !validId(raw.operationId)||!validId(raw.tokenId)||
      !Number.isSafeInteger(raw.checkpointIndex)||raw.checkpointIndex<0||
      !validPoint(raw.from)||!validPoint(raw.to)||
      !Number.isFinite(raw.nativeDistance)||raw.nativeDistance<=0||
      !Number.isFinite(raw.movingHours)||raw.movingHours<=0||
      !Number.isSafeInteger(raw.worldTimeBefore)||
      !Number.isSafeInteger(raw.worldAdvanceSeconds)||
      raw.worldAdvanceSeconds<0||
      !Number.isSafeInteger(raw.atlasRevision)||raw.atlasRevision<0)
    throw Error("Invalid pending Atlas native movement checkpoint.");
  if(raw.bounded!==undefined&&(
      raw.bounded!==true||
      !(raw.previousMovementId===null||validId(raw.previousMovementId))||
      !Number.isFinite(raw.completedPercent)||raw.completedPercent<=0||raw.completedPercent>100+1e-7||
      !Array.isArray(raw.path)||raw.path.length<2||raw.path.length>4096||
      !raw.path.every(validPoint)||!near(raw.path[0],raw.from,0)||
      !near(raw.path.at(-1),raw.to,0)))
    throw Error("Invalid bounded native movement evidence.");
  if(raw.nativePath!==undefined&&(!raw.bounded||
      !preservesAuthoredNativePath(raw.path,raw.nativePath)))
    throw Error("Invalid normalized native movement path.");
  if(raw.arrivalEvidence!==undefined&&(!raw.bounded||
      !matchesArrivalEvidence(raw,raw.arrivalEvidence)))
    throw Error("Invalid durable native endpoint evidence.");
  if(raw.partialEvidence!==undefined&&(raw.arrivalEvidence!==undefined||
      !partialNativeProgress(raw,raw.partialEvidence)))
    throw Error("Invalid durable partial native movement evidence.");
  return structuredClone(raw);
}

/**
 * 'at-start': No new native travel proved. 'at-end': Token moved, but only
 * when an exact native movement ID and clock state corroborate the saved
 * Journal intent. Otherwise a GM must review the unchanged records.
 */
export function assessPendingNativeMove(raw,{
  tokenId,tokenPoint,recordedMovementIds=[],worldTime,
  atlasRevision,tolerancePixels=.25
}={}){
  const pending=validatePendingNativeMove(raw);
  if(tokenId!==pending.tokenId||atlasRevision!==pending.atlasRevision||
      !validPoint(tokenPoint)||!Number.isSafeInteger(worldTime)||
      !Number.isFinite(tolerancePixels)||tolerancePixels<0||
      tolerancePixels>1)
    return {status:"review",reason:"Recovery identity or native coordinates changed."};
  if(near(tokenPoint,pending.from,tolerancePixels))
    return worldTime===pending.worldTimeBefore?
      {status:"at-start",confirmed:false,worldClockAction:"none"}:
      {status:"review",reason:"World time changed before the pending move completed."};
  if(!near(tokenPoint,pending.to,tolerancePixels))
    return {status:"review",reason:"Token does not match either checkpoint endpoint."};
  if(!Array.isArray(recordedMovementIds)||
      !recordedMovementIds.includes(pending.operationId))
    return {status:"review",reason:"No matching native committed movement ID."};
  if(worldTime===pending.worldTimeBefore)
    return {status:"at-end",confirmed:true,
      worldClockAction:pending.worldAdvanceSeconds?"advance":"none"};
  if(pending.worldAdvanceSeconds>0&&
      worldTime===pending.worldTimeBefore+pending.worldAdvanceSeconds)
    return {status:"at-end",confirmed:true,worldClockAction:"already-advanced"};
  return {status:"review",reason:"World-time state does not match the pending checkpoint."};
}

/** Foundry v14 reports origin separately from passed destination waypoints.
 * Origin-inclusive evidence remains valid only if every coordinate agrees. */
export function matchesNativeIntervalPath(path,movement,tolerance=1,nativePath){
  if(!Array.isArray(path)||path.length<2||!near(movement?.origin,path[0],tolerance)||
      !near(movement?.destination,path.at(-1),tolerance))return false;
  const passed=movement.passed?.waypoints;
  if(nativePath!==undefined){
    if(!preservesAuthoredNativePath(path,nativePath)||!Array.isArray(passed))return false;
    const inclusive=passed.length===nativePath.length&&near(passed[0],path[0],tolerance);
    const actual=inclusive?passed.slice(1):passed;
    if(actual.length!==nativePath.length-1)return false;
    let authored=1;
    return actual.every((p,i)=>{
      const expected=nativePath[i+1];
      if(!near(p,expected,tolerance)||p.movementId!==movement.id)return false;
      if(near(expected,path[authored],0)){authored++;return true;}
      // Region-boundary waypoints may be marked explicit by Foundry.
      // Their authority is the independently predicted native coordinate,
      // ordered movement ID and intermediate/checkpoint classification.
      return p.intermediate===true&&p.checkpoint===false;
    })&&authored===path.length;
  }
  // Legacy pending intents have no independently normalized native path.
  if(!Array.isArray(passed)||!passed.length)return path.length===2;
  // The native list may include the origin or extra processed waypoints.
  // Every authored bend must still occur in order. Only native-generated
  // intermediate points can be inserted between them.
  let next=1,previousProjection=0;
  const start=near(passed[0],path[0],tolerance)?1:0;
  for(const p of passed.slice(start)){
    if(next>=path.length)return false;
    if(p.movementId!==undefined&&p.movementId!==movement.id)return false;
    if(near(p,path[next],tolerance)){
      next++;previousProjection=0;continue;
    }
    if(!validPoint(p)||p.intermediate!==true||p.explicit!==false||
        p.checkpoint!==false||p.movementId!==movement.id)return false;
    const a=path[next-1],b=path[next],dx=b.x-a.x,dy=b.y-a.y;
    const lengthSquared=dx*dx+dy*dy;
    if(!lengthSquared)return false;
    const projection=((p.x-a.x)*dx+(p.y-a.y)*dy)/lengthSquared;
    // A conservative Atlas-only allowance for snapped intermediate points:
    // five native pixels covers the captured v14 fixture, never endpoints
    // or authored bends. Larger native transformations require review.
    const allowance=p.snapped===true?5:tolerance;
    if(projection<previousProjection||projection>1||
        Math.hypot(p.x-a.x-projection*dx,p.y-a.y-projection*dy)>allowance)return false;
    previousProjection=projection;
  }
  return next===path.length;
}

/** A compact, GM-written receipt of the settled document at the approved
 * endpoint. A receipt is not a confirmed Journal segment or a clock write. */
function matchesArrivalEvidence(intent,movement){
  return validId(movement?.id)&&
    Array.isArray(movement.chain)&&movement.chain.length<=64&&movement.chain.every(validId)&&
    (movement.id===intent.operationId||movement.chain.includes(intent.operationId))&&
    movement.constrained===false&&Array.isArray(movement.pending?.waypoints)&&
    movement.pending.waypoints.length===0&&Array.isArray(movement.passed?.waypoints)&&
    movement.passed.waypoints.length>0&&movement.passed.waypoints.length<=4096&&
    matchesNativeIntervalPath(intent.path,movement,1,intent.nativePath);
}

export function captureNativeArrivalEvidence(raw,{movement,tokenPoint}={}){
  const intent=validatePendingNativeMove(raw);
  if(!intent.bounded||!near(tokenPoint,intent.to,1))return null;
  const copyPoint=p=>({x:p.x,y:p.y});
  if(!validPoint(movement?.origin)||!validPoint(movement?.destination)||
      !Array.isArray(movement.passed?.waypoints)||
      movement.passed.waypoints.length>4096||
      !movement.passed.waypoints.every(validPoint)||
      !Array.isArray(movement.pending?.waypoints)||movement.pending.waypoints.length||
      movement.constrained!==false)return null;
  const evidence={id:movement.id,chain:movement.chain??[],
    origin:copyPoint(movement.origin),destination:copyPoint(movement.destination),
    constrained:false,passed:{waypoints:movement.passed.waypoints.map(p=>{
      const copy=copyPoint(p);
      for(const key of ["movementId","subpathId","intermediate","snapped","explicit","checkpoint"])
        if(p[key]!==undefined)copy[key]=p[key];
      return copy;
    })},pending:{waypoints:[]}};
  return matchesArrivalEvidence(intent,evidence)?structuredClone(evidence):null;
}

/** Exact endpoint of one separately authorized native interval. The route
 * corridor is not movement proof; matching native identity and path are. */
export function assessBoundedNativeArrival(raw,{movement,...context}={}){
  const pending=validatePendingNativeMove(raw);
  // Foundry's current/last movement identity is transient across a browser
  // reload. Use the verified durable receipt only when no conflicting live
  // movement is present; a live foreign identity is never overridden.
  const terminal=["completed","stopped"].includes(movement?.state);
  if(terminal&&!movement.id&&!movement.chain?.length&&movement.constrained!==true&&
      !movement.pending?.waypoints?.length&&pending.arrivalEvidence)
    movement=pending.arrivalEvidence;
  if(!pending.bounded||pending.partialEvidence||!terminal||!near(context.tokenPoint,pending.to,1)||
      !(movement.id===pending.operationId||movement.chain?.includes(pending.operationId))||
      !near(movement.destination,pending.to,1))
    return {status:"review",reason:"Native interval identity or endpoint is unverified."};
  if(movement.constrained===true||movement.pending?.waypoints?.length>0)
    return {status:"review",reason:"Native movement was constrained or still has pending waypoints."};
  if(!matchesNativeIntervalPath(pending.path,movement,1,pending.nativePath))
    return {status:"review",reason:"Native interval waypoint evidence is incomplete or does not match the approved ordered path."};
  return assessPendingNativeMove(pending,{...context,
    recordedMovementIds:[pending.operationId],tolerancePixels:1});
}

/** Prove an actually passed native prefix, including a possible fractional
 * last step. Spatial proximity alone is never authorization. */
function segmentFraction(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
  if(!length)return null;
  const t=((p.x-a.x)*dx+(p.y-a.y)*dy)/(length*length);
  return t>=0&&t<=1&&Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)<=1?t:null;
}

function partialNativeProgress(intent,movement){
  const path=intent.path,native=intent.nativePath;
  if(!intent.bounded||!preservesAuthoredNativePath(path,native)||
      !["completed","stopped"].includes(movement?.state)||
      movement.id!==intent.operationId||movement.constrained!==false||
      !Array.isArray(movement.pending?.waypoints)||movement.pending.waypoints.length||
      !near(movement.origin,intent.from,1)||!validPoint(movement.destination)||
      near(movement.destination,intent.from,1)||near(movement.destination,intent.to,1))
    return null;
  const passed=movement.passed?.waypoints;
  if(!Array.isArray(passed)||!passed.length||passed.length>native.length||
      !near(passed.at(-1),movement.destination,.25))return null;
  const points=near(passed[0],native[0],.25)?passed.slice(1):passed;
  if(!points.length)return null;
  let index=1;
  for(const [i,p] of points.entries()){
    if(index>=native.length||!validPoint(p)||p.movementId!==intent.operationId)return null;
    if(near(p,native[index],.25)){index++;continue;}
    // Only the LAST passed point may be between predicted native vertices.
    // In particular, do not accept a missing authored bend or skipped snap.
    const t=segmentFraction(p,native[index-1],native[index]);
    if(i!==points.length-1||t===null||t<=0||t>=1)return null;
  }
  // Credit authored travel, not the length of Foundry's snapped detours.
  // Identify the authored segment from the verified ordered native prefix.
  let authored=1;
  for(let i=1;i<index;i++)
    if(near(native[i],path[authored],0))authored++;
  if(authored>=path.length)return null;
  const t=segmentFraction(movement.destination,path[authored-1],path[authored]);
  if(t===null)return null;
  let total=0,covered=0;
  for(let i=1;i<path.length;i++){
    const length=Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y);
    total+=length;
    covered+=length*(i<authored?1:i===authored?t:0);
  }
  const fraction=covered/total;
  if(!(fraction>0&&fraction<1))return null;
  // Older intents do not distinguish a batched zero clock write from a
  // disabled clock. Controller checks the setting for the zero case.
  // ponytail: do not prorate a coalesced outstanding clock debt; manual
  // review is safer until per-interval accounting can prove that debt.
  if(intent.worldAdvanceSeconds&&
      Math.abs(intent.worldAdvanceSeconds-Math.round(intent.movingHours*3600))>1)
    return null;
  return {fraction,worldAdvanceSeconds:Math.round(intent.worldAdvanceSeconds*fraction)};
}

export function assessBoundedNativePartial(raw,{movement,tokenId,tokenPoint,
  atlasRevision,worldTime}={}){
  const intent=validatePendingNativeMove(raw);
  const review=reason=>({status:"review",reason});
  if(intent.arrivalEvidence||tokenId!==intent.tokenId||atlasRevision!==intent.atlasRevision||
      !Number.isSafeInteger(worldTime))return review("Partial native identity or clock is unverified.");
  if(intent.partialEvidence&&["completed","stopped"].includes(movement?.state)&&
      !movement.id&&!movement.chain?.length&&movement.constrained!==true&&
      !movement.pending?.waypoints?.length)movement=intent.partialEvidence;
  const progress=partialNativeProgress(intent,movement);
  if(!progress||!near(tokenPoint,movement.destination,.25))
    return review("No verified terminal native prefix at the current TokenDocument position.");
  if(intent.partialEvidence&&(!near(movement.destination,intent.partialEvidence.destination,.25)||
      Math.abs(progress.fraction-partialNativeProgress(intent,intent.partialEvidence).fraction)>1e-8))
    return review("Live movement conflicts with the saved partial evidence.");
  const seconds=progress.worldAdvanceSeconds;
  const target=intent.worldTimeBefore+seconds;
  if(!Number.isSafeInteger(target)||![intent.worldTimeBefore,target].includes(worldTime)||
      !intent.partialEvidence&&worldTime!==intent.worldTimeBefore)
    return review("World time does not match the verified partial interval.");
  const copy=p=>({x:p.x,y:p.y});
  const evidence={id:movement.id,state:movement.state,origin:copy(movement.origin),
    destination:copy(movement.destination),constrained:false,
    passed:{waypoints:movement.passed.waypoints.map(p=>({...copy(p),movementId:p.movementId??null}))},
    pending:{waypoints:[]}};
  return {status:"partial",...progress,evidence,
    worldClockAction:seconds===0?"none":worldTime===target?"already-advanced":"advance"};
}
