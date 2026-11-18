import test from "node:test";
import assert from "node:assert/strict";
import { GEOGRAPHY_SCHEMA_VERSION, validateGeographyFlag, validateGeographyHierarchy,
  sampleAtlasRoads, buildTerritoryRoadDirectory }
  from "../scripts/territory-geography-model.js";

const geography=(kind,parentRegionId=null,roadOverrides={})=>({
  schemaVersion:GEOGRAPHY_SCHEMA_VERSION,kind,parentRegionId,roadOverrides
});
const territory=(id,name,kind,parentRegionId=null,roadOverrides={})=>({
  id,name,linked:true,geography:geography(kind,parentRegionId,roadOverrides)
});

test("geography is a strict versioned Atlas-only description, not native Levels",()=>{
  assert.equal(validateGeographyFlag(null),null);
  assert.deepEqual(validateGeographyFlag(geography("city")),geography("city"));
  assert.deepEqual(validateGeographyFlag(geography("settlement")),geography("settlement"));
  for(const flag of [[],{}, {schemaVersion:2,kind:"city"},
    {...geography("city"),levels:["surface"]},geography("planet"),
    geography("continent","parent"),geography("town",null,{road1:"unknown"}),
    geography("town",null,{"": "include"})]) {
    assert.throws(()=>validateGeographyFlag(flag),/Unsupported|Invalid/);
  }
});

test("parents require Atlas-linked geographic parent, and cycles are refused",()=>{
  const continent=territory("continent","Valecor","continent");
  const city=territory("city","Dirwest","city","continent");
  const map=new Map([continent,city].map(t=>[t.id,t]));
  assert.doesNotThrow(()=>validateGeographyHierarchy(city.id,city.geography,map));
  assert.throws(()=>validateGeographyHierarchy("continent",geography("area","city"),map),/Parent territory/);
  const area=territory("area","Inner Valecor","area","continent");
  map.set(area.id,area);
  assert.throws(()=>validateGeographyHierarchy("continent",geography("area","area"),
    new Map([...map,["area",{...area,geography:geography("area","continent")}]])),
    /cycle/);
  assert.throws(()=>validateGeographyHierarchy("city",geography("city","missing"),map),/Select/);
  assert.doesNotThrow(()=>validateGeographyHierarchy("settlement",
    geography("settlement","continent"),map));
});

test("a Settlement is a first-class Road directory child without modifying source geography",()=>{
  const territories=[territory("continent","Valecor","continent"),
    territory("settlement","Hearth's Heart","settlement","continent")];
  const original=structuredClone(territories);
  const result=buildTerritoryRoadDirectory({territories,roads:[{id:"riverRoad"}],
    roadSamples:new Map([["riverRoad",[{x:2,y:3}]]]),
    contains:(territory,point)=>territory.id==="settlement"&&point.x===2});
  assert.deepEqual(result.tree[0].roadIds,["riverRoad"]);
  assert.deepEqual(result.tree[0].children[0].kind,"settlement");
  assert.deepEqual(result.tree[0].children[0].roadIds,["riverRoad"]);
  assert.deepEqual(territories,original);
});

test("Roads are many-to-many; continent includes descendant Roads; overrides win",()=>{
  const territories=[territory("valecor","Valecor","continent"),
    territory("dirwest","Dirwest","city","valecor",{road2:"include"}),
    territory("millstone","Millstone","city","valecor",{road2:"exclude"}),
    territory("reshara","Reshara","continent"),
    territory("eyrie","The Eyrie","city","reshara")];
  const roads=["road1","road2","road3","road4"].map(id=>({id}));
  const samples=new Map([["road1",[{x:1,y:1},{x:2,y:2}]],
    ["road2",[{x:20,y:20}]], ["road3",[{x:200,y:200}]],
    ["road4",[{x:10000,y:10000}]]]);
  const contains=(t,p)=> t.id==="dirwest"&&p.x<=2 ||
    t.id==="millstone"&&p.x<=2 || t.id==="eyrie"&&p.x===200;
  const result=buildTerritoryRoadDirectory({territories,roads,roadSamples:samples,contains});
  const valecor=result.tree.find(t=>t.id==="valecor");
  assert.deepEqual(new Set(valecor.roadIds),new Set(["road1","road2"]));
  assert.deepEqual(valecor.children.find(t=>t.id==="dirwest").roadIds,["road1","road2"]);
  assert.deepEqual(valecor.children.find(t=>t.id==="millstone").roadIds,["road1"]);
  assert.deepEqual(result.tree.find(t=>t.id==="reshara").roadIds,["road3"]);
  assert.deepEqual(result.unclassifiedRoadIds,["road4"]);
  const unavailable=buildTerritoryRoadDirectory({territories,roads,roadSamples:samples,
    contains,geometryAvailable:false});
  assert.deepEqual(unavailable.tree.find(t=>t.id==="valecor").roadIds,["road2"]);
  assert.deepEqual(unavailable.unclassifiedRoadIds,["road1","road3","road4"]);
});

test("image-relative Road graph sampling is bounded and non-mutating",()=>{
  const atlas={nodes:[{id:"a",x:0,y:0},{id:"b",x:100,y:0}],
    segments:[{roadId:"road",from:"a",to:"b",via:[{x:50,y:10}]}],
    roads:[{id:"road"},{id:"empty"}]};
  const original=structuredClone(atlas);
  const result=sampleAtlasRoads(atlas,{origin:{x:800,y:400},step:10});
  assert.deepEqual(result.samples.get("road")[0],{x:800,y:400});
  assert.ok(result.samples.get("road").some(p=>p.x===850&&p.y===410));
  assert.deepEqual(result.samples.get("empty"),[]);
  assert.deepEqual(atlas,original);
  const capped=sampleAtlasRoads(atlas,{maxPerRoad:2,step:1});
  assert.equal(capped.samples.get("road").length,2);
  assert.ok(capped.truncated.has("road"));
  assert.throws(()=>sampleAtlasRoads(atlas,{step:0}),/unavailable/);
  const distant=sampleAtlasRoads(atlas,{origin:{x:0,y:0},step:1,maxPerRoad:5});
  assert.deepEqual(distant.samples.get("road").at(-1),{x:100,y:0},
    "a capped sampler must retain the far endpoint, not only the beginning");
  assert.ok(distant.samples.get("road").some(p=>p.x>80));
});
