import test from "node:test";
import assert from "node:assert/strict";
import {groupLivestockResources,planJourneyLivestock,validateJourneyLivestock,
  suggestedLivestockBoarding,assertRecoveredLivestock}
  from "../scripts/navigation-journey-livestock.js";
const roster={members:[
  {role:"passenger",actorId:"p",actorName:"Cassian",quantity:1},
  {role:"mount",actorId:"a",actorName:"Warhorse",quantity:1,enabled:true},
  {role:"mount",actorId:"b",actorName:"Riding Horse",quantity:2,enabled:true}
]};
test("three physical mounts require a decision each; never mutate Group inventory",()=>{
  const saved=structuredClone(roster);
  const plan=planJourneyLivestock(roster,{a:1,b:2},{surface:"water",methodId:"ship-passage",
    units:1,capacityPerUnit:3,fareCp:300});
  assert.equal(plan.resources.reduce((n,r)=>n+r.aboard,0),3);
  assert.equal(plan.estimatedFareCp,300);
  assert.deepEqual(roster,saved);
  assert.deepEqual(validateJourneyLivestock(plan),plan);
  assert.throws(()=>planJourneyLivestock(roster,{a:1},{surface:"water",
    methodId:"ship-passage",units:1,capacityPerUnit:3}),/Decide/);
  assert.throws(()=>planJourneyLivestock(roster,{a:1,b:2},{surface:"water",
    methodId:"ship-passage",units:1,capacityPerUnit:2}),/insufficient/);
  assert.throws(()=>planJourneyLivestock(roster,{a:1,b:2},{surface:"water",
    methodId:"ship-passage",units:1,capacityPerUnit:null}),/insufficient/);
  assert.throws(()=>planJourneyLivestock(roster,{a:1,b:3},{surface:"water",
    methodId:"ship-passage",units:1,capacityPerUnit:3}),/quantity/);
  assert.throws(()=>planJourneyLivestock(roster,{a:0,b:0,ghost:1},{surface:"water",
    methodId:"ship-passage",units:1,capacityPerUnit:3}),/no longer/);
  const stayed=planJourneyLivestock(roster,{a:0,b:0},{surface:"water",
    methodId:"ship-passage",units:1,capacityPerUnit:null});
  assert.equal(stayed.resources.reduce((n,m)=>n+m.aboard,0),0);
});
test("next leg suggests prior mount boarding but reapproval and roster checks remain required",()=>{
  const convoy={methods:[{resourceIds:["a","b"]}]};
  assert.deepEqual(suggestedLivestockBoarding({legs:[{convoy}]},roster),{a:1},
    "plural Actor quantities cannot be inferred from one resource ID");
  const boarded=planJourneyLivestock(roster,{a:1,b:0},{surface:"water",
    methodId:"ship-passage",units:1,capacityPerUnit:1});
  const journal={legs:[{livestock:boarded}]};
  assert.deepEqual(suggestedLivestockBoarding(journal,roster),{a:1,b:0});
  assert.deepEqual(assertRecoveredLivestock(journal,roster),boarded);
  const edited=structuredClone(roster);edited.members[2].quantity=3;
  assert.throws(()=>assertRecoveredLivestock(journal,edited),/differs/);
});
