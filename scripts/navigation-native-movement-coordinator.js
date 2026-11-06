/**
 * Foundry v14 adapter: a single TokenDocument.move through authored bends,
 * with native checkpoint pauses for durable Atlas Journal confirmation.
 * No game rules, Journal writes, or World time are owned by this adapter.
 */
const near=(a,b,tolerance)=>Number.isFinite(a?.x)&&Number.isFinite(a?.y)&&
  Number.isFinite(b?.x)&&Number.isFinite(b?.y)&&
  Math.hypot(a.x-b.x,a.y-b.y)<=tolerance;
const point=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)?
  {x:p.x,y:p.y}:null;
const separation=(a,b)=>point(a)&&point(b)?Math.hypot(a.x-b.x,a.y-b.y):null;
const distanceToSegment=(p,a,b)=>{
  const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;
  const t=len?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/len)):0;
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
};

/**
 * A native continuation can report its full-path origin instead of the
 * previous Atlas interval's origin. Accept that form only if Foundry's
 * documented passed waypoints prove this exact approved interval, in order,
 * without a detour away from the submitted native path.
 */
function verifiedPassedInterval(movement,plan,checkpoint,tolerance){
  const passed=movement?.passed?.waypoints;
  if(!Array.isArray(passed)||passed.length<2)return false;
  const last=passed.findLastIndex(p=>near(p,checkpoint.point,tolerance));
  if(last<1)return false;
  let first=-1;
  for(let i=last-1;i>=0;i--){
    if(near(passed[i],checkpoint.from,tolerance)){first=i;break;}
  }
  if(first<0)return false;
  const start=checkpoint.pathStartIndex??
    plan.path.findIndex(p=>near(p,checkpoint.from,tolerance));
  const finish=checkpoint.pathEndIndex??
    plan.path.findIndex((p,i)=>i>start&&near(p,checkpoint.point,tolerance));
  if(start<0||finish<=start)return false;
  if(!near(plan.path[start],checkpoint.from,tolerance)||
      !near(plan.path[finish],checkpoint.point,tolerance))return false;
  const approved=plan.path.slice(start,finish+1);
  return passed.slice(first,last+1).every(p=>point(p)&&
    approved.slice(1).some((b,i)=>distanceToSegment(p,approved[i],b)<=tolerance));
}

function checkpointDetails({token,movement,operationId,checkpoint,index,tolerance,
  originMatches,destinationMatches,documentMatches,reconciledFromPassed,
  observationPhase="move-hook",failureReason=null,failedChecks=[]}){
  const passed=movement?.passed?.waypoints;
  const pending=movement?.pending?.waypoints;
  return {
    observationPhase,failureReason,failedChecks,
    nativeOperationId:operationId,nativeMovementId:movement?.id??null,
    movementChain:Array.isArray(movement?.chain)?movement.chain.slice(0,16):[],
    nativeSubpathId:movement?.subpathId??null,
    nativeCheckpointKey:checkpoint?`${operationId}:${checkpoint.index}`:null,
    nativeCheckpointIndex:checkpoint?.index??index,
    atlasCheckpointId:checkpoint?.atlasCheckpointId??null,
    roadId:checkpoint?.roadId??null,segmentId:checkpoint?.segmentId??null,
    nearestRoadId:checkpoint?.nearestRoadId??null,
    nearestSegmentId:checkpoint?.nearestSegmentId??null,
    routeSeparationPixels:checkpoint?.routeSeparationPixels??null,
    expectedFrom:point(checkpoint?.from),expectedTo:point(checkpoint?.point),
    nativeOrigin:point(movement?.origin),nativeDestination:point(movement?.destination),
    tokenDocument:point(token),
    originDifferencePixels:separation(movement?.origin,checkpoint?.from),
    destinationDifferencePixels:separation(movement?.destination,checkpoint?.point),
    documentDifferencePixels:separation(token,checkpoint?.point),
    originMatches,destinationMatches,documentMatches,reconciledFromPassed,
    nativePathConstrained:movement?.constrained===true,
    passedWaypointCount:Array.isArray(passed)?passed.length:null,
    passedStart:point(passed?.[0]),passedEnd:point(passed?.at(-1)),
    pendingWaypointCount:Array.isArray(pending)?pending.length:null,
    pendingStart:point(pending?.[0]),pendingEnd:point(pending?.at(-1)),
    tolerancePixels:tolerance
  };
}

/**
 * A TokenMovementOptions.id is set before any Document update. Subsequent
 * native checkpoints may carry that ID in movement.chain instead of id.
 * Callbacks are serialized by the public pauseMovement() continuation.
 */
export async function coordinateNativeTokenMovement({
  token,plan,operationId,movementSpeed,hooks,
  prepareCheckpoint,confirmCheckpoint,shouldStop=()=>false,
  tolerancePixels=1,signal=null,onCheckpointDiagnostics=null
}={}){
  if(typeof token?.move!=="function"||
      typeof token?.pauseMovement!=="function"||
      typeof token?.stopMovement!=="function"||
      typeof hooks?.on!=="function"||typeof hooks?.off!=="function"||
      typeof prepareCheckpoint!=="function"||
      typeof confirmCheckpoint!=="function"||
      !Array.isArray(plan?.path)||!plan.path.length||
      !Array.isArray(plan?.checkpoints)||!plan.checkpoints.length||
      !Number.isFinite(movementSpeed)||movementSpeed<=0||
      typeof operationId!=="string"||!operationId||
      (onCheckpointDiagnostics!==null&&typeof onCheckpointDiagnostics!=="function")||
      !Number.isFinite(tolerancePixels)||tolerancePixels<0||tolerancePixels>1)
    throw Error("Native checkpoint movement cannot start without v14 public movement controls.");

  let checkpointIndex=0;
  let failure=null;
  let inFlight=Promise.resolve();
  let ended=false;
  let nativeStarted=false;
  let abortListener=null;
  let abortPromise=null;
  const fail=(error)=>{
    if(!failure)failure=error instanceof Error?error:Error(String(error));
    try{token.stopMovement();}
    catch{/* The original movement failure remains authoritative. */}
  };
  const report=(mismatch,details)=>{
    try{onCheckpointDiagnostics?.({mismatch,details});}
    catch{/* Diagnostics cannot alter native movement or checkpoint authority. */}
  };
  const onMove=(document,movement)=>{
    if(ended||document!==token)return;
    const checkpoint=plan.checkpoints[checkpointIndex];
    const chain=Array.isArray(movement?.chain)?movement.chain:[];
    if(movement?.id!==operationId&&!chain.includes(operationId)){
      report(true,checkpointDetails({token,movement,operationId,checkpoint,
        index:checkpointIndex,tolerance:tolerancePixels,
        failureReason:"foreign-native-movement-id",failedChecks:["movement-id"]}));
      fail(Error("Another native movement displaced the Atlas party token."));return;
    }
    if(!checkpoint){
      report(true,checkpointDetails({token,movement,operationId,checkpoint,
        index:checkpointIndex,tolerance:tolerancePixels,
        failureReason:"unexpected-native-checkpoint",failedChecks:["checkpoint-count"]}));
      fail(Error("Foundry issued an unexpected extra movement checkpoint."));return;
    }
    // Foundry can issue moveToken for an approved native endpoint before the
    // TokenDocument's x/y fields show that endpoint. Identity and route proof
    // are mandatory now; document arrival is verified after animation.ended,
    // before any Journey/World-time confirmation is allowed.
    const originMatches=near(movement.origin,checkpoint.from,tolerancePixels);
    const destinationMatches=near(movement.destination,checkpoint.point,tolerancePixels);
    const documentMatches=near(token,checkpoint.point,tolerancePixels);
    const reconciledFromPassed=!originMatches&&destinationMatches&&
      verifiedPassedInterval(movement,plan,checkpoint,tolerancePixels);
    const mismatch=!(originMatches||reconciledFromPassed)||!destinationMatches;
    const failedChecks=[
      ...(!(originMatches||reconciledFromPassed)?["origin-and-passed-path"]:[]),
      ...(!destinationMatches?["destination"]:[])
    ];
    report(mismatch,checkpointDetails({token,movement,operationId,checkpoint,
      index:checkpointIndex,tolerance:tolerancePixels,originMatches,
      destinationMatches,documentMatches,reconciledFromPassed,
      failureReason:mismatch?"native-checkpoint-mismatch":null,failedChecks}));
    if(mismatch){
      fail(Error("Foundry movement does not match the approved native checkpoint."));
      return;
    }
    const resume=token.pauseMovement();
    if(typeof resume!=="function"&&checkpointIndex<plan.checkpoints.length-1){
      fail(Error("Foundry could not pause at the approved Journal checkpoint."));return;
    }
    checkpointIndex++;
    inFlight=inFlight.then(async()=>{
      // The native animation signal alone is not proof of a persisted Token
      // position; verify the authoritative document *after* it resolves.
      await Promise.race([movement.animation?.ended??Promise.resolve(),abortPromise]);
      if(signal?.aborted||shouldStop())
        throw Error("Native movement stopped by the GM or canvas lifecycle.");
      const settledDocumentMatches=near(token,checkpoint.point,tolerancePixels);
      report(!settledDocumentMatches,checkpointDetails({token,movement,operationId,
        checkpoint,index:checkpoint.index,tolerance:tolerancePixels,
        originMatches,destinationMatches,documentMatches:settledDocumentMatches,
        reconciledFromPassed,observationPhase:"animation-ended",
        failureReason:settledDocumentMatches?null:"native-document-checkpoint-mismatch",
        failedChecks:settledDocumentMatches?[]:["token-document"]}));
      if(!settledDocumentMatches)
        throw Error("The native TokenDocument missed its approved checkpoint.");
      await confirmCheckpoint(checkpoint,movement);
      if(checkpointIndex<plan.checkpoints.length){
        if(shouldStop())throw Error("Native movement stopped at the confirmed checkpoint.");
        await prepareCheckpoint(plan.checkpoints[checkpointIndex]);
      }
      if(shouldStop())throw Error("Native movement interrupted after Journal confirmation.");
      if(resume)await resume();
    }).catch(fail);
  };
  const hookId=hooks.on("moveToken",onMove);
  try{
    // A prepared, durable pending intent must exist before the first native
    // TokenDocument update. The caller persists each successor before resume.
    await prepareCheckpoint(plan.checkpoints[0]);
    if(shouldStop()||signal?.aborted)
      return {completed:false,confirmed:0,error:null};
    abortPromise=new Promise((_,reject)=>{
      if(!signal)return;
      abortListener=()=>reject(Error("Canvas lifecycle cancelled native travel."));
      signal.addEventListener("abort",abortListener,{once:true});
      if(signal.aborted)abortListener();
    });
    nativeStarted=true;
    // The first path element is our authoritative TokenDocument origin, not a
    // destination to send to Foundry's public move(waypoints) operation.
    const nativePromise=token.move(plan.path.slice(1),{
      id:operationId,animate:true,autoRotate:false,showRuler:false,pan:false,
      animation:{movementSpeed}
    });
    const completed=await Promise.race([nativePromise,abortPromise]);
    await inFlight;
    if(failure)throw failure;
    if(!completed||checkpointIndex!==plan.checkpoints.length)
      throw Error("Native movement stopped before every checkpoint was confirmed.");
    return {completed:true,confirmed:checkpointIndex,error:null};
  }catch(error){
    if(nativeStarted)fail(error);
    throw error;
  }finally{
    ended=true;
    if(abortListener)signal?.removeEventListener("abort",abortListener);
    hooks.off("moveToken",hookId);
  }
}
