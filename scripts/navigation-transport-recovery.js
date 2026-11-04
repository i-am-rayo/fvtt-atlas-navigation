/**
 * Recover only a previously confirmed, checkpoint-bound transport leg.
 * The validated Journey Journal is authority for the voyage already approved;
 * the current Atlas graph and token position remain authority for movement.
 */
const near=(a,b,tolerance=.01)=>Number.isFinite(a?.x)&&Number.isFinite(a?.y)&&
  Number.isFinite(b?.x)&&Number.isFinite(b?.y)&&
  Math.hypot(a.x-b.x,a.y-b.y)<=tolerance;

export function restoreApprovedTransportPlan(route,projected,record,catalog,operationOverride=null){
  const prior=record?.legs?.at(-1);
  const t=prior?.transport;
  if(!t||prior.completedPercent>=99.999||
      !["interrupted","paused","moving"].includes(record.status))return null;
  if(route?.status!=="ok"||!Array.isArray(catalog)||
      !Array.isArray(projected?.legs)||projected.legs.length!==1||
      !near(route.end,prior.destination)||
      !near(projected.legs[0].end,prior.destination)||
      projected.legs[0].surface!==t.surface||
      projected.legs[0].arrivalCheckpoint?.id!==t.arrivalCheckpointId)
    throw Error("The saved voyage no longer ends at its approved checkpoint. Replan with the GM.");
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
    projected.legs[0].weightedDistance:projected.legs[0].distance;
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
  const leg={...projected.legs[0],options:[option],selectedOption:option,
    selectedValue:option.value,methodName:t.methodName,errors:[],hours,costCp:0,
    operation,recovered:true,
    narration:["Continuing the previously approved "+t.methodName+" voyage toward "+
      t.arrivalCheckpointName+". No new booking or payment occurs."]};
  return {...projected,hasTransitions:true,complete:true,legs:[leg],
    totalHours:hours,totalElapsedHours:operation==="continuous"?hours:
      hours+Math.max(0,Math.ceil(hours/8)-1)*16,totalCp:0};
}
