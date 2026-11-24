/** Durable, narrative-only Journey participation; no Foundry document writes. */
import {partyTravelerRoster} from "./navigation-party-selection.js";

const id=value=>typeof value==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
const safeName=value=>typeof value==="string"&&value.trim().length>0&&
  value.length<=120&&!/[\u0000-\u001f]/.test(value);
const key=value=>typeof value==="string"&&/^(owned|hire)\|[A-Za-z0-9_-]{1,128}$/.test(value);

/** Treat the complete live native Group roster as the source of membership. */
export function createJourneyParticipation(roster,selectedIds,{methodKey,assignments={},
  checkpointId=null}={}){
  const members=partyTravelerRoster(roster);
  if(!members.length||members.length>150||new Set(members.map(m=>m.id)).size!==members.length)
    throw Error("Cannot approve a Journey without a valid unique Group roster.");
  if(!Array.isArray(selectedIds)||selectedIds.length===0||
    selectedIds.length>members.length||new Set(selectedIds).size!==selectedIds.length||
    selectedIds.some(value=>!id(value)))
    throw Error("Choose at least one unique Group traveler before approving.");
  const known=new Set(members.map(m=>m.id));
  if(selectedIds.some(value=>!known.has(value)))
    throw Error("The Group roster changed. Review each traveler before approving.");
  if(checkpointId!==null&&!id(checkpointId))
    throw Error("Invalid Journey departure checkpoint.");
  const selected=new Set(selectedIds);
  const people=members.map(member=>({
    actorId:member.id,name:member.name,traveling:selected.has(member.id),
    seats:member.seats,
    methodKey:selected.has(member.id)?assignments[member.id]??methodKey:null
  }));
  return validateJourneyParticipation({schemaVersion:1,checkpointId,people});
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
  if(approved.people.some(person=>!live.has(person.actorId)))
    throw Error("The Group roster changed since the approved Journey. Review the saved manifest.");
  return approved.people.filter(person=>person.traveling).map(person=>person.actorId);
}
