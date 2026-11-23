import test from "node:test";
import assert from "node:assert/strict";
import {createJourneyParticipation,validateJourneyParticipation,priorJourneySelection}
  from "../scripts/navigation-journey-participation.js";
const roster={travelers:3,members:[
  {actorId:"alba",actorName:"Alba",role:"passenger",actorType:"character"},
  {actorId:"kori",actorName:"Kori",role:"passenger",actorType:"character"},
  {actorId:"nyx",actorName:"Nyx",role:"passenger",actorType:"npc",needsSeat:false}
]};
test("participation is narrative-only and preserves excluded members and names",()=>{
  const before=structuredClone(roster);
  const manifest=createJourneyParticipation(roster,["alba","nyx"],{
    methodKey:"hire|ship",checkpointId:"dock"});
  assert.equal(manifest.schemaVersion,1);
  assert.deepEqual(manifest.people.map(p=>[p.actorId,p.traveling,p.methodKey]),[
    ["alba",true,"hire|ship"],["kori",false,null],["nyx",true,"hire|ship"]]);
  assert.equal(manifest.people[2].seats,0);
  assert.deepEqual(roster,before);
  assert.deepEqual(validateJourneyParticipation(manifest),manifest);
});
test("a new leg inherits only selected traveler ids as an editable preview",()=>{
  const first=createJourneyParticipation(roster,["alba"],{methodKey:"owned|walking"});
  const record={legs:[{participation:first}]};
  assert.deepEqual(priorJourneySelection(record,roster),["alba"]);
  assert.equal(priorJourneySelection({legs:[{}]},roster),null);
});
test("stale IDs, duplicates, empty travel, tampered method, and missing roster fail closed",()=>{
  assert.throws(()=>createJourneyParticipation(roster,[],{methodKey:"owned|walking"}),/at least one/);
  assert.throws(()=>createJourneyParticipation(roster,["alba","alba"],{methodKey:"owned|walking"}),/unique/);
  assert.throws(()=>createJourneyParticipation(roster,["absent"],{methodKey:"owned|walking"}),/roster changed/);
  const approved=createJourneyParticipation(roster,["alba"],{methodKey:"owned|walking"});
  approved.people[0].methodKey="unsupported";
  assert.throws(()=>validateJourneyParticipation(approved),/Invalid/);
  const record={legs:[{participation:createJourneyParticipation(roster,["alba"],{
    methodKey:"owned|walking"})}]};
  assert.throws(()=>priorJourneySelection(record,{...roster,
    members:roster.members.filter(m=>m.actorId!=="alba")}),/roster changed/);
});
