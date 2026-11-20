import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveAtlasMeasuringUnits,resolveCheckpointElevationUnits,
  atlasDisplayDistance,atlasDisplaySpeed,
  atlasDisplayPresetSpeed,atlasPresetSpeedFromDisplay,
  atlasSceneDistanceFromDisplay,atlasSceneSpeedFromDisplay,atlasDisplayElevation,
  atlasDisplayCostPerDistance,atlasCostPerMileFromDisplay
} from "../scripts/navigation-measure-units.js";

const settings=(choice="system",dndMetric=false)=>({
  get(ns,key){
    if(ns==="fvtt-atlas-navigation"&&key==="measuringUnits")return choice;
    if(ns==="dnd5e"&&key==="metricLengthUnits")return dndMetric;
    throw new Error("Unknown setting");
  }
});
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,
  actual+" was not "+expected);

test("D&D 5e System Default follows metricLengthUnits, not Scene grid units",()=>{
  assert.equal(resolveAtlasMeasuringUnits(settings("system",false),"dnd5e","km"),"imperial");
  assert.equal(resolveAtlasMeasuringUnits(settings("system",true),"dnd5e","mi"),"metric");
  assert.equal(resolveAtlasMeasuringUnits(settings("metric",false),"dnd5e","mi"),"metric");
  assert.equal(resolveAtlasMeasuringUnits(settings("imperial",true),"dnd5e","km"),"imperial");
});
test("unknown systems safely use Scene native unit family",()=>{
  assert.equal(resolveAtlasMeasuringUnits(settings(),"pf2e","km"),"metric");
  assert.equal(resolveAtlasMeasuringUnits(settings(),"pf2e","ft"),"imperial");
  assert.equal(resolveAtlasMeasuringUnits(settings(),"pf2e","leagues"),"imperial");
});
test("navigation distances and speeds convert display but preserve source values",()=>{
  const imperial=settings("system",false);
  const distance=atlasDisplayDistance(162.1,"km",imperial,"dnd5e");
  assert.equal(distance.unit,"mi");
  near(distance.value,100.72427026167183);
  const speed=atlasDisplaySpeed(4.828032,"km",imperial,"dnd5e");
  assert.equal(speed.unit,"mi/hour");near(speed.value,3);
  const metric=settings("system",true);
  near(atlasDisplayDistance(3,"mi",metric,"dnd5e").value,4.828032);
  near(atlasDisplayDistance(5280,"ft",metric,"dnd5e").value,1.609344);
  assert.deepEqual(atlasDisplayDistance(10,"leagues",metric,"dnd5e"),
    {value:10,unit:"leagues"},"unknown Scene units must not invent conversions");
});
test("transport preset editing stores canonical mph even when shown in km/h",()=>{
  const metric=settings("metric",false);
  const rendered=atlasDisplayPresetSpeed(3,metric,"dnd5e");
  assert.equal(rendered.unit,"km/h");near(rendered.value,4.828032);
  near(atlasPresetSpeedFromDisplay(rendered.value,metric,"dnd5e"),3);
  const imperial=settings("imperial",true);
  assert.deepEqual(atlasDisplayPresetSpeed(3,imperial,"dnd5e"),{value:3,unit:"mph"});
});
test("Scene exploration radius values round-trip without changing Scene flags",()=>{
  const imperial=settings("imperial",false);
  const shown=atlasDisplayDistance(2,"km",imperial,"dnd5e").value;
  near(atlasSceneDistanceFromDisplay(shown,"km",imperial,"dnd5e"),2);
});
test("checkpoint elevation remains stored in meters",()=>{
  const display=atlasDisplayElevation(304.8,settings("imperial"),"dnd5e");
  assert.equal(display.unit,"ft");near(display.value,1000);
  assert.deepEqual(atlasDisplayElevation(100,settings("metric"),"dnd5e"),
    {value:100,unit:"m"});
});
test("per-distance fare labels and editor rates round-trip across unit systems",()=>{
  const metric=settings("metric",false);
  const cpPerKm=atlasDisplayCostPerDistance(3,metric,"dnd5e");
  near(atlasCostPerMileFromDisplay(cpPerKm,metric,"dnd5e"),3);
  near(atlasDisplayCostPerDistance(3,settings("imperial"),"dnd5e"),3);
});

test("checkpoint elevation follows native Foundry Scene grid unit family with system fallback",()=>{
  const dndMetric=settings("system",true);
  const explicitImperial=settings("imperial",false);
  assert.equal(resolveCheckpointElevationUnits("km",explicitImperial,"dnd5e"),"metric",
    "native kilometre Scene must display elevation in meters, not feet");
  assert.equal(resolveCheckpointElevationUnits("ft",dndMetric,"dnd5e"),"imperial",
    "native feet Scene remains in feet without modifying saved meters");
  assert.equal(resolveCheckpointElevationUnits("",dndMetric,"dnd5e"),"metric",
    "Scenes without a recognized unit use D&D5e metric setting");
  assert.equal(resolveCheckpointElevationUnits("unknown",settings("metric"),"pf2e"),"metric");
});

test("custom convoy speeds round-trip the World metric and imperial settings",()=>{
  for(const choice of ["metric","imperial"]){
    const config=settings(choice,false);
    const original=4;
    const rendered=atlasDisplaySpeed(original,"mi",config,"dnd5e");
    near(atlasSceneSpeedFromDisplay(rendered.value,"mi",config,"dnd5e"),original);
    assert.equal(rendered.unit,choice==="metric"?"km/hour":"mi/hour");
  }
});

test("global metric comparison shows 3mph walkers and 4mph carts exactly 1.61km/h apart",()=>{
  const metric=settings("metric");
  const walking=atlasDisplaySpeed(3,"mi",metric,"dnd5e");
  const cart=atlasDisplaySpeed(4,"mi",metric,"dnd5e");
  near(cart.value-walking.value,1.609344);
});

test("rounded metric cart ceiling 6.44 km/h maps to exactly 4 mph, not faster",()=>{
  const metric=settings("metric",false);
  const displayed=atlasDisplaySpeed(4,"mi",metric,"dnd5e");
  assert.equal(Number(displayed.value.toFixed(2)),6.44);
  assert.ok(atlasSceneSpeedFromDisplay(6.44,"mi",metric,"dnd5e")>4);
  near(atlasSceneSpeedFromDisplay(6.44,"mi",metric,"dnd5e",4),4);
  assert.equal(atlasSceneSpeedFromDisplay(6.45,"mi",metric,"dnd5e",4)>4,true,
    "a genuinely faster pace remains above the vehicle ceiling");
});
