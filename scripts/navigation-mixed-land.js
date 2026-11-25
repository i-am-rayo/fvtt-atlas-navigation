/** System-neutral mixed land Journey planner. Preview only: no Foundry globals or writes.
 * Walking, mounted, passenger and cargo methods share one approved pace.
 */
import {convertGroupSpeed} from "./navigation-party-speed.js";
import {projectedGroupFare} from "./navigation-currency.js";
import {quoteTransportationService,assessHiredTransportAvailability,validateHiredServiceApproval}
  from "./navigation-transport-service.js";
import {planOwnedVehicleService,validateOwnedVehicleApproval,validateConfirmedOwnedVehicleApproval}
  from "./navigation-group-transport.js";

const id=s=>typeof s==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(s);
const positive=n=>Number.isFinite(n)&&n>0;
const nonnegative=n=>Number.isFinite(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER;
const unitsOf=(speed,units)=>convertGroupSpeed(speed,"mph",units);
const sum=(xs,key)=>xs.reduce((n,x)=>n+x[key],0);
const EPS=1e-7;
const validName=name=>name===undefined||typeof name==="string"&&
  name.trim().length>0&&name.length<=240&&!/[\u0000-\u001f]/.test(name);

/** Authoritative approved snapshot; its stock and price are historical facts. */
export function validateMixedLandConvoy(record,{draft=false}={}){
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
  const tiered=record.methods.some(m=>m.serviceApproval!==undefined||m.ownedApproval!==undefined);
  if(tiered&&(!positive(record.sharedDailyHours)||record.sharedDailyHours>24)||
      !tiered&&record.sharedDailyHours!==undefined)
    throw Error("Invalid mixed Journey service schedule.");
  for(const t of record.travelers){
    if(!id(t.actorId)||riders.has(t.actorId)||
      typeof t.methodKey!=="string"||
      !/^(owned|hire)\|[A-Za-z0-9_-]{1,128}$/.test(t.methodKey)||
      !["walking","riding"].includes(t.role)||
      !Number.isInteger(t.seatsNeeded)||t.seatsNeeded<0||t.seatsNeeded>100||
      !Number.isInteger(t.passengers)||t.passengers<1||t.passengers>100||
      !validName(t.name)||
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
    if(m.serviceApproval!==undefined){
      const approval=validateHiredServiceApproval(m.serviceApproval);
      if(m.arrangement!=="hire"||approval.advertisedDailyHours===undefined||
          approval.dailyHours!==record.sharedDailyHours||approval.units!==m.units||
          approval.travelers!==m.passengers||approval.movingHours!==record.movingHours||
          approval.totalCp!==m.estimatedCostCp)
        throw Error("Invalid approved mixed service fare or schedule.");
    }
    if(m.ownedApproval!==undefined){
      const a=draft?validateOwnedVehicleApproval(m.ownedApproval):
        validateConfirmedOwnedVehicleApproval(m.ownedApproval);
      if(m.arrangement!=="owned"||m.role!=="riders"||a.surface!=="land"||
          a.methodId!==m.methodId||a.operation!=="normal"||
          a.dailyHours!==record.sharedDailyHours||a.movingHours!==record.movingHours||
          a.units.length!==m.units||a.passengerSeats!==m.seatsUsed||
          m.capacity!==Math.ceil(a.passengerCapacity/m.units)||
          Math.abs(unitsOf(a.speedMph,record.sceneUnits)-m.speedPerHour)>EPS||
          a.totalCp!==m.estimatedCostCp||
          JSON.stringify(a.resources.map(r=>r.actorId))!==JSON.stringify(m.resourceIds)||
          a.units.flatMap(u=>u.namedCrew).some(c=>!record.travelers.some(t=>
            t.actorId===c.actorId&&t.methodKey===m.key)))
        throw Error("Invalid approved mixed owned service, roster or schedule.");
    }
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
      !Number.isInteger(t.passengers)||t.passengers<1||t.passengers>100||
      !validName(t.name))
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
      seatsNeeded:t.seatsNeeded,passengers:t.passengers,
      ...(t.name!==undefined?{name:t.name}:{})};
  });
  const usedResources=new Set();
  const prepared=[];
  for(const {key,arrangement,method,checkpointId,resources=[],units,serviceLevel=null,projection,operatedUnits} of methods){
    if(serviceLevel!==null&&arrangement!=="hire")throw Error("Hired service tiers require a hired vehicle.");
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
        availableUnits:supply.availableUnits,method,serviceLevel});
      continue;
    }
    if(operatedUnits!==undefined){
      if(method.kind!=="vehicle"||!projection||!Array.isArray(projection.members))
        throw Error("Selected operating units need a valid owned vehicle roster.");
      const scoped={...projection,travelers:seatsUsed,selectedTravelerIds:people.map(t=>t.actorId)};
      // Zero-distance quote provides selected capacity and pace before the
      // convoy's final shared duration is known. Reuse the owned service engine.
      const {approval}=planOwnedVehicleService(scoped,method,{operatedUnits,
        movingHours:0,distanceMi:0,regularHours,operation:"normal"});
      for(const crew of approval.units.flatMap(u=>u.namedCrew)){
        const existing=roster.find(t=>t.actorId===crew.actorId);
        if(existing){
          if(existing.methodKey!==key)throw Error("Named crew must travel on their operated unit.");
          existing.seatsNeeded=Math.max(0,existing.seatsNeeded-1);
        }else{
          if(members.has(crew.actorId))throw Error("Named crew cannot be assigned twice.");
          members.add(crew.actorId);
          roster.push({actorId:crew.actorId,name:crew.name,methodKey:key,
            role:"riding",seatsNeeded:0,passengers:1});
        }
      }
      const assigned=roster.filter(t=>t.methodKey===key);
      if(sum(assigned,"seatsNeeded")!==approval.passengerSeats)
        throw Error("Named crew and selected passenger seats differ.");
      const resourceIds=approval.resources.map(r=>r.actorId);
      if(resourceIds.some(id=>usedResources.has(id)))
        throw Error("An owned mount or vehicle cannot be selected twice.");
      resourceIds.forEach(id=>usedResources.add(id));
      prepared.push({key,arrangement,methodId:method.id,methodName:method.name,
        speedPerHour:unitsOf(approval.speedMph,sceneUnits),units:approval.units.length,
        capacity:Math.ceil(approval.passengerCapacity/approval.units.length),
        seatsUsed:approval.passengerSeats,passengers:sum(assigned,"passengers"),
        role:"riders",resourceIds,method,projection:scoped,operatedUnits});
      continue;
    }
    if(!Array.isArray(resources)||!resources.length)
      throw Error("The selected owned method has no assigned Group transport resources.");
    let need=seatsUsed,count=0,costResources=[],speed=nativeSpeed;
    for(const resource of resources){
      if(!id(resource.actorId)||usedResources.has(resource.actorId))
        throw Error("An owned mount or vehicle cannot be selected twice.");
      if(!Number.isInteger(resource.quantity)||resource.quantity<1||
        !Number.isInteger(resource.capacity)||resource.capacity<1||
        !positive(resource.speedMph))
        throw Error("Owned Group transportation has invalid capacity or speed.");
      // Party-owned personal rider is only the *default*. The GM can loan
      // that mount to another Group traveler for this Journey without writing
      // a new owner or mutating the Group's saved assignment.
      const use=Math.min(resource.quantity,Math.ceil(Math.max(need,
        count===0&&passengers>0?1:0)/resource.capacity));
      if(!use)continue;
      usedResources.add(resource.actorId);
      const covering=Math.min(need,use*resource.capacity);
      need-=covering;count+=use;
      speed=Math.min(speed,unitsOf(resource.speedMph,sceneUnits));
      costResources.push({...resource,units:use});
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
    let total=0,serviceApproval=null,ownedApproval=null;
    if(p.arrangement==="hire"){
      const quote=quoteTransportationService(p.method,{arrangement:"hire",
        travelers:p.passengers,requestedUnits:p.units,movingHours,
        distanceMi,regularHours,serviceLevel:p.serviceLevel,sharedTravelDay:p.serviceLevel!==null});
      total=quote.totalCp;
      if(p.serviceLevel!==null)serviceApproval=validateHiredServiceApproval(quote);
    }else if(p.operatedUnits!==undefined){
      ownedApproval=planOwnedVehicleService(p.projection,p.method,{operatedUnits:p.operatedUnits,
        movingHours,distanceMi,regularHours,operation:"normal"}).approval;
      total=ownedApproval.totalCp;
    }else if(p.role!=="walking"){
      let remaining=p.passengers;
      for(const [index,r] of p.costResources.entries()){
        const billed=index===p.costResources.length-1?remaining:
          Math.min(remaining,r.units*r.capacity);
        remaining-=billed;
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
    const {method,costResources,serviceLevel,projection,operatedUnits,...record}=p;
    return {...record,estimatedCostCp:total,...(serviceApproval?{serviceApproval}:{}),
      ...(ownedApproval?{ownedApproval}:{})};
  });
  const result={schemaVersion:2,mode:"mixed-land",sceneUnits,
    travelers:roster,methods:historic,walkingSpeedPerHour:walkingSpeed,
    suggestedSpeedPerHour:recommended,speedPerHour:chosenSpeed,movingHours,
    ...(gmWalkingPaceOverride?{gmWalkingPaceOverride:true}:{}),
    ...(historic.some(m=>m.serviceApproval||m.ownedApproval)?{sharedDailyHours:regularHours}:{}),
    totalSeatsNeeded:sum(roster,"seatsNeeded"),
    totalCp:sum(historic,"estimatedCostCp")};
  return validateMixedLandConvoy(result,{draft:true});
}

export function validateNavigationConvoy(value){
  if(value?.schemaVersion===2)return validateMixedLandConvoy(value);
  throw Error("Unknown mixed Journey schema.");
}
