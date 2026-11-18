/**
 * v0.3.8-beta.7: pure, immutable current-leg native-travel gate.
 * A checkpoint boundary clips movement before a different route surface.
 */
const finitePoint=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
const near=(a,b,tolerance=0.01)=>finitePoint(a)&&finitePoint(b)&&
  Math.hypot(a.x-b.x,a.y-b.y)<=tolerance;

export function prepareGuidedTransportLeg(route,leg){
  if(route?.status!=="ok"||!Array.isArray(route.legs)||!leg||
      leg.index!==0||leg.firstRouteLeg!==0||
      !Number.isSafeInteger(leg.lastRouteLeg)||leg.lastRouteLeg<0||
      leg.lastRouteLeg>=route.legs.length||
      !leg.arrivalCheckpoint?.id||!finitePoint(leg.start)||!finitePoint(leg.end)||
      !leg.transferValid||!leg.selectedOption||leg.errors?.length||
      !Number.isFinite(leg.hours)||leg.hours<=0||
      !Number.isFinite(leg.distance)||leg.distance<=0)
    throw Error("Select a supported method and an authored arrival checkpoint for this leg.");
  const included=route.legs.slice(0,leg.lastRouteLeg+1);
  if(!included.length||included.some(segment=>!Array.isArray(segment.points)||
      segment.points.length<2||!segment.points.every(finitePoint)))
    throw Error("The checkpoint leg contains invalid road geometry.");
  if(!near(included[0].points[0],leg.start)||
      !near(included.at(-1).points.at(-1),leg.end))
    throw Error("The checkpoint leg no longer matches the calculated route.");
  const distance=included.reduce((sum,part)=>sum+part.distance,0);
  const cost=included.reduce((sum,part)=>sum+(Number.isFinite(part.cost)?
    part.cost:part.distance),0);
  if(!Number.isFinite(distance)||Math.abs(distance-leg.distance)>Math.max(.001,leg.distance*1e-6)||
      !Number.isFinite(cost)||cost<0)
    throw Error("The checkpoint leg's distance changed since its preview.");
  const walking=leg.selectedOption.method?.id==="walking";
  const terrainAware=walking&&leg.surface==="land"&&Boolean(route.terrainAware);
  return {
    status:"ok",
    start:{...leg.start},end:{...leg.end},
    distance,cost:terrainAware?cost:distance,terrainAware,
    legs:structuredClone(included),
    checkpoint:{id:leg.arrivalCheckpoint.id,name:leg.arrivalCheckpoint.name,
      point:{...leg.end}},
    transport:{methodId:leg.selectedOption.method.id,
      methodName:leg.selectedOption.method.name,
      kind:leg.selectedOption.method.kind,
      arrangement:leg.selectedOption.arrangement,
      surface:leg.surface,
      departureCheckpointName:leg.departureCheckpoint?.name??null,
      arrivalCheckpointId:leg.arrivalCheckpoint.id,
      arrivalCheckpointName:leg.arrivalCheckpoint.name,
      roadNames:[...leg.roadNames],
      estimatedFareCp:leg.costCp??null,
      operation:leg.operation??"normal",continuation:Boolean(leg.recovered)}
  };
}

export function confirmGuidedCheckpointArrival({token,gridSize,atlasPoint,
  expectedPoint,tolerance=0.75}={}){
  if(!Number.isFinite(gridSize)||gridSize<=0||!finitePoint(expectedPoint)||
      !finitePoint(atlasPoint)||!Number.isFinite(token?.x)||
      !Number.isFinite(token?.y)||!Number.isFinite(token?.width)||
      !Number.isFinite(token?.height)||!Number.isFinite(tolerance)||tolerance<0)
    throw Error("Checkpoint arrival cannot be verified against the party token.");
  // Coordinates have already passed through Atlas's image-relative adapter.
  return near(atlasPoint,expectedPoint,Math.max(.01,tolerance*gridSize));
}
