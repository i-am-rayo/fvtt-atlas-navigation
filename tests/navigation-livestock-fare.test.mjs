import test from "node:test";
import assert from "node:assert/strict";
import {quoteTransportationService,readLivestockFarePercent}
  from "../scripts/navigation-transport-service.js";
import {setTransportationPreset,defaultTransportationCatalog,
  listTransportationPresets} from "../scripts/navigation-transport-catalog.js";
import {checkpointOfferMethod,validateCheckpointTransportOffers}
  from "../scripts/checkpoint-transportation.js";
const ship={id:"ship-passage",name:"Passage",kind:"vehicle",surface:"water",
  capacity:10,hireEnabled:true,hireUnlimited:true,hireCostCp:10,
  hireBasis:"mile",hireApplies:"passenger",livestockCapacity:3,
  livestockFareCp:null,livestockFareBasis:"trip",crewCount:0,
  hireCrewIncluded:true,includeCrewWages:false};
const options={arrangement:"hire",operation:"normal",movingHours:5,
  distanceMi:12,travelers:4};
test("three physical mounts pay half-price passenger equivalents, not human seats",()=>{
 const quote=quoteTransportationService(ship,{...options,livestockCount:3});
 assert.equal(quote.baseCp,480,"four human passengers at 1 SP/mile");
 assert.equal(quote.livestockFareCp,180,"three physical mounts each pay half a passenger fare");
 assert.equal(quote.totalCp,660);
 assert.equal(quote.travelers,4);
 assert.equal(quote.units,1);
});
test("animal accommodation can require a second vessel without double passenger fares",()=>{
 const quote=quoteTransportationService({...ship,livestockCapacity:2},{
   ...options,livestockCount:3});
 assert.equal(quote.units,2);
 assert.equal(quote.baseCp,480);
 assert.equal(quote.totalCp,660);
 assert.throws(()=>quoteTransportationService({...ship,livestockCapacity:2,
   hireUnlimited:false,hireQuantity:1},{...options,livestockCount:3}),
   /Not enough hired transportation units/);
 const unlimited=quoteTransportationService({...ship,livestockCapacity:null},
   {...options,livestockCount:3});
 assert.equal(unlimited.units,1,"blank means unlimited animal accommodation");
 assert.equal(unlimited.livestockFareCp,180,"unlimited does not waive animal fare");
 assert.equal(quoteTransportationService({...ship,livestockCapacity:undefined},
   {...options,livestockCount:3}).units,1);
 assert.throws(()=>quoteTransportationService({...ship,livestockCapacity:0},
   {...options,livestockCount:3}),/does not allow/);
 assert.throws(()=>quoteTransportationService({...ship,livestockCapacity:null,
   hireUnlimited:false,hireQuantity:0},{...options,livestockCount:3}),
   /Not enough hired transportation units/,
   "unlimited animal stalls do not create extra hired vessels");
});
test("GM trip/day/mile animal rate overrides default equivalent only for animals",()=>{
 const custom={...ship,livestockFareCp:25,livestockFareBasis:"trip"};
 assert.equal(quoteTransportationService(custom,{...options,livestockCount:3}).totalCp,555);
 assert.equal(quoteTransportationService({...custom,livestockFareBasis:"mile"},
   {...options,livestockCount:3}).livestockFareCp,900);
 assert.equal(quoteTransportationService({...custom,livestockFareBasis:"day"},
   {...options,livestockCount:3}).livestockFareCp,75);
 assert.equal(quoteTransportationService({...ship,hireApplies:"unit"},
   {...options,livestockCount:3}).livestockFareCp,0,
   "default livestock equivalence applies only to per-passenger hired fare");
 assert.equal(quoteTransportationService(ship,{...options,livestockCount:0}).totalCp,480);
});
test("land coaches carrying animals respect unlimited, zero, finite stalls and charged units",()=>{
 const coach={...ship,id:"coach-hire",surface:"land",livestockCapacity:null,
   hireCostCp:40,hireBasis:"trip",capacity:4,hireQuantity:1,hireUnlimited:false};
 const base=quoteTransportationService(coach,{...options,travelers:2,
   livestockCount:3});
 assert.equal(base.units,1);
 assert.equal(base.baseCp,80);
 assert.equal(base.livestockFareCp,60);
 assert.equal(base.totalCp,140);
 assert.throws(()=>quoteTransportationService({...coach,livestockCapacity:0},
   {...options,travelers:2,livestockCount:3}),/does not allow/);
 assert.throws(()=>quoteTransportationService({...coach,livestockCapacity:2},
   {...options,travelers:2,livestockCount:3}),/Not enough hired transportation units/);
 assert.equal(quoteTransportationService({...coach,livestockCapacity:2,
   hireQuantity:2},{...options,travelers:2,livestockCount:3}).units,2);
 assert.equal(quoteTransportationService({...coach,livestockCapacity:1},
   {...options,travelers:2,livestockCount:0}).units,1);
});
test("World and checkpoint overrides retain animal fields without rewriting previous methods",()=>{
 const raw=defaultTransportationCatalog();
 const preset=listTransportationPresets({get:(_m,k)=>k==="guidedTransportationCatalog"?raw:undefined},"dnd5e")
   .find(m=>m.id==="ship-passage");
 const edited={...preset,livestockCapacity:3,livestockFareCp:25,
   livestockFareBasis:"trip"};
 const saved=setTransportationPreset(raw,"dnd5e2024",edited);
 assert.equal(saved.overrides.dnd5e2024["ship-passage"].livestockCapacity,3);
 const checked=validateCheckpointTransportOffers([{methodId:"ship-passage",
   mode:"sea",overrides:{livestockCapacity:2,livestockFareCp:0,
     livestockFareBasis:"mile"}}]);
 assert.equal(checkpointOfferMethod(checked[0],edited).livestockCapacity,2);
 const coach=listTransportationPresets({get:(_m,k)=>k==="guidedTransportationCatalog"?raw:undefined},
   "dnd5e").find(m=>m.id==="coach-hire");
 assert.ok(coach,"builtin land vehicle exists");
 const coachEdited={...coach,livestockCapacity:2,livestockFareCp:40,
   livestockFareBasis:"trip"};
 const coachCatalog=setTransportationPreset(raw,"dnd5e2024",coachEdited);
 assert.equal(coachCatalog.overrides.dnd5e2024["coach-hire"].livestockCapacity,2);
 const land=validateCheckpointTransportOffers([{methodId:"coach-hire",
   mode:"land",overrides:{livestockCapacity:0}}])[0];
 assert.equal(checkpointOfferMethod(land,coachEdited).livestockCapacity,0);
 assert.equal(checkpointOfferMethod({...land,overrides:{livestockCapacity:null}},
   {...coachEdited,livestockCapacity:null}).livestockCapacity,null);
 assert.throws(()=>validateCheckpointTransportOffers([{methodId:"ship-passage",
   mode:"sea",overrides:{livestockCapacity:-1}}]),/Invalid/);
});

test("World defaults, method override, and trip-specific percentage use the same quote",()=>{
  const defaultFare=quoteTransportationService(ship,{...options,livestockCount:2});
  assert.equal(defaultFare.livestockFareCp,120,"two mounts cost 50% of passenger price");
  assert.equal(quoteTransportationService(ship,{...options,livestockCount:2,
    livestockPercent:0}).livestockFareCp,0);
  assert.equal(quoteTransportationService(ship,{...options,livestockCount:2,
    livestockPercent:200}).livestockFareCp,480);
  const method={...ship,livestockFarePercent:25};
  assert.equal(quoteTransportationService(method,{...options,livestockCount:2,
    livestockPercent:200}).livestockFareCp,60,"method beats the World");
  assert.equal(quoteTransportationService({...method,livestockFarePercent:150},{
    ...options,livestockCount:2,livestockPercent:25}).livestockFareCp,360,
    "the current Journey's effective method percentage wins");
  assert.equal(quoteTransportationService({...method,livestockFareCp:5,
    livestockFareBasis:"trip",livestockFarePercent:null},{
    ...options,livestockCount:2,livestockPercent:200}).livestockFareCp,10,
    "existing custom flat fares take precedence when explicitly configured");
  assert.throws(()=>quoteTransportationService({...method,livestockFareCp:5},{
    ...options,livestockCount:2}),/Invalid livestock/);
  for(const livestockPercent of [-1,201,NaN,1.5,"50"])
    assert.throws(()=>quoteTransportationService(ship,{...options,
      livestockCount:2,livestockPercent}),/Invalid transportation service/);
});

test("World fare setting remains bounded and defaults without persisted writes",()=>{
  const reads=[];
  const settings={get(_mod,key){reads.push(key);return undefined;}};
  assert.equal(readLivestockFarePercent(settings),50);
  settings.get=(_mod,key)=>key==="guidedLivestockFarePercent"?125:undefined;
  assert.equal(readLivestockFarePercent(settings),125);
  settings.get=()=>201;
  assert.throws(()=>readLivestockFarePercent(settings),/0 to 200/);
  settings.get=()=>-1;
  assert.throws(()=>readLivestockFarePercent(settings),/0 to 200/);
  assert.ok(reads.includes("guidedLivestockFarePercent"));
});

test("World and Map Marker percentage overrides inherit or explicitly reset",()=>{
  const raw=defaultTransportationCatalog();
  const source=listTransportationPresets({get:(_m,k)=>
    k==="guidedTransportationCatalog"?raw:undefined},"dnd5e")
    .find(method=>method.id==="ship-passage");
  assert.equal(source.livestockFarePercent,null);
  const world=setTransportationPreset(raw,"dnd5e2024",{
    ...source,livestockFarePercent:75});
  assert.equal(world.overrides.dnd5e2024["ship-passage"].livestockFarePercent,75);
  const local=validateCheckpointTransportOffers([{methodId:source.id,mode:"sea",
    overrides:{livestockFarePercent:150}}])[0];
  assert.equal(checkpointOfferMethod(local,source).livestockFarePercent,150);
  const reset=validateCheckpointTransportOffers([{methodId:source.id,mode:"sea",
    overrides:{livestockFarePercent:null}}])[0];
  assert.equal(checkpointOfferMethod(reset,{...source,livestockFarePercent:75}).livestockFarePercent,null);
  assert.throws(()=>validateCheckpointTransportOffers([{methodId:source.id,mode:"sea",
    overrides:{livestockFarePercent:201}}]),/Invalid livestockFarePercent/);
  assert.throws(()=>setTransportationPreset(raw,"dnd5e2024",{
    ...source,livestockFarePercent:250}),/Invalid/);
  assert.deepEqual(raw,defaultTransportationCatalog(),"planning must not mutate World catalog");
});
