/**
 * Pure read-only D&D5e Group transportation projection plus versioned Atlas
 * World-only assignments (read-only v1/v2/v3 to v4 normalization). Native Group members, currencies and Actor documents
 * are never modified. NPCs are intentionally unclassified until a GM chooses.
 */
export const GROUP_TRANSPORT_SETTING="guidedGroupTransportation";
import { projectedGroupFare } from "./navigation-currency.js";

export const GROUP_TRANSPORT_VERSION=4;
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

export function defaultGroupTransportation(){return {version:GROUP_TRANSPORT_VERSION,groups:{}};}

export function validateGroupTransportation(input){
  if(!input||typeof input!=="object"||Array.isArray(input)||
      ![1,2,3,GROUP_TRANSPORT_VERSION].includes(input.version)||
      !input.groups||typeof input.groups!=="object"||Array.isArray(input.groups)||
      Object.keys(input.groups).length>MAX_GROUPS)
    throw new Error("Invalid Atlas Group transportation configuration.");
  const output=defaultGroupTransportation();
  for(const [groupId,group] of Object.entries(input.groups)){
    if(!safeId(groupId)||!group||typeof group!=="object"||Array.isArray(group)||
        !group.members||typeof group.members!=="object"||Array.isArray(group.members)||
        Object.keys(group.members).length>MAX_MEMBERS)
      throw new Error("Invalid Atlas Group transportation roster.");
    const members={};
    for(const [actorId,entry] of Object.entries(group.members)){
      if(!safeId(actorId)||!entry||typeof entry!=="object"||Array.isArray(entry)||
          !GROUP_TRANSPORT_ROLES.includes(entry.role)||
          !integer(entry.quantity,1,100)||
          !(entry.capacity===null||integer(entry.capacity,1,1000))||
          !GROUP_TRANSPORT_SURFACES.includes(entry.surface)||
          !validProfileId(entry.profileId??null)||
          !validTravelSpeedOverride(entry.speedMphOverride??null)||
          !validMoneyOverride(entry.costCpOverride??null)||
          !validBasisOverride(entry.costBasisOverride??null)||
          !validAppliesOverride(entry.costAppliesOverride??null)||
          !validPurchaseOverride(entry.purchaseGpOverride??null)||
          !validNoteOverride(entry.noteOverride??null))
        throw new Error("Invalid Atlas Group member transportation assignment.");
      members[actorId]={role:entry.role,quantity:entry.quantity,
        capacity:entry.capacity,surface:entry.surface,profileId:entry.profileId??null,
        speedMphOverride:entry.speedMphOverride??null,
        costCpOverride:entry.costCpOverride??null,
        costBasisOverride:entry.costBasisOverride??null,
        costAppliesOverride:entry.costAppliesOverride??null,
        purchaseGpOverride:entry.purchaseGpOverride??null,
        noteOverride:entry.noteOverride??null};
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
export function setGroupTransportationMember(input,groupId,actorId,entry){
  if(!safeId(groupId)||!safeId(actorId))throw new Error("A valid Group and Actor ID are required.");
  const current=validateGroupTransportation(input);
  const next={...current,groups:{...current.groups}};
  const prior=next.groups[groupId]??{members:{}};
  next.groups[groupId]={members:{...prior.members,[actorId]:{...entry}}};
  return validateGroupTransportation(next);
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
    const capacity=vehicle?saved?.capacity??passengerMaximum(actor):
      role==="mount"?(saved?.capacity??1):null;
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
    members.push({actorId:actor.id,actorName:actor.name??"Unnamed Actor",
      actorType:actor.type,role,quantity,capacity,surface,profileId,
      speedMphOverride,costCpOverride,costBasisOverride,costAppliesOverride,
      purchaseGpOverride,noteOverride,
      primaryVehicle:Boolean(vehicle&&group.system?.primaryVehicle?.id===actor.id),
      configured:Boolean(saved)});
  }
  const travelers=members.reduce((sum,m)=>
    sum+(m.role==="passenger"?m.quantity:0),0);
  const unclassified=members.filter(m=>m.role==="unassigned").length;
  const resources=members.filter(m=>m.role==="mount"||m.role==="vehicle");
  const capacityBySurface=Object.fromEntries(GROUP_TRANSPORT_SURFACES.map(surface=>[
    surface,resources.filter(m=>m.surface===surface).reduce((total,m)=>
      total+(m.capacity??0)*m.quantity,0)
  ]));
  return {groupId,groupName:group.name??"The Party",members,
    travelers,unclassified,capacityBySurface};
}
/** UI estimates do not imply boarding or approve mixed travel. */
export function groupTravelCapacityStatus(projection,surface){
  if(!GROUP_TRANSPORT_SURFACES.includes(surface))throw new Error("Unknown travel surface.");
  const seats=projection.capacityBySurface[surface]??0;
  const unknown=projection.members.filter(m=>
    (m.role==="vehicle"||m.role==="mount")&&m.surface===surface&&m.capacity===null).length;
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
  return {...method,capacity:resource.capacity??method.capacity,
    speedMph:resource.speedMphOverride??method.speedMph,
    costCp:resource.costCpOverride??method.costCp,
    costBasis:resource.costBasisOverride??method.costBasis,
    costApplies:resource.costAppliesOverride??method.costApplies,
    purchaseGp:purchase==="none"?null:(purchase??method.purchaseGp),
    note:resource.noteOverride??method.note};
}

/** Match a specific method to relevant Group resources, not every vehicle on
 * the same road surface. The generic Mounted option accepts all GM-marked mounts. */
export function groupMethodCapacityStatus(projection,method){
  const relevant=matchingResources(projection,method);
  const seats=relevant.reduce((sum,m)=>sum+(m.capacity??0)*m.quantity,0);
  const quantity=relevant.reduce((sum,m)=>sum+m.quantity,0);
  const unknown=relevant.filter(m=>m.capacity===null).length;
  // With no individual boarding assignments, assume every matching resource joins
  // the convoy. The slowest participating resource determines its estimated pace.
  const speeds=relevant.map(m=>m.speedMphOverride??method.speedMph)
    .filter(speed=>typeof speed==="number"&&Number.isFinite(speed)&&speed>0);
  const effectiveSpeedMph=speeds.length?Math.min(...speeds):null;
  return {travelers:projection.travelers,seats,
    missing:Math.max(0,projection.travelers-seats),unknown,
    matched:relevant.length,quantity,effectiveSpeedMph,
    sufficient:projection.travelers>0&&projection.travelers<=seats};
}

/** Display-only per-resource planning quote. For per-passenger overrides,
 * passengers are allocated across available seats in stable Group roster order;
 * no actual boarding or currency mutation occurs. */
export function groupMethodFareEstimate(projection,method,{hours,distanceMi,dayHours}){
  const resources=matchingResources(projection,method);
  if(!Number.isFinite(hours)||hours<0||!Number.isFinite(distanceMi)||distanceMi<0||
      !Number.isFinite(dayHours)||dayHours<=0||dayHours>24)
    throw new Error("Invalid Group transportation cost inputs.");
  let remaining=projection.travelers,amount=0;
  const breakdown=[];
  for(const member of resources){
    const effective=effectiveGroupResourceMethod(member,method);
    const seats=(member.capacity??0)*member.quantity;
    const passengers=Math.min(remaining,seats);
    remaining-=passengers;
    const cost=projectedGroupFare(effective,{quantity:member.quantity,
      passengers,distanceMi,hours,dayHours});
    const crewDays=hours===0?0:Math.ceil(Math.max(0,hours-1e-7)/dayHours);
    const wages=effective.includeCrewWages?
      crewDays*(effective.crewCount??0)*(effective.crewWageCpPerDay??200)*member.quantity:0;
    if(!Number.isFinite(wages)||wages<0||!Number.isSafeInteger(Math.ceil(amount+cost+wages)))
      throw new Error("Invalid projected crew wage total.");
    amount+=cost+wages;
    breakdown.push({actorId:member.actorId,name:member.actorName,
      quantity:member.quantity,passengers,costCp:effective.costCp,
      costBasis:effective.costBasis,costApplies:effective.costApplies,
      recurringCp:cost,crewWagesCp:wages,crewDays,amount:cost+wages});
  }
  return {amount,breakdown,unseated:remaining,quantity:resources.reduce((n,m)=>n+m.quantity,0)};
}
