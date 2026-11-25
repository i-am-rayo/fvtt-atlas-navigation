import assert from "node:assert/strict";
import test from "node:test";
import {projectPartyTravelSelection} from "../scripts/navigation-party-selection.js";
import {
  defaultGroupTransportation,validateGroupTransportation,
  setGroupTransportationMember,setGroupTransportationMembers,eligibleGroupRiders,
  projectGroupTransportation,groupTravelCapacityStatus,
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
  assert.equal(migrated.version,7);
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
  assert.equal(migrated.version,7);
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
  assert.equal(migrated.version,7);
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


test("linked World capacity is inherited while explicit Group seats win",()=>{
  const profile={id:"warship",name:"Warship",kind:"vehicle",surface:"water",
    capacity:45,speedMph:3,costCp:0,costBasis:"none",costApplies:"unit"};
  let saved=setGroupTransportationMember(defaultGroupTransportation(),"group1","ship1",
    {role:"unassigned",quantity:2,capacity:null,surface:"water",profileId:"warship"});
  let p=projectGroupTransportation(group([pc,warship]),saved,[profile]);
  assert.equal(p.members.find(m=>m.actorId==="ship1").capacity,45);
  assert.equal(groupMethodCapacityStatus(p,profile).seats,90);
  p=projectGroupTransportation(group([pc,warship]),saved,[{...profile,capacity:12}]);
  assert.equal(groupMethodCapacityStatus(p,profile).seats,24,
    "inherited capacity changes with the World preset");
  saved=setGroupTransportationMember(saved,"group1","ship1",
    {role:"unassigned",quantity:2,capacity:17,surface:"water",profileId:"warship"});
  p=projectGroupTransportation(group([pc,warship]),saved,[{...profile,capacity:12}]);
  assert.equal(groupMethodCapacityStatus(p,profile).seats,34,
    "explicitly saved Group capacity remains stable");
});

test("v4 reads default to included; v5 exclusion survives World/Group projection and matching",()=>{
  const old={version:4,groups:{group1:{members:{ship1:{
    role:"unassigned",quantity:1,capacity:30,surface:"water",profileId:"warship"
  }}}}};
  const normalized=validateGroupTransportation(old);
  assert.equal(normalized.version,7);
  assert.equal(normalized.groups.group1.members.ship1.enabled,true);
  const excluded=setGroupTransportationMember(normalized,"group1","ship1",{
    ...normalized.groups.group1.members.ship1,enabled:false
  });
  const p=projectGroupTransportation(group([pc,warship]),excluded);
  assert.equal(p.capacityBySurface.water,0);
  const method={id:"warship",name:"Warship",kind:"vehicle",surface:"water",
    speedMph:3,costCp:5,costBasis:"day",costApplies:"unit"};
  assert.equal(groupMethodCapacityStatus(p,method).seats,0);
  assert.equal(groupMethodFareEstimate(p,method,{hours:8,distanceMi:10,dayHours:8}).amount,0);
  assert.throws(()=>setGroupTransportationMember(normalized,"group1","ship1",{
    ...normalized.groups.group1.members.ship1,enabled:"false"
  }),/Invalid/);
});

test("legacy v5 personal mounts normalize without writes; IDs survive rename",()=>{
  const old={version:5,groups:{group1:{members:{
    camel1:{role:"mount",quantity:1,capacity:1,surface:"land",profileId:"camel"}
  }}}};
  const validated=validateGroupTransportation(old);
  assert.equal(validated.version,7);
  assert.equal(validated.groups.group1.members.camel1.assignedTo,null);
  assert.equal(old.version,5,"legacy settings must not migrate on read");
  const saved=setGroupTransportationMember(validated,"group1","camel1",{
    ...validated.groups.group1.members.camel1,assignedTo:"pc1"
  });
  assert.equal(saved.groups.group1.members.camel1.assignedTo,"pc1");
  const renamed=actor("pc1","Cassian Renamed","character");
  const projection=projectGroupTransportation(group([renamed,camel]),saved);
  assert.equal(projection.members.find(m=>m.actorId==="camel1").assignedTo,"pc1");
  assert.deepEqual(eligibleGroupRiders(projection),[{id:"pc1",name:"Cassian Renamed"}]);
  assert.equal(groupTravelCapacityStatus(projection,"land").seats,1);
});

test("personal mount only counts for its actual selected rider, not another PC",()=>{
  const second=actor("pc2","Lucious","character");
  const method={id:"camel",name:"Camel",kind:"mount",surface:"land",
    speedMph:3,costCp:9,costBasis:"day",costApplies:"unit"};
  const saved=setGroupTransportationMember(defaultGroupTransportation(),"group1","camel1",
    {role:"mount",quantity:1,capacity:2,surface:"land",
      profileId:"camel",assignedTo:"pc1"});
  const projection=projectGroupTransportation(group([pc,second,camel]),saved,[method]);
  const full=groupMethodCapacityStatus(projection,method);
  assert.equal(full.seats,1,"a personal mount never gives extra seats to other riders");
  assert.equal(full.missing,1);
  assert.equal(full.sufficient,false);
  const notRider={...projection,travelers:1,selectedTravelerIds:["pc2"]};
  const noSeat=groupMethodCapacityStatus(notRider,method);
  assert.equal(noSeat.seats,0);
  assert.equal(noSeat.matched,0,"not offered as available transport to the other PC");
  assert.equal(groupTravelCapacityStatus(notRider,"land").seats,0);
  const noFare=groupMethodFareEstimate(notRider,method,
    {hours:8,distanceMi:20,dayHours:8});
  assert.equal(noFare.amount,0,"do not charge upkeep for an absent personal rider");
  assert.equal(noFare.breakdown.length,0);
  const rider={...projection,travelers:1,selectedTravelerIds:["pc1"]};
  assert.equal(groupMethodCapacityStatus(rider,method).seats,1);
  assert.equal(groupMethodCapacityStatus(rider,method).sufficient,true);
  const quoted=groupMethodFareEstimate(rider,method,
    {hours:8,distanceMi:20,dayHours:8});
  assert.equal(quoted.breakdown[0].passengers,1);
  assert.equal(quoted.unseated,0);
  assert.equal(quoted.amount,9);
});

test("shared pools and distinct personal mounts do not double-count riders or fares",()=>{
  const second=actor("pc2","Lucious","character");
  const third=actor("pc3","Mali","character");
  const method={id:"mounted",name:"Mounted (general)",kind:"mount",surface:"land",
    speedMph:4,costCp:5,costBasis:"day",costApplies:"passenger"};
  let saved=defaultGroupTransportation();
  saved=setGroupTransportationMember(saved,"group1","camel1",{
    role:"mount",quantity:1,capacity:2,surface:"land",assignedTo:"pc1",
    costCpOverride:7
  });
  saved=setGroupTransportationMember(saved,"group1","camel2",{
    role:"mount",quantity:2,capacity:1,surface:"land"
  });
  const projection=projectGroupTransportation(group([pc,second,third,camel,camel2]),saved);
  assert.equal(projection.travelers,3);
  assert.equal(groupTravelCapacityStatus(projection,"land").seats,3,
    "1 reserved seat plus 2 shared seats, not 4");
  const status=groupMethodCapacityStatus(projection,method);
  assert.equal(status.seats,3);assert.equal(status.sufficient,true);
  const quote=groupMethodFareEstimate(projection,method,
    {hours:8,distanceMi:20,dayHours:8});
  assert.deepEqual(quote.breakdown.map(x=>x.passengers),[1,2]);
  assert.equal(quote.amount,17,"7 CP personal rider + 10 CP two shared passengers");
  assert.equal(quote.unseated,0);
  const otherSelection={...projection,travelers:2,selectedTravelerIds:["pc2","pc3"]};
  assert.equal(groupMethodCapacityStatus(otherSelection,method).seats,2);
  assert.equal(groupMethodCapacityStatus(otherSelection,method).sufficient,true);
});

test("invalid riders, duplicate assignments and pool transitions fail closed",()=>{
  const base={role:"mount",quantity:1,capacity:1,surface:"land"};
  const good=setGroupTransportationMember(defaultGroupTransportation(),
    "group1","camel1",{...base,assignedTo:"pc1"});
  for(const patch of [
    {assignedTo:"../../evil"},{quantity:2},{role:"pack"},{enabled:false}
  ])assert.throws(()=>setGroupTransportationMember(good,"group1","camel1",
    {...good.groups.group1.members.camel1,...patch}),/Invalid/i);
  assert.throws(()=>setGroupTransportationMember(good,"group1","camel2",
    {...base,assignedTo:"pc1"}),/cannot be assigned more than one/i);
  // The Group editor saves one completed draft, allowing A->B reassignment
  // without transient duplicate IDs during its staging process.
  const switched=setGroupTransportationMembers(good,"group1",{
    camel1:{...good.groups.group1.members.camel1,assignedTo:null},
    camel2:{...base,assignedTo:"pc1"}
  });
  assert.equal(switched.groups.group1.members.camel1.assignedTo,null);
  assert.equal(switched.groups.group1.members.camel2.assignedTo,"pc1");
  const noMember=projectGroupTransportation(group([camel,camel2]),good);
  assert.equal(groupTravelCapacityStatus(noMember,"land").seats,0,
    "orphan personal mount cannot become shared transport");
});

test("an individually traveling NPC passenger is eligible; pooled passengers are not",()=>{
  let saved=defaultGroupTransportation();
  saved=setGroupTransportationMember(saved,"group1","camel1",{
    role:"mount",quantity:1,capacity:1,surface:"land",assignedTo:"camel2"
  });
  saved=setGroupTransportationMember(saved,"group1","camel2",{
    role:"passenger",quantity:1,capacity:null,surface:"land"
  });
  const one=projectGroupTransportation(group([camel,camel2]),saved);
  assert.deepEqual(eligibleGroupRiders(one),[{id:"camel2",name:"Camel"}]);
  assert.equal(groupTravelCapacityStatus(one,"land").seats,1);
  saved=setGroupTransportationMember(saved,"group1","camel2",{
    role:"passenger",quantity:2,capacity:null,surface:"land"
  });
  const pooled=projectGroupTransportation(group([camel,camel2]),saved);
  assert.deepEqual(eligibleGroupRiders(pooled),[]);
  assert.equal(groupTravelCapacityStatus(pooled,"land").seats,0);
});

test("selected party previews cannot borrow a personal mount owned by an absent PC",()=>{
  const second=actor("pc2","Lucious","character");
  const saved=setGroupTransportationMember(defaultGroupTransportation(),"group1","camel1",{
    role:"mount",quantity:1,capacity:1,surface:"land",assignedTo:"pc1"
  });
  const projection=projectGroupTransportation(group([pc,second,camel]),saved);
  const other=projectPartyTravelSelection(projection,{mode:"selected",ids:["pc2"]});
  assert.equal(other.previewRoster.travelers,1);
  assert.deepEqual(other.previewRoster.selectedTravelerIds,["pc2"]);
  assert.equal(groupTravelCapacityStatus(other.previewRoster,"land").seats,0);
  const rider=projectPartyTravelSelection(projection,{mode:"selected",ids:["pc1"]});
  assert.equal(groupTravelCapacityStatus(rider.previewRoster,"land").seats,1);
  assert.equal(projection.travelers,2,"preview selection never mutates authoritative Group");
});

test("v6 NPC passenger records retain seat requirement by default without write on read",()=>{
  const old={version:6,groups:{group1:{members:{
    camel1:{role:"passenger",quantity:1,capacity:null,surface:"land"}
  }}}};
  const writes=[];
  const migrated=readGroupTransportation({
    get:()=>old,set:(...args)=>writes.push(args)
  });
  assert.equal(migrated.version,7);
  assert.equal(migrated.groups.group1.members.camel1.needsSeat,true);
  assert.equal(old.version,6);
  assert.deepEqual(writes,[]);
  assert.throws(()=>setGroupTransportationMember(migrated,"group1","camel1",{
    ...migrated.groups.group1.members.camel1,needsSeat:"yes"
  }),/Invalid/);
});

test("three PC and optional-seat NPC acceptance matrix, with assigned camel and shared horses",()=>{
  const cass=actor("cass","Cassian","character");
  const luc=actor("luc","Lucious","character");
  const torr=actor("torr","Torrus","character");
  const nyx=actor("nyx","Nyx","npc");
  const jon=actor("jon","Jonathan","npc");
  const vip2=actor("vip2","VIP 2","npc");
  const horse=actor("horse","Riding Horse","npc");
  const camel=actor("camel","Hamilton","npc");
  const members=[cass,luc,torr,nyx,jon,vip2,horse,camel];
  const herd={id:"horse-preset",name:"Riding Horse",surface:"land",kind:"mount",
    speedMph:3.5,capacity:1,costCp:0,costBasis:"none",costApplies:"unit"};
  const camelMethod={id:"camel-preset",name:"Camel",surface:"land",kind:"mount",
    speedMph:2.5,capacity:1,costCp:0,costBasis:"none",costApplies:"unit"};
  const generic={id:"mounted",name:"Mounted (general)",surface:"land",kind:"mount",
    speedMph:4,costCp:0,costBasis:"none",costApplies:"unit"};
  let owned=defaultGroupTransportation();
  owned=setGroupTransportationMember(owned,"group1","horse",{
    role:"mount",quantity:3,capacity:1,surface:"land",profileId:herd.id});
  owned=setGroupTransportationMember(owned,"group1","camel",{
    role:"mount",quantity:1,capacity:1,surface:"land",profileId:camelMethod.id,
    assignedTo:"cass"});
  for(const [id,needsSeat] of [["nyx",false],["jon",true],["vip2",true]])
    owned=setGroupTransportationMember(owned,"group1",id,{
      role:"passenger",quantity:1,capacity:null,surface:"land",needsSeat});
  const scenarios=[
    {npcs:["nyx"],needed:3,bSufficient:true,aSufficient:true,bMissing:0,aMissing:0},
    {npcs:["jon"],needed:4,bSufficient:true,aSufficient:false,bMissing:0,aMissing:1},
    {npcs:["nyx","jon","vip2"],needed:5,bSufficient:false,aSufficient:false,
      bMissing:1,aMissing:2}
  ];
  for(const scenario of scenarios){
    const party=group([...members.slice(0,3),
      ...scenario.npcs.map(id=>members.find(actor=>actor.id===id)),horse,camel]);
    const aParty=group([...members.slice(0,3),
      ...scenario.npcs.map(id=>members.find(actor=>actor.id===id)),horse]);
    const b=projectGroupTransportation(party,owned,[herd,camelMethod]);
    const a=projectGroupTransportation(aParty,owned,[herd,camelMethod]);
    assert.equal(b.travelers,scenario.needed,"B seat demand "+scenario.needed);
    assert.equal(b.pcCount,3);
    assert.equal(b.npcCount,scenario.npcs.length);
    assert.equal(groupMethodCapacityStatus(b,generic).seats,4);
    const bs=groupMethodCapacityStatus(b,generic);
    const as=groupMethodCapacityStatus(a,generic);
    assert.deepEqual([bs.sufficient,bs.missing],
      [scenario.bSufficient,scenario.bMissing]);
    assert.deepEqual([as.sufficient,as.missing],
      [scenario.aSufficient,scenario.aMissing]);
    assert.equal(bs.effectiveSpeedMph,2.5,
      "the slower camel sets the shared convoy pace");
    assert.equal(as.effectiveSpeedMph,3.5,"horses-only convoy uses horse speed");
  }
  const missingCass=projectGroupTransportation(group([luc,torr,horse,camel]),
    owned,[herd,camelMethod]);
  const capacities=groupMethodCapacityStatus(missingCass,generic);
  assert.equal(capacities.seats,3,"personal camel unavailable when its rider is absent");
  assert.equal(capacities.effectiveSpeedMph,3.5,
    "unused personal mount does not slow the convoy");
  assert.equal(groupMethodFareEstimate(missingCass,generic,{
    hours:8,distanceMi:30,dayHours:8
  }).quantity,3,"unused camel does not add to the fare quote");
});

test("no-seat NPC is still a traveler but does not require or reserve an individual seat",()=>{
  const nyx=actor("nyx","Nyx","npc");
  let saved=defaultGroupTransportation();
  saved=setGroupTransportationMember(saved,"group1","nyx",{
    role:"passenger",quantity:1,capacity:null,surface:"land",needsSeat:false});
  const p=projectGroupTransportation(group([pc,nyx]),saved);
  assert.equal(p.travelers,1);
  assert.deepEqual([p.pcCount,p.npcCount],[1,1]);
  assert.equal(eligibleGroupRiders(p).some(m=>m.id==="nyx"),false,
    "no-seat companion cannot reserve an exclusive personal mount");
  const selected=projectPartyTravelSelection(p,{mode:"selected",ids:["pc1","nyx"]});
  assert.equal(selected.travelerCount,1);
  assert.equal(selected.partial,false);
  const justNyx=projectPartyTravelSelection(p,{mode:"selected",ids:["nyx"]});
  assert.equal(justNyx.travelerCount,0);
  assert.equal(justNyx.empty,false,"an NPC without a seat is still present");
  assert.equal(justNyx.partial,true,"native Group Token cannot split");
});

test("unit-specific crew rosters preserve missing versus explicit empty configuration",()=>{
  const entry={role:"unassigned",quantity:2,capacity:60,surface:"water",profileId:"warship"};
  const legacy=setGroupTransportationMember(defaultGroupTransportation(),"group1","ship1",entry);
  const empty=setGroupTransportationMember(legacy,"group1","ship1",{...entry,crewRoster:[]});
  assert.equal(legacy.groups.group1.members.ship1.crewRoster,undefined);
  assert.deepEqual(empty.groups.group1.members.ship1.crewRoster,[]);
  const roster=[{unitIndex:1,named:[{actorId:"pc1",duty:"Navigator"}],hired:30},
    {unitIndex:2,named:[],hired:12}];
  const configured=setGroupTransportationMember(empty,"group1","ship1",{...entry,crewRoster:roster});
  const source=JSON.stringify(configured);
  const projection=projectGroupTransportation(group([pc,warship]),configured);
  assert.deepEqual(projection.members.find(m=>m.actorId==="ship1").crewRoster,roster);
  const revised=setGroupTransportationMember(configured,"group1","ship1",{...entry,noteOverride:"new note"});
  assert.deepEqual(revised.groups.group1.members.ship1.crewRoster,roster,"unrelated edits retain roster");
  roster[0].hired=99;
  assert.equal(JSON.stringify(configured),source,"saved roster is independent from draft input");
  assert.equal(projection.travelers,1,"legacy passenger projection is unchanged until leg selection");
});
test("crew roster validation rejects duplicate named members across units and resources",()=>{
  const entry={role:"unassigned",quantity:2,capacity:60,surface:"water",profileId:"warship"};
  const unit={unitIndex:1,named:[{actorId:"pc1"}],hired:1};
  for(const crewRoster of [null,{},[{...unit,unitIndex:0}],[{...unit,hired:-1}],
    [{...unit,hired:1.5}],[{...unit,named:[{actorId:"pc1",duty:"x".repeat(81)}]}],
    [unit,{...unit,named:[]}],[unit,{...unit,unitIndex:2}]])
    assert.throws(()=>setGroupTransportationMember(defaultGroupTransportation(),"group1","ship1",
      {...entry,crewRoster}),/invalid|crew/i);
  const saved=setGroupTransportationMember(defaultGroupTransportation(),"group1","ship1",
    {...entry,crewRoster:[unit]});
  assert.throws(()=>setGroupTransportationMember(saved,"group1","ship2",
    {...entry,crewRoster:[unit]}),/crew/i);
});
test("crew assessment reports eligible named crew, hired hands and stale units without mutating native Actors",async()=>{
  const {assessGroupCrewRoster}=await import("../scripts/navigation-group-transport.js");
  const npc=actor("npc1","Sailor","npc");
  const native=group([pc,npc,warship]);
  const before=JSON.stringify(native);
  const method={id:"warship",kind:"vehicle",crewCount:60,includeCrewWages:true};
  const entry={role:"unassigned",quantity:2,capacity:60,surface:"water",profileId:"warship"};
  let saved=setGroupTransportationMembers(defaultGroupTransportation(),"group1",{
    ship1:{...entry,crewRoster:[{unitIndex:1,named:[{actorId:"pc1"},{actorId:"npc1"}],hired:30}]},
    npc1:{role:"crew",quantity:1,capacity:null,surface:"water"}
  });
  const assess=()=>{const p=projectGroupTransportation(native,saved,[method]);
    return assessGroupCrewRoster(p,p.members.find(m=>m.actorId==="ship1"),method);};
  let result=assess();
  assert.equal(result.configured,true);
  assert.deepEqual(result.issues,[]);
  assert.deepEqual(result.units.map(({unitIndex,staffedCrew,pcCrew,paidCrew,tier})=>
    ({unitIndex,staffedCrew,pcCrew,paidCrew,tier})),[
      {unitIndex:1,staffedCrew:32,pcCrew:1,paidCrew:31,tier:"optimal"},
      {unitIndex:2,staffedCrew:0,pcCrew:0,paidCrew:0,tier:"below-minimum"}]);
  saved=setGroupTransportationMember(saved,"group1","ship1",{...entry,quantity:1,
    crewRoster:[{unitIndex:1,named:[{actorId:"missing"}],hired:61},
      {unitIndex:2,named:[],hired:1}]});
  result=assess();
  assert.ok(result.issues.some(x=>x.code==="stale-member"));
  assert.ok(result.issues.some(x=>x.code==="stale-unit"));
  assert.ok(result.issues.some(x=>x.code==="over-capacity"));
  assert.equal(JSON.stringify(native),before);
});

test("owned crew policy overrides are validated and reset independently of the roster",()=>{
  const entry={role:"unassigned",quantity:2,capacity:60,surface:"water",profileId:"warship",
    crewRoster:[{unitIndex:1,named:[{actorId:"pc1"}],hired:30}]};
  const policy={crewCount:40,crewThresholds:{minimum:10,optimal:20,excellent:30},
    crewWageCpPerDay:0,crewWageBasis:"trip",includeCrewWages:false};
  const world={id:"warship",crewCount:60,crewThresholds:{minimum:15,optimal:30,excellent:45},
    crewWageCpPerDay:200,crewWageBasis:"day",includeCrewWages:true};
  const saved=setGroupTransportationMember(defaultGroupTransportation(),"group1","ship1",
    {...entry,crewPolicyOverride:policy});
  const resource=data=>projectGroupTransportation(group([pc,warship]),data,[world]).members.find(m=>m.actorId==="ship1");
  const effective=effectiveGroupResourceMethod(resource(saved),world);
  for(const key of Object.keys(policy))assert.deepEqual(effective[key],policy[key]);
  const unrelated=setGroupTransportationMember(saved,"group1","ship1",{...entry,noteOverride:"Note"});
  assert.deepEqual(resource(unrelated).crewPolicyOverride,policy);
  const reset=setGroupTransportationMember(unrelated,"group1","ship1",{...entry,crewPolicyOverride:null});
  assert.deepEqual(resource(reset).crewRoster,entry.crewRoster);
  assert.equal(effectiveGroupResourceMethod(resource(reset),world).crewCount,60);
  assert.equal(world.crewWageCpPerDay,200);
  for(const patch of [{crewCount:-1},{crewCount:20},{crewWageCpPerDay:-1},
    {crewWageBasis:"week"},{includeCrewWages:"false"},{unknown:1}])
    assert.throws(()=>setGroupTransportationMember(saved,"group1","ship1",
      {...entry,crewPolicyOverride:{...policy,...patch}}),/invalid/i);
});
test("explicit operated-unit crew estimates pay NPCs and hired hands only, preserving reference estimates for missing rosters",async()=>{
  const {estimateOperatedGroupCrew}=await import("../scripts/navigation-group-transport.js");
  const npc=actor("npc1","Sailor","npc");
  const native=group([pc,npc,warship]);
  const method={id:"warship",name:"Warship",kind:"vehicle",surface:"water",crewCount:60,
    crewWageCpPerDay:200,crewWageBasis:"day",includeCrewWages:true};
  const entry={role:"unassigned",quantity:2,capacity:60,surface:"water",profileId:"warship",
    crewRoster:[{unitIndex:1,named:[{actorId:"pc1"},{actorId:"npc1"}],hired:30},
      {unitIndex:2,named:[],hired:10}]};
  const selected=[{actorId:"ship1",unitIndex:1}];
  const build=entry=>projectGroupTransportation(native,setGroupTransportationMembers(defaultGroupTransportation(),"group1",{
    ship1:entry,npc1:{role:"crew",quantity:1,capacity:null,surface:"water"}}),[method]);
  const factors={operatedUnits:selected,hours:24,distanceMi:60,dayHours:8};
  const estimate=(entry,patch={})=>estimateOperatedGroupCrew(build(entry),method,{...factors,...patch});
  const result=estimate(entry);
  assert.equal(result.crewWagesCp,18600);
  assert.deepEqual(result.namedCrewIds,["pc1","npc1"]);
  assert.equal(result.units[0].paidCrew,31);
  assert.equal(result.units[0].tier,"optimal");
  assert.equal(estimate(entry,{operatedUnits:[{actorId:"ship1",unitIndex:2}]}).crewWagesCp,6000);
  assert.equal(estimate({...entry,crewRoster:[]}).crewWagesCp,0);
  const {crewRoster,...legacy}=entry;
  const ref=estimate(legacy);
  assert.equal(ref.crewWagesCp,36000);
  assert.equal(ref.units[0].configured,false);
  const policy={crewCount:60,crewThresholds:{minimum:15,optimal:30,excellent:45},
    crewWageCpPerDay:200,crewWageBasis:"trip",includeCrewWages:true};
  assert.equal(estimate({...entry,crewPolicyOverride:policy}).crewWagesCp,6200);
  assert.equal(estimate({...entry,crewPolicyOverride:{...policy,crewWageBasis:"mile"}}).crewWagesCp,372000);
  assert.equal(estimate({...entry,crewPolicyOverride:{...policy,includeCrewWages:false}}).crewWagesCp,0);
  assert.equal(estimate(entry,{hours:0,distanceMi:0}).crewWagesCp,0);
  for(const operatedUnits of [[],[...selected,...selected],[{actorId:"ship1",unitIndex:3}],[{actorId:"unknown",unitIndex:1}]])
    assert.throws(()=>estimate(entry,{operatedUnits}),/unit/i);
  const partial={...build(entry),selectedTravelerIds:[],travelers:0};
  assert.throws(()=>estimateOperatedGroupCrew(partial,method,factors),/crew/i);
});

test("explicit owned unit quote separates crew from passenger seats and bills selected upkeep plus wages",()=>{
  const npc=actor("npc1","Sailor","npc");
  const rider=actor("pc2","Passenger","character");
  const native=group([pc,rider,npc,warship]);
  const method={id:"warship",name:"Warship",kind:"vehicle",surface:"water",crewCount:60,
    costCp:100,costBasis:"day",costApplies:"unit",crewWageCpPerDay:200,
    crewWageBasis:"day",includeCrewWages:true};
  const saved=setGroupTransportationMembers(defaultGroupTransportation(),"group1",{
    ship1:{role:"unassigned",quantity:2,capacity:1,surface:"water",profileId:"warship",
      crewRoster:[{unitIndex:1,named:[{actorId:"pc1"},{actorId:"npc1"}],hired:30},
        {unitIndex:2,named:[],hired:10}]},
    npc1:{role:"passenger",quantity:1,capacity:null,surface:"water"}
  });
  const projection=projectGroupTransportation(native,saved,[method]);
  const original=JSON.stringify(projection);
  const factors={hours:24,distanceMi:60,dayHours:8};
  const legacy=groupMethodFareEstimate(projection,method,factors);
  assert.equal(legacy.amount,72600,"legacy reference calculation remains available");
  const quote=groupMethodFareEstimate(projection,method,
    {...factors,operatedUnits:[{actorId:"ship1",unitIndex:1}]});
  assert.equal(quote.quantity,1);
  assert.equal(quote.unseated,0);
  assert.equal(quote.breakdown[0].passengers,1);
  assert.equal(quote.breakdown[0].recurringCp,300);
  assert.equal(quote.breakdown[0].crewWagesCp,18600);
  assert.equal(quote.amount,18900);
  assert.deepEqual(quote.namedCrewIds,["pc1","npc1"]);
  assert.equal(quote.breakdown[0].staffedCrew,32);
  assert.equal(quote.breakdown[0].requiredCrew,60);
  assert.equal(quote.breakdown[0].paidCrew,31);
  const other=groupMethodFareEstimate(projection,method,
    {...factors,operatedUnits:[{actorId:"ship1",unitIndex:2}]});
  assert.equal(other.unseated,2,"crew of non-operating units still need passenger seats");
  assert.equal(other.amount,6300);
  assert.equal(JSON.stringify(projection),original,"quotes do not alter Group projection");
});

test("explicit owned vehicle selection uses only operated hulls for seats, crew, pace and upkeep",()=>{
  const npc=actor("npc1","Sailor","npc"),rider=actor("pc2","Passenger","character");
  const other=actor("ship2","Other Warship","vehicle",{passengers:{max:60}});
  const native=group([pc,rider,npc,warship,other]);
  const method={id:"warship",name:"Warship",kind:"vehicle",surface:"water",speedMph:5,
    crewCount:60,costCp:100,costBasis:"day",costApplies:"unit",crewWageCpPerDay:200,
    crewWageBasis:"day",includeCrewWages:true};
  const saved=setGroupTransportationMembers(defaultGroupTransportation(),"group1",{
    ship1:{role:"unassigned",quantity:2,capacity:1,surface:"water",profileId:"warship",
      crewRoster:[{unitIndex:1,named:[{actorId:"pc1"},{actorId:"npc1"}],hired:30},
        {unitIndex:2,named:[],hired:10}],speedMphOverride:4},
    ship2:{role:"unassigned",quantity:1,capacity:60,surface:"water",profileId:"warship",
      speedMphOverride:2,crewRoster:[]},
    npc1:{role:"passenger",quantity:1,capacity:null,surface:"water"}
  });
  const projection=projectGroupTransportation(native,saved,[method]);
  const original=JSON.stringify(projection);
  const operatedUnits=[{actorId:"ship1",unitIndex:1}];
  const capacity=groupMethodCapacityStatus(projection,method,{operatedUnits});
  assert.equal(capacity.sufficient,true);
  assert.equal(capacity.travelers,1);
  assert.equal(capacity.seats,1);
  assert.equal(capacity.quantity,1);
  assert.equal(capacity.effectiveSpeedMph,4);
  assert.deepEqual(capacity.namedCrewIds,["pc1","npc1"]);
  assert.equal(capacity.belowMinimum,false);
  const otherUnit=groupMethodCapacityStatus(projection,method,{operatedUnits:[{actorId:"ship1",unitIndex:2}]});
  assert.equal(otherUnit.sufficient,false);
  assert.equal(otherUnit.missing,2);
  assert.equal(otherUnit.belowMinimum,true);
  const empty=groupMethodCapacityStatus(projection,method,{operatedUnits:[{actorId:"ship2",unitIndex:1}]});
  assert.equal(empty.belowMinimum,true);
  const legacy=groupMethodCapacityStatus(projection,method);
  assert.equal(legacy.quantity,3);
  assert.equal(legacy.effectiveSpeedMph,2);
  const fare=groupMethodFareEstimate(projection,method,{hours:24,distanceMi:96,dayHours:8,operatedUnits});
  assert.equal(fare.amount,18900);
  assert.equal(fare.unseated,capacity.missing);
  assert.throws(()=>groupMethodCapacityStatus(projection,method,{operatedUnits:[]}),/unit/i);
  assert.throws(()=>groupMethodCapacityStatus(projection,method,{operatedUnits:[{actorId:"ship1",unitIndex:3}]}),/unit/i);
  assert.equal(JSON.stringify(projection),original);
});
