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
  const gm=quote(cart,{paceOverride:3});
  assert.equal(gm.gmWalkingPaceOverride,true);
  assert.equal(gm.sceneUnits,"mi");
  assert.equal(gm.movingHours,20/3);
  assert.equal(gm.totalCp,100,"a GM-approved faster pace changes day-rate hire cost");
  assert.throws(()=>quote(cart,{paceOverride:5}),/slowest hired vehicle/);
  assert.equal(quote(cart,{paceOverride:1}).movingHours,20);
  assert.equal(quote(cart,{paceOverride:1}).totalCp,300,
    "twenty convoy moving hours require three eight-hour hired days");
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

test("inline pace comparison has one recommended/custom decision and unit-consistent speeds",async()=>{
  const previous=globalThis.document;
  globalThis.document={createElement:tag=>({
    tag,children:[],style:{},listeners:new Map(),
    append(...nodes){this.children.push(...nodes);},
    addEventListener(name,cb){this.listeners.set(name,cb);},
    setAttribute(){}
  })};
  try{
    const {renderWalkingCargoControls}=await import("../scripts/navigation-mixed-convoy-view.js");
    const changed=[];
    const view=renderWalkingCargoControls({
      participants:[
        {label:"Walking (party pace)",speed:"4.83"},
        {label:"Cart (cargo only)",speed:"6.44",methodId:"cart",available:1}
      ],
      quantities:{cart:1},recommendedSpeed:"4.83",
      maximumSpeed:"6.44",customPace:null,unit:"km/h",
      plan:{speed:"4.83",moving:"10h",cost:"200 CP"},
      onQuantity:(id,count)=>changed.push(["units",id,count]),
      onPace:pace=>changed.push(["pace",pace])
    });
    const all=node=>[node,...node.children.flatMap(all)];
    const inputs=all(view).filter(n=>n.tag==="input");
    const quantity=inputs.find(n=>n.type==="number"&&n.min==="1");
    assert.equal(quantity.value,"1");
    quantity.value="2";quantity.listeners.get("change")();
    const radios=inputs.filter(n=>n.type==="radio");
    assert.equal(radios.length,2);
    assert.equal(radios[0].checked,true,"slowest is suggested by default");
    radios[1].checked=true;radios[1].listeners.get("change")();
    assert.equal(inputs.filter(n=>n.type==="checkbox").length,0,
      "transport choices belong in the unified Travel method fieldset");
    assert.ok(all(view).some(n=>String(n.textContent??"").includes("km/h")));
    assert.ok(all(view).some(n=>String(n.textContent??"").includes(
      "Maximum with selected hired vehicles: 6.44 km/h")));
    assert.ok(all(view).some(n=>String(n.textContent??"")==="GM pace override"));
    assert.deepEqual(changed,[["units","cart",2],["pace","custom"]]);
  }finally{globalThis.document=previous;}
});

test("3 mph walkers can explicitly travel at 4 mph with a 4 mph hired cargo cart",()=>{
  const chosen=quote(cart,{walkingSpeed:3,paceOverride:4,
    routeDistance:30,weightedDistance:30,distanceMi:30});
  assert.equal(chosen.suggestedSpeedPerHour,3);
  assert.equal(chosen.speedPerHour,4);
  assert.equal(chosen.movingHours,7.5);
  assert.equal(chosen.totalCp,100);
  assert.equal(chosen.gmWalkingPaceOverride,true);
  assert.deepEqual(validateWalkingCargoConvoy(chosen),chosen);
  const recommended=quote(cart,{walkingSpeed:3,
    routeDistance:30,weightedDistance:30,distanceMi:30});
  assert.equal(recommended.movingHours,10);
  assert.equal(recommended.totalCp,200);
  assert.equal(recommended.gmWalkingPaceOverride,undefined);
  const unapproved=structuredClone(chosen);
  delete unapproved.gmWalkingPaceOverride;
  assert.throws(()=>validateWalkingCargoConvoy(unapproved),/Invalid approved/);
  const overVehicle=structuredClone(chosen);
  overVehicle.speedPerHour=4.01;
  assert.throws(()=>validateWalkingCargoConvoy(overVehicle),/Invalid approved/);
  const changedCart=structuredClone(chosen);
  changedCart.hires[0].speedMph=3;
  assert.throws(()=>validateWalkingCargoConvoy(changedCart),/Invalid approved/);
  const missingUnits=structuredClone(chosen);
  missingUnits.sceneUnits="furlongs";
  assert.throws(()=>validateWalkingCargoConvoy(missingUnits),/Invalid approved/);
});
