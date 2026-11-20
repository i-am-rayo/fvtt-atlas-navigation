import assert from "node:assert/strict";
import test from "node:test";
import {planAggregateLandConvoy,validateAggregateLandConvoy}
  from "../scripts/navigation-theater-convoy.js";

const travelers=[
  {actorId:"pc1",passengers:1,seatsNeeded:1},
  {actorId:"pc2",passengers:1,seatsNeeded:1},
  {actorId:"pc3",passengers:1,seatsNeeded:1},
  {actorId:"npc1",passengers:1,seatsNeeded:0},
  {actorId:"npc2",passengers:1,seatsNeeded:1}
];
const walking={key:"owned|walking",arrangement:"owned",
  method:{id:"walking",name:"Walking",kind:"foot",surface:"land"}};
const camel={key:"owned|camel",arrangement:"owned",
  method:{id:"camel",name:"Camel",kind:"mount",surface:"land",
    capacity:1,speedMph:3},
  resources:[{actorId:"camelActor",capacity:1,quantity:1,
    speedMph:3,assignedTo:"pc1",
    method:{costCp:0,costBasis:"none",costApplies:"unit"}}]};
const cart={key:"hire|cart",arrangement:"hire",
  method:{id:"cart",name:"Cart",kind:"vehicle",surface:"land",
    capacity:2,speedMph:4,hireEnabled:true,hireApplies:"unit",
    hireBasis:"day",hireCostCp:200,hireUnlimited:false,hireQuantity:1},
  checkpointId:"hearth",units:1};
const coach={key:"hire|coach",arrangement:"hire",
  method:{id:"coach",name:"Coach",kind:"vehicle",surface:"land",
    capacity:4,speedMph:4,hireEnabled:true,hireApplies:"passenger",
    hireBasis:"day",hireCostCp:100,hireUnlimited:false,hireQuantity:1},
  checkpointId:"hearth",units:1};
const plan=(methods=[walking,camel,cart],opts={})=>
  planAggregateLandConvoy({travelers,methods,walkingSpeed:3,
    sceneUnits:"mi",routeDistance:24,weightedDistance:24,
    distanceMi:24,regularHours:8,...opts});

test("Party-owned camel honors named rider, cart carries cargo, remainder walks",()=>{
  const result=plan();
  const owned=result.methods.find(m=>m.key==="owned|camel");
  const hired=result.methods.find(m=>m.key==="hire|cart");
  const walker=result.methods.find(m=>m.role==="walking");
  assert.equal(owned.passengers,1);
  assert.deepEqual(owned.personalRiders,[{riderId:"pc1",resourceId:"camelActor"}]);
  assert.equal(owned.seatsUsed,1);
  assert.equal(hired.role,"cargo");
  assert.equal(hired.passengers,0);
  assert.equal(hired.units,1);
  assert.equal(walker.passengers,4);
  assert.equal(walker.seatsUsed,3);
  assert.equal(result.totalPassengers,5);
  assert.equal(result.totalSeatsNeeded,4);
  assert.equal(result.totalCp,200);
  assert.equal(result.schemaVersion,3);
  assert.equal(result.allocationMode,"theater-of-mind");
  assert.ok(result.travelers.every(t=>!Object.hasOwn(t,"methodKey")),
    "no invented identity-to-coach assignments");
  assert.deepEqual(validateAggregateLandConvoy(result),result);
});
test("Walking and passenger coach need only total rider count, not names",()=>{
  const result=plan([walking,coach],{
    riderCounts:{"hire|coach":3}
  });
  const service=result.methods.find(m=>m.key==="hire|coach");
  assert.equal(service.passengers,3);
  assert.equal(service.seatsUsed,3);
  assert.equal(service.estimatedCostCp,300);
  assert.equal(result.methods.find(m=>m.role==="walking").passengers,2);
  assert.equal(result.totalCp,300);
  assert.throws(()=>plan([walking,coach],{
    riderCounts:{"hire|coach":0}
  }),/Per-passenger hire needs/);
});
test("No walking requires full Group coverage across chosen modes",()=>{
  assert.throws(()=>plan([camel,coach],{
    riderCounts:{"hire|coach":1}
  }),/do not cover the entire Group/);
  const withCapacity=plan([camel,coach],{
    riderCounts:{"hire|coach":4}
  });
  assert.equal(withCapacity.methods.reduce((n,m)=>n+m.passengers,0),5);
  assert.equal(withCapacity.totalSeatsNeeded,4);
});
test("Cargo local stock is enforced; changing quantities cannot invent hired units",()=>{
  assert.throws(()=>plan([walking,camel,{
    ...cart,method:{...cart.method,hireQuantity:0}
  }]),/Not enough hired/);
  assert.throws(()=>plan([walking,camel,{
    ...cart,units:2
  }]),/Not enough hired/);
  assert.throws(()=>plan([walking,camel,cart],{
    riderCounts:{"hire|cart":3}
  }),/exceeds party members or hired seats/);
  assert.throws(()=>plan([walking,camel,cart],{
    riderCounts:{"hire|cart":-1}
  }),/exceeds party members or hired seats/);
});
test("GM override only increases walking, never a configured 4mph cart",()=>{
  const result=plan([walking,cart],{paceOverride:4});
  assert.equal(result.gmWalkingPaceOverride,true);
  assert.equal(result.movingHours,6);
  assert.equal(result.totalCp,200);
  assert.throws(()=>plan([walking,cart],{paceOverride:5}),/slowest selected vehicle/);
  const altered=structuredClone(result);
  delete altered.gmWalkingPaceOverride;
  assert.throws(()=>validateAggregateLandConvoy(altered),/sustainable pace/);
  const extra=structuredClone(result);
  extra.methods[1].units=2;
  assert.throws(()=>validateAggregateLandConvoy(extra),/Invalid aggregate travel method/);
});
test("Unsaved mounted rider IDs are never double counted in two selected modes",()=>{
  const duplicate={...camel,
    key:"owned|pony",method:{...camel.method,id:"pony"},
    resources:[{...camel.resources[0]}]};
  assert.throws(()=>plan([walking,camel,duplicate]),/has no usable/);
});
