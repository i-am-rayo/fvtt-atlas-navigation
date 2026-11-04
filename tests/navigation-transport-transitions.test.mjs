import assert from "node:assert/strict";
import test from "node:test";
import {projectTransportationRouteLegs,transportationLegSelection,
  describeTransportationLeg,TRANSPORT_TRANSITION_SCHEMA}
  from "../scripts/navigation-transport-transitions.js";

const p=(x,y)=>({x,y});
const atlas=()=>({
  roads:[
    {id:"road-east",name:"East Road",travelPresetId:null},
    {id:"strait",name:"Barthos Strait",travelPresetId:"sea"},
    {id:"road-west",name:"West Road",travelPresetId:null}
  ],
  nodes:[{id:"a",...p(0,0)},{id:"port-a",...p(20,0)},
    {id:"port-b",...p(50,0)},{id:"b",...p(70,0)}],
  checkpoints:[
    {id:"barthos",name:"Port Barthos",roadId:"road-east",nodeId:"port-a"},
    {id:"haven",name:"Haven Dock",roadId:"strait",nodeId:"port-b"}
  ]
});
const presets=[{id:"sea",mode:"water"}];
const segment=(roadId,from,to,distance=20)=>({
  kind:"road",roadId,segmentId:roadId,points:[from,to],
  distance,cost:distance
});
const route=()=>({
  status:"ok",start:p(0,0),end:p(70,0),distance:70,cost:70,
  legs:[
    segment("road-east",p(0,0),p(20,0)),
    segment("strait",p(20,0),p(50,0),30),
    segment("road-west",p(50,0),p(70,0))
  ]
});

test("land → water → land becomes three ordered legs with explicit port transfers",()=>{
  const source=route(),map=atlas();
  const plan=projectTransportationRouteLegs(source,map,presets);
  assert.equal(plan.schemaVersion,TRANSPORT_TRANSITION_SCHEMA);
  assert.equal(plan.hasTransitions,true);
  assert.equal(plan.validTransfers,true);
  assert.deepEqual(plan.legs.map(leg=>leg.surface),["land","water","land"]);
  assert.deepEqual(plan.legs.map(leg=>leg.distance),[20,30,20]);
  assert.deepEqual(plan.legs.map(leg=>leg.roadNames),[
    ["East Road"],["Barthos Strait"],["West Road"]
  ]);
  assert.equal(plan.legs[0].arrivalCheckpoint.name,"Port Barthos");
  assert.equal(plan.legs[1].departureCheckpoint.name,"Port Barthos");
  assert.equal(plan.legs[1].arrivalCheckpoint.name,"Haven Dock");
  assert.equal(plan.legs[2].departureCheckpoint.name,"Haven Dock");
  assert.deepEqual(source,route(),"planning must never rewrite route geometry");
  assert.deepEqual(map,atlas(),"planning must never change checkpoint flags");
});

test("unknown or absent checkpoint at a mode boundary blocks explicit transfer",()=>{
  const map=atlas();
  map.checkpoints=map.checkpoints.filter(cp=>cp.id!=="barthos");
  const plan=projectTransportationRouteLegs(route(),map,presets);
  assert.equal(plan.validTransfers,false);
  assert.equal(plan.legs[0].transferValid,false);
  assert.equal(plan.legs[1].departureCheckpoint,null);
});

test("leading approach follows the road while the trailing unknown stretch stays independent",()=>{
  const r=route();
  r.legs.unshift({kind:"off-road",points:[p(-2,0),p(0,0)],distance:2,cost:3});
  r.legs.push({kind:"off-road",points:[p(70,0),p(72,0)],distance:2,cost:3});
  const plan=projectTransportationRouteLegs(r,atlas(),presets);
  assert.deepEqual(plan.legs.map(leg=>leg.distance),[22,30,20,2]);
  assert.deepEqual(plan.legs.map(leg=>leg.surface),["land","water","land","unspecified"]);
  assert.equal(plan.legs[0].weightedDistance,23);
  assert.equal(plan.legs[3].weightedDistance,3);
  assert.equal(plan.validTransfers,false,"an off-road mode transfer requires an authored checkpoint");
});

test("only walking safely defaults on land; non-land legs require a selection",()=>{
  const plan=projectTransportationRouteLegs(route(),atlas(),presets);
  assert.deepEqual(transportationLegSelection(plan.legs[0]),
    {arrangement:"owned",methodId:"walking"});
  assert.equal(transportationLegSelection(plan.legs[1]),null);
  assert.deepEqual(transportationLegSelection(plan.legs[1],"hire|warship"),
    {arrangement:"hire",methodId:"warship"});
  assert.throws(()=>transportationLegSelection(plan.legs[1],"hire|bad#id"),/Invalid/);
});

test("port arrival, hired passage, embarkation and disembarkation are named",()=>{
  const plan=projectTransportationRouteLegs(route(),atlas(),presets);
  const first=describeTransportationLeg(plan.legs[0],{
    name:"Walking (party pace)",kind:"foot",surface:"land",arrangement:"owned"});
  const water=describeTransportationLeg(plan.legs[1],{
    name:"Warship",kind:"vehicle",surface:"water",arrangement:"hire"});
  const after=describeTransportationLeg(plan.legs[2],{
    name:"Walking (party pace)",kind:"foot",surface:"land",arrangement:"owned"});
  assert.match(first.join(" "),/Reached Port Barthos/);
  assert.match(water.join(" "),/booked passage.*Port Barthos/);
  assert.match(water.join(" "),/embarked.*Warship.*Barthos Strait/);
  assert.match(water.join(" "),/Disembarked at Haven Dock/);
  assert.match(after.join(" "),/West Road/);
  assert.match(describeTransportationLeg(plan.legs[0],{
    name:"Caravan",kind:"vehicle",surface:"land",arrangement:"hire"}).join(" "),
    /Hired Caravan.*to continue travel/);
});

test("unknown authored travel surface fails closed without inferring land",()=>{
  const broken=atlas();
  broken.roads[1].travelPresetId="missing";
  assert.throws(()=>projectTransportationRouteLegs(route(),broken,presets),
    /unknown travel surface preset/);
});

test("water-to-unclassified final approach never inherits an ocean vessel",()=>{
  const r=route();
  r.legs.pop();
  r.legs.push({kind:"off-road",points:[p(50,0),p(70,0)],distance:16.64,cost:16.64});
  const map=atlas();
  map.checkpoints=map.checkpoints.filter(cp=>cp.id!=="haven");
  const plan=projectTransportationRouteLegs(r,map,presets);
  assert.deepEqual(plan.legs.map(leg=>leg.surface),["land","water","unspecified"]);
  assert.equal(plan.legs[1].distance,30,"the water fare excludes the final approach");
  assert.equal(plan.legs[2].distance,16.64);
  assert.equal(transportationLegSelection(plan.legs[2]),null,
    "unspecified ground does not quietly inherit a ship or walking");
  assert.equal(plan.legs[1].transferValid,false,
    "an unknown landing must be confirmed at a checkpoint");
});
