/**
 * Recover only a previously confirmed, checkpoint-bound transport leg.
 * The validated Journey Journal is authority for the voyage already approved;
 * the current Atlas graph and token position remain authority for movement.
 */
import {assessApprovedJourneyRecovery} from "./navigation-approved-path.js";
const near=(a,b,tolerance=.01)=>Number.isFinite(a?.x)&&Number.isFinite(a?.y)&&
  Number.isFinite(b?.x)&&Number.isFinite(b?.y)&&
  Math.hypot(a.x-b.x,a.y-b.y)<=tolerance;

/** Only an extremely short final attachment to the *approved* native
 * checkpoint can be folded into an interrupted voyage. This does not change
 * ordinary route surface classification or grant vessels general off-road
 * movement. All geometric/identity checks are read-only. */
function approvedTerminalAttachment(route,projected,prior,{atlas,gridSize,gridDistance}={}){
  if(route?.status!=="ok"||!Array.isArray(route.legs)||
      !Array.isArray(projected?.legs)||projected.legs.length!==2||
      !Number.isFinite(gridSize)||gridSize<=0||
      !Number.isFinite(gridDistance)||gridDistance<=0)return null;
  const [sailing,attachment]=projected.legs;
  const last=route.legs?.at(-1),transport=prior.transport;
  if(sailing.surface!==transport.surface||attachment.surface!=="unspecified"||
      attachment.firstRouteLeg!==route.legs.length-1||
      attachment.lastRouteLeg!==route.legs.length-1||
      last?.kind!=="off-road"||!Array.isArray(last.points)||
      last.points.length!==2||!last.points.every(point=>
        Number.isFinite(point?.x)&&Number.isFinite(point?.y))||
      !sailing.roadIds?.length||!Number.isFinite(last.distance)||
      last.distance<0||last.distance>gridDistance*.02||
      sailing.arrivalCheckpoint?.id&&
        sailing.arrivalCheckpoint.id!==transport.arrivalCheckpointId||
      !near(last.points.at(-1),prior.destination)||
      !near(attachment.end,prior.destination))return null;
  const attachLength=Math.hypot(last.points[0].x-last.points.at(-1).x,
    last.points[0].y-last.points.at(-1).y);
  if(attachLength>gridSize*.25||!near(sailing.end,last.points[0]))return null;
  const cp=atlas?.checkpoints?.find(item=>item.id===transport.arrivalCheckpointId);
  const node=atlas?.nodes?.find(item=>item.id===cp?.nodeId);
  if(!cp||!node||!near(node,prior.destination))return null;
  const merged={...sailing,lastRouteLeg:attachment.lastRouteLeg,
    end:{...attachment.end},distance:sailing.distance+attachment.distance,
    weightedDistance:sailing.weightedDistance+attachment.weightedDistance,
    arrivalCheckpoint:{id:cp.id,name:cp.name},transferValid:true};
  return {...projected,legs:[merged],hasTransitions:false,validTransfers:true};
}

/** A native token can already be ahead of the last *confirmed* Journal chunk
 * when Canvas tears down. Never credit the difference or infer completed
 * travel merely because it occupies the destination's hex. */
function checkConfirmedRemainingDistance(route,record,prior,{gridDistance,gridSize}={}){
  if(prior?.approvedPath){
    const assessment=assessApprovedJourneyRecovery({
      approvedPath:prior.approvedPath,route,anchor:record?.lastConfirmedAnchor,
      tokenPosition:route?.start,gridSize,marginCells:2
    });
    if(!assessment.safe)
      throw Error("The saved voyage cannot be safely recovered against its approved " +
        "route ("+assessment.reason+"). Keep the Journal intact and ask the GM " +
        "to review the confirmed position before continuing.");
    return;
  }
  if(!record?.lastConfirmedAnchor||!Number.isFinite(gridDistance)||gridDistance<=0||
      !Number.isFinite(prior.completedPercent)||!Number.isFinite(prior.distance))return;
  const expected=prior.distance*(1-prior.completedPercent/100);
  const actual=route.distance;
  if(!Number.isFinite(actual)||actual<0)return;
  // A half-hex allowance can represent several miles on a world map. Only
  // rounding-level distance differences are safe to accept automatically.
  const allowance=Math.max(gridDistance*.02,expected*.05);
  if(Math.abs(actual-expected)>allowance)
    throw Error("The saved voyage has "+(100-prior.completedPercent).toFixed(1)+
      "% unconfirmed progress, but the token's remaining native route is "+
      "inconsistent with that distance. Keep the Journal intact and have the GM "+
      "review the confirmed anchor before resuming.");
}

export function hasUnfinishedApprovedTransport(record){
  const prior=record?.legs?.at(-1);
  return Boolean(prior?.transport&&Number.isFinite(prior.completedPercent)&&
    prior.completedPercent<99.999&&
    ["interrupted","paused","moving"].includes(record?.status));
}

/**
 * Restore the previously authorized transport *before* recalculating a route.
 * A fresh controller defaults to Walking, which can select a different
 * terrain-weighted road path and falsely invalidate a saved mounted voyage.
 * This is a read-only validation: it does not approve travel or book a fare.
 */
export function approvedTransportRecoverySelection(record,catalog){
  if(!hasUnfinishedApprovedTransport(record))return null;
  if(!Array.isArray(catalog))
    throw Error("The saved voyage's transportation catalog is unavailable.");
  const transport=record.legs.at(-1).transport;
  const method=catalog.find(item=>item.id===transport.methodId);
  if(!method||method.kind!==transport.kind||method.surface!==transport.surface)
    throw Error("The saved voyage's transportation method is no longer compatible.");
  if(!["owned","hire"].includes(transport.arrangement))
    throw Error("The saved voyage's transportation arrangement is invalid.");
  return {methodId:method.id,arrangement:transport.arrangement,
    operation:transport.operation??null};
}

export function restoreApprovedTransportPlan(route,projected,record,catalog,
  operationOverride=null,context={}){
  if(!hasUnfinishedApprovedTransport(record))return null;
  const prior=record.legs.at(-1);
  const t=prior.transport;
  if(route?.status==="ok")checkConfirmedRemainingDistance(route,record,prior,context);
  const verifiedProjection=approvedTerminalAttachment(route,projected,prior,context)??projected;
  // Preserve the same strict guard, but report which requirement failed so a
  // future canvas-rebuild diagnostic is actionable without weakening safety.
  const reason=route?.status!=="ok"?"route unavailable":
    !Array.isArray(catalog)?"transport catalog unavailable":
    !Array.isArray(verifiedProjection?.legs)||verifiedProjection.legs.length!==1?
      "projected leg count changed":
    !near(route.end,prior.destination)?"route endpoint changed":
    !near(verifiedProjection.legs[0].end,prior.destination)?"projected endpoint changed":
    verifiedProjection.legs[0].surface!==t.surface?"travel surface changed":
    verifiedProjection.legs[0].arrivalCheckpoint?.id!==t.arrivalCheckpointId?
      "arrival checkpoint changed":null;
  if(reason){
    const surfaces=reason==="projected leg count changed"&&
      Array.isArray(projected?.legs)?
      "; projected surfaces: "+projected.legs.map(leg=>leg.surface).join(" → "):"";
    throw Error("The saved voyage no longer ends at its approved checkpoint ("+
      reason+surfaces+"). Replan with the GM.");
  }
  const method=catalog.find(item=>item.id===t.methodId);
  if(!method||method.kind!==t.kind||method.surface!==t.surface)
    throw Error("The saved voyage's transportation method is no longer compatible.");
  if(operationOverride!==null&&
      (t.operation!=null||!['water','air'].includes(t.surface)||
        method.kind!=='vehicle'||
        !['normal','continuous'].includes(operationOverride)))
    throw Error('The recovered voyage operating override is unavailable.');
  const operation=t.operation??operationOverride??(method.continuousEnabled&&
    ["water","air"].includes(t.surface)&&method.kind==="vehicle"?
    "continuous":"normal");
  if(!["normal","continuous"].includes(operation))
    throw Error("The saved voyage's operating schedule is unsupported.");
  const originalDistance=prior.terrainAware?
    verifiedProjection.legs[0].weightedDistance:verifiedProjection.legs[0].distance;
  const hours=originalDistance/prior.speedPerHour;
  if(!Number.isFinite(hours)||hours<=0||
      !Number.isFinite(prior.speedPerHour)||prior.speedPerHour<=0)
    throw Error("The saved voyage's speed is invalid.");
  const option={
    value:t.arrangement+"|"+t.methodId,label:t.methodName,group:"Current voyage",
    method:{...method,name:t.methodName,
      ...(operation==="continuous"?{continuousEnabled:true}:{})},
    arrangement:t.arrangement,recovered:true
  };
  const leg={...verifiedProjection.legs[0],options:[option],selectedOption:option,
    selectedValue:option.value,methodName:t.methodName,errors:[],hours,costCp:0,
    operation,recovered:true,
    narration:["Continuing the previously approved "+t.methodName+" voyage toward "+
      t.arrivalCheckpointName+". No new booking or payment occurs."]};
  return {...verifiedProjection,hasTransitions:true,complete:true,legs:[leg],
    totalHours:hours,totalElapsedHours:operation==="continuous"?hours:
      hours+Math.max(0,Math.ceil(hours/8)-1)*16,totalCp:0};
}
