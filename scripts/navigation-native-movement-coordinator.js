/**
 * Foundry v14 adapter: a single TokenDocument.move through authored bends,
 * with native checkpoint pauses for durable Atlas Journal confirmation.
 * No game rules, Journal writes, or World time are owned by this adapter.
 */
const near=(a,b,tolerance)=>Number.isFinite(a?.x)&&Number.isFinite(a?.y)&&
  Number.isFinite(b?.x)&&Number.isFinite(b?.y)&&
  Math.hypot(a.x-b.x,a.y-b.y)<=tolerance;

/**
 * A TokenMovementOptions.id is set before any Document update. Subsequent
 * native checkpoints may carry that ID in movement.chain instead of id.
 * Callbacks are serialized by the public pauseMovement() continuation.
 */
export async function coordinateNativeTokenMovement({
  token,plan,operationId,movementSpeed,hooks,
  prepareCheckpoint,confirmCheckpoint,shouldStop=()=>false,
  tolerancePixels=1
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
      !Number.isFinite(tolerancePixels)||tolerancePixels<0||tolerancePixels>1)
    throw Error("Native checkpoint movement cannot start without v14 public movement controls.");

  let checkpointIndex=0;
  let failure=null;
  let inFlight=Promise.resolve();
  let ended=false;
  const fail=(error)=>{
    if(!failure)failure=error instanceof Error?error:Error(String(error));
    try{token.stopMovement();}
    catch{/* The original movement failure remains authoritative. */}
  };
  const onMove=(document,movement)=>{
    if(ended||document!==token)return;
    const chain=Array.isArray(movement?.chain)?movement.chain:[];
    if(movement?.id!==operationId&&!chain.includes(operationId)){
      fail(Error("Another native movement displaced the Atlas party token."));return;
    }
    const checkpoint=plan.checkpoints[checkpointIndex];
    if(!checkpoint){fail(Error("Foundry issued an unexpected extra movement checkpoint."));return;}
    // The movement operation is immutable. Verify its documented native origin
    // and destination before accepting even a visually plausible waypoint.
    if(!near(movement.origin,checkpoint.from,tolerancePixels)||
        !near(movement.destination,checkpoint.point,tolerancePixels)||
        !near(token,checkpoint.point,tolerancePixels)){
      fail(Error("Foundry movement does not match the approved native checkpoint."));
      return;
    }
    const resume=token.pauseMovement();
    if(typeof resume!=="function"&&checkpointIndex<plan.checkpoints.length-1){
      fail(Error("Foundry could not pause at the approved Journal checkpoint."));return;
    }
    checkpointIndex++;
    inFlight=inFlight.then(async()=>{
      // Unlike TokenDocument.x/y, animation.ended proves visual arrival.
      await movement.animation?.ended;
      if(shouldStop())throw Error("Native movement stopped by the GM or canvas lifecycle.");
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
    if(shouldStop())return {completed:false,confirmed:0,error:null};
    const completed=await token.move(plan.path,{
      id:operationId,animate:true,autoRotate:false,showRuler:false,pan:false,
      animation:{movementSpeed}
    });
    await inFlight;
    if(failure)throw failure;
    if(!completed||checkpointIndex!==plan.checkpoints.length)
      throw Error("Native movement stopped before every checkpoint was confirmed.");
    return {completed:true,confirmed:checkpointIndex,error:null};
  }finally{
    ended=true;
    hooks.off("moveToken",hookId);
  }
}
