import test from "node:test";
import assert from "node:assert/strict";
import {findTransportationPreset,defaultTransportationCatalog,setTransportationPreset,
  TRANSPORT_CATALOG_SETTING} from "../scripts/navigation-transport-catalog.js";
import * as service from "../scripts/navigation-transport-service.js";
import {checkpointOfferMethod,transportationMethodOverrideDelta,validateCheckpointTransportOffers}
  from "../scripts/checkpoint-transportation.js";
const preset=(id="warship",catalog)=>findTransportationPreset(id,{get:(_m,k)=>
  k===TRANSPORT_CATALOG_SETTING?catalog:undefined},"dnd5e");
const ship=()=>({...preset(),hireEnabled:true,overtimeEnabled:true,continuousEnabled:true});
const offer=overrides=>({methodId:"warship",mode:"sea",overrides});

test("hired service levels use staffing thresholds and only eligible operating schedules",()=>{
  const method=ship(),before=JSON.stringify(method);
  const rows=["minimum","optimal","excellent","full"].map(tier=>service.resolveHiredServiceLevel(method,tier));
  assert.deepEqual(rows.map(r=>r.crewCount),[15,30,45,60]);
  assert.deepEqual(rows.map(r=>r.operation),["normal","overtime","overtime","continuous"]);
  assert.deepEqual(rows.map(r=>r.hireCostCp),[25000,25000,25000,25000]);
  assert.equal(service.resolveHiredServiceLevel({...method,continuousEnabled:false},"full").operation,"overtime");
  assert.equal(service.resolveHiredServiceLevel({...method,overtimeEnabled:false,continuousEnabled:false},"optimal").operation,"normal");
  assert.throws(()=>service.resolveHiredServiceLevel({...method,hireEnabled:false},"full"),/hire/i);
  assert.throws(()=>service.resolveHiredServiceLevel({...method,kind:"mount"},"full"),/vehicle/i);
  assert.throws(()=>service.resolveHiredServiceLevel(method,"unknown"),/level/i);
  assert.equal(JSON.stringify(method),before);
});

test("World and Map Marker service overrides retain field inheritance and explicit zero",()=>{
  const world=ship();
  const levels={optimal:{hireCostCp:12345},full:{operation:"overtime",hireCostCp:40000}};
  const saved=setTransportationPreset(defaultTransportationCatalog(),"dnd5e2024",{...world,hireServiceLevels:levels});
  const base=preset("warship",saved);
  assert.deepEqual(base.hireServiceLevels,levels);
  const local=checkpointOfferMethod(offer({hireServiceLevels:{optimal:{hireCostCp:0},full:{operation:"continuous"}}}),base);
  assert.equal(service.resolveHiredServiceLevel(local,"optimal").hireCostCp,0);
  assert.equal(service.resolveHiredServiceLevel(local,"full").hireCostCp,40000);
  assert.equal(service.resolveHiredServiceLevel(local,"full").operation,"continuous");
  assert.deepEqual(transportationMethodOverrideDelta(base,local),{hireServiceLevels:{
    optimal:{hireCostCp:0},full:{operation:"continuous"}}});
  assert.deepEqual(transportationMethodOverrideDelta(base,structuredClone(base)),{});
  const changed={...base,hireServiceLevels:{...levels,full:{...levels.full,hireCostCp:42000}}};
  assert.equal(service.resolveHiredServiceLevel(checkpointOfferMethod(offer({
    hireServiceLevels:{full:{operation:"continuous"}}}),changed),"full").hireCostCp,42000);
  assert.equal(service.resolveHiredServiceLevel(checkpointOfferMethod(offer({}),base),"optimal").hireCostCp,12345);
  for(const invalid of [null,[],{bad:{hireCostCp:0}},{full:{hireCostCp:-1}},{full:{operation:"teleport"}},
    {full:{unknown:1}},{full:{hireCostCp:Infinity}}]){
    assert.throws(()=>setTransportationPreset(saved,"dnd5e2024",{...base,hireServiceLevels:invalid}),/invalid/i);
    assert.throws(()=>validateCheckpointTransportOffers([offer({hireServiceLevels:invalid})]),/invalid/i);
  }
  assert.throws(()=>service.resolveHiredServiceLevel({...base,continuousEnabled:false,
    hireServiceLevels:{full:{operation:"continuous"}}},"full"),/continuous/i);
});
test("explicit service levels quote advertised crew once and preserve legacy quote defaults",()=>{
  const method={...ship(),hireCostCp:1000,hireCrewIncluded:false,includeCrewWages:true,crewWageCpPerDay:200};
  const args={arrangement:"hire",movingHours:24,distanceMi:60,travelers:1,regularHours:8};
  const min=service.quoteTransportationService(method,{...args,serviceLevel:"minimum"});
  const full=service.quoteTransportationService(method,{...args,serviceLevel:"full"});
  assert.equal(min.operation,"normal");assert.equal(min.crewWagesCp,9000);
  assert.equal(full.operation,"continuous");assert.equal(full.crewWagesCp,36000);
  assert.equal(full.serviceLevel,"full");assert.equal(full.advertisedCrew,60);
  assert.equal(service.quoteTransportationService({...method,hireCrewIncluded:true},{...args,serviceLevel:"full"}).crewWagesCp,0);
  assert.equal(service.quoteTransportationService(method,args).crewWagesCp,36000);
  assert.equal(service.quoteTransportationService(method,args).serviceLevel,undefined);
  const edited=service.quoteTransportationService(method,{...args,serviceLevel:"optimal",hireTerms:{hireCostCp:0}});
  assert.equal(edited.operation,"overtime");assert.equal(edited.baseCp,0);
  assert.throws(()=>service.quoteTransportationService(method,{...args,arrangement:"owned",serviceLevel:"full"}),/hire/i);
});

test("stale inherited staffing remains readable for correction and cannot produce a service quote",()=>{
  const world={...ship(),crewThresholds:{minimum:15,optimal:30,excellent:45}};
  const local=offer({crewCount:20});
  const effective=checkpointOfferMethod(local,world);
  assert.equal(effective.crewCount,20);
  assert.deepEqual(effective.crewThresholds,world.crewThresholds);
  assert.throws(()=>service.resolveHiredServiceLevel(effective,"full"),/threshold/i);
  const corrected=checkpointOfferMethod(offer({crewCount:20,crewThresholds:{minimum:5,optimal:10,excellent:15}}),world);
  assert.equal(service.resolveHiredServiceLevel(corrected,"optimal").crewCount,10);
  assert.deepEqual(local,offer({crewCount:20}),"read does not repair or rewrite an offer");
});

test("Journey overrides compose with Map Marker and World tiers without copying sibling terms",async()=>{
  const {applyTransportationMethodOverrides}=await import("../scripts/checkpoint-transportation.js");
  const world={...ship(),hireServiceLevels:{minimum:{hireCostCp:1000},optimal:{hireCostCp:2000,operation:"overtime"},full:{hireCostCp:4000}}};
  const marker=checkpointOfferMethod(offer({hireServiceLevels:{optimal:{hireCostCp:3000}}}),world);
  const local={hireServiceLevels:{optimal:{operation:"normal"},full:{hireCostCp:0}}};
  const before=JSON.stringify({world,marker,local});
  const effective=applyTransportationMethodOverrides(marker,local);
  assert.deepEqual(effective.hireServiceLevels,{minimum:{hireCostCp:1000},
    optimal:{hireCostCp:3000,operation:"normal"},full:{hireCostCp:0}});
  assert.deepEqual(transportationMethodOverrideDelta(marker,effective),local);
  const updated=applyTransportationMethodOverrides(checkpointOfferMethod(offer({
    hireServiceLevels:{optimal:{hireCostCp:3500}}}),world),local);
  assert.equal(service.resolveHiredServiceLevel(updated,"optimal").hireCostCp,3500);
  assert.equal(service.resolveHiredServiceLevel(updated,"optimal").operation,"normal");
  assert.equal(JSON.stringify({world,marker,local}),before);
  assert.deepEqual(applyTransportationMethodOverrides(marker,null),marker);
  assert.throws(()=>applyTransportationMethodOverrides(marker,{hireServiceLevels:{full:{operation:"invalid"}}}),/invalid/i);
});
