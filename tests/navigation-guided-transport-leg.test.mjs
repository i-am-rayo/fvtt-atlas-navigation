import assert from "node:assert/strict";
import test from "node:test";
import {prepareGuidedTransportLeg,confirmGuidedCheckpointArrival}
  from "../scripts/navigation-guided-transport-leg.js";

const p=(x,y)=>({x,y});
const road=(id,a,b,d)=>({
  kind:"road",roadId:id,segmentId:id,points:[a,b],distance:d,cost:d
});
const source=()=>({
  status:"ok",start:p(0,0),end:p(30,0),distance:30,cost:30,terrainAware:false,
  legs:[road("road-a",p(0,0),p(10,0),10),
    road("sea",p(10,0),p(25,0),15),
    {kind:"off-road",points:[p(25,0),p(30,0)],distance:5,cost:5}]
});
const current=()=>({
  index:0,firstRouteLeg:0,lastRouteLeg:0,start:p(0,0),end:p(10,0),
  distance:10,hours:3,errors:[],transferValid:true,surface:"land",
  roadNames:["East Road"],arrivalCheckpoint:{id:"port-a",name:"Port Barthos"},
  selectedOption:{arrangement:"owned",method:{id:"walking",name:"Walking",
    kind:"foot"}},costCp:0
});

test("one confirmed leg clips native waypoints at its checkpoint, never following water",()=>{
  const route=source(),leg=current();
  const result=prepareGuidedTransportLeg(route,leg);
  assert.equal(result.legs.length,1);
  assert.deepEqual(result.end,p(10,0));
  assert.deepEqual(result.checkpoint,{id:"port-a",name:"Port Barthos",point:p(10,0)});
  assert.equal(result.distance,10);
  assert.equal(result.transport.methodId,"walking");
  assert.deepEqual(route,source(),"the full authored route is never mutated");
});

test("transport speed and surface data remain explicit and immutable",()=>{
  const leg=current();leg.surface="water";
  leg.selectedOption={arrangement:"hire",method:{id:"sailing",name:"Sailing Ship",
    kind:"vehicle"}};
  const result=prepareGuidedTransportLeg(source(),leg);
  assert.equal(result.terrainAware,false);
  assert.equal(result.transport.arrangement,"hire");
  assert.equal(result.transport.estimatedFareCp,0);
  assert.deepEqual(result.transport.roadNames,["East Road"]);
});

test("reject speculative travel, missing checkpoints and modified route geometry",()=>{
  const leg=current();delete leg.arrivalCheckpoint;
  assert.throws(()=>prepareGuidedTransportLeg(source(),leg),/checkpoint/);
  leg.arrivalCheckpoint={id:"port-a",name:"Port Barthos"};
  leg.errors=["No vessel in reach"];
  assert.throws(()=>prepareGuidedTransportLeg(source(),leg),/checkpoint/);
  leg.errors=[];leg.lastRouteLeg=2;
  assert.throws(()=>prepareGuidedTransportLeg(source(),leg),/no longer matches|distance changed/);
});

test("arrival is confirmed against the actual translated token position",()=>{
  const token={x:0,y:0,width:1,height:1};
  assert.equal(confirmGuidedCheckpointArrival({token,gridSize:100,
    atlasPoint:p(100,100),expectedPoint:p(100,100)}),true);
  assert.equal(confirmGuidedCheckpointArrival({token,gridSize:100,
    atlasPoint:p(500,100),expectedPoint:p(100,100)}),false);
  assert.throws(()=>confirmGuidedCheckpointArrival({token,gridSize:0,
    atlasPoint:p(100,100),expectedPoint:p(100,100)}),/cannot be verified/);
});
