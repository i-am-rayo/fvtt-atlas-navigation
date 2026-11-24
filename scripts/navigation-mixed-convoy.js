/** Pure, opt-in all-walking convoy with independently hired cargo vehicles.
 * This planner never seats travelers in cargo vehicles or books a service.
 */
import {convertGroupSpeed} from "./navigation-party-speed.js";
import {quoteTransportationService,assessHiredTransportAvailability}
  from "./navigation-transport-service.js";

const validId=id=>typeof id==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(id);
const positive=n=>Number.isFinite(n)&&n>0;
const money=n=>Number.isFinite(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER;

/** Stored in the approved Journey Journal, never recomputed from live offers on resume. */
export function validateWalkingCargoConvoy(value){
  if(!value||value.schemaVersion!==1||value.mode!=="walking-cargo"||
      !Array.isArray(value.travelers)||!value.travelers.length||
      value.travelers.length>150||
      value.travelers.some(t=>!validId(t.actorId)||t.role!=="walking"||
        !Number.isInteger(t.seatsNeeded)||t.seatsNeeded<0||t.seatsNeeded>100)||
      new Set(value.travelers.map(t=>t.actorId)).size!==value.travelers.length||
      !Array.isArray(value.hires)||!value.hires.length||value.hires.length>20||
      value.hires.some(h=>!validId(h.methodId)||!validId(h.checkpointId)||
        typeof h.methodName!=="string"||!h.methodName.trim()||
        h.methodName.length>240||
        !Number.isInteger(h.units)||h.units<1||h.units>100||
        !positive(h.speedMph)||h.speedMph>600||
        !["trip","mile","day"].includes(h.hireBasis)||
        !money(h.hireCostCp)||!money(h.estimatedCostCp)||
        typeof h.unlimited!=="boolean"||
        (h.unlimited?h.availableUnits!==null:
          !Number.isInteger(h.availableUnits)||h.availableUnits<h.units||
          h.availableUnits>100))||
      new Set(value.hires.map(h=>h.methodId)).size!==value.hires.length||
      !positive(value.speedPerHour)||!positive(value.suggestedSpeedPerHour)||
      (value.gmWalkingPaceOverride!==undefined&&
        typeof value.gmWalkingPaceOverride!=="boolean")||
      (value.gmWalkingPaceOverride===true?(
        value.speedPerHour<=value.suggestedSpeedPerHour+1e-7||
        typeof value.sceneUnits!=="string"||value.sceneUnits.length>32||
        value.hires.some(h=>{
          const cap=convertGroupSpeed(h.speedMph,"mph",value.sceneUnits);
          return !positive(cap)||value.speedPerHour>cap+1e-7;
        })
      ):value.speedPerHour>value.suggestedSpeedPerHour+1e-7)||
      !positive(value.movingHours)||!money(value.totalCp)||
      Math.abs(value.totalCp-value.hires.reduce((n,h)=>n+h.estimatedCostCp,0))>1e-5)
    throw Error("Invalid approved walking-and-cargo convoy.");
  return structuredClone(value);
}

/** Distances and speed are native Scene units; USD-style units are not assumed.
 * Only land vehicles charged per unit can participate as cargo-only hire.
 */
export function planWalkingCargoConvoy({travelers,walkingSpeed,sceneUnits,
  routeDistance,weightedDistance,distanceMi,hires,paceOverride=null,
  regularHours=8}={}){
  if(!Array.isArray(travelers)||!travelers.length||
      !Array.isArray(hires)||!hires.length||hires.length>20||
      !positive(walkingSpeed)||!positive(routeDistance)||
      !positive(weightedDistance)||!positive(distanceMi)||
      !positive(regularHours)||regularHours>24)
    throw Error("Choose a party and a valid road route before planning a convoy.");
  const speedOf=m=>convertGroupSpeed(m.speedMph,"mph",sceneUnits);
  for(const {method,units,checkpointId} of hires){
    if(!method||method.kind!=="vehicle"||method.surface!=="land"||
        !method.hireEnabled||method.hireApplies!=="unit"||
        !validId(method.id)||!validId(checkpointId)||
        !Number.isInteger(units)||units<1||units>100||
        !positive(speedOf(method)))
      throw Error("Cargo convoy requires an eligible hired land vehicle with unit pricing.");
    const stock=assessHiredTransportAvailability(method,{
      travelers:0,requestedUnits:units});
    if(!stock.sufficient)
      throw Error(method.name+": insufficient cargo vehicle inventory.");
  }
  const suggestedSpeedPerHour=Math.min(walkingSpeed,
    ...hires.map(({method})=>speedOf(method)));
  // A GM may raise walking pace for this Journey, but not exceed any
  // selected hired vehicle's speed. No Actor speeds or Rules are rewritten.
  const cargoLimit=Math.min(...hires.map(({method})=>speedOf(method)));
  if(paceOverride!==null&&(!positive(paceOverride)||paceOverride>1000||
      paceOverride>cargoLimit+1e-7))
    throw Error("GM convoy pace exceeds the slowest hired vehicle speed.");
  const gmWalkingPaceOverride=paceOverride!==null&&
    paceOverride>suggestedSpeedPerHour+1e-7;
  const speedPerHour=paceOverride??suggestedSpeedPerHour;
  const movingHours=weightedDistance/speedPerHour;
  if(!positive(movingHours)||movingHours>1e7)
    throw Error("The convoy travel duration is invalid.");
  const entries=hires.map(({method,units,checkpointId})=>{
    const quote=quoteTransportationService(method,{arrangement:"hire",
      travelers:0,requestedUnits:units,movingHours,distanceMi,regularHours});
    return {methodId:method.id,methodName:method.name,checkpointId,
      units,speedMph:method.speedMph,unlimited:method.hireUnlimited!==false,
      availableUnits:method.hireUnlimited!==false?null:method.hireQuantity,
      hireCostCp:quote.hireTerms.hireCostCp,hireBasis:quote.hireTerms.hireBasis,
      estimatedCostCp:quote.totalCp};
  });
  const snapshot={schemaVersion:1,mode:"walking-cargo",
    travelers:travelers.map(t=>({actorId:t.actorId,role:"walking",
      seatsNeeded:t.seatsNeeded})),
    hires:entries,suggestedSpeedPerHour,speedPerHour,movingHours,
    ...(gmWalkingPaceOverride?{gmWalkingPaceOverride:true,sceneUnits}:{}),
    totalCp:entries.reduce((n,h)=>n+h.estimatedCostCp,0)};
  return validateWalkingCargoConvoy(snapshot);
}
