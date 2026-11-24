import assert from "node:assert/strict";
import test from "node:test";
import * as catalog from "../scripts/navigation-transport-catalog.js";

const settings=(values={})=>({get(_module,key){return values[key];}});
const preset=(id,values={})=>catalog.findTransportationPreset(id,settings(values),"dnd5e");

test("staffing thresholds derive from the existing reference crew count",()=>{
  assert.deepEqual(catalog.resolveCrewThresholds(preset("warship")),
    {minimum:15,optimal:30,excellent:45,full:60});
  assert.deepEqual(catalog.resolveCrewThresholds(preset("airship")),
    {minimum:3,optimal:5,excellent:8,full:10});
  assert.deepEqual(catalog.resolveCrewThresholds(preset("rowboat")),
    {minimum:1,optimal:1,excellent:1,full:1});
  assert.deepEqual(catalog.resolveCrewThresholds(preset("walking")),
    {minimum:0,optimal:0,excellent:0,full:0});
});

test("staffing classification is advisory, including zero and coincident thresholds",()=>{
  const ship=preset("warship");
  for(const [count,tier] of [[0,"below-minimum"],[14,"below-minimum"],[15,"minimum"],
    [30,"optimal"],[45,"excellent"],[60,"full"],[61,"over-capacity"]])
    assert.equal(catalog.classifyCrewStaffing(ship,count),tier);
  assert.equal(catalog.classifyCrewStaffing(preset("walking"),0),"not-required");
  assert.equal(catalog.classifyCrewStaffing(preset("rowboat"),1),"full");
  for(const count of [-1,1.5,NaN,Infinity])assert.throws(()=>catalog.classifyCrewStaffing(ship,count));
});

test("explicit staffing thresholds round-trip and invalid edits fail closed",()=>{
  const original=catalog.defaultTransportationCatalog();
  const ship=preset("warship");
  const next=catalog.setTransportationPreset(original,"dnd5e2024",
    {...ship,crewCount:40,crewThresholds:{minimum:10,optimal:20,excellent:30}});
  const stored=catalog.validateTransportationCatalog(next);
  assert.deepEqual(stored.overrides.dnd5e2024.warship.crewThresholds,
    {minimum:10,optimal:20,excellent:30});
  const values={[catalog.TRANSPORT_CATALOG_SETTING]:stored};
  assert.deepEqual(catalog.resolveCrewThresholds(preset("warship",values)),
    {minimum:10,optimal:20,excellent:30,full:40});
  assert.deepEqual(original.overrides,{});
  assert.deepEqual(catalog.resolveCrewThresholds(preset("warship",{
    ...values,guidedTravelRulesProfile:"dnd5e2014"})),
    {minimum:15,optimal:30,excellent:45,full:60});
  for(const thresholds of [null,[],{}, {minimum:20,optimal:10,excellent:30},
    {minimum:-1,optimal:20,excellent:30},{minimum:10,optimal:20,excellent:61},
    {minimum:10,optimal:20.5,excellent:30},{minimum:10,optimal:20,excellent:30,extra:1}])
    assert.throws(()=>catalog.setTransportationPreset(original,"dnd5e2024",
      {...ship,crewThresholds:thresholds}),/invalid/i);
  assert.throws(()=>catalog.setTransportationPreset(original,"dnd5e2024",
    {...ship,crewCount:10,crewThresholds:{minimum:5,optimal:8,excellent:11}}),/invalid/i);
});
