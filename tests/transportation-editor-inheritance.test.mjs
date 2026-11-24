import test from "node:test";
import assert from "node:assert/strict";
import {checkpointOfferMethod,defaultCheckpointTransportOffers,
  transportationMethodOverrideDelta,validateCheckpointTransportOffers}
  from "../scripts/checkpoint-transportation.js";
import {findTransportationPreset} from "../scripts/navigation-transport-catalog.js";

const settings={get:()=>undefined};
const cart=()=>findTransportationPreset("cart",settings,"dnd5e");

test("checkpoint method changes preserve World inheritance for untouched fields",()=>{
  const base=cart();
  const selected={...base,hireCostCp:275,note:"Local toll includes bridge passage"};
  const diff=transportationMethodOverrideDelta(base,selected);
  assert.deepEqual(diff,{hireCostCp:275,note:"Local toll includes bridge passage"});
  const offer=validateCheckpointTransportOffers([{
    methodId:base.id,mode:"land",overrides:diff
  }])[0];
  const newerWorld={...base,speedMph:4,capacity:3};
  const effective=checkpointOfferMethod(offer,newerWorld);
  assert.equal(effective.speedMph,4,"new World speed is inherited");
  assert.equal(effective.capacity,3,"new World capacity is inherited");
  assert.equal(effective.hireCostCp,275,"only local fare stays overridden");
  assert.equal(effective.note,selected.note);
});

test("journey estimate overrides use the same delta without changing World or checkpoint data",()=>{
  const base=cart();
  const checkpoint=checkpointOfferMethod({methodId:base.id,mode:"land",
    overrides:{hireCostCp:250,hireEnabled:true}},base);
  const scenario={...checkpoint,hireCostCp:400,overtimeEnabled:true};
  const delta=transportationMethodOverrideDelta(checkpoint,scenario);
  assert.deepEqual(delta,{hireCostCp:400,overtimeEnabled:true});
  assert.equal(checkpoint.hireCostCp,250);
  assert.equal(base.hireCostCp,250);
  const updatedWorld={...checkpoint,capacity:4};
  assert.deepEqual({...updatedWorld,...delta},{...updatedWorld,hireCostCp:400,overtimeEnabled:true});
});

test("Journey mount percentage uses a scoped delta without editing World or Map Marker",()=>{
  const world={...cart(),livestockFarePercent:50};
  const edited={...world,livestockFarePercent:175};
  const delta=transportationMethodOverrideDelta(world,edited);
  assert.deepEqual(delta,{livestockFarePercent:175});
  assert.equal({...world,...delta}.livestockFarePercent,175);
  assert.equal(world.livestockFarePercent,50);
  const marker=checkpointOfferMethod({methodId:world.id,mode:"land",
    overrides:{livestockFarePercent:25}},world);
  assert.equal(marker.livestockFarePercent,25);
  const journey=transportationMethodOverrideDelta(marker,{
    ...marker,livestockFarePercent:0});
  assert.deepEqual(journey,{livestockFarePercent:0});
  assert.equal({...marker,...journey}.livestockFarePercent,0);
  assert.equal(marker.livestockFarePercent,25);
});

test("Town transportation inherits ordinary town carriage and coach offers",()=>{
  const offers=defaultCheckpointTransportOffers("town");
  assert.ok(offers.some(offer=>offer.methodId==="cart"));
  assert.ok(offers.some(offer=>offer.methodId==="coach-hire"));
  assert.ok(offers.every(offer=>Object.keys(offer.overrides)
    .every(key=>!["purchaseGp","crewCount"].includes(key))));
});

test("new inventory fields inherit legacy unlimited supply without noisy overrides",()=>{
  const base=cart();
  const neutral={...base,hireUnlimited:true,hireQuantity:1};
  assert.deepEqual(transportationMethodOverrideDelta(base,neutral),{});
  const local={...neutral,hireUnlimited:false,hireQuantity:2};
  const delta=transportationMethodOverrideDelta(base,local);
  assert.deepEqual(delta,{hireUnlimited:false,hireQuantity:2});
  assert.equal(checkpointOfferMethod({methodId:base.id,mode:"land",
    overrides:delta},base).hireQuantity,2);
  assert.deepEqual(transportationMethodOverrideDelta(base,neutral),{});
});
