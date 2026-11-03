import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultGroupTransportation,validateGroupTransportation,
  setGroupTransportationMember,projectGroupTransportation,groupTravelCapacityStatus,
  groupMethodCapacityStatus
} from "../scripts/navigation-group-transport.js";

const actor=(id,name,type,system={})=>({id,name,type,system});
const pc=actor("pc1","Dr. Cassian","character");
const camel=actor("camel1","Camel","npc");
const camel2=actor("camel2","Camel","npc");
const warship=actor("ship1","Warship","vehicle",
  {passengers:{max:30},details:{type:"water"}});
const group=(members)=>({id:"group1",name:"The Party",type:"group",
  system:{members:members.map(actor=>({actor})),primaryVehicle:warship}});

test("Group projection distinguishes characters, unclassified NPCs and vehicles",()=>{
  const p=projectGroupTransportation(group([pc,camel,warship]));
  assert.equal(p.travelers,1,"a camel and ship are not extra party members");
  assert.equal(p.unclassified,1);
  assert.equal(p.capacityBySurface.water,30);
  assert.equal(p.capacityBySurface.land,0);
  assert.equal(p.members.find(m=>m.actorId==="ship1").primaryVehicle,true);
  assert.equal(groupTravelCapacityStatus(p,"land").missing,1);
});

test("one Camel Actor can stand for several physical animals",()=>{
  const saved=setGroupTransportationMember(defaultGroupTransportation(),
    "group1","camel1",{role:"mount",quantity:2,capacity:1,surface:"land"});
  const p=projectGroupTransportation(group([pc,camel,warship]),saved);
  assert.equal(p.travelers,1);
  assert.equal(p.capacityBySurface.land,2);
  assert.equal(p.members.find(m=>m.actorId==="camel1").quantity,2);
  assert.deepEqual(groupTravelCapacityStatus(p,"land"),
    {travelers:1,seats:2,missing:0,unknown:0,sufficient:true});
});

test("distinct Actors sharing the Camel name stay distinct; same Actor ID is counted once",()=>{
  let saved=defaultGroupTransportation();
  for(const [id,quantity] of [["camel1",2],["camel2",1]])
    saved=setGroupTransportationMember(saved,"group1",id,
      {role:"mount",quantity,capacity:1,surface:"land"});
  const p=projectGroupTransportation(group([pc,camel,camel,camel2]),saved);
  assert.equal(p.members.length,3);
  assert.equal(p.capacityBySurface.land,3,"2+1 physical mounts from different Actor IDs");
});

test("NPC passenger roles affect party size without counting mounts",()=>{
  let saved=defaultGroupTransportation();
  saved=setGroupTransportationMember(saved,"group1","camel1",
    {role:"mount",quantity:1,capacity:1,surface:"land"});
  saved=setGroupTransportationMember(saved,"group1","camel2",
    {role:"passenger",quantity:2,capacity:null,surface:"land"});
  const p=projectGroupTransportation(group([pc,camel,camel2]),saved);
  assert.equal(p.travelers,3);
  assert.equal(groupTravelCapacityStatus(p,"land").missing,2);
});

test("invalid roles, negative quantities and unknown surfaces fail closed",()=>{
  const good={role:"mount",quantity:1,capacity:1,surface:"land"};
  for(const patch of [{role:"vehicle"},{quantity:0},{quantity:1.1},
    {capacity:0},{capacity:-1},{surface:"space"}])
    assert.throws(()=>setGroupTransportationMember(defaultGroupTransportation(),
      "group1","camel1",{...good,...patch}),/Invalid/i);
  assert.deepEqual(validateGroupTransportation(defaultGroupTransportation()),
    defaultGroupTransportation());
  assert.throws(()=>projectGroupTransportation(actor("bad","Other","npc")),
    /Group Actor/i);
});

test("specific Camel route does not borrow available Warship passenger seats",()=>{
  const saved=setGroupTransportationMember(defaultGroupTransportation(),
    "group1","camel1",{role:"mount",quantity:2,capacity:1,surface:"land"});
  const p=projectGroupTransportation(group([pc,camel,warship]),saved);
  assert.equal(groupMethodCapacityStatus(p,{id:"camel",name:"Camel",surface:"land"}).seats,2);
  assert.equal(groupMethodCapacityStatus(p,{id:"warship",name:"Warship",surface:"water"}).seats,30);
  assert.equal(groupMethodCapacityStatus(p,{id:"sailing",name:"Sailing Ship",surface:"water"}).seats,0);
  assert.equal(groupMethodCapacityStatus(p,{id:"mounted",name:"Mounted (general)",surface:"land"}).seats,2);
});
