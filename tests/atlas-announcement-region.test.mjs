import test from "node:test";
import assert from "node:assert/strict";
import {publicRegionDestinationName,inspectPublicRegionDestination}
  from "../scripts/atlas-announcement-region.js";
import {MODULE_ID} from "../scripts/atlas-storage.js";
import {PUBLIC_TERRITORY_FLAG} from "../scripts/region-narration-model.js";
import {mostSpecificPublicTerritoryLabel} from "../scripts/region-narration-model.js";

function fixture(){
  const observed=[];
  const region={id:"territory",name:"GM only original name",hidden:false,
    parent:{id:"scene"},testPoint:point=>{
      observed.push(point);return point.x===510&&point.y===320&&point.elevation===10;
    },getFlag:(scope,key)=>{
      assert.equal(scope,MODULE_ID);assert.equal(key,PUBLIC_TERRITORY_FLAG);
      return {schemaVersion:1,enabled:true,label:"Valecor"};}};
  const record={sceneId:"scene",tokenId:"party",status:"moving",
    destination:{x:10,y:20},lastConfirmedAnchor:{point:{x:0,y:0}}};
  const scene={id:"scene",grid:{size:100},
    tokens:{get:()=>({elevation:10})},regions:{contents:[region]}};
  const view={ready:true,scene:{id:"scene"},
    dimensions:{sceneX:500,sceneY:300}};
  const atlas={schemaVersion:9};
  return {scene,view,atlas,record,region,observed};
}

test("only an opted-in, nonhidden Region containing native elevated Point B names a journey",()=>{
  const s=fixture();
  assert.equal(publicRegionDestinationName(s),"Valecor");
  assert.deepEqual(s.observed,[{x:510,y:320,elevation:10}],
    "native testPoint receives canvas coordinates with image origin and elevation");
  s.region.hidden=true;
  assert.equal(publicRegionDestinationName(s),null);
  s.region.hidden=false;
  s.region.getFlag=()=>null;
  assert.equal(publicRegionDestinationName(s),null);
  s.region.getFlag=()=>({schemaVersion:99,enabled:true,label:"Secret"});
  assert.equal(publicRegionDestinationName(s),null);
  s.region.getFlag=()=>({schemaVersion:1,enabled:true,label:"Valecor"});
  s.region.testPoint=()=>false;
  assert.equal(publicRegionDestinationName(s),null);
});

test("overlap, unknown elevation, wrong canvas and unsafe completion fail closed",()=>{
  const s=fixture();
  s.scene.regions.contents.push({...s.region,id:"territory2",
    getFlag:()=>({schemaVersion:1,enabled:true,label:"Reshara"})});
  assert.equal(publicRegionDestinationName(s),null);
  assert.deepEqual(inspectPublicRegionDestination(s),{
    name:null,reason:"ambiguous-public-region-overlap",published:2,containing:2});
  s.scene.regions.contents.pop();
  s.view.ready=false;
  assert.equal(publicRegionDestinationName(s),null);
  assert.equal(inspectPublicRegionDestination(s).reason,"canvas-not-ready");
  s.view.ready=true;s.view.scene.id="other";
  assert.equal(publicRegionDestinationName(s),null);
  s.view.scene.id="scene";
  s.scene.tokens.get=()=>({elevation:NaN});
  assert.equal(publicRegionDestinationName(s),null);
  assert.equal(inspectPublicRegionDestination(s).reason,"token-elevation-unavailable");
  s.scene.tokens.get=()=>({elevation:10});
  s.record.status="completed";
  s.record.lastConfirmedAnchor.point={x:9999,y:9999};
  assert.equal(publicRegionDestinationName(s),null);
  assert.equal(inspectPublicRegionDestination(s).reason,"unverified-point-b");
  s.record.lastConfirmedAnchor.point={x:10,y:20};
  assert.equal(publicRegionDestinationName(s),"Valecor");
  s.region.testPoint=()=>{throw Error("Native Region unavailable");};
  assert.equal(publicRegionDestinationName(s),null);
});

test("published Hearth's Heart Town wins over published Valecor Continent at Point B",()=>{
  const s=fixture();
  const geographical=(id,label,kind,parentRegionId)=>({id,name:"Private "+id,
    parent:{id:"scene"},hidden:false,
    testPoint:point=>point.x===510&&point.y===320&&point.elevation===10,
    getFlag:(_namespace,key)=>key==="publicTerritory"?
      {schemaVersion:1,enabled:true,label}:
      key==="atlas"?{schemaVersion:1,linked:true}:
      key==="territoryGeography"?{schemaVersion:1,kind,parentRegionId,roadOverrides:{}}:null});
  const continent=geographical("valecor","Valecor","continent",null);
  const town=geographical("hearth","Hearth's Heart","town","valecor");
  s.scene.regions.contents=[continent,town];
  assert.equal(publicRegionDestinationName(s),"Hearth's Heart",
    "the most specific published descendant takes precedence");
  s.record.status="completed";
  s.record.lastConfirmedAnchor.point={x:10,y:20};
  assert.equal(publicRegionDestinationName(s),"Hearth's Heart",
    "both Journey start and committed arrival use the same Point B policy");
  const sibling=geographical("dirwest","Dirwest","town","valecor");
  s.scene.regions.contents.push(sibling);
  assert.equal(publicRegionDestinationName(s),null,
    "overlapping sibling towns cannot be resolved by ID or order");
  s.scene.regions.contents.pop();
  town.getFlag=(_namespace,key)=>key==="publicTerritory"?
    {schemaVersion:1,enabled:true,label:"Hearth's Heart"}:
    key==="atlas"?{schemaVersion:1,linked:true}:
    key==="territoryGeography"?{schemaVersion:1,kind:"town",parentRegionId:"missing",roadOverrides:{}}:null;
  assert.equal(publicRegionDestinationName(s),null,
    "broken or missing parent classification must not guess a published name");
});

test("hierarchical label policy rejects unrelated overlap and corrupt cycles",()=>{
  const entries=new Map([
    ["a",{linked:true,geography:{kind:"area",parentRegionId:"b"}}],
    ["b",{linked:true,geography:{kind:"area",parentRegionId:"a"}}]
  ]);
  assert.equal(mostSpecificPublicTerritoryLabel([
    {id:"a",label:"Private A"},{id:"b",label:"Private B"}],entries),null);
  entries.set("a",{linked:true,geography:{kind:"continent",parentRegionId:null}});
  entries.set("b",{linked:true,geography:{kind:"area",parentRegionId:"a"}});
  assert.equal(mostSpecificPublicTerritoryLabel([
    {id:"a",label:"Valecor"},{id:"b",label:"Hearth's Heart"}],entries),"Hearth's Heart");
  entries.get("b").linked=false;
  assert.equal(mostSpecificPublicTerritoryLabel([
    {id:"a",label:"Valecor"},{id:"b",label:"Private"}],entries),null);
});
