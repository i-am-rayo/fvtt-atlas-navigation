/** Mixed Group travel, using aggregate seating and only existing named mount
 * ownership. No fictitious rider-to-coach assignments or authoritative writes.
 */
import {convertGroupSpeed} from "./navigation-party-speed.js";
import {quoteTransportationService,assessHiredTransportAvailability}
  from "./navigation-transport-service.js";
import {projectedGroupFare} from "./navigation-currency.js";

const isId=x=>typeof x==="string"&&/^[\w-]{1,128}$/.test(x);
const positive=x=>Number.isFinite(x)&&x>0;
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const money=x=>Number.isFinite(x)&&x>=0&&x<=Number.MAX_SAFE_INTEGER;
const sum=(xs,key)=>xs.reduce((n,x)=>n+x[key],0);
const EPS=1e-7;

export function validateAggregateLandConvoy(snapshot){
  if(!snapshot||snapshot.schemaVersion!==3||snapshot.mode!=="mixed-land"||
    snapshot.allocationMode!=="theater-of-mind"||
    typeof snapshot.sceneUnits!=="string"||snapshot.sceneUnits.length>32||
    !Array.isArray(snapshot.travelers)||!snapshot.travelers.length||
    snapshot.travelers.length>150||
    !Array.isArray(snapshot.methods)||snapshot.methods.length<2||
    snapshot.methods.length>20||
    !positive(snapshot.walkingSpeedPerHour)||
    !positive(snapshot.suggestedSpeedPerHour)||!positive(snapshot.speedPerHour)||
    !positive(snapshot.movingHours)||!integer(snapshot.totalPassengers)||
    !integer(snapshot.totalSeatsNeeded)||!money(snapshot.totalCp))
    throw Error("Invalid aggregate mixed Journey.");
  const actors=new Set(), keys=new Set(), mounts=new Set(), personalRiders=new Set();
  for(const t of snapshot.travelers){
    if(!isId(t.actorId)||actors.has(t.actorId)||
      !integer(t.passengers)||t.passengers<1||
      !integer(t.seatsNeeded)||t.seatsNeeded>t.passengers)
      throw Error("Invalid aggregate Group roster.");
    actors.add(t.actorId);
  }
  if(sum(snapshot.travelers,"passengers")!==snapshot.totalPassengers||
     sum(snapshot.travelers,"seatsNeeded")!==snapshot.totalSeatsNeeded)
    throw Error("Aggregate Group totals differ from the saved roster.");
  for(const m of snapshot.methods){
    if(!isId(m.methodId)||m.key!==m.arrangement+"|"+m.methodId||
      !["hire","owned"].includes(m.arrangement)||keys.has(m.key)||
      !["walking","riders","cargo"].includes(m.role)||
      !positive(m.speedPerHour)||!integer(m.passengers)||!integer(m.seatsUsed)||
      m.seatsUsed>m.passengers||!integer(m.units)||!money(m.estimatedCostCp)||
      !Array.isArray(m.resourceIds)||!Array.isArray(m.personalRiders)||
      (m.role==="walking"?(m.key!=="owned|walking"||m.units!==0):
        m.units<1||!integer(m.capacity)||m.capacity<1||
        m.seatsUsed>m.units*m.capacity)||
      (m.role==="cargo"&&(m.passengers!==0||m.seatsUsed!==0))||
      (m.role==="riders"&&m.passengers<1)||
      (m.arrangement==="hire"&&(!isId(m.checkpointId)||
        typeof m.unlimited!=="boolean"||
        (m.unlimited?m.availableUnits!==null:
          !integer(m.availableUnits)||m.availableUnits<m.units)))||
      (m.arrangement==="owned"&&m.checkpointId!==undefined))
      throw Error("Invalid aggregate travel method.");
    for(const id of m.resourceIds){
      if(!isId(id)||mounts.has(id))throw Error("Owned transport is duplicated.");
      mounts.add(id);
    }
    for(const a of m.personalRiders){
      if(!isId(a.riderId)||!isId(a.resourceId)||!actors.has(a.riderId)||
        personalRiders.has(a.riderId)||!m.resourceIds.includes(a.resourceId))
        throw Error("Invalid personal mount assignment.");
      personalRiders.add(a.riderId);
    }
    if(m.personalRiders.length>m.passengers)
      throw Error("Reserved personal riders exceed allocated passengers.");
    keys.add(m.key);
  }
  if(sum(snapshot.methods,"passengers")!==snapshot.totalPassengers||
    sum(snapshot.methods,"seatsUsed")!==snapshot.totalSeatsNeeded||
    sum(snapshot.methods,"estimatedCostCp")!==snapshot.totalCp)
    throw Error("Aggregate passenger seats or fare do not balance.");
  const recommended=Math.min(...snapshot.methods.map(m=>m.speedPerHour));
  if(Math.abs(recommended-snapshot.suggestedSpeedPerHour)>EPS)
    throw Error("Aggregate speed recommendation is inconsistent.");
  if(snapshot.gmWalkingPaceOverride){
    if(!snapshot.methods.some(m=>m.role==="walking")||
      snapshot.speedPerHour<=recommended+EPS||
      snapshot.methods.some(m=>m.role!=="walking"&&
        snapshot.speedPerHour>m.speedPerHour+EPS))
      throw Error("Invalid approved walking pace exception.");
  }else if(snapshot.speedPerHour>recommended+EPS){
    throw Error("Aggregate convoy exceeds the approved sustainable pace.");
  }
  return structuredClone(snapshot);
}

/** GM selects modes and aggregate rider counts, never individual passengers.
 * Named personal mounts are bound to Group assignments automatically.
 */
export function planAggregateLandConvoy({travelers,methods,riderCounts={},
  walkingSpeed,sceneUnits,routeDistance,weightedDistance,distanceMi,
  paceOverride=null,regularHours=8}={}){
  if(!Array.isArray(travelers)||!travelers.length||
    !Array.isArray(methods)||methods.length<2||methods.length>20||
    !positive(walkingSpeed)||!positive(routeDistance)||
    !positive(weightedDistance)||!positive(distanceMi)||
    !positive(regularHours)||regularHours>24)
    throw Error("Choose a full Group and at least two land travel methods.");
  const persons=new Map();
  for(const t of travelers){
    if(!isId(t.actorId)||persons.has(t.actorId)||
      !integer(t.passengers)||t.passengers<1||
      !integer(t.seatsNeeded)||t.seatsNeeded>t.passengers)
      throw Error("Invalid Group traveler/seat totals.");
    persons.set(t.actorId,t);
  }
  const totalPassengers=sum(travelers,"passengers");
  const totalSeatsNeeded=sum(travelers,"seatsNeeded");
  const known=new Set(),usedResources=new Set(),fixedRiders=new Set();
  const prepared=[];
  for(const entry of methods){
    const {key,arrangement,method,checkpointId,resources=[],units}=entry;
    if(!method||!isId(method.id)||key!==arrangement+"|"+method.id||
      known.has(key)||!["hire","owned"].includes(arrangement)||
      method.surface!=="land"||
      (key!=="owned|walking"&&!["mount","vehicle"].includes(method.kind)))
      throw Error("All mixed methods must share the same land journey.");
    known.add(key);
    if(key==="owned|walking"){
      prepared.push({key,arrangement,methodId:"walking",methodName:method.name,
        speedPerHour:walkingSpeed,units:0,capacity:0,
        passengers:0,seatsUsed:0,role:"walking",estimatedCostCp:0,
        resourceIds:[],personalRiders:[]});
      continue;
    }
    const speed=convertGroupSpeed(method.speedMph,"mph",sceneUnits);
    if(!positive(speed)||!integer(method.capacity)||method.capacity<1)
      throw Error("Selected transportation needs valid speed and passenger capacity.");
    if(arrangement==="hire"){
      if(!method.hireEnabled||!isId(checkpointId))
        throw Error("Hired transportation is unavailable at this checkpoint.");
      const count=units??1;
      if(!Number.isInteger(count)||count<1||count>100)
        throw Error("Choose a valid hired unit quantity.");
      const supply=assessHiredTransportAvailability(method,{
        travelers:0,requestedUnits:count});
      if(!supply.sufficient)
        throw Error("Not enough hired "+method.name+" at departure.");
      prepared.push({key,arrangement,methodId:method.id,methodName:method.name,
        speedPerHour:speed,units:count,capacity:method.capacity,
        passengers:0,seatsUsed:0,role:"cargo",
        checkpointId,unlimited:supply.unlimited,
        availableUnits:supply.availableUnits,estimatedCostCp:0,
        resourceIds:[],personalRiders:[],method});
      continue;
    }
    if(!Array.isArray(resources)||!resources.length)
      throw Error("Selected owned method has no Group mounts or vehicles.");
    let quantity=0,seatCapacity=0,actualSpeed=speed,personalRiders=[],chosen=[];
    for(const resource of resources){
      if(!isId(resource.actorId)||usedResources.has(resource.actorId))
        continue;
      if(!Number.isInteger(resource.quantity)||resource.quantity<1||
        !Number.isInteger(resource.capacity)||resource.capacity<1||
        !positive(resource.speedMph))
        throw Error("Configured owned transport has invalid seats or speed.");
      if(resource.assignedTo){
        const rider=persons.get(resource.assignedTo);
        if(!rider||fixedRiders.has(rider.actorId)||rider.passengers!==1||
          resource.quantity!==1)continue;
        fixedRiders.add(rider.actorId);
        personalRiders.push({riderId:rider.actorId,resourceId:resource.actorId});
        quantity++;
        seatCapacity++;
        chosen.push({...resource,usedUnits:1,usedPassengers:1});
      }else{
        quantity+=resource.quantity;
        seatCapacity+=resource.quantity*resource.capacity;
        chosen.push({...resource,usedUnits:resource.quantity});
      }
      usedResources.add(resource.actorId);
      actualSpeed=Math.min(actualSpeed,
        convertGroupSpeed(resource.speedMph,"mph",sceneUnits));
    }
    if(!quantity)throw Error("Selected owned method has no usable Group resources.");
    prepared.push({key,arrangement,methodId:method.id,
      methodName:method.name,speedPerHour:actualSpeed,units:quantity,
      capacity:Math.max(1,Math.ceil(seatCapacity/quantity)),
      passengers:0,seatsUsed:0,role:"riders",estimatedCostCp:0,
      resourceIds:chosen.map(r=>r.actorId),personalRiders,
      seatCapacity,resources:chosen});
  }
  let peopleRemaining=totalPassengers-fixedRiders.size;
  let seatsRemaining=totalSeatsNeeded-
    [...fixedRiders].reduce((n,id)=>n+persons.get(id).seatsNeeded,0);
  if(peopleRemaining<0||seatsRemaining<0)
    throw Error("Assigned personal mounts exceed the Group roster.");
  const hasWalking=prepared.some(p=>p.key==="owned|walking");
  for(const p of prepared){
    if(p.arrangement==="owned"&&p.role!=="walking"){
      const fixed=p.personalRiders.length;
      const freeCap=p.seatCapacity-fixed;
      const desired=riderCounts[p.key]===undefined?
        Math.min(peopleRemaining,Math.max(0,freeCap)):
        riderCounts[p.key]-fixed;
      if(!integer(desired)||desired>freeCap||desired>peopleRemaining)
        throw Error("Owned passenger count exceeds usable Group seats.");
      const otherSeats=Math.min(desired,seatsRemaining);
      p.passengers=fixed+desired;
      p.seatsUsed=[...p.personalRiders].reduce((n,a)=>
        n+persons.get(a.riderId).seatsNeeded,0)+otherSeats;
      seatsRemaining-=otherSeats;peopleRemaining-=desired;
    }
  }
  for(const p of prepared){
    if(p.arrangement!=="hire")continue;
    // Hired per-passenger services default to a minimal single rider when
    // Walking is available; otherwise use remaining capacity without guessing IDs.
    const defaultCount=p.method.hireApplies==="passenger"?
      hasWalking?Math.min(1,peopleRemaining):
        Math.min(peopleRemaining,p.units*p.capacity):
      hasWalking?0:Math.min(peopleRemaining,p.units*p.capacity);
    const count=riderCounts[p.key]??defaultCount;
    if(!integer(count)||count>peopleRemaining||
      count>p.units*p.capacity)
      throw Error("Hired passenger count exceeds party members or hired seats.");
    if(!count&&p.method.hireApplies!=="unit")
      throw Error("Per-passenger hire needs an aggregate rider count.");
    const seats=Math.min(count,seatsRemaining);
    p.passengers=count;p.seatsUsed=seats;p.role=count?"riders":"cargo";
    peopleRemaining-=count;seatsRemaining-=seats;
  }
  const walk=prepared.find(p=>p.role==="walking");
  if(walk){
    walk.passengers=peopleRemaining;walk.seatsUsed=seatsRemaining;
    if(walk.passengers<1)throw Error("No walkers remain; deselect Walking.");
    peopleRemaining=0;seatsRemaining=0;
  }
  if(peopleRemaining!==0||seatsRemaining!==0)
    throw Error("Selected travel methods do not cover the entire Group; "+
      "add Walking or increase aggregate passenger capacity.");
  const suggestedSpeedPerHour=Math.min(...prepared.map(x=>x.speedPerHour));
  const vehicleMax=Math.min(...prepared.filter(p=>p.role!=="walking")
    .map(p=>p.speedPerHour));
  if(paceOverride!==null&&(!positive(paceOverride)||
    paceOverride>vehicleMax+EPS))
    throw Error("GM pace exceeds the slowest selected vehicle or mount.");
  const speedPerHour=paceOverride??suggestedSpeedPerHour;
  if(speedPerHour>suggestedSpeedPerHour+EPS&&!walk)
    throw Error("Only walking pace may be overridden above the recommendation.");
  const movingHours=weightedDistance/speedPerHour;
  if(!positive(movingHours)||movingHours>1e7)
    throw Error("Invalid aggregate Journey moving duration.");
  const historic=prepared.map(p=>{
    let amount=0;
    if(p.arrangement==="hire")amount=quoteTransportationService(p.method,{
      arrangement:"hire",travelers:p.passengers,requestedUnits:p.units,
      distanceMi,movingHours,regularHours}).totalCp;
    else if(p.role!=="walking"){
      let remaining=p.passengers-p.personalRiders.length;
      for(const resource of p.resources){
        const billed=resource.assignedTo?1:Math.min(remaining,
          resource.usedUnits*resource.capacity);
        if(!resource.assignedTo)remaining-=billed;
        amount+=projectedGroupFare(resource.method,{
          quantity:resource.usedUnits,passengers:billed,
          distanceMi,hours:movingHours,dayHours:regularHours});
        if(resource.method.includeCrewWages){
          const days=Math.ceil(Math.max(0,movingHours-EPS)/regularHours);
          const periods=resource.method.crewWageBasis==="trip"?1:
            resource.method.crewWageBasis==="mile"?distanceMi:days;
          amount+=(resource.method.crewCount??0)*
            (resource.method.crewWageCpPerDay??200)*periods*resource.usedUnits;
        }
      }
      if(remaining!==0)throw Error("Owned passenger allocation is incomplete.");
    }
    const {resources,seatCapacity,method,...record}=p;
    return {...record,estimatedCostCp:amount};
  });
  const snapshot={schemaVersion:3,mode:"mixed-land",
    allocationMode:"theater-of-mind",sceneUnits,
    travelers:travelers.map(t=>({...t})),methods:historic,
    totalPassengers,totalSeatsNeeded,walkingSpeedPerHour:walkingSpeed,
    suggestedSpeedPerHour,speedPerHour,movingHours,
    ...(speedPerHour>suggestedSpeedPerHour+EPS?
      {gmWalkingPaceOverride:true}:{}),
    totalCp:sum(historic,"estimatedCostCp")};
  return validateAggregateLandConvoy(snapshot);
}
