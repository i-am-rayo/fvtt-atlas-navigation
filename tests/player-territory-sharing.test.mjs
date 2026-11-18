import test from "node:test";
import assert from "node:assert/strict";
import {MODULE_ID} from "../scripts/atlas-storage.js";
import {readPlayerTerritorySharing,listPlayerTerritories,savePlayerTerritorySharing,
  validatePlayerTerritorySharing,PLAYER_TERRITORY_FLAG}
  from "../scripts/player-territory-sharing.js";

const geography=kind=>({schemaVersion:1,kind,parentRegionId:null,roadOverrides:{}});
const publicName=label=>({schemaVersion:1,enabled:true,label});
function mockRegion(id,{name="Private native name",kind="city",shared=false,
  published=null,hidden=false,linked=true}={}){
  const flags=new Map();
  if(linked)flags.set("atlas",{schemaVersion:1,linked:true});
  if(kind)flags.set("territoryGeography",geography(kind));
  if(shared)flags.set(PLAYER_TERRITORY_FLAG,{schemaVersion:1,visible:true});
  if(published)flags.set("publicTerritory",publicName(published));
  const writes=[];
  return {id,name,hidden,parent:{id:"scene"},flags,writes,
    canUserModify:()=>true,
    getFlag(scope,key){assert.equal(scope,MODULE_ID);return flags.get(key)??null;},
    async setFlag(scope,key,value){assert.equal(scope,MODULE_ID);
      writes.push({op:"set",key,value});flags.set(key,structuredClone(value));},
    async unsetFlag(scope,key){assert.equal(scope,MODULE_ID);
      writes.push({op:"unset",key});flags.delete(key);}
  };
}
const scene=(...regions)=>({id:"scene",regions:new Map(regions.map(region=>[region.id,region])),
  canUserModify:()=>true,update(){throw Error("Player visibility must not update native Scene");}});
const snapshot=region=>({expected:readPlayerTerritorySharing(region),
  expectedName:region.name,expectedHidden:region.hidden});

test("only explicitly shared, visible, classified native Territories enter player projection",()=>{
  const named=mockRegion("named",{shared:true,published:"Dirwest"});
  const unnamed=mockRegion("unnamed",{shared:true});
  const settlement=mockRegion("settlement",{kind:"settlement",shared:true,
    published:"Hearth's Heart"});
  const privateRegion=mockRegion("private",{published:"Public but no boundary grant"});
  const hidden=mockRegion("hidden",{shared:true,published:"Hidden",hidden:true});
  const unlinked=mockRegion("unlinked",{shared:true,linked:false});
  const unclassified=mockRegion("unclassified",{shared:true,kind:null});
  const invalid=mockRegion("invalid",{shared:true});
  invalid.flags.set(PLAYER_TERRITORY_FLAG,{schemaVersion:99,visible:true});
  const projection=listPlayerTerritories(scene(named,unnamed,settlement,privateRegion,hidden,
    unlinked,unclassified,invalid));
  assert.deepEqual(projection,[
    {id:"named",name:"Dirwest",publicName:"Dirwest",linked:true,invalid:false,
      playerShared:true,geography:{kind:"city"}},
    {id:"settlement",name:"Hearth's Heart",publicName:"Hearth's Heart",linked:true,
      invalid:false,playerShared:true,geography:{kind:"settlement"}},
    {id:"unnamed",name:"",publicName:null,linked:true,invalid:false,
      playerShared:true,geography:{kind:"city"}}
  ]);
  assert.equal(JSON.stringify(projection).includes("Private native name"),false);
  assert.equal(JSON.stringify(projection).includes("roadOverrides"),false);
  assert.equal(JSON.stringify(projection).includes("Public but no boundary grant"),false);
});

test("GM shares or revokes a native boundary with one flag only, never altering Shapes or names",async()=>{
  const previous=globalThis.game;
  globalThis.game={user:{id:"gm",isGM:true}};
  try{
    const region=mockRegion("dirwest");
    region.shapes=[{type:"polygon",points:[0,0,5,0,5,5]}];
    region.behaviors=[{name:"Native behavior"}];
    const origin=scene(region),shapes=region.shapes,behaviors=region.behaviors;
    assert.equal(await savePlayerTerritorySharing(origin,region.id,{visible:true,
      ...snapshot(region)}),true);
    assert.deepEqual(region.writes,[{op:"set",key:PLAYER_TERRITORY_FLAG,
      value:{schemaVersion:1,visible:true}}]);
    assert.equal(await savePlayerTerritorySharing(origin,region.id,{visible:true,
      ...snapshot(region)}),false,"idempotent sharing does not write twice");
    assert.equal(await savePlayerTerritorySharing(origin,region.id,{visible:false,
      ...snapshot(region)}),true);
    assert.deepEqual(region.writes.at(-1),{op:"unset",key:PLAYER_TERRITORY_FLAG});
    assert.equal(region.shapes,shapes);
    assert.equal(region.behaviors,behaviors);
    assert.equal(region.name,"Private native name");
  }finally{globalThis.game=previous;}
});

test("player boundary grants fail closed for stale state, malformed permission and GM-only writes",async()=>{
  const previous=globalThis.game;
  globalThis.game={user:{isGM:true}};
  try{
    assert.throws(()=>validatePlayerTerritorySharing({schemaVersion:2,visible:true}),
      /Unsupported/);
    assert.throws(()=>validatePlayerTerritorySharing({schemaVersion:1,visible:false}),
      /Unsupported/);
    const region=mockRegion("dirwest");const origin=scene(region);
    const initial=snapshot(region);
    region.name="Renamed";
    await assert.rejects(savePlayerTerritorySharing(origin,region.id,{visible:true,
      ...initial}),/changed/);
    region.hidden=true;
    await assert.rejects(savePlayerTerritorySharing(origin,region.id,{visible:true,
      ...snapshot(region)}),/Only visible/);
    region.hidden=false;
    region.flags.set(PLAYER_TERRITORY_FLAG,{schemaVersion:9,visible:true});
    await assert.rejects(savePlayerTerritorySharing(origin,region.id,{visible:false,
      expected:null,expectedName:region.name,expectedHidden:false}),/Unsupported/);
    region.flags.delete(PLAYER_TERRITORY_FLAG);
    globalThis.game.user.isGM=false;
    await assert.rejects(savePlayerTerritorySharing(origin,region.id,{visible:true,
      ...snapshot(region)}),/Only a Scene-authorized GM/);
    assert.equal(region.writes.length,0);
  }finally{globalThis.game=previous;}
});
