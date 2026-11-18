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

test("Town transportation inherits ordinary town carriage and coach offers",()=>{
  const offers=defaultCheckpointTransportOffers("town");
  assert.ok(offers.some(offer=>offer.methodId==="cart"));
  assert.ok(offers.some(offer=>offer.methodId==="coach-hire"));
  assert.ok(offers.every(offer=>Object.keys(offer.overrides)
    .every(key=>!["purchaseGp","crewCount"].includes(key))));
});
