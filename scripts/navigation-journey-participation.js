/** Durable, narrative-only Journey participation; no Foundry document writes. */
import {partyTravelerRoster} from "./navigation-party-selection.js";
import {validateConfirmedOwnedVehicleApproval} from "./navigation-group-transport.js";

const id=value=>typeof value==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
const safeName=value=>typeof value==="string"&&value.trim().length>0&&
  value.length<=120&&!/[\u0000-\u001f]/.test(value);
const key=value=>typeof value==="string"&&/^(owned|hire)\|[A-Za-z0-9_-]{1,128}$/.test(value);

/** Only crew named on the confirmed operated units join this leg. */
function ownedCrewMembers(roster,approval){
  const named=approval.units.flatMap(unit=>unit.namedCrew);
  const members=new Map();
  for(const crew of named){
    const matches=roster?.members?.filter(m=>m.actorId===crew.actorId)??[];
    const member=matches[0];
    if(matches.length!==1||member.enabled===false||member.actorType!==crew.actorType||
        !(member.actorType==="character"&&member.role==="passenger"||
          member.actorType==="npc"&&["passenger","crew","unassigned"].includes(member.role)))
      throw Error("The Group roster changed. Review the named crew before approving.");
    members.set(crew.actorId,member);
  }
  return members;
}

function assertOwnedParticipation(manifest,approval){
  const traveling=manifest.people.filter(person=>person.traveling);
  if(traveling.some(person=>person.methodKey!=="owned|"+approval.methodId)||
      traveling.reduce((sum,person)=>sum+person.seats,0)!==approval.passengerSeats||
      approval.units.flatMap(unit=>unit.namedCrew).some(crew=>
        !traveling.some(person=>person.actorId===crew.actorId)))
    throw Error("The owned vehicle crew, passenger seats or method differs from the approved service.");
}

/** Treat the complete live native Group roster as the source of membership. */
export function createJourneyParticipation(roster,selectedIds,{methodKey,assignments={},
  checkpointId=null,ownedApproval}={}){
  const approval=ownedApproval===undefined?null:validateConfirmedOwnedVehicleApproval(ownedApproval);
  if(approval&&methodKey!=="owned|"+approval.methodId)
    throw Error("The owned vehicle approval differs from the selected method.");
  const crew=approval?ownedCrewMembers(roster,approval):new Map();
  const members=partyTravelerRoster(roster);
  if((!members.length&&!crew.size)||members.length>150||new Set(members.map(m=>m.id)).size!==members.length)
    throw Error("Cannot approve a Journey without a valid unique Group roster.");
  if(!Array.isArray(selectedIds)||selectedIds.length===0&&!crew.size||
    selectedIds.length>members.length||new Set(selectedIds).size!==selectedIds.length||
    selectedIds.some(value=>!id(value)))
    throw Error("Choose at least one unique Group traveler before approving.");
  const known=new Set(members.map(m=>m.id));
  if(selectedIds.some(value=>!known.has(value)))
    throw Error("The Group roster changed. Review each traveler before approving.");
  if(checkpointId!==null&&!id(checkpointId))
    throw Error("Invalid Journey departure checkpoint.");
  const selected=new Set(selectedIds);
  for(const [actorId,member] of crew){
    if(known.has(actorId)){
      if(!selected.has(actorId))throw Error("Named crew must be traveling on the selected operated unit.");
    }else{
      members.push({id:actorId,name:String(member.actorName??"Unnamed traveler").slice(0,120),seats:0});
      selected.add(actorId);
    }
  }
  const people=members.map(member=>({
    actorId:member.id,name:member.name,traveling:selected.has(member.id),
    seats:crew.has(member.id)?Math.max(0,member.seats-1):member.seats,
    methodKey:selected.has(member.id)?assignments[member.id]??methodKey:null
  }));
  const manifest=validateJourneyParticipation({schemaVersion:1,checkpointId,people});
  if(approval)assertOwnedParticipation(manifest,approval);
  return manifest;
}

/** Existing Journeys without participation metadata remain readable unchanged. */
export function validateJourneyParticipation(value){
  if(!value||value.schemaVersion!==1||
    value.checkpointId!==null&&value.checkpointId!==undefined&&!id(value.checkpointId)||
    !Array.isArray(value.people)||!value.people.length||value.people.length>150)
    throw Error("Invalid saved Journey participation.");
  const seen=new Set();
  let selected=0;
  for(const person of value.people){
    if(!id(person?.actorId)||seen.has(person.actorId)||!safeName(person.name)||
      typeof person.traveling!=="boolean"||
      !Number.isInteger(person.seats)||person.seats<0||person.seats>100||
      (person.traveling?!key(person.methodKey):person.methodKey!==null))
      throw Error("Invalid saved Journey traveler or method assignment.");
    seen.add(person.actorId);
    if(person.traveling)selected++;
  }
  if(!selected)throw Error("A Journey leg must include at least one traveler.");
  return structuredClone(value);
}

/** Historical approval stays fixed; only the next unapproved leg can change. */
export function priorJourneySelection(record,liveRoster){
  const prior=record?.legs?.at(-1)?.participation;
  if(!prior)return null;
  const approved=validateJourneyParticipation(prior);
  const live=new Set(partyTravelerRoster(liveRoster).map(m=>m.id));
  const owned=record.legs.at(-1).transport?.ownedApproval;
  const approval=owned===undefined?null:validateConfirmedOwnedVehicleApproval(owned);
  const crew=approval?ownedCrewMembers(liveRoster,approval):new Map();
  if(approval)assertOwnedParticipation(approved,approval);
  if(approved.people.some(person=>!live.has(person.actorId)&&!crew.has(person.actorId)))
    throw Error("The Group roster changed since the approved Journey. Review the saved manifest.");
  // The next draft uses passenger IDs only; named non-passengers join via its own operated units.
  return approved.people.filter(person=>person.traveling&&live.has(person.actorId)).map(person=>person.actorId);
}
