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
      pc3:"hire|coach-hire",npc1:"hire|coach-hire",npc2:"hire|coach-hire"}
  }),/cannot be selected twice/);
});
