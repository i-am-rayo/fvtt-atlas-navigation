import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultGroupTransportation,validateGroupTransportation,
  setGroupTransportationMember,projectGroupTransportation,groupTravelCapacityStatus,
  groupMethodCapacityStatus,groupMethodFareEstimate,effectiveGroupResourceMethod,
  readGroupTransportation
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
  assert.equal(migrated.version,4);
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
  assert.equal(migrated.version,4);
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

test("v3 speed overrides migrate read-only into v4 with World prices inherited",()=>{
  const previous={version:3,groups:{group1:{members:{
    camel1:{role:"mount",quantity:1,capacity:1,surface:"land",
      profileId:"camel",speedMphOverride:3.75}
  }}}};
  const migrated=validateGroupTransportation(previous);
  const item=migrated.groups.group1.members.camel1;
  assert.equal(migrated.version,4);
  assert.equal(item.speedMphOverride,3.75);
  assert.equal(item.costCpOverride,null);
  assert.equal(item.purchaseGpOverride,null);
  assert.equal(previous.version,3,"legacy flag is not silently rewritten");
});
test("all Group cost and purchase overrides are independent of the World profile",()=>{
  const world={id:"camel",name:"Camel",kind:"mount",surface:"land",
    speedMph:3,costCp:5,costBasis:"day",costApplies:"unit",purchaseGp:50,
    note:"World reference",capacity:1};
  const entry={role:"mount",quantity:3,capacity:1,surface:"land",
    profileId:"camel",speedMphOverride:3.2,
    costCpOverride:7,costBasisOverride:"mile",
    costAppliesOverride:"unit",purchaseGpOverride:"none",
    noteOverride:"Special hardy camels"};
  const saved=setGroupTransportationMember(defaultGroupTransportation(),
    "group1","camel1",entry);
  const roster=projectGroupTransportation(group([pc,camel]),saved,[world]);
  const own=effectiveGroupResourceMethod(roster.members.find(m=>m.actorId==="camel1"),world);
  assert.equal(own.speedMph,3.2);
  assert.equal(own.costCp,7);
  assert.equal(own.costBasis,"mile");
  assert.equal(own.costApplies,"unit");
  assert.equal(own.purchaseGp,null);
  assert.equal(own.note,"Special hardy camels");
  assert.equal(world.costCp,5);
  assert.equal(world.purchaseGp,50);
  const quote=groupMethodFareEstimate(roster,world,{hours:30,distanceMi:10,dayHours:8});
  assert.equal(quote.amount,210,"3 units × 10 miles × 7 CP");
  assert.equal(quote.unseated,0);
});
test("Group passenger charging and daily cost use linked resource overrides",()=>{
  const world={id:"camel",name:"Camel",kind:"mount",surface:"land",
    speedMph:3,costCp:5,costBasis:"day",costApplies:"unit"};
  const addedPc=actor("pc2","Lucious","character");
  const saved=setGroupTransportationMember(defaultGroupTransportation(),"group1","camel1",{
    role:"mount",quantity:2,capacity:1,surface:"land",profileId:"camel",
    costCpOverride:9,costBasisOverride:"day",costAppliesOverride:"passenger"
  });
  const roster=projectGroupTransportation(group([pc,addedPc,camel]),saved,[world]);
  const quote=groupMethodFareEstimate(roster,world,{hours:30+5/60,distanceMi:90.23,dayHours:8});
  assert.equal(quote.amount,72,"2 passengers × 4 travel days × 9 CP");
});
test("malformed Group economy overrides fail validation closed",()=>{
  const good={role:"mount",quantity:1,capacity:1,surface:"land",profileId:"camel"};
  for(const patch of [{costCpOverride:-1},{costCpOverride:Infinity},
    {costBasisOverride:"week"},{costAppliesOverride:"crew"},
    {purchaseGpOverride:"1500"},{purchaseGpOverride:-4},
    {noteOverride:"x".repeat(241)}]){
    assert.throws(()=>setGroupTransportationMember(defaultGroupTransportation(),
      "group1","camel1",{...good,...patch}),/Invalid/i);
  }
});

test("optional per-unit crew wages appear in the owned Group navigation quote",()=>{
  const method={id:"warship",name:"Warship",kind:"vehicle",surface:"water",
    capacity:60,speedMph:2.5,costCp:0,costBasis:"none",costApplies:"unit",
    crewCount:60,crewWageCpPerDay:200,includeCrewWages:true};
  const saved=setGroupTransportationMember(defaultGroupTransportation(),
    "group1","ship1",{role:"unassigned",quantity:1,capacity:60,
      surface:"water",profileId:"warship"});
  const projected=projectGroupTransportation(group([pc,warship]),saved,[method]);
  const quote=groupMethodFareEstimate(projected,method,
    {distanceMi:100,hours:40,dayHours:24});
  assert.equal(quote.amount,24000,"60 crew × 2GP × two 24h wage days");
  assert.equal(quote.breakdown[0].recurringCp,0);
  assert.equal(quote.breakdown[0].crewWagesCp,24000);
  assert.equal(quote.breakdown[0].crewDays,2);
  const noWages=groupMethodFareEstimate(projected,{...method,includeCrewWages:false},
    {distanceMi:100,hours:40,dayHours:24});
  assert.equal(noWages.amount,0,"crew costs remain off by default");
});
