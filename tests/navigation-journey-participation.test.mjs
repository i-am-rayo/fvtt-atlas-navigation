import test from "node:test";
import assert from "node:assert/strict";
import {planOwnedVehicleService} from "../scripts/navigation-group-transport.js";
import {createJourneyParticipation,validateJourneyParticipation,priorJourneySelection}
  from "../scripts/navigation-journey-participation.js";
import {createJourneyRecord,resumeJourneyRecord,validateJourneyRecord,formatJourneyJournalHTML}
  from "../scripts/navigation-journey-journal.js";
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

const itinerary=participation=>({
  schemaVersion:1,scene:{name:"Paedor",units:"mi"},
  endpoints:{departure:{x:0,y:0},destination:{x:30,y:0}},
  measurements:{distance:30,travelHours:10,terrainAware:false},
  travel:{speedPerHour:3},directions:[{kind:"road",instruction:"Continue",
    distance:30,cost:30,roadId:"road"}],
  ...(participation?{participation}:{})
});
test("Journal validates confirmed participation and preserves legacy schema-one legs",()=>{
  const selection=createJourneyParticipation(roster,["alba"],{
    methodKey:"owned|walking"});
  const record=createJourneyRecord({sceneId:"scene",tokenId:"group",
    atlasRevision:7,itinerary:itinerary(selection)});
  assert.deepEqual(validateJourneyRecord(record).legs[0].participation,selection);
  assert.equal(createJourneyRecord({sceneId:"scene",tokenId:"group",
    atlasRevision:7,itinerary:itinerary()}).legs[0].participation,undefined);
  const tampered=structuredClone(record);
  tampered.legs[0].participation.people[0].methodKey="wrong";
  assert.throws(()=>validateJourneyRecord(tampered),/invalid recovery metadata/i);
  assert.doesNotMatch(formatJourneyJournalHTML(record),/Confirmed Travelers/,
    "planned or unconfirmed participation must never appear as confirmed travel");
  const confirmed=structuredClone(record);
  confirmed.legs[0].completedMovingHours=1;confirmed.legs[0].completedPercent=10;
  const html=formatJourneyJournalHTML(confirmed);
  assert.match(html,/Confirmed Travelers/);
  assert.match(html,/Alba — Traveling/);
  assert.match(html,/Kori — Not traveling/);
  assert.match(html,/native Group membership is unchanged/);
});
test("interrupted leg cannot change approved manifest; finished next leg can",()=>{
  const selection=createJourneyParticipation(roster,["alba"],{
    methodKey:"owned|walking"});
  const replaced=createJourneyParticipation(roster,["alba","kori"],{
    methodKey:"hire|ship"});
  const record=createJourneyRecord({sceneId:"scene",tokenId:"group",
    atlasRevision:7,itinerary:itinerary(selection)});
  assert.throws(()=>resumeJourneyRecord(record,{atlasRevision:7,
    itinerary:itinerary(replaced)}),/cannot change approved Journey participation/);
  const continuing=resumeJourneyRecord(record,{atlasRevision:7,
    itinerary:itinerary(selection)});
  assert.deepEqual(continuing.legs[1].participation,selection);
  const completedLeg=structuredClone(record);
  completedLeg.status="paused";completedLeg.legs[0].completedPercent=100;
  completedLeg.legs[0].completedMovingHours=10;
  const next=resumeJourneyRecord(completedLeg,{atlasRevision:7,
    itinerary:itinerary(replaced)});
  assert.deepEqual(next.legs[0].participation,selection,
    "existing leg history cannot be overwritten by the next draft");
  assert.deepEqual(next.legs[1].participation,replaced);
});

const vesselMethod={id:"warship",name:"Warship",kind:"vehicle",surface:"water",
  speedMph:5,capacity:2,crewCount:60,costCp:0,costBasis:"none",costApplies:"unit",
  includeCrewWages:true,crewWageCpPerDay:200,crewWageBasis:"day"};
const staffedRoster={travelers:2,members:[
  {actorId:"pc",actorName:"Captain",actorType:"character",role:"passenger",quantity:1,needsSeat:true,enabled:true},
  {actorId:"guest",actorName:"Guest",actorType:"character",role:"passenger",quantity:1,needsSeat:true,enabled:true},
  {actorId:"sailor",actorName:"Sailor",actorType:"npc",role:"crew",quantity:1,enabled:true},
  {actorId:"mate",actorName:"Mate",actorType:"npc",role:"unassigned",quantity:1,enabled:true},
  {actorId:"idle",actorName:"Idle",actorType:"npc",role:"crew",quantity:1,enabled:true},
  {actorId:"ship",actorName:"Warship",actorType:"vehicle",role:"vehicle",quantity:1,capacity:2,
    surface:"water",profileId:"warship",enabled:true,crewRoster:[{unitIndex:1,named:[
      {actorId:"pc",duty:"Captain"},{actorId:"sailor"},{actorId:"mate"}],hired:10}]}
]};
function staffedApproval(roster,selectedIds){
  const draft=planOwnedVehicleService({...roster,selectedTravelerIds:selectedIds},vesselMethod,{
    operatedUnits:[{actorId:"ship",unitIndex:1}],movingHours:8,distanceMi:40,regularHours:8}).approval;
  return {...draft,belowMinimumAcknowledged:draft.belowMinimum};
}
test("owned leg participation includes named crew once without passenger seats and restores passenger selection",()=>{
  const before=structuredClone(staffedRoster);
  const approved=staffedApproval(staffedRoster,["pc","guest"]);
  const opts={methodKey:"owned|warship",ownedApproval:approved};
  const manifest=createJourneyParticipation(staffedRoster,["pc","guest"],opts);
  assert.deepEqual(manifest.people.map(p=>[p.actorId,p.traveling,p.seats]).sort(),[
    ["guest",true,1],["mate",true,0],["pc",true,0],["sailor",true,0]]);
  assert.deepEqual(validateJourneyParticipation(manifest),manifest);
  const record={legs:[{participation:manifest,transport:{ownedApproval:approved}}]};
  assert.deepEqual(priorJourneySelection(record,staffedRoster).sort(),["guest","pc"]);
  assert.throws(()=>priorJourneySelection(record,{...staffedRoster,
    members:staffedRoster.members.filter(m=>m.actorId!=="sailor")}),/roster changed/i);
  assert.throws(()=>createJourneyParticipation(staffedRoster,["guest"],opts),/crew/i);
  assert.throws(()=>createJourneyParticipation(staffedRoster,["pc","guest"],{
    ...opts,methodKey:"owned|walking"}),/method/i);
  assert.throws(()=>createJourneyParticipation(staffedRoster,["pc","guest"],{
    ...opts,ownedApproval:{...approved,belowMinimumAcknowledged:false}}),/acknowledg/i);
  assert.deepEqual(staffedRoster,before);
});
test("an owned leg can include only eligible non-passenger named crew",()=>{
  const crewOnly={travelers:0,members:staffedRoster.members.filter(m=>!["pc","guest"].includes(m.actorId))
    .map(m=>m.actorId==="ship"?{...m,crewRoster:[{unitIndex:1,named:[{actorId:"sailor"}],hired:0}]}:m)};
  const approved=staffedApproval(crewOnly,[]);
  const manifest=createJourneyParticipation(crewOnly,[],{methodKey:"owned|warship",ownedApproval:approved});
  assert.deepEqual(manifest.people.map(p=>[p.actorId,p.traveling,p.seats]),[["sailor",true,0]]);
  assert.deepEqual(priorJourneySelection({legs:[{participation:manifest,transport:{ownedApproval:approved}}]},crewOnly),[]);
  assert.throws(()=>createJourneyParticipation(crewOnly,[],{methodKey:"owned|warship"}),/valid unique|at least one/i);
});

test("unfinished owned recovery requires its exact available units and historical manifest",()=>{
  const approved=staffedApproval(staffedRoster,["pc","guest"]);
  const manifest=createJourneyParticipation(staffedRoster,["pc","guest"],{
    methodKey:"owned|warship",ownedApproval:approved});
  const record={legs:[{completedPercent:25,participation:manifest,transport:{ownedApproval:approved}}]};
  for(const members of [
    staffedRoster.members.filter(m=>m.actorId!=="ship"),
    staffedRoster.members.map(m=>m.actorId==="ship"?{...m,enabled:false}:m),
    staffedRoster.members.map(m=>m.actorId==="ship"?{...m,quantity:0}:m)
  ]){
    assert.throws(()=>priorJourneySelection(record,{...staffedRoster,members}),/approved owned operating units.*no longer available/i);
  }
  const absent=structuredClone(record);delete absent.legs[0].participation;
  assert.throws(()=>priorJourneySelection(absent,staffedRoster),/approved owned vehicle traveler manifest.*unavailable/i);
  const completed=structuredClone(record);completed.legs[0].completedPercent=100;
  assert.deepEqual(priorJourneySelection(completed,{...staffedRoster,
    members:staffedRoster.members.filter(m=>m.actorId!=="ship")}).sort(),["guest","pc"],
    "the next unapproved leg need not retain a previously completed vessel");
  assert.deepEqual(priorJourneySelection(record,staffedRoster).sort(),["guest","pc"]);
});
