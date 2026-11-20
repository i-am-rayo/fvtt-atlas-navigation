/** System-neutral mixed land Journey planner. Preview only: no Foundry globals or writes.
 * Walking, mounted, passenger and cargo methods share one approved pace.
 */
import {convertGroupSpeed} from "./navigation-party-speed.js";
import {projectedGroupFare} from "./navigation-currency.js";
import {quoteTransportationService,assessHiredTransportAvailability}
  from "./navigation-transport-service.js";

const id=s=>typeof s==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(s);
const positive=n=>Number.isFinite(n)&&n>0;
const nonnegative=n=>Number.isFinite(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER;
const unitsOf=(speed,units)=>convertGroupSpeed(speed,"mph",units);
const sum=(xs,key)=>xs.reduce((n,x)=>n+x[key],0);
const EPS=1e-7;

/** Authoritative approved snapshot; its stock and price are historical facts. */
export function validateMixedLandConvoy(record){
  if(!record||record.schemaVersion!==2||record.mode!=="mixed-land"||
    typeof record.sceneUnits!=="string"||record.sceneUnits.length>32||
    !Array.isArray(record.travelers)||!record.travelers.length||
    record.travelers.length>150||
    !Array.isArray(record.methods)||record.methods.length<2||record.methods.length>20||
    !positive(record.walkingSpeedPerHour)||!positive(record.suggestedSpeedPerHour)||
    !positive(record.speedPerHour)||!positive(record.movingHours)||
    !nonnegative(record.totalCp)||!Number.isInteger(record.totalSeatsNeeded)||
    record.totalSeatsNeeded<0)
    throw Error("Invalid approved mixed transportation Journey.");
  const keys=new Set(),riders=new Set(),resources=new Set();
  for(const t of record.travelers){
    if(!id(t.actorId)||riders.has(t.actorId)||
      typeof t.methodKey!=="string"||
      !/^(owned|hire)\|[A-Za-z0-9_-]{1,128}$/.test(t.methodKey)||
      !["walking","riding"].includes(t.role)||
      !Number.isInteger(t.seatsNeeded)||t.seatsNeeded<0||t.seatsNeeded>100||
      !Number.isInteger(t.passengers)||t.passengers<1||t.passengers>100||
      (t.role==="walking")!==(t.methodKey==="owned|walking"))
      throw Error("Invalid mixed Journey traveler assignment.");
    riders.add(t.actorId);
  }
  for(const m of record.methods){
    if(typeof m.key!=="string"||!["owned","hire"].includes(m.arrangement)||
      m.key!==m.arrangement+"|"+m.methodId||!id(m.methodId)||
      keys.has(m.key)||!positive(m.speedPerHour)||
      typeof m.methodName!=="string"||!m.methodName.trim()||
      m.methodName.length>240||
      !Number.isInteger(m.units)||m.units<0||m.units>100||
      !Number.isInteger(m.seatsUsed)||m.seatsUsed<0||
      !Number.isInteger(m.passengers)||m.passengers<0||
      !nonnegative(m.estimatedCostCp)||!["walking","riders","cargo"].includes(m.role)||
      (m.methodId==="walking")!==(m.role==="walking")||
      (m.role==="walking"&&(m.arrangement!=="owned"||m.units!==0))||
      (m.role!=="walking"&&(m.units===0||!Number.isInteger(m.capacity)||
        m.capacity<1||m.seatsUsed>m.units*m.capacity))||
      (m.role==="cargo"&&(m.passengers!==0||m.seatsUsed!==0))||
      (m.role==="riders"&&m.passengers===0))
      throw Error("Invalid approved mixed Journey transport.");
    if(m.arrangement==="hire"&&
      (!id(m.checkpointId)||typeof m.unlimited!=="boolean"||
       (m.unlimited?m.availableUnits!==null:
         !Number.isInteger(m.availableUnits)||m.availableUnits<m.units||
         m.availableUnits>100)))
      throw Error("Invalid mixed Journey hired inventory.");
    if(m.arrangement==="owned"){
      if(!Array.isArray(m.resourceIds)||m.resourceIds.length>150||
        m.resourceIds.some(r=>!id(r)||resources.has(r)))
        throw Error("Owned transport resource is reused by multiple methods.");
      m.resourceIds.forEach(r=>resources.add(r));
    }
    keys.add(m.key);
  }
  if(record.travelers.some(t=>!keys.has(t.methodKey))||
    !record.methods.every(m=>{
      const ridersHere=record.travelers.filter(t=>t.methodKey===m.key);
      return m.passengers===sum(ridersHere,"passengers")&&
        m.seatsUsed===sum(ridersHere,"seatsNeeded")&&
        (m.role==="walking"||m.passengers===0?m.role!=="riders":m.role==="riders");
    })||
    sum(record.travelers,"seatsNeeded")!==record.totalSeatsNeeded||
    Math.abs(sum(record.methods,"estimatedCostCp")-record.totalCp)>1e-5)
    throw Error("Mixed Journey passenger coverage or fare does not balance.");
  const walker=record.methods.some(m=>m.role==="walking");
  const minimum=Math.min(...record.methods.map(m=>m.speedPerHour));
  if(Math.abs(minimum-record.suggestedSpeedPerHour)>EPS)
    throw Error("Saved mixed Journey recommendation differs from participant speeds.");
  if(record.gmWalkingPaceOverride){
    if(!walker||record.speedPerHour<=minimum+EPS||
      record.methods.some(m=>m.role!=="walking"&&
        record.speedPerHour>m.speedPerHour+EPS))
      throw Error("Invalid GM walking pace exception.");
  }else if(record.speedPerHour>minimum+EPS){
    throw Error("A mixed party cannot exceed its slowest participant without GM approval.");
  }
  return structuredClone(record);
}

/** Every Group member is assigned once. Hires occupy checkpoint units;
 * owned resources are independently matched by stable Group Actor IDs.
 */
export function planMixedLandConvoy({travelers,assignments,methods,walkingSpeed,
  sceneUnits,routeDistance,weightedDistance,distanceMi,paceOverride=null,
  regularHours=8}={}){
  if(!Array.isArray(travelers)||!travelers.length||travelers.length>150||
    !Array.isArray(methods)||methods.length<2||methods.length>20||
    !assignments||typeof assignments!=="object"||
    !positive(walkingSpeed)||!positive(routeDistance)||
    !positive(weightedDistance)||!positive(distanceMi)||
    !positive(regularHours)||regularHours>24)
    throw Error("Choose travelers and at least two compatible land methods.");
  const members=new Set();
  for(const t of travelers){
    if(!id(t.actorId)||members.has(t.actorId)||
      !Number.isInteger(t.seatsNeeded)||t.seatsNeeded<0||t.seatsNeeded>100||
      !Number.isInteger(t.passengers)||t.passengers<1||t.passengers>100)
      throw Error("Invalid Group passenger roster.");
    members.add(t.actorId);
  }
  const chosen=new Map();
  for(const entry of methods){
    const {key,method,arrangement}=entry;
    if(!method||typeof key!=="string"||
      !["owned","hire"].includes(arrangement)||
      key!==arrangement+"|"+method.id||chosen.has(key)||
      method.surface!=="land"||
      (key!=="owned|walking"&&!["mount","vehicle"].includes(method.kind)))
      throw Error("Every selected mixed method must be a compatible land method.");
    chosen.set(key,entry);
  }
  const roster=travelers.map(t=>{
    const key=assignments[t.actorId];
    if(!chosen.has(key))throw Error("Assign each Group traveler to a selected travel method.");
    return {actorId:t.actorId,methodKey:key,
      role:key==="owned|walking"?"walking":"riding",
      seatsNeeded:t.seatsNeeded,passengers:t.passengers};
  });
  const usedResources=new Set();
  const prepared=[];
  for(const {key,arrangement,method,checkpointId,resources=[],units} of methods){
    const people=roster.filter(t=>t.methodKey===key);
    const seatsUsed=sum(people,"seatsNeeded");
    const passengers=sum(people,"passengers");
    if(key==="owned|walking"){
      if(!people.length)throw Error("Deselect Walking if no Group travelers are walking.");
      prepared.push({key,arrangement,methodId:"walking",methodName:method.name,
        speedPerHour:walkingSpeed,units:0,capacity:0,
        seatsUsed,passengers,role:"walking",estimatedCostCp:0,resourceIds:[]});
      continue;
    }
    const nativeSpeed=unitsOf(method.speedMph,sceneUnits);
    if(!positive(nativeSpeed))throw Error("Selected transportation has no valid travel speed.");
    if(arrangement==="hire"){
      if(!method.hireEnabled||!id(checkpointId))
        throw Error("A selected hired method is not offered at the departure checkpoint.");
      const capacity=method.capacity;
      if(!Number.isInteger(capacity)||capacity<1)
        throw Error("Set passenger seating capacity before mixed travel.");
      const minimumUnits=passengers?Math.max(1,Math.ceil(seatsUsed/capacity)):1;
      const count=units??minimumUnits;
      if(!Number.isInteger(count)||count<minimumUnits||count>100)
        throw Error("Selected hired units cannot cover assigned passenger seats.");
      if(!passengers&&method.hireApplies!=="unit")
        throw Error("A per-passenger service requires assigned passengers.");
      const supply=assessHiredTransportAvailability(method,{
        travelers:passengers,requestedUnits:count});
      if(!supply.sufficient)
        throw Error("Not enough hired "+method.name+" units at the departure checkpoint.");
      prepared.push({key,arrangement,methodId:method.id,methodName:method.name,
        speedPerHour:nativeSpeed,units:count,capacity,
        seatsUsed,passengers,role:passengers?"riders":"cargo",
        checkpointId,unlimited:supply.unlimited,
        availableUnits:supply.availableUnits,method});
      continue;
    }
    if(!Array.isArray(resources)||!resources.length)
      throw Error("The selected owned method has no assigned Group transport resources.");
    let need=seatsUsed,count=0,costResources=[],speed=nativeSpeed;
    const reservedRiders=new Set();
    for(const resource of resources){
      if(!id(resource.actorId)||usedResources.has(resource.actorId))
        throw Error("An owned mount or vehicle cannot be selected twice.");
      if(!Number.isInteger(resource.quantity)||resource.quantity<1||
        !Number.isInteger(resource.capacity)||resource.capacity<1||
        !positive(resource.speedMph))
        throw Error("Owned Group transportation has invalid capacity or speed.");
      if(resource.assignedTo&&!people.some(t=>t.actorId===resource.assignedTo))
        continue;
      const required=resource.assignedTo&&!reservedRiders.has(resource.assignedTo)?
        people.find(t=>t.actorId===resource.assignedTo)?.seatsNeeded??0:
        resource.assignedTo?0:need;
      const usable=resource.assignedTo?Math.min(1,resource.quantity):
        resource.quantity;
      const use=Math.min(usable,Math.ceil(Math.max(0,required)/resource.capacity));
      if(!use)continue;
      usedResources.add(resource.actorId);
      const covering=Math.min(need,use*resource.capacity);
      need-=covering;count+=use;
      if(resource.assignedTo)reservedRiders.add(resource.assignedTo);
      speed=Math.min(speed,unitsOf(resource.speedMph,sceneUnits));
      costResources.push({...resource,units:use,
        billedPassengers:resource.assignedTo?
          people.find(t=>t.actorId===resource.assignedTo)?.passengers??0:
          0});
    }
    if(need>0||!count||!passengers)
      throw Error("Insufficient assigned Group transport seats for "+method.name+".");
    prepared.push({key,arrangement,methodId:method.id,methodName:method.name,
      speedPerHour:speed,units:count,capacity:Math.max(1,Math.ceil(seatsUsed/count)),
      seatsUsed,passengers,role:"riders",resourceIds:costResources.map(r=>r.actorId),
      costResources});
  }
  const recommended=Math.min(...prepared.map(m=>m.speedPerHour));
  const vehicleLimit=Math.min(...prepared.filter(m=>m.role!=="walking")
    .map(m=>m.speedPerHour));
  if(paceOverride!==null&&(!positive(paceOverride)||paceOverride>1000||
      paceOverride>vehicleLimit+EPS))
    throw Error("GM pace exceeds the slowest participating mount or vehicle.");
  const chosenSpeed=paceOverride??recommended;
  const gmWalkingPaceOverride=chosenSpeed>recommended+EPS;
  if(gmWalkingPaceOverride&&!prepared.some(m=>m.role==="walking"))
    throw Error("Cannot override the slowest mounted or hired method.");
  const movingHours=weightedDistance/chosenSpeed;
  if(!positive(movingHours)||movingHours>1e7)
    throw Error("Mixed convoy moving time is invalid.");
  const historic=prepared.map(p=>{
    let total=0;
    if(p.arrangement==="hire"){
      total=quoteTransportationService(p.method,{arrangement:"hire",
        travelers:p.passengers,requestedUnits:p.units,movingHours,
        distanceMi,regularHours}).totalCp;
    }else if(p.role!=="walking"){
      let remaining=p.passengers-p.costResources.reduce((n,r)=>
        n+r.billedPassengers,0);
      for(const r of p.costResources){
        const billed=r.assignedTo?r.billedPassengers:
          Math.min(remaining,r.units*r.capacity);
        if(!r.assignedTo)remaining-=billed;
        total+=projectedGroupFare(r.method,{quantity:r.units,
          passengers:billed,distanceMi,hours:movingHours,dayHours:regularHours});
        if(r.method.includeCrewWages){
          const days=Math.ceil(Math.max(0,movingHours-EPS)/regularHours);
          const periods=r.method.crewWageBasis==="trip"?1:
            r.method.crewWageBasis==="mile"?distanceMi:days;
          total+=(r.method.crewCount??0)*
            (r.method.crewWageCpPerDay??200)*periods*r.units;
        }
      }
    }
    const {method,costResources,...record}=p;
    return {...record,estimatedCostCp:total};
  });
  const result={schemaVersion:2,mode:"mixed-land",sceneUnits,
    travelers:roster,methods:historic,walkingSpeedPerHour:walkingSpeed,
    suggestedSpeedPerHour:recommended,speedPerHour:chosenSpeed,movingHours,
    ...(gmWalkingPaceOverride?{gmWalkingPaceOverride:true}:{}),
    totalSeatsNeeded:sum(roster,"seatsNeeded"),
    totalCp:sum(historic,"estimatedCostCp")};
  return validateMixedLandConvoy(result);
}

export function validateNavigationConvoy(value){
  if(value?.schemaVersion===2)return validateMixedLandConvoy(value);
  throw Error("Unknown mixed Journey schema.");
}
