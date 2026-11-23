/**
 * Opt-in transportation service schedule and estimate engine.
 * Pure planning only. No Actor, Scene, currency or clock writes.
 */
export const TRANSPORT_HIRE_BASES=Object.freeze(["trip","mile","day"]);
export const TRANSPORT_OPERATIONS=Object.freeze(["normal","overtime","continuous"]);
export const LIVESTOCK_FARE_PERCENT_SETTING="guidedLivestockFarePercent";
export const LIVESTOCK_FARE_PERCENT_DEFAULT=50;
export const validLivestockFarePercent=value=>
  Number.isInteger(value)&&value>=0&&value<=200;
export function readLivestockFarePercent(settings){
  let value;
  try{value=settings?.get?.("fvtt-atlas-navigation",LIVESTOCK_FARE_PERCENT_SETTING);}
  catch{return LIVESTOCK_FARE_PERCENT_DEFAULT;}
  if(value==null)return LIVESTOCK_FARE_PERCENT_DEFAULT;
  if(!validLivestockFarePercent(value))
    throw Error("World mount fare must be a percentage from 0 to 200.");
  return value;
}

/** Fresh vehicle plans follow the method's enabled 24h capability unless
 * the GM expressly chose overtime. Approved Journey snapshots are separate. */
export const draftTransportationOperation=(method,operation="normal")=>
  operation==="normal"&&method?.kind==="vehicle"&&method?.continuousEnabled?
    "continuous":operation;
const EPS=1e-7;
const wagePeriods=(method,days,distanceMi,movingHours)=>
  method.crewWageBasis==="trip"?(movingHours>EPS?1:0):
  method.crewWageBasis==="mile"?distanceMi:days;
const nonnegative=n=>Number.isFinite(n)&&n>=0;

export function resolveTransportationOperation(method,operation="normal",regularHours=8){
  if(!TRANSPORT_OPERATIONS.includes(operation))throw Error("Unknown transportation operation.");
  if(operation==="overtime"&&!method?.overtimeEnabled)
    throw Error("Overtime is not enabled for this transportation method.");
  if(operation==="continuous"&&(!method?.continuousEnabled||method.kind!=="vehicle"||
      !["land","water","air"].includes(method.surface)))
    throw Error("Continuous operation is not enabled for this transportation method.");
  if(!Number.isFinite(regularHours)||regularHours<=0||regularHours>24)
    throw Error("Invalid regular travel hours.");
  const dailyHours=operation==="continuous"?24:operation==="overtime"?
    8+(method?.overtimeExtraHours??8):regularHours;
  if(!Number.isFinite(dailyHours)||dailyHours<=0||dailyHours>24||
      (operation==="overtime"&&dailyHours<8))
    throw Error("Invalid transportation daily operating hours.");
  const multiplier=method?.overtimeMultiplier??1.5;
  if(!Number.isFinite(multiplier)||multiplier<1||multiplier>5)
    throw Error("Invalid transportation overtime multiplier.");
  return Object.freeze({operation,dailyHours,overnightHours:24-dailyHours,
    overtimeMultiplier:multiplier});
}

/** Resolve a trip-local quote without altering the World transportation preset. */
export function resolveTransportationHireFare(method,overrides=null){
  if(!method?.hireEnabled)throw Error("This transportation method is not offered for hire.");
  const fare=Object.freeze({
    hireCostCp:overrides?.hireCostCp??method.hireCostCp,
    hireBasis:overrides?.hireBasis??method.hireBasis,
    hireApplies:overrides?.hireApplies??method.hireApplies
  });
  if(!nonnegative(fare.hireCostCp)||fare.hireCostCp>1e8||
    !TRANSPORT_HIRE_BASES.includes(fare.hireBasis)||
    !["unit","passenger"].includes(fare.hireApplies))
    throw Error("Invalid GM travel fare. Enter a valid amount, basis and charging unit.");
  return fare;
}

/** Missing quantities on historical offers mean unlimited supply (legacy behavior).
 * Finite offers fail closed if their requested vehicle count exceeds inventory.
 */
export function assessHiredTransportAvailability(method,{travelers,requestedUnits=null}={}){
  const capacity=method?.capacity;
  if(!Number.isInteger(travelers)||travelers<0||travelers>1000||
      requestedUnits!==null&&(!Number.isInteger(requestedUnits)||requestedUnits<1||
        requestedUnits>1000))
    throw Error("Invalid hired transport passenger or unit count.");
  const unknown=!Number.isInteger(capacity)||capacity<1||capacity>1000;
  const requiredUnits=requestedUnits??(unknown?0:Math.ceil(travelers/capacity));
  const unlimited=method?.hireUnlimited!==false;
  const availableUnits=unlimited?null:method?.hireQuantity;
  const validStock=unlimited||(Number.isInteger(availableUnits)&&
    availableUnits>=0&&availableUnits<=100);
  const missing=!validStock?requiredUnits:unlimited?0:
    Math.max(0,requiredUnits-availableUnits);
  return {requiredUnits,availableUnits,unlimited,unknown,missing,
    sufficient:!unknown&&validStock&&missing===0&&
      (travelers>0||requestedUnits!==null)};
}

/**
 * Read-only cost preview for a route. Only one operation can be selected:
 * standard 8h, overtime 8h+extra (max 16h), or continuous 24h.
 *
 * - Day fares: minimum one fare per operating day plus 1.5x for every extra
 *   overtime hour as a fraction of the regular 8h daily fare.
 * - Mile/trip fares: the base covers the route; only the overtime share
 *   attracts the marginal premium (multiplier - 1).
 * - Crew: daily wages are paid per operating day when explicitly included,
 *   with overtime labor added at multiplier x the hourly (daily/8) wage.
 */
export function quoteTransportationService(method,{
  arrangement="owned",operation="normal",movingHours,distanceMi,
  travelers=1,requestedUnits=null,livestockCount=0,ownedQuote=null,
  hireTerms=null,adjustmentCp=0,regularHours=8,
  livestockPercent=LIVESTOCK_FARE_PERCENT_DEFAULT
}={}){
  if(!method||!["owned","hire"].includes(arrangement)||
    !nonnegative(movingHours)||!nonnegative(distanceMi)||
    !Number.isInteger(travelers)||travelers<0||travelers>1000||
    !Number.isInteger(livestockCount)||livestockCount<0||livestockCount>15000||
    !validLivestockFarePercent(livestockPercent)||
    !Number.isFinite(adjustmentCp)||Math.abs(adjustmentCp)>1e8)
    throw Error("Invalid transportation service estimate.");
  const fare=arrangement==="hire"?resolveTransportationHireFare(method,hireTerms):null;
  const schedule=resolveTransportationOperation(method,operation,regularHours);
  const days=movingHours<=EPS?0:Math.ceil(Math.max(0,movingHours-EPS)/schedule.dailyHours);
  // Crewed continuous operation affects *movement*, not the World-defined
  // length of a standard chargeable operating day.
  const billableDayUnits=operation==="continuous"?movingHours/regularHours:days;
  let extraHours=0;
  if(operation==="overtime"){
    const fullDays=Math.floor((movingHours+EPS)/schedule.dailyHours);
    const remaining=Math.max(0,movingHours-fullDays*schedule.dailyHours);
    extraHours=fullDays*(schedule.dailyHours-8)+Math.max(0,remaining-8);
  }
  let units=1,baseCp=0,crewWagesCp=0,baseLabel="Owned Group resources";
  let livestockBaseCp=0,livestockOvertimeCp=0;
  if(arrangement==="hire"){
    const animalSlots=method.livestockCapacity;
    // Blank means unlimited by GM policy; zero explicitly prohibits animals.
    if(livestockCount>0&&(!["land","water","air"].includes(method.surface)||
      method.kind!=="vehicle"||animalSlots===0||
      animalSlots!=null&&(!Number.isInteger(animalSlots)||
        animalSlots<0||animalSlots>1000)))
      throw Error("This vehicle does not allow the selected animal boarding.");
    const passengerUnits=assessHiredTransportAvailability(method,{travelers});
    if(passengerUnits.unknown)
      throw Error("Set passenger capacity before pricing a hired transport.");
    const minimumUnits=livestockCount>0&&animalSlots!=null?
      Math.max(passengerUnits.requiredUnits,Math.ceil(livestockCount/animalSlots)):
      passengerUnits.requiredUnits;
    const requiredUnits=requestedUnits??minimumUnits;
    if(requiredUnits<minimumUnits)
      throw Error("Insufficient animal stalls or passenger seats for the hired service.");
    const supply=assessHiredTransportAvailability(method,{travelers,requestedUnits:requiredUnits});
    if(supply.unknown)
      throw Error("Set passenger capacity before pricing a hired transport.");
    if(!supply.sufficient)
      throw Error("Not enough hired transportation units available at this checkpoint.");
    units=supply.requiredUnits;
    const count=fare.hireApplies==="passenger"?travelers:units;
    const basis=fare.hireBasis==="day"?billableDayUnits:
      fare.hireBasis==="mile"?distanceMi: (movingHours>EPS?1:0);
    baseCp=fare.hireCostCp*basis*count;
    if(livestockCount){
      const custom=method.livestockFareCp;
      const override=method.livestockFarePercent;
      if(override!=null&&!validLivestockFarePercent(override)||
        custom!=null&&override!=null||
        custom!=null&&(!nonnegative(custom)||custom>1e8||
          !TRANSPORT_HIRE_BASES.includes(method.livestockFareBasis)))
        throw Error("Invalid livestock fare configuration.");
      const animalBasis=custom==null?fare.hireBasis:method.livestockFareBasis;
      const percent=override??livestockPercent;
      const animalRate=custom==null?
        (fare.hireApplies==="passenger"?fare.hireCostCp*percent/100:0):custom;
      const periods=animalBasis==="day"?billableDayUnits:
        animalBasis==="mile"?distanceMi:(movingHours>EPS?1:0);
      livestockBaseCp=animalRate*periods*livestockCount;
    }
    baseLabel="Hired "+fare.hireBasis+" fare ("+count+" "+
      (fare.hireApplies==="passenger"?"passenger(s)":"unit(s)")+")";
    if(method.includeCrewWages&&!method.hireCrewIncluded)
      crewWagesCp=(method.crewCount??0)*(method.crewWageCpPerDay??200)*
        wagePeriods(method,billableDayUnits,distanceMi,movingHours)*units;
  }else{
    if(!ownedQuote||!nonnegative(ownedQuote.amount)||
      !Array.isArray(ownedQuote.breakdown))
      throw Error("Matching party-owned transportation is required for a cost quote.");
    units=ownedQuote.quantity??1;
    baseCp=ownedQuote.breakdown.reduce((sum,item)=>sum+
      (item.recurringCp??item.amount??0),0);
    crewWagesCp=ownedQuote.breakdown.reduce((sum,item)=>sum+
      (item.crewWagesCp??0),0);
  }
  let overtimeFareCp=0,overtimeCrewCp=0;
  if(operation==="overtime"&&extraHours>EPS){
    const multiplier=schedule.overtimeMultiplier;
    if(arrangement==="hire"){
      const count=fare.hireApplies==="passenger"?travelers:units;
      overtimeFareCp=fare.hireBasis==="day"?
        fare.hireCostCp*count*(extraHours/8)*multiplier:
        baseCp*(extraHours/Math.max(EPS,movingHours))*(multiplier-1);
      if(livestockBaseCp>0){
        const basis=method.livestockFareCp==null?fare.hireBasis:method.livestockFareBasis;
        livestockOvertimeCp=basis==="day"?
          (livestockBaseCp/Math.max(EPS,billableDayUnits))*(extraHours/8)*multiplier:
          livestockBaseCp*(extraHours/Math.max(EPS,movingHours))*(multiplier-1);
      }
      if(crewWagesCp>0&&(method.crewWageBasis??"day")==="day")
        overtimeCrewCp=(method.crewCount??0)*(method.crewWageCpPerDay??200)*
          units*(extraHours/8)*multiplier;
    }else{
      // Each resource may have a distinct quantity and inherited wage.
      for(const item of ownedQuote.breakdown){
        if(item.crewWagesCp<=0||days===0||(item.crewWageBasis??"day")!=="day")continue;
        const dailyWages=item.crewWagesCp/days;
        overtimeCrewCp+=dailyWages*(extraHours/8)*multiplier;
      }
    }
  }
  const grossCp=baseCp+crewWagesCp+overtimeFareCp+overtimeCrewCp+
    livestockBaseCp+livestockOvertimeCp;
  const totalCp=Math.max(0,grossCp+adjustmentCp);
  if(!nonnegative(totalCp)||totalCp>Number.MAX_SAFE_INTEGER)
    throw Error("Transportation estimate exceeds the supported range.");
  return Object.freeze({arrangement,operation,units,travelers,
    movingHours,distanceMi,travelDays:days,billableDayUnits,extraHours,
    dailyHours:schedule.dailyHours,overnightHours:schedule.overnightHours,
    baseLabel,baseCp,crewWagesCp,overtimeFareCp,overtimeCrewCp,adjustmentCp,
    livestockCount,livestockBaseCp,livestockOvertimeCp,
    livestockFareCp:livestockBaseCp+livestockOvertimeCp,
    totalCp,hireTerms:fare,driverIncluded:arrangement==="hire"&&Boolean(method.hireCrewIncluded),
    provisionalAvailability:arrangement==="hire"});
}
