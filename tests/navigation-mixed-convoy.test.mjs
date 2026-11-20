import assert from "node:assert/strict";
import test from "node:test";
import {planWalkingCargoConvoy,validateWalkingCargoConvoy}
  from "../scripts/navigation-mixed-convoy.js";

const cart={id:"cart",name:"Cart",kind:"vehicle",surface:"land",
  capacity:2,speedMph:4,hireEnabled:true,hireApplies:"unit",
  hireCostCp:100,hireBasis:"day",hireCrewIncluded:true,
  hireUnlimited:false,hireQuantity:1};
const party=Array.from({length:4},(_,i)=>({actorId:"member"+i,
  seatsNeeded:1}));
const quote=(method=cart,options={})=>planWalkingCargoConvoy({
  travelers:party,walkingSpeed:2,sceneUnits:"mi",
  routeDistance:20,weightedDistance:20,distanceMi:20,
  hires:[{method,units:1,checkpointId:"hearth"}],...options
});
test("four walkers plus one finite cargo cart share the slower 2mph pace",()=>{
  const result=quote();
  assert.equal(result.hires[0].units,1);
  assert.equal(result.hires[0].availableUnits,1);
  assert.equal(result.movingHours,10);
  assert.equal(result.suggestedSpeedPerHour,2);
  assert.equal(result.totalCp,200,"10h travel requires two paid 8h days");
  assert.equal(result.travelers.length,4);
  assert.ok(result.travelers.every(t=>t.role==="walking"));
  assert.deepEqual(validateWalkingCargoConvoy(result),result);
});
test("zero stock, unsafe speed, passenger-priced hire and non-land roads fail closed",()=>{
  assert.throws(()=>quote({...cart,hireQuantity:0}),/inventory/);
  assert.throws(()=>quote(cart,{paceOverride:3}),/faster/);
  assert.equal(quote(cart,{paceOverride:1}).movingHours,20);
  assert.throws(()=>quote({...cart,hireApplies:"passenger"}),/unit pricing/);
  assert.throws(()=>quote({...cart,surface:"water"}),/land vehicle/);
  assert.throws(()=>quote({...cart,hireQuantity:1},{
    hires:[{method:cart,units:2,checkpointId:"hearth"}]}),/inventory/);
});
test("multiple cargo hires are quoted once each for actual convoy duration",()=>{
  const wagon={...cart,id:"wagon",name:"Wagon",speedMph:3,
    hireCostCp:150,hireQuantity:3};
  const result=quote(cart,{hires:[
    {method:cart,units:1,checkpointId:"hearth"},
    {method:wagon,units:2,checkpointId:"hearth"}
  ]});
  assert.equal(result.hires.length,2);
  assert.equal(result.totalCp,200+600);
  assert.equal(result.movingHours,10);
  assert.throws(()=>validateWalkingCargoConvoy({...result,
    hires:[result.hires[0],result.hires[0]]}),/Invalid approved/);
  assert.throws(()=>validateWalkingCargoConvoy({...result,speedPerHour:3}),
    /Invalid approved/);
});
test("legacy unlimited service remains available to cargo-only hires",()=>{
  const old={...cart,hireQuantity:undefined,hireUnlimited:undefined};
  assert.equal(quote(old).hires[0].unlimited,true);
  assert.equal(quote(old).hires[0].availableUnits,null);
});
