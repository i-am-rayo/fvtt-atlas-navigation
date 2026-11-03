import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultGroupTransportation,validateGroupTransportation,
  setGroupTransportationMember,projectGroupTransportation,groupTravelCapacityStatus,
  groupMethodCapacityStatus,readGroupTransportation
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

test("legacy v1 Group assignments are normalized without writing or losing quantities",()=>{
  const old={version:1,groups:{group1:{members:{
    camel1:{role:"mount",quantity:3,capacity:1,surface:"land"}
  }}}};
  const changes=[];
  const settings={get:()=>old,set:(...args)=>changes.push(args)};
  const migrated=readGroupTransportation(settings);
  assert.equal(migrated.version,3);
  assert.equal(migrated.groups.group1.members.camel1.quantity,3);
  assert.equal(migrated.groups.group1.members.camel1.profileId,null);
  assert.deepEqual(changes,[],"read must not persist migration");
});
test("stable transportation profile survives an NPC rename",()=>{
  const linked=setGroupTransportationMember(defaultGroupTransportation(),"group1","camel1",{
    role:"mount",quantity:3,capacity:1,surface:"land",profileId:"camel"
  });
  const renamed=actor("camel1","Biscuit","npc");
  const p=projectGroupTransportation(group([pc,renamed,warship]),linked);
  const capacity=groupMethodCapacityStatus(p,{id:"camel",name:"Camel",surface:"land"});
  assert.equal(capacity.seats,3);
  assert.equal(capacity.quantity,3);
  assert.equal(groupMethodCapacityStatus(p,{id:"riding-horse",name:"Riding Horse",surface:"land"}).seats,0);
});
test("v2 profile IDs are validated and remain optional for unassigned NPCs",()=>{
  const good={role:"mount",quantity:1,capacity:1,surface:"land"};
  assert.equal(setGroupTransportationMember(defaultGroupTransportation(),"group1","camel1",good)
    .groups.group1.members.camel1.profileId,null);
  assert.throws(()=>setGroupTransportationMember(defaultGroupTransportation(),"group1","camel1",
    {...good,profileId:"../../bad"}),/Invalid/);
});

test("legacy v2 Group settings upgrade in memory and preserve stable profiles",()=>{
  const previous={version:2,groups:{group1:{members:{
    camel1:{role:"mount",quantity:2,capacity:1,surface:"land",profileId:"camel"}
  }}}};
  const migrated=validateGroupTransportation(previous);
  assert.equal(migrated.version,3);
  assert.equal(migrated.groups.group1.members.camel1.profileId,"camel");
  assert.equal(migrated.groups.group1.members.camel1.speedMphOverride,null);
  assert.equal(previous.version,2,"migrating is read-only");
});

test("Group-only speed overrides are validated and use slowest matching mount",()=>{
  const original={id:"camel",name:"Camel",surface:"land",speedMph:3};
  let saved=defaultGroupTransportation();
  saved=setGroupTransportationMember(saved,"group1","camel1",
    {role:"mount",quantity:2,capacity:1,surface:"land",profileId:"camel",speedMphOverride:3.8});
  saved=setGroupTransportationMember(saved,"group1","camel2",
    {role:"mount",quantity:1,capacity:1,surface:"land",profileId:"camel",speedMphOverride:2.6});
  const roster=projectGroupTransportation(group([pc,camel,camel2]),saved);
  const matching=groupMethodCapacityStatus(roster,original);
  assert.equal(matching.seats,3);
  assert.equal(matching.effectiveSpeedMph,2.6);
  assert.equal(original.speedMph,3,"World profile remains untouched");
  const one=projectGroupTransportation(group([pc,camel]),saved);
  assert.equal(groupMethodCapacityStatus(one,original).effectiveSpeedMph,3.8);
  for(const bad of [-1,0,601,Number.NaN,Infinity,"3.5"])
    assert.throws(()=>setGroupTransportationMember(saved,"group1","camel1",
      {role:"mount",quantity:1,capacity:1,surface:"land",profileId:"camel",
        speedMphOverride:bad}),/Invalid/i);
});

test("profile surface wins when a World profile changes after Group assignment",()=>{
  const saved=setGroupTransportationMember(defaultGroupTransportation(),"group1","ship1",
    {role:"unassigned",quantity:1,capacity:30,surface:"water",profileId:"warship"});
  const before=projectGroupTransportation(group([pc,warship]),saved);
  assert.equal(before.capacityBySurface.water,30);
  const profile={id:"warship",name:"Warship",kind:"vehicle",surface:"air",speedMph:4};
  const after=projectGroupTransportation(group([pc,warship]),saved,[profile]);
  assert.equal(after.capacityBySurface.water,0);
  assert.equal(after.capacityBySurface.air,30);
  assert.equal(groupMethodCapacityStatus(after,profile).seats,30);
  assert.equal(saved.groups.group1.members.ship1.surface,"water",
    "read-only projection does not rewrite existing Group settings");
});
