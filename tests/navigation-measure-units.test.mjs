import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveAtlasMeasuringUnits,atlasDisplayDistance,atlasDisplaySpeed,
  atlasDisplayPresetSpeed,atlasPresetSpeedFromDisplay,
  atlasSceneDistanceFromDisplay,atlasDisplayElevation,
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
