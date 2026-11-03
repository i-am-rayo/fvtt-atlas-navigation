/**
 * Pure read-only D&D5e Group transportation projection plus versioned Atlas
 * World-only assignments. Native Group members, currencies and Actor documents
 * are never modified. NPCs are intentionally unclassified until a GM chooses.
 */
export const GROUP_TRANSPORT_SETTING="guidedGroupTransportation";
export const GROUP_TRANSPORT_VERSION=1;
export const GROUP_TRANSPORT_ROLES=Object.freeze([
  "unassigned","mount","passenger","crew","pack","ignore"
]);
export const GROUP_TRANSPORT_SURFACES=Object.freeze(["land","water","air"]);
const MAX_GROUPS=100,MAX_MEMBERS=150;
const safeId=id=>typeof id==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(id);
const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);

export function defaultGroupTransportation(){return {version:GROUP_TRANSPORT_VERSION,groups:{}};}

export function validateGroupTransportation(input){
  if(!input||typeof input!=="object"||Array.isArray(input)||
      input.version!==GROUP_TRANSPORT_VERSION||
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
          !GROUP_TRANSPORT_SURFACES.includes(entry.surface))
        throw new Error("Invalid Atlas Group member transportation assignment.");
      members[actorId]={role:entry.role,quantity:entry.quantity,
        capacity:entry.capacity,surface:entry.surface};
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
export function projectGroupTransportation(group,settings=defaultGroupTransportation()){
  const data=validateGroupTransportation(settings);
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
    const surface=saved?.surface??actorSurface(actor);
    members.push({actorId:actor.id,actorName:actor.name??"Unnamed Actor",
      actorType:actor.type,role,quantity,capacity,surface,
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

/** Match a specific method to relevant Group resources, not every vehicle on
 * the same road surface. The generic Mounted option accepts all GM-marked mounts. */
export function groupMethodCapacityStatus(projection,method){
  if(!method||!GROUP_TRANSPORT_SURFACES.includes(method.surface))
    throw new Error("A valid transport method is required.");
  const relevant=projection.members.filter(m=>{
    if(m.surface!==method.surface)return false;
    if(method.id==="mounted")return m.role==="mount";
    return (m.role==="mount"||m.role==="vehicle")&&
      m.actorName.toLowerCase()===String(method.name??"").toLowerCase();
  });
  const seats=relevant.reduce((sum,m)=>sum+(m.capacity??0)*m.quantity,0);
  const quantity=relevant.reduce((sum,m)=>sum+m.quantity,0);
  const unknown=relevant.filter(m=>m.capacity===null).length;
  return {travelers:projection.travelers,seats,
    missing:Math.max(0,projection.travelers-seats),unknown,
    matched:relevant.length,quantity,sufficient:projection.travelers>0&&projection.travelers<=seats};
}
