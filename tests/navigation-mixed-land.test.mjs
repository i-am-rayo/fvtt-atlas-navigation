import assert from "node:assert/strict";
import test from "node:test";
import {planMixedLandConvoy,validateMixedLandConvoy}
  from "../scripts/navigation-mixed-land.js";

const walkers=[{actorId:"pc1",seatsNeeded:1,passengers:1},
  {actorId:"pc2",seatsNeeded:1,passengers:1},
  {actorId:"pc3",seatsNeeded:1,passengers:1},
  {actorId:"npc1",seatsNeeded:0,passengers:1},
  {actorId:"npc2",seatsNeeded:1,passengers:1}];
const walking={key:"owned|walking",arrangement:"owned",
  method:{id:"walking",name:"Walking",kind:"foot",surface:"land"}};
const coach={id:"coach-hire",name:"Coach between towns",kind:"vehicle",
  surface:"land",capacity:4,speedMph:4,hireEnabled:true,
  hireApplies:"passenger",hireBasis:"day",hireCostCp:100,
  hireUnlimited:false,hireQuantity:1};
const coachMethod={key:"hire|coach-hire",arrangement:"hire",method:coach,
  checkpointId:"hearth"};
const plan=(override={})=>planMixedLandConvoy({
  travelers:walkers,assignments:{
    pc1:"owned|walking",pc2:"owned|walking",
    pc3:"hire|coach-hire",npc1:"hire|coach-hire",npc2:"hire|coach-hire"
  },methods:[walking,coachMethod],walkingSpeed:3,sceneUnits:"mi",
  routeDistance:24,weightedDistance:24,distanceMi:24,regularHours:8,
  ...override
});

test("walking plus passenger-priced hired coach seats named riders and prices actual passengers",()=>{
  const result=plan();
  assert.equal(result.mode,"mixed-land");
  assert.equal(result.suggestedSpeedPerHour,3);
  assert.equal(result.movingHours,8);
  assert.equal(result.totalSeatsNeeded,4);
  assert.equal(result.methods[1].units,1);
  assert.equal(result.methods[1].passengers,3);
  assert.equal(result.methods[1].seatsUsed,2);
  assert.equal(result.methods[1].estimatedCostCp,300);
  assert.deepEqual(validateMixedLandConvoy(result),result);
});

test("GM-approved walking pace 4mph preserves coach fare based on actual 6-hour moving time",()=>{
  const result=plan({paceOverride:4});
  assert.equal(result.gmWalkingPaceOverride,true);
  assert.equal(result.movingHours,6);
  assert.equal(result.methods[1].estimatedCostCp,300);
  assert.throws(()=>plan({paceOverride:5}),/slowest participating mount or vehicle/);
  const corrupted=structuredClone(result);
  delete corrupted.gmWalkingPaceOverride;
  assert.throws(()=>validateMixedLandConvoy(corrupted),/slowest participant/);
});

test("finite hire units and boarding assignments fail closed",()=>{
  assert.throws(()=>plan({methods:[walking,{
    ...coachMethod,method:{...coach,hireQuantity:0}}]}),/Not enough hired/);
  assert.throws(()=>plan({assignments:{pc1:"owned|walking"}}),/Assign each/);
  assert.throws(()=>plan({assignments:Object.fromEntries(
    walkers.map(t=>[t.actorId,"hire|coach-hire"]))}),/Deselect Walking/);
  assert.throws(()=>plan({methods:[walking,{...coachMethod,
    units:1,method:{...coach,capacity:1}}]}),/cannot cover assigned passenger/);
});

test("cargo-only per-unit vehicle can join two passenger-carrying methods",()=>{
  const wagon={id:"wagon",name:"Wagon",kind:"vehicle",surface:"land",
    capacity:4,speedMph:3,hireEnabled:true,hireApplies:"unit",
    hireCostCp:200,hireBasis:"day",hireQuantity:1,hireUnlimited:false};
  const result=plan({methods:[walking,coachMethod,{
    key:"hire|wagon",arrangement:"hire",method:wagon,checkpointId:"hearth"
  }]});
  assert.equal(result.methods[2].role,"cargo");
  assert.equal(result.methods[2].units,1);
  assert.equal(result.methods[2].estimatedCostCp,200);
  assert.equal(result.totalCp,500);
});

test("owned mounts and hired coach combine with an independent walking group",()=>{
  const horse={id:"riding-horse",name:"Riding Horse",kind:"mount",
    surface:"land",speedMph:4};
  const resources=[{actorId:"horse1",quantity:1,capacity:1,speedMph:4,
    assignedTo:"pc2",method:{costCp:5,costBasis:"day",costApplies:"unit"}},
    {actorId:"horse2",quantity:1,capacity:1,speedMph:3,
    assignedTo:"pc1",method:{costCp:5,costBasis:"day",costApplies:"unit"}}];
  const result=plan({methods:[walking,coachMethod,{
    key:"owned|riding-horse",arrangement:"owned",method:horse,resources
  }],assignments:{pc1:"owned|walking",pc2:"owned|riding-horse",
    pc3:"hire|coach-hire",npc1:"hire|coach-hire",npc2:"hire|coach-hire"}});
  assert.equal(result.methods[2].units,1);
  assert.deepEqual(result.methods[2].resourceIds,["horse1"]);
  assert.equal(result.methods[2].estimatedCostCp,5);
  assert.equal(result.totalCp,305);
});

test("two different owned methods cannot double-use a Group mount actor",()=>{
  const mount={id:"mounted",name:"Mounted",kind:"mount",surface:"land",
    speedMph:3};
  const resource={actorId:"horse1",quantity:1,capacity:1,speedMph:3,
    method:{costCp:5,costBasis:"day",costApplies:"unit"}};
  assert.throws(()=>plan({
    methods:[walking,coachMethod,{
      key:"owned|mounted",arrangement:"owned",method:mount,resources:[resource]},
      {key:"owned|pony",arrangement:"owned",
        method:{...mount,id:"pony"},resources:[resource]}],
    assignments:{pc1:"owned|mounted",pc2:"owned|pony",
      pc3:"owned|walking",npc1:"hire|coach-hire",npc2:"hire|coach-hire"}
  }),/cannot be selected twice/);
});

test("owned mixed transport crew wages are charged for used resources only",()=>{
  const horse={id:"riding-horse",name:"Riding Horse",kind:"mount",
    surface:"land",speedMph:4};
  const resources=[{actorId:"horse1",quantity:1,capacity:1,speedMph:4,
    assignedTo:"pc2",method:{costCp:5,costBasis:"day",costApplies:"unit",
      includeCrewWages:true,crewCount:1,crewWageCpPerDay:200,crewWageBasis:"day"}},
    {actorId:"horse2",quantity:1,capacity:1,speedMph:3,
    assignedTo:"pc1",method:{costCp:5,costBasis:"day",costApplies:"unit",
      includeCrewWages:true,crewCount:1,crewWageCpPerDay:200,crewWageBasis:"day"}}];
  const result=plan({methods:[walking,coachMethod,{
    key:"owned|riding-horse",arrangement:"owned",method:horse,resources
  }],assignments:{pc1:"owned|walking",pc2:"owned|riding-horse",
    pc3:"hire|coach-hire",npc1:"hire|coach-hire",npc2:"hire|coach-hire"}});
  assert.deepEqual(result.methods[2].resourceIds,["horse1"]);
  assert.equal(result.methods[2].estimatedCostCp,205);
  assert.equal(result.totalCp,505,
    "unused horse does not incur an extra feed cost or crew wage");
});

test("two hired passenger methods travel together without selecting Walking",()=>{
  const cart={id:"cart",name:"Cart",kind:"vehicle",surface:"land",
    capacity:2,speedMph:3,hireEnabled:true,hireApplies:"unit",
    hireCostCp:200,hireBasis:"day",hireUnlimited:false,hireQuantity:1};
  const options={methods:[coachMethod,{key:"hire|cart",arrangement:"hire",
    method:cart,checkpointId:"hearth"}],
    assignments:{pc1:"hire|coach-hire",pc2:"hire|coach-hire",
      pc3:"hire|cart",npc1:"hire|coach-hire",npc2:"hire|cart"}};
  const approved=plan(options);
  assert.equal(approved.methods.length,2);
  assert.equal(approved.travelers.filter(t=>t.role==="walking").length,0);
  assert.equal(approved.suggestedSpeedPerHour,3);
  assert.equal(approved.movingHours,8);
  assert.equal(approved.totalSeatsNeeded,4);
  assert.equal(approved.methods[0].passengers,3);
  assert.equal(approved.methods[0].seatsUsed,2);
  assert.equal(approved.methods[1].passengers,2);
  assert.equal(approved.methods[1].seatsUsed,2);
  assert.equal(approved.totalCp,500);
  assert.throws(()=>plan({...options,paceOverride:4}),
    /GM pace exceeds the slowest participating mount or vehicle/,
    "the 3 mph cart prevents a faster 4 mph mixed-party override");
  const overCapacity=structuredClone(approved);
  overCapacity.methods[1].seatsUsed=3;
  assert.throws(()=>validateMixedLandConvoy(overCapacity),
    /Invalid approved mixed Journey transport/,
    "a tampered seat count exceeding the cart's capacity fails immediately");
  const unmatched=structuredClone(approved);
  unmatched.methods[0].seatsUsed=1;
  assert.throws(()=>validateMixedLandConvoy(unmatched),
    /Mixed Journey passenger coverage or fare does not balance/,
    "a seat count that no longer matches the assigned travelers fails closed");
});

test("GM may loan a personally assigned Warhorse to Jonathan for one Journey",()=>{
  const warhorse={key:"owned|horse",arrangement:"owned",
    method:{id:"horse",name:"Warhorse",kind:"mount",surface:"land",
      speedMph:4,capacity:1},
    resources:[{actorId:"horseActor",assignedTo:"pc2",quantity:1,
      capacity:1,speedMph:4,
      method:{costCp:0,costBasis:"none",costApplies:"unit"}}]};
  const ownedBefore=structuredClone(warhorse);
  const result=plan({
    methods:[walking,warhorse,coachMethod],
    assignments:{pc1:"owned|walking",pc2:"owned|walking",
      pc3:"owned|horse",npc1:"hire|coach-hire",npc2:"hire|coach-hire"}
  });
  assert.deepEqual(result.methods.find(m=>m.key==="owned|horse").resourceIds,
    ["horseActor"]);
  assert.equal(result.travelers.find(t=>t.actorId==="pc3").methodKey,"owned|horse");
  assert.deepEqual(warhorse,ownedBefore,
    "temporary mount loan must not rewrite Group's personal mount assignment");
});

test("approved schema-2 records retain safe historical rider names without a migration",()=>{
  const named=walkers.map((t,i)=>({...t,name:["Cassian","Lucious","Torrus","Nyx","Jonathan"][i]}));
  const record=plan({travelers:named});
  assert.deepEqual(record.travelers.map(t=>t.name),named.map(t=>t.name));
  assert.deepEqual(validateMixedLandConvoy(record),record);
  const old=structuredClone(record);
  old.travelers.forEach(t=>{delete t.name;});
  assert.deepEqual(validateMixedLandConvoy(old),old,
    "old schema-2 records load without write-on-read name migration");
  const unsafe=structuredClone(record);
  unsafe.travelers[0].name="Cassian\nInjected";
  assert.throws(()=>validateMixedLandConvoy(unsafe),/Invalid mixed Journey traveler/);
});

test("mixed hired tiers use advertised staffing and rates but the shared convoy travel day",()=>{
  const hired={...coachMethod,serviceLevel:"full",method:{...coach,crewCount:8,
    continuousEnabled:true,hireCrewIncluded:false,includeCrewWages:true,
    crewWageCpPerDay:200,crewWageBasis:"day",
    hireServiceLevels:{full:{hireCostCp:150}}}};
  const input={methods:[walking,hired],routeDistance:48,weightedDistance:48,distanceMi:48};
  const before=JSON.stringify(input);
  const result=plan(input),row=result.methods[1];
  assert.equal(result.movingHours,16);
  assert.equal(row.serviceApproval.serviceLevel,"full");
  assert.equal(row.serviceApproval.advertisedCrew,8);
  assert.equal(row.serviceApproval.advertisedDailyHours,24);
  assert.equal(row.serviceApproval.operation,"normal");
  assert.equal(row.serviceApproval.dailyHours,8);
  assert.equal(row.serviceApproval.baseCp,900);
  assert.equal(row.serviceApproval.crewWagesCp,3200);
  assert.equal(row.estimatedCostCp,4100);
  assert.equal(result.totalCp,4100);
  assert.deepEqual(validateMixedLandConvoy(result),result);
  assert.equal(JSON.stringify(input),before);
  const tampered=structuredClone(result);
  tampered.methods[1].serviceApproval.dailyHours=16;
  assert.throws(()=>validateMixedLandConvoy(tampered),/invalid|schedule/i);
  const changed=structuredClone(result);
  changed.methods[1].estimatedCostCp++;changed.totalCp++;
  assert.throws(()=>validateMixedLandConvoy(changed),/invalid|fare/i);
  assert.equal(plan().methods[1].serviceApproval,undefined);
});
