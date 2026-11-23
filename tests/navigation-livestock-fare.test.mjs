import test from "node:test";
import assert from "node:assert/strict";
import {quoteTransportationService} from "../scripts/navigation-transport-service.js";
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
test("three physical mounts pay three additional fare equivalents, not human seats",()=>{
 const quote=quoteTransportationService(ship,{...options,livestockCount:3});
 assert.equal(quote.baseCp,480,"four human passengers at 1 SP/mile");
 assert.equal(quote.livestockFareCp,360,"three physical mounts each pay one fare");
 assert.equal(quote.totalCp,840);
 assert.equal(quote.travelers,4);
 assert.equal(quote.units,1);
});
test("animal accommodation can require a second vessel without double passenger fares",()=>{
 const quote=quoteTransportationService({...ship,livestockCapacity:2},{
   ...options,livestockCount:3});
 assert.equal(quote.units,2);
 assert.equal(quote.baseCp,480);
 assert.equal(quote.totalCp,840);
 assert.throws(()=>quoteTransportationService({...ship,livestockCapacity:2,
   hireUnlimited:false,hireQuantity:1},{...options,livestockCount:3}),
   /Not enough hired transportation units/);
 assert.throws(()=>quoteTransportationService({...ship,livestockCapacity:null},
   {...options,livestockCount:3}),/verified vessel livestock capacity/);
 assert.throws(()=>quoteTransportationService({...ship,livestockCapacity:0},
   {...options,livestockCount:3}),/verified vessel livestock capacity/);
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
test("World and checkpoint overrides retain animal fields without rewriting previous methods",()=>{
 const raw=defaultTransportationCatalog();
 const preset=listTransportationPresets({get:()=>raw},"dnd5e")
   .find(m=>m.id==="ship-passage");
 const edited={...preset,livestockCapacity:3,livestockFareCp:25,
   livestockFareBasis:"trip"};
 const saved=setTransportationPreset(raw,"dnd5e2024",edited);
 assert.equal(saved.overrides.dnd5e2024["ship-passage"].livestockCapacity,3);
 const checked=validateCheckpointTransportOffers([{methodId:"ship-passage",
   mode:"sea",overrides:{livestockCapacity:2,livestockFareCp:0,
     livestockFareBasis:"mile"}}]);
 assert.equal(checkpointOfferMethod(checked[0],edited).livestockCapacity,2);
 assert.throws(()=>validateCheckpointTransportOffers([{methodId:"ship-passage",
   mode:"sea",overrides:{livestockCapacity:-1}}]),/Invalid/);
});
