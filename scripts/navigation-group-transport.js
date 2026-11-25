/**
 * Pure read-only D&D5e Group transportation projection plus versioned Atlas
 * World-only assignments (read-only v1–v5 compatibility normalization). Native Group members, currencies and Actor documents
 * are never modified. NPCs are intentionally unclassified until a GM chooses.
 */
export const GROUP_TRANSPORT_SETTING="guidedGroupTransportation";
import { projectedGroupFare } from "./navigation-currency.js";
import { classifyCrewStaffing,resolveCrewThresholds } from "./navigation-transport-catalog.js";
import {quoteTransportationService,resolveTransportationOperation} from "./navigation-transport-service.js";

export const GROUP_TRANSPORT_VERSION=7;
export const GROUP_TRANSPORT_ROLES=Object.freeze([
  "unassigned","mount","passenger","crew","pack","ignore"
]);
export const GROUP_TRANSPORT_SURFACES=Object.freeze(["land","water","air"]);
const MAX_GROUPS=100,MAX_MEMBERS=150;
const safeId=id=>typeof id==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(id);
const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const validProfileId=id=>id===null||(typeof id==="string"&&/^[a-z0-9-]{1,64}$/.test(id));
const validTravelSpeedOverride=v=>v===null||(typeof v==="number"&&Number.isFinite(v)&&v>=0.1&&v<=600);
const validMoneyOverride=v=>v===null||(typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=100000000);
const validBasisOverride=v=>v===null||["none","day","mile"].includes(v);
const validAppliesOverride=v=>v===null||["unit","passenger"].includes(v);
const validPurchaseOverride=v=>v==="none"||validMoneyOverride(v);
const validNoteOverride=v=>v===null||(typeof v==="string"&&v.length<=240);

/** Optional roster distinguishes unconfigured from explicitly zero staffing.
 * Unit indexes belong to the existing resource Actor, not native documents.
 * Keep stale indexes readable so a GM can correct rather than lose assignments. */
function validateCrewRoster(roster,assigned){
  if(!Array.isArray(roster)||roster.length>100)throw Error("Invalid crew roster.");
  const units=new Set();
  return roster.map(unit=>{
    if(!unit||!integer(unit.unitIndex,1,100)||units.has(unit.unitIndex)||
        !Array.isArray(unit.named)||unit.named.length>MAX_MEMBERS||
        !integer(unit.hired,0,1000))throw Error("Invalid crew unit.");
    units.add(unit.unitIndex);
    const named=unit.named.map(member=>{
      if(!member||!safeId(member.actorId)||assigned.has(member.actorId)||
          (member.duty!==undefined&&(typeof member.duty!=="string"||member.duty.length>80)))
        throw Error("Invalid or duplicate named crew member.");
      assigned.add(member.actorId);
      return {actorId:member.actorId,...(member.duty===undefined?{}:{duty:member.duty})};
    });
    return {unitIndex:unit.unitIndex,named,hired:unit.hired};
  });
}

/** Resource-level policy applies to all physical units represented by this Actor.
 * A null override explicitly restores World inheritance, without clearing the roster. */
export function validateOwnedCrewPolicy(policy){
  if(policy===null)return null;
  const keys=["crewCount","crewThresholds","crewWageCpPerDay","crewWageBasis","includeCrewWages"];
  if(!policy||typeof policy!=="object"||Array.isArray(policy)||
      Object.keys(policy).length!==keys.length||!keys.every(key=>Object.hasOwn(policy,key))||
      !integer(policy.crewCount,0,1000)||!validMoneyOverride(policy.crewWageCpPerDay)||
      policy.crewWageCpPerDay===null||!["day","trip","mile"].includes(policy.crewWageBasis)||
      typeof policy.includeCrewWages!=="boolean"||policy.crewThresholds===undefined)
    throw Error("Invalid owned crew policy.");
  resolveCrewThresholds(policy);
  return {...policy,crewThresholds:{...policy.crewThresholds}};
}

export function defaultGroupTransportation(){return {version:GROUP_TRANSPORT_VERSION,groups:{}};}

export function validateGroupTransportation(input){
  if(!input||typeof input!=="object"||Array.isArray(input)||
      ![1,2,3,4,5,6,GROUP_TRANSPORT_VERSION].includes(input.version)||
      !input.groups||typeof input.groups!=="object"||Array.isArray(input.groups)||
      Object.keys(input.groups).length>MAX_GROUPS)
    throw new Error("Invalid Atlas Group transportation configuration.");
  const output=defaultGroupTransportation();
  for(const [groupId,group] of Object.entries(input.groups)){
    if(!safeId(groupId)||!group||typeof group!=="object"||Array.isArray(group)||
        !group.members||typeof group.members!=="object"||Array.isArray(group.members)||
        Object.keys(group.members).length>MAX_MEMBERS)
      throw new Error("Invalid Atlas Group transportation roster.");
    const members={},assignedRiders=new Set(),assignedCrew=new Set();
    for(const [actorId,entry] of Object.entries(group.members)){
      if(!safeId(actorId)||!entry||typeof entry!=="object"||Array.isArray(entry)||
          !GROUP_TRANSPORT_ROLES.includes(entry.role)||
          !integer(entry.quantity,1,100)||
          !(entry.capacity===null||integer(entry.capacity,1,1000))||
          !GROUP_TRANSPORT_SURFACES.includes(entry.surface)||
          !(entry.enabled===undefined||typeof entry.enabled==="boolean")||
          !(entry.needsSeat===undefined||typeof entry.needsSeat==="boolean")||
          !(entry.assignedTo==null||safeId(entry.assignedTo))||
          (entry.assignedTo!=null&&(entry.role!=="mount"||
            entry.quantity!==1||entry.enabled===false))||
          !validProfileId(entry.profileId??null)||
          !validTravelSpeedOverride(entry.speedMphOverride??null)||
          !validMoneyOverride(entry.costCpOverride??null)||
          !validBasisOverride(entry.costBasisOverride??null)||
          !validAppliesOverride(entry.costAppliesOverride??null)||
          !validPurchaseOverride(entry.purchaseGpOverride??null)||
          !validNoteOverride(entry.noteOverride??null))
        throw new Error("Invalid Atlas Group member transportation assignment.");
      if(entry.assignedTo!=null){
        if(assignedRiders.has(entry.assignedTo))
          throw new Error("One Party member cannot be assigned more than one personal mount.");
        assignedRiders.add(entry.assignedTo);
      }
      members[actorId]={role:entry.role,quantity:entry.quantity,
        capacity:entry.capacity,surface:entry.surface,enabled:entry.enabled??true,
        needsSeat:entry.needsSeat??true,assignedTo:entry.assignedTo??null,
        profileId:entry.profileId??null,
        speedMphOverride:entry.speedMphOverride??null,
        costCpOverride:entry.costCpOverride??null,
        costBasisOverride:entry.costBasisOverride??null,
        costAppliesOverride:entry.costAppliesOverride??null,
        purchaseGpOverride:entry.purchaseGpOverride??null,
        noteOverride:entry.noteOverride??null,
        ...(entry.crewRoster===undefined?{}:{crewRoster:validateCrewRoster(entry.crewRoster,assignedCrew)}),
        ...(entry.crewPolicyOverride===undefined?{}:{crewPolicyOverride:validateOwnedCrewPolicy(entry.crewPolicyOverride)})};
    }
    output.groups[groupId]={members};
  }
  return output;
}

export function readGroupTransportation(settings){
  let raw;
  try{raw=settings?.get?.("fvtt-atlas-navigation",GROUP_TRANSPORT_SETTING);}catch{}
  return validateGroupTransportation(raw??defaultGroupTransportation());
}

/** Save only Atlas metadata. Existing World overrides for other Groups survive. */
/** Apply a Group draft in one validation pass, allowing explicit rider reassignment
 * without transient duplicates while retaining other Group revisions. */
export function setGroupTransportationMembers(input,groupId,patches){
  if(!safeId(groupId)||!patches||typeof patches!=="object"||
      Object.keys(patches).some(id=>!safeId(id)))
    throw new Error("Valid Group and Actor IDs are required.");
  const current=validateGroupTransportation(input);
  const next={...current,groups:{...current.groups}};
  const prior=next.groups[groupId]??{members:{}};
  const members={...prior.members};
  for(const [id,patch] of Object.entries(patches)){
    // Legacy Party editors replace resource records; preserve new crew data
    // unless this edit explicitly supplies the roster (including an empty one).
    const previous=members[id];
    members[id]=patch?{...patch,
      ...Object.fromEntries(["crewRoster","crewPolicyOverride"]
        .filter(key=>previous?.[key]!==undefined&&!Object.hasOwn(patch,key))
        .map(key=>[key,previous[key]]))}:patch;
  }
  next.groups[groupId]={members};
  return validateGroupTransportation(next);
}
export function setGroupTransportationMember(input,groupId,actorId,entry){
  return setGroupTransportationMembers(input,groupId,{[actorId]:entry});
}

const readMemberActor=member=>member?.actor?.type?member.actor:
  member?.type&&member?.id?member:null;
const passengerMaximum=actor=>{
  const raw=actor?.system?.passengers?.max;
  return integer(raw,1,1000)?raw:null;
};
const actorSurface=actor=>{
  if(actor?.type==="vehicle"&&GROUP_TRANSPORT_SURFACES.includes(actor.system?.details?.type))
    return actor.system.details.type;
  return "land";
};
/** The same Actor may represent multiple physical units; never group by name. */
export function projectGroupTransportation(group,settings=defaultGroupTransportation(),methods=[]){
  const data=validateGroupTransportation(settings);
  const profileLookup=new Map(methods.map(method=>[method.id,method]));
  const groupId=group?.parent?.actorId??group?.id;
  if(!group||group.type!=="group"||!safeId(groupId))
    throw new Error("A D&D 5e Group Actor is required.");
  const stored=data.groups[groupId]?.members??{};
  const source=Array.isArray(group.system?.members)?group.system.members:[];
  const seen=new Set();
  const members=[];
  for(const item of source){
    const actor=readMemberActor(item);
    if(!actor?.id||seen.has(actor.id)||!["character","npc","vehicle"].includes(actor.type))continue;
    seen.add(actor.id);
    const saved=stored[actor.id];
    const vehicle=actor.type==="vehicle";
    const character=actor.type==="character";
    const role=vehicle?"vehicle":character?"passenger":saved?.role??"unassigned";
    const quantity=character?1:saved?.quantity??1;
    // Explicit saved seats win; otherwise inherit the linked World method,
    // then D&D 5e native Vehicle seating (or one seat for an unlinked mount).
    const capacity=vehicle?saved?.capacity??profileLookup.get(saved?.profileId)?.capacity??
      passengerMaximum(actor):
      role==="mount"?(saved?.capacity??profileLookup.get(saved?.profileId)?.capacity??1):null;
    const profileId=saved?.profileId??null;
    // The World profile is authoritative when available. Stored surface is
    // retained for legacy/unlinked resources and when a profile was deleted.
    const surface=profileLookup.get(profileId)?.surface??saved?.surface??actorSurface(actor);
    const speedMphOverride=saved?.speedMphOverride??null;
    const costCpOverride=saved?.costCpOverride??null;
    const costBasisOverride=saved?.costBasisOverride??null;
    const costAppliesOverride=saved?.costAppliesOverride??null;
    const purchaseGpOverride=saved?.purchaseGpOverride??null;
    const noteOverride=saved?.noteOverride??null;
    const needsSeat=character?true:saved?.needsSeat??true;
    const profileSpeedMph=profileLookup.get(profileId)?.speedMph??null;
    members.push({actorId:actor.id,actorName:actor.name??"Unnamed Actor",
      actorType:actor.type,role,quantity,capacity,surface,profileId,
      enabled:saved?.enabled??true,needsSeat,assignedTo:saved?.assignedTo??null,
      profileSpeedMph,speedMphOverride,costCpOverride,costBasisOverride,costAppliesOverride,
      purchaseGpOverride,noteOverride,
      primaryVehicle:Boolean(vehicle&&group.system?.primaryVehicle?.id===actor.id),
      ...(saved?.crewRoster===undefined?{}:{crewRoster:saved.crewRoster}),
      ...(saved?.crewPolicyOverride===undefined?{}:{crewPolicyOverride:saved.crewPolicyOverride}),
      configured:Boolean(saved)});
  }
  // Travelers and required seats are distinct: companions may travel on
  // another member's seat without consuming a separate one.
  const partyMembers=members.filter(m=>m.role==="passenger");
  const travelers=partyMembers.reduce((sum,m)=>
    sum+(m.needsSeat?m.quantity:0),0);
  const pcCount=partyMembers.filter(m=>m.actorType==="character").length;
  const npcCount=partyMembers.filter(m=>m.actorType==="npc").length;
  const unclassified=members.filter(m=>m.actorType==="npc"&&m.role==="unassigned").length;
  const resources=members.filter(m=>m.enabled&&
    (m.role==="mount"||m.role==="vehicle"));
  const available=eligibleResourceSeats({members},resources);
  const capacityBySurface=Object.fromEntries(GROUP_TRANSPORT_SURFACES.map(surface=>[
    surface,available.filter(item=>item.member.surface===surface).reduce((total,item)=>
      total+item.seats,0)
  ]));
  return {groupId,groupName:group.name??"The Party",members,
    travelers,pcCount,npcCount,unclassified,capacityBySurface};
}
/** Assess configured staffing without changing passenger counts or native membership.
 * Missing roster retains legacy reference estimates until a leg selects units. */
export function assessGroupCrewRoster(projection,resource,method){
  if(resource.crewRoster===undefined)return {configured:false,units:[],issues:[]};
  if(!integer(resource.quantity,1,100))throw Error("Invalid crew resource quantity.");
  const roster=validateCrewRoster(resource.crewRoster,new Set());
  method=effectiveGroupResourceMethod(resource,method);
  const thresholds=resolveCrewThresholds(method);
  const issues=[];
  if(resource.role!=="vehicle"||resource.enabled===false)
    issues.push({code:"unavailable-resource",actorId:resource.actorId});
  const members=new Map(projection.members.map(member=>[member.actorId,member]));
  const indexed=new Map(roster.map(unit=>[unit.unitIndex,unit]));
  for(const unit of roster)if(unit.unitIndex>resource.quantity)
    issues.push({code:"stale-unit",unitIndex:unit.unitIndex});
  const units=Array.from({length:resource.quantity},(_,index)=>{
    const unitIndex=index+1;
    const unit=indexed.get(unitIndex)??{named:[],hired:0};
    let pcCrew=0,npcCrew=0;
    for(const assignment of unit.named){
      const member=members.get(assignment.actorId);
      const eligible=member&&member.enabled!==false&&
        (member.actorType==="character"||
          member.actorType==="npc"&&["crew","passenger","unassigned"].includes(member.role));
      if(!eligible){
        issues.push({code:"stale-member",unitIndex,actorId:assignment.actorId});
        continue;
      }
      if(member.actorType==="character")pcCrew++;else npcCrew++;
    }
    const staffedCrew=pcCrew+npcCrew+unit.hired;
    const tier=classifyCrewStaffing(method,staffedCrew);
    if(tier==="over-capacity")issues.push({code:"over-capacity",unitIndex});
    return {unitIndex,requiredCrew:thresholds.full,staffedCrew,pcCrew,npcCrew,
      hiredCrew:unit.hired,paidCrew:method.includeCrewWages?npcCrew+unit.hired:0,tier};
  });
  return {configured:true,units,issues};
}

/** Eligible travelers are native Group characters or individual passenger NPCs.
 * Selected-party preview limits PC availability but cannot authorize Token movement. */
export function eligibleGroupRiders(projection){
  return projection.members.filter(m=>m.role==="passenger"&&m.needsSeat!==false&&
    (m.actorType==="character"||(m.actorType==="npc"&&m.quantity===1)))
    .map(m=>({id:m.actorId,name:m.actorName}))
    .sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
}
const eligibleTravelerSet=projection=>{
  const known=new Set(eligibleGroupRiders(projection).map(m=>m.id));
  if(!Array.isArray(projection.selectedTravelerIds))return known;
  return new Set(projection.selectedTravelerIds.filter(id=>known.has(id)));
};
/** A personal mount contributes one seat *only for its named traveler*.
 * Its surplus seats cannot be consumed by others; a missing or absent rider
 * contributes zero. Unassigned resource pools preserve legacy behavior. */
const eligibleResourceSeats=(projection,resources)=>{
  const traveling=eligibleTravelerSet(projection),reserved=new Set();
  return resources.map(member=>{
    if(member.role==="mount"&&member.assignedTo){
      const eligible=member.quantity===1&&member.capacity>=1&&
        traveling.has(member.assignedTo)&&!reserved.has(member.assignedTo);
      if(eligible)reserved.add(member.assignedTo);
      return {member,seats:eligible?1:0,reserved:eligible};
    }
    return {member,seats:(member.capacity??0)*member.quantity,reserved:false};
  });
};
/** UI estimates do not imply boarding or approve mixed travel. */
export function groupTravelCapacityStatus(projection,surface){
  if(!GROUP_TRANSPORT_SURFACES.includes(surface))throw new Error("Unknown travel surface.");
  const resources=projection.members.filter(m=>m.enabled&&
    (m.role==="vehicle"||m.role==="mount")&&m.surface===surface);
  const seats=eligibleResourceSeats(projection,resources)
    .reduce((sum,item)=>sum+item.seats,0);
  const unknown=resources.filter(m=>m.capacity===null&&
    !(m.role==="mount"&&m.assignedTo)).length;
  return {travelers:projection.travelers,seats,
    missing:Math.max(0,projection.travelers-seats),unknown,
    sufficient:projection.travelers>0&&projection.travelers<=seats};
}

/** Stable Group Actor ID projections, never guessing a resource by renamed label
 * once a profile is linked. The generic Mounted method accepts all mounts. */
const matchingResources=(projection,method)=>{
  if(!method||!GROUP_TRANSPORT_SURFACES.includes(method.surface))
    throw new Error("A valid transport method is required.");
  return projection.members.filter(m=>{
    if(!m.enabled)return false;
    if(method.id==="mounted")return m.role==="mount"&&m.surface===method.surface;
    if(m.profileId!==null)return (m.role==="mount"||m.role==="vehicle")&&
      m.profileId===method.id;
    return m.surface===method.surface&&
      (m.role==="mount"||m.role==="vehicle")&&
      m.actorName.toLowerCase()===String(method.name??"").toLowerCase();
  });
};

export function effectiveGroupResourceMethod(resource,method){
  const purchase=resource.purchaseGpOverride;
  return {...method,...(resource.crewPolicyOverride?validateOwnedCrewPolicy(resource.crewPolicyOverride):{}),
    capacity:resource.capacity??method.capacity,
    speedMph:resource.speedMphOverride??method.speedMph,
    costCp:resource.costCpOverride??method.costCp,
    costBasis:resource.costBasisOverride??method.costBasis,
    costApplies:resource.costAppliesOverride??method.costApplies,
    purchaseGp:purchase==="none"?null:(purchase??method.purchaseGp),
    note:resource.noteOverride??method.note};
}

/** Match a specific method to relevant Group resources, not every vehicle on
 * the same road surface. The generic Mounted option accepts all GM-marked mounts. */
export function groupMethodCapacityStatus(projection,method,{operatedUnits}={}){
  const crew=operatedUnits===undefined?null:estimateOperatedGroupCrew(projection,method,{
    operatedUnits,hours:0,distanceMi:0,dayHours:8});
  const {resources,seatProjection}=operatedResourceProjection(projection,method,crew);
  const usable=eligibleResourceSeats(seatProjection,resources);
  if(crew&&usable.some(item=>item.member.assignedTo&&!item.reserved))
    throw Error("An operated personal mount requires its eligible assigned rider.");
  const seats=usable.reduce((sum,item)=>sum+item.seats,0);
  const participating=usable.filter(item=>item.seats>0||
    !item.member.assignedTo);
  const unknown=participating.filter(item=>item.member.capacity===null).length;
  // Only resources available to traveling members affect estimated pace.
  const speeds=usable.filter(item=>crew||item.seats>0)
    .map(({member})=>member.speedMphOverride??
      (method.id==="mounted"?member.profileSpeedMph:null)??method.speedMph)
    .filter(speed=>typeof speed==="number"&&Number.isFinite(speed)&&speed>0);
  const effectiveSpeedMph=speeds.length?Math.min(...speeds):null;
  return {travelers:seatProjection.travelers,seats,
    missing:Math.max(0,seatProjection.travelers-seats),unknown,
    matched:participating.length,quantity:participating.reduce((sum,item)=>
      sum+item.member.quantity,0),effectiveSpeedMph,
    sufficient:(projection.travelers>0||Boolean(crew?.namedCrewIds.length))&&seatProjection.travelers<=seats,
    ...(crew?{namedCrewIds:crew.namedCrewIds,
      belowMinimum:crew.units.some(unit=>unit.tier==="below-minimum")}: {})};
}

/** Stable resource inventory for explicit multi-method passenger allocation.
 * Only GM-configured Group resources count. An assigned personal mount may
 * carry its assigned rider only; duplicated Actor IDs are rejected by planner.
 */
export function groupMethodResourceInventory(projection,method){
  if(!projection||!Array.isArray(projection.members))
    throw Error("A valid Group transportation projection is required.");
  return matchingResources(projection,method).map(resource=>{
    const effective=effectiveGroupResourceMethod(resource,method);
    return {actorId:resource.actorId,actorName:resource.actorName,
      quantity:resource.quantity,capacity:effective.capacity,
      assignedTo:resource.assignedTo??null,speedMph:effective.speedMph,
      method:effective};
  });
}

/** One selected-unit projection for both capacity and fare calculations.
 * Crew occupy their own positions; unoperated resources contribute neither
 * passenger seating nor cost. Missing selection preserves legacy estimates. */
function operatedResourceProjection(projection,method,crew){
  let resources=matchingResources(projection,method);
  const crewByResource=new Map();
  let seatProjection=projection;
  if(crew){
    for(const unit of crew.units){
      if(!crewByResource.has(unit.actorId))crewByResource.set(unit.actorId,[]);
      crewByResource.get(unit.actorId).push(unit);
    }
    resources=resources.filter(resource=>crewByResource.has(resource.actorId))
      .map(resource=>({...resource,quantity:crewByResource.get(resource.actorId).length}));
    const named=new Set(crew.namedCrewIds);
    // Named crew remain travelers, but occupy crew positions instead of passenger seats.
    // Count one seat at most per named Actor, even for an NPC quantity pool.
    const crewSeats=projection.members.filter(member=>named.has(member.actorId)&&
      member.role==="passenger"&&member.needsSeat!==false).length;
    seatProjection={...projection,travelers:Math.max(0,projection.travelers-crewSeats),
      selectedTravelerIds:[...eligibleTravelerSet(projection)].filter(id=>!named.has(id))};
  }
  return {resources,seatProjection,crewByResource};
}

/** Display-only per-resource planning quote. For per-passenger overrides,
 * passengers are allocated across available seats in stable Group roster order;
 * no actual boarding or currency mutation occurs. */
export function groupMethodFareEstimate(projection,method,{hours,distanceMi,dayHours,operatedUnits}){
  if(!Number.isFinite(hours)||hours<0||!Number.isFinite(distanceMi)||distanceMi<0||
      !Number.isFinite(dayHours)||dayHours<=0||dayHours>24)
    throw new Error("Invalid Group transportation cost inputs.");
  const crew=operatedUnits===undefined?null:
    estimateOperatedGroupCrew(projection,method,{operatedUnits,hours,distanceMi,dayHours});
  const {resources,seatProjection,crewByResource}=operatedResourceProjection(projection,method,crew);
  const usable=eligibleResourceSeats(seatProjection,resources);
  if(crew&&usable.some(item=>item.member.assignedTo&&!item.reserved))
    throw Error("An operated personal mount requires its eligible assigned rider.");
  const reservedCount=usable.filter(item=>item.reserved).length;
  let remaining=Math.max(0,seatProjection.travelers-reservedCount),amount=0;
  const breakdown=[];
  for(const {member,seats,reserved} of usable){
    if(member.role==="mount"&&member.assignedTo&&!reserved)continue;
    const effective=effectiveGroupResourceMethod(member,method);
    const passengers=reserved?1:Math.min(remaining,seats);
    if(!reserved)remaining-=passengers;
    const cost=projectedGroupFare(effective,{quantity:member.quantity,
      passengers,distanceMi,hours,dayHours});
    const crewDays=hours===0?0:Math.ceil(Math.max(0,hours-1e-7)/dayHours);
    const wagePeriods=effective.crewWageBasis==="trip"?(hours>0?1:0):
      effective.crewWageBasis==="mile"?distanceMi:crewDays;
    const crewUnits=crewByResource.get(member.actorId);
    const wages=crewUnits?crewUnits.reduce((sum,unit)=>sum+unit.crewWagesCp,0):
      effective.includeCrewWages?
      wagePeriods*(effective.crewCount??0)*(effective.crewWageCpPerDay??200)*member.quantity:0;
    if(!Number.isFinite(wages)||wages<0||!Number.isSafeInteger(Math.ceil(amount+cost+wages)))
      throw new Error("Invalid projected crew wage total.");
    amount+=cost+wages;
    breakdown.push({actorId:member.actorId,name:member.actorName,
      quantity:member.quantity,passengers,costCp:effective.costCp,
      costBasis:effective.costBasis,costApplies:effective.costApplies,
      recurringCp:cost,crewWagesCp:wages,crewDays,crewWageBasis:effective.crewWageBasis??"day",amount:cost+wages,
      ...(crewUnits?{crewUnits,requiredCrew:crewUnits.reduce((sum,unit)=>sum+unit.requiredCrew,0),
        staffedCrew:crewUnits.every(unit=>unit.configured)?crewUnits.reduce((sum,unit)=>sum+unit.staffedCrew,0):null,
        paidCrew:crewUnits.reduce((sum,unit)=>sum+unit.paidCrew,0)}:{})});
  }
  return {amount,breakdown,unseated:remaining,
    quantity:breakdown.reduce((sum,item)=>sum+item.quantity,0),
    ...(crew?{namedCrewIds:crew.namedCrewIds}:{})};
}

/** Estimate crew only for explicitly selected operating units. This is a draft
 * calculation: callers must use the same unit list for passenger allocation,
 * upkeep and approval. Legacy quotes continue through their existing path. */
export function estimateOperatedGroupCrew(projection,method,{operatedUnits,hours,distanceMi,dayHours}={}){
  if(!Array.isArray(operatedUnits)||!operatedUnits.length||
      !Number.isFinite(hours)||hours<0||!Number.isFinite(distanceMi)||distanceMi<0||
      !Number.isFinite(dayHours)||dayHours<=0||dayHours>24)
    throw Error("Invalid operating units or crew estimate factors.");
  const resources=new Map(matchingResources(projection,method).map(resource=>[resource.actorId,resource]));
  const selected=Array.isArray(projection.selectedTravelerIds)?new Set(projection.selectedTravelerIds):null;
  const members=new Map(projection.members.map(member=>[member.actorId,member]));
  const seen=new Set(),namedCrew=new Set(),assessments=new Map(),units=[];
  const crewDays=hours===0?0:Math.ceil(Math.max(0,hours-1e-7)/dayHours);
  let crewWagesCp=0;
  for(const selection of operatedUnits){
    const resource=resources.get(selection?.actorId),unitIndex=selection?.unitIndex;
    const key=selection?.actorId+":"+unitIndex;
    if(!resource||!integer(unitIndex,1,resource.quantity)||seen.has(key))
      throw Error("Invalid or duplicate operated unit.");
    seen.add(key);
    const effective=effectiveGroupResourceMethod(resource,method);
    if(!assessments.has(resource.actorId))
      assessments.set(resource.actorId,assessGroupCrewRoster(projection,resource,method));
    const assessment=assessments.get(resource.actorId);
    if(assessment.issues.length)throw Error("Correct invalid crew assignments before reviewing this leg.");
    const configured=assessment.configured;
    const named=resource.crewRoster?.find(unit=>unit.unitIndex===unitIndex)?.named??[];
    for(const {actorId} of named){
      if(namedCrew.has(actorId)||selected&&members.get(actorId)?.role==="passenger"&&!selected.has(actorId))
        throw Error("Named crew must be traveling on the selected operated unit.");
      namedCrew.add(actorId);
    }
    const requiredCrew=resolveCrewThresholds(effective).full;
    const staffing=configured?assessment.units.find(unit=>unit.unitIndex===unitIndex):
      {unitIndex,requiredCrew,staffedCrew:null,pcCrew:null,npcCrew:null,hiredCrew:null,
        paidCrew:effective.includeCrewWages?requiredCrew:0,tier:null};
    const wageBasis=effective.crewWageBasis??"day",rate=effective.crewWageCpPerDay??200;
    const periods=wageBasis==="trip"?(hours>0?1:0):wageBasis==="mile"?distanceMi:crewDays;
    const wages=staffing.paidCrew*rate*periods;
    if(!Number.isFinite(wages)||wages<0||!Number.isSafeInteger(Math.ceil(crewWagesCp+wages)))
      throw Error("Invalid projected crew wage total.");
    crewWagesCp+=wages;
    units.push({...staffing,actorId:resource.actorId,configured,crewWageBasis:wageBasis,
      crewWageCpPerDay:rate,crewDays,crewWagesCp:wages});
  }
  return {units,namedCrewIds:[...namedCrew],crewWagesCp};
}

/** A single owned-vehicle planning contract, including the exact operating
 * units and original wage evidence. Nothing here writes or approves movement. */
export function planOwnedVehicleService(projection,method,{operatedUnits,movingHours,distanceMi,
  regularHours=8,operation="normal"}={}){
  if(method?.kind!=="vehicle")throw Error("Choose an owned vehicle.");
  const schedule=resolveTransportationOperation(method,operation,regularHours);
  const billingDayHours=operation==="continuous"?regularHours:schedule.dailyHours;
  const capacity=groupMethodCapacityStatus(projection,method,{operatedUnits});
  if(!capacity.sufficient||capacity.unknown||capacity.effectiveSpeedMph===null)
    throw Error("Select enough valid operated vehicle passenger seats.");
  const ownedQuote=groupMethodFareEstimate(projection,method,{
    operatedUnits,hours:movingHours,distanceMi,dayHours:billingDayHours});
  if(ownedQuote.unseated!==0)throw Error("Insufficient operated vehicle passenger seats.");
  const quote=quoteTransportationService(method,{arrangement:"owned",operation,movingHours,
    distanceMi,travelers:capacity.travelers,ownedQuote,regularHours});
  const members=new Map(projection.members.map(m=>[m.actorId,m]));
  const units=ownedQuote.breakdown.flatMap(row=>row.crewUnits.map(unit=>{
    const resource=members.get(unit.actorId);
    const effective=effectiveGroupResourceMethod(resource,method);
    return {...unit,name:resource.actorName,capacity:effective.capacity,speedMph:effective.speedMph,
      thresholds:resolveCrewThresholds(effective),wagesEnabled:Boolean(effective.includeCrewWages),
      namedCrew:(resource.crewRoster?.find(x=>x.unitIndex===unit.unitIndex)?.named??[]).map(assignment=>{
        const member=members.get(assignment.actorId);
        return {...assignment,name:member.actorName,actorType:member.actorType};
      })};
  }));
  const resources=ownedQuote.breakdown.map(({actorId,quantity,passengers,costCp,costBasis,costApplies,
    recurringCp,crewWagesCp,crewWageBasis})=>({actorId,quantity,passengers,costCp,costBasis,costApplies,
      recurringCp,crewWagesCp,crewWageBasis}));
  const approval=validateOwnedVehicleApproval({schemaVersion:1,methodId:method.id,surface:method.surface,
    operation,regularHours,billingDayHours,dailyHours:quote.dailyHours,overnightHours:quote.overnightHours,
    overtimeMultiplier:schedule.overtimeMultiplier,movingHours,distanceMi,
    passengerSeats:capacity.travelers,passengerCapacity:capacity.seats,speedMph:capacity.effectiveSpeedMph,
    units,resources,baseCp:quote.baseCp,crewWagesCp:quote.crewWagesCp,
    overtimeCrewCp:quote.overtimeCrewCp,totalCp:quote.totalCp,belowMinimum:capacity.belowMinimum});
  return {capacity,quote,approval};
}

const validApprovalName=name=>typeof name==="string"&&name.trim().length>0&&name.length<=240&&
  !/[\u0000-\u001f]/.test(name);
const approvalMoney=n=>Number.isFinite(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER;
const approvalError=()=>{throw Error("Invalid approved owned vehicle service.");};

/** Historical validation needs only the captured rules and unit evidence.
 * Do not use the current Group roster, World prices or crew policy here. */
export function validateOwnedVehicleApproval(raw){
  if(!raw||raw.schemaVersion!==1||!safeId(raw.methodId)||
      !GROUP_TRANSPORT_SURFACES.includes(raw.surface)||
      !Array.isArray(raw.units)||!raw.units.length||raw.units.length>1000||
      !Array.isArray(raw.resources)||!raw.resources.length||raw.resources.length>MAX_MEMBERS||
      !integer(raw.passengerSeats,0,1000)||!integer(raw.passengerCapacity,1,1000000)||
      raw.passengerSeats>raw.passengerCapacity||
      ![raw.movingHours,raw.distanceMi,raw.baseCp,raw.crewWagesCp,raw.overtimeCrewCp,raw.totalCp].every(approvalMoney))
    approvalError();
  const method={id:raw.methodId,kind:"vehicle",surface:raw.surface,continuousEnabled:true,
    overtimeEnabled:true,overtimeExtraHours:raw.dailyHours-8,overtimeMultiplier:raw.overtimeMultiplier};
  const schedule=resolveTransportationOperation(method,raw.operation,raw.regularHours);
  if(raw.dailyHours!==schedule.dailyHours||raw.overnightHours!==schedule.overnightHours||
      raw.billingDayHours!==(raw.operation==="continuous"?raw.regularHours:schedule.dailyHours)||
      raw.overtimeMultiplier!==schedule.overtimeMultiplier)approvalError();
  const days=raw.movingHours===0?0:Math.ceil(Math.max(0,raw.movingHours-1e-7)/raw.billingDayHours);
  const seen=new Set(),named=new Set(),byResource=new Map();
  let seats=0,speed=Infinity,belowMinimum=false;
  for(const unit of raw.units){
    if(!unit||!safeId(unit.actorId)||!integer(unit.unitIndex,1,100)||
        !validApprovalName(unit.name)||!integer(unit.capacity,1,1000)||
        !validTravelSpeedOverride(unit.speedMph)||unit.speedMph===null||
        !integer(unit.requiredCrew,0,1000)||typeof unit.configured!=="boolean"||
        typeof unit.wagesEnabled!=="boolean"||!Array.isArray(unit.namedCrew)||unit.namedCrew.length>MAX_MEMBERS||
        !["day","trip","mile"].includes(unit.crewWageBasis)||
        !approvalMoney(unit.crewWageCpPerDay)||unit.crewWageCpPerDay>100000000||
        !approvalMoney(unit.crewWagesCp)||unit.crewDays!==days||!integer(unit.paidCrew,0,1000))
      approvalError();
    const key=unit.actorId+":"+unit.unitIndex;
    if(seen.has(key))approvalError();
    seen.add(key);
    const {minimum,optimal,excellent,full}=unit.thresholds??{};
    const policy={crewCount:unit.requiredCrew,crewThresholds:{minimum,optimal,excellent}};
    if(full!==unit.requiredCrew)approvalError();
    resolveCrewThresholds(policy);
    let pcs=0,npcs=0;
    for(const crew of unit.namedCrew){
      if(!safeId(crew?.actorId)||named.has(crew.actorId)||!validApprovalName(crew.name)||
          !["character","npc"].includes(crew.actorType)||
          crew.duty!==undefined&&(typeof crew.duty!=="string"||crew.duty.length>80||
            /[\u0000-\u001f]/.test(crew.duty)))approvalError();
      named.add(crew.actorId);
      if(crew.actorType==="character")pcs++;else npcs++;
    }
    const staffed=pcs+npcs+unit.hiredCrew;
    if(unit.configured){
      if(!integer(unit.hiredCrew,0,1000)||unit.pcCrew!==pcs||unit.npcCrew!==npcs||
          unit.staffedCrew!==staffed||staffed>full||unit.tier!==classifyCrewStaffing(policy,staffed)||
          unit.paidCrew!==(unit.wagesEnabled?npcs+unit.hiredCrew:0))approvalError();
    }else if(unit.namedCrew.length||[unit.staffedCrew,unit.pcCrew,unit.npcCrew,unit.hiredCrew,unit.tier]
      .some(v=>v!==null)||unit.paidCrew!==(unit.wagesEnabled?full:0))approvalError();
    const periods=unit.crewWageBasis==="trip"?(raw.movingHours>0?1:0):
      unit.crewWageBasis==="mile"?raw.distanceMi:days;
    if(unit.crewWagesCp!==unit.paidCrew*unit.crewWageCpPerDay*periods)approvalError();
    seats+=unit.capacity;speed=Math.min(speed,unit.speedMph);
    belowMinimum ||= unit.tier==="below-minimum";
    if(!byResource.has(unit.actorId))byResource.set(unit.actorId,[]);
    byResource.get(unit.actorId).push(unit);
  }
  if(raw.passengerCapacity!==seats||raw.speedMph!==speed||raw.belowMinimum!==belowMinimum||
      raw.resources.length!==byResource.size)approvalError();
  const resources=new Set();
  let passengers=0,amount=0;
  for(const row of raw.resources){
    const units=byResource.get(row?.actorId);
    if(!units||resources.has(row.actorId)||row.quantity!==units.length||
        !integer(row.passengers,0,units.reduce((n,u)=>n+u.capacity,0))||
        !approvalMoney(row.costCp)||row.costCp>100000000||
        !["none","day","mile"].includes(row.costBasis)||!["unit","passenger"].includes(row.costApplies)||
        units.some(u=>u.crewWageBasis!==row.crewWageBasis)||
        row.crewWagesCp!==units.reduce((n,u)=>n+u.crewWagesCp,0)||
        row.recurringCp!==projectedGroupFare(row,{quantity:row.quantity,passengers:row.passengers,
          distanceMi:raw.distanceMi,hours:raw.movingHours,dayHours:raw.billingDayHours}))
      approvalError();
    resources.add(row.actorId);passengers+=row.passengers;amount+=row.recurringCp+row.crewWagesCp;
  }
  if(passengers!==raw.passengerSeats||!approvalMoney(amount))approvalError();
  const quote=quoteTransportationService(method,{arrangement:"owned",operation:raw.operation,
    movingHours:raw.movingHours,distanceMi:raw.distanceMi,travelers:raw.passengerSeats,
    ownedQuote:{quantity:raw.units.length,amount,breakdown:raw.resources},regularHours:raw.regularHours});
  if(["baseCp","crewWagesCp","overtimeCrewCp","totalCp"].some(key=>raw[key]!==quote[key]))approvalError();
  return structuredClone(raw);
}
