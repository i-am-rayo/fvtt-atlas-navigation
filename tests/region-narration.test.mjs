import test from "node:test";
import assert from "node:assert/strict";
import {MODULE_ID} from "../scripts/atlas-storage.js";
import {PUBLIC_TERRITORY_FLAG,validatePublicTerritoryFlag,
  uniquePublicTerritoryLabel} from "../scripts/region-narration-model.js";
import {readPublicTerritory,listPublicTerritorySettings,savePublicTerritory}
  from "../scripts/region-narration.js";

function fixture({hidden=false,editable=true,sceneEditable=true}={}){
  let flag=null;
  const writes=[];
  const region={id:"reg-1",name:"GM secret — Terrain Area",parent:{id:"scene"},
    hidden,shapes:[{id:"shape"}],behaviors:[{id:"behavior"}],
    elevation:{bottom:0,top:20},canUserModify:()=>editable,
    getFlag:(scope,key)=>{assert.equal(scope,MODULE_ID);
      assert.equal(key,PUBLIC_TERRITORY_FLAG);return flag;},
    setFlag:async(scope,key,value)=>{assert.equal(scope,MODULE_ID);
      writes.push({operation:"set",key,value});flag=structuredClone(value);},
    unsetFlag:async(scope,key)=>{assert.equal(scope,MODULE_ID);
      writes.push({operation:"unset",key});flag=null;}};
  const scene={id:"scene",canUserModify:()=>sceneEditable,
    regions:{contents:[region],get:id=>id===region.id?region:null,
      values:function*(){yield region;}}};
  globalThis.game={user:{isGM:true,id:"gm"}};
  return {scene,region,writes,setFlag:value=>{flag=value;}};
}

test("public Region flag requires one explicit printable public label",()=>{
  assert.equal(validatePublicTerritoryFlag(null),null);
  assert.deepEqual(validatePublicTerritoryFlag({schemaVersion:1,enabled:true,
    label:"Valecor"}),{schemaVersion:1,enabled:true,label:"Valecor"});
  for(const value of [{schemaVersion:1,enabled:false,label:"Valecor"},
    {schemaVersion:2,enabled:true,label:"Valecor"},
    {schemaVersion:1,enabled:true,label:"GM\nsecret"},
    {schemaVersion:1,enabled:true,label:""},
    {schemaVersion:1,enabled:true,label:"X".repeat(121)},
    {schemaVersion:1,enabled:true,label:" Valecor"},
    {schemaVersion:1,enabled:true,label:"Valecor",privateRegionId:"p"}]){
    assert.throws(()=>validatePublicTerritoryFlag(value));
  }
  assert.equal(uniquePublicTerritoryLabel(["Valecor"]),"Valecor");
  assert.equal(uniquePublicTerritoryLabel([]),null);
  assert.equal(uniquePublicTerritoryLabel(["Valecor","Reshara"]),null);
});

test("GM public label opt-in touches exactly its own Region flag",async()=>{
  const f=fixture();
  const saved={shapes:f.region.shapes,behaviors:f.region.behaviors,
    elevation:f.region.elevation,name:f.region.name,hidden:f.region.hidden};
  await savePublicTerritory(f.scene,f.region.id,{enabled:true,label:"Valecor",
    expected:null,expectedName:f.region.name,expectedHidden:false});
  assert.equal(readPublicTerritory(f.region)?.label,"Valecor");
  assert.deepEqual(f.writes,[{operation:"set",key:PUBLIC_TERRITORY_FLAG,
    value:{schemaVersion:1,enabled:true,label:"Valecor"}}]);
  assert.deepEqual({shapes:f.region.shapes,behaviors:f.region.behaviors,
    elevation:f.region.elevation,name:f.region.name,hidden:f.region.hidden},saved);
  assert.equal(listPublicTerritorySettings(f.scene)[0].label,"Valecor");
  await savePublicTerritory(f.scene,f.region.id,{enabled:false,
    expected:readPublicTerritory(f.region),
    expectedName:f.region.name,expectedHidden:false});
  assert.deepEqual(f.writes[1],{operation:"unset",key:PUBLIC_TERRITORY_FLAG});
});

test("public label writes reject permissions, hidden, stale and invalid flags",async()=>{
  const f=fixture();
  const args={enabled:true,label:"Reshara",expected:null,
    expectedName:f.region.name,expectedHidden:false};
  globalThis.game.user.isGM=false;
  await assert.rejects(savePublicTerritory(f.scene,f.region.id,args),/GM/);
  globalThis.game.user.isGM=true;
  f.scene.canUserModify=()=>false;
  await assert.rejects(savePublicTerritory(f.scene,f.region.id,args),/GM/);
  f.scene.canUserModify=()=>true;
  f.region.canUserModify=()=>false;
  await assert.rejects(savePublicTerritory(f.scene,f.region.id,args),/unavailable/);
  f.region.canUserModify=()=>true;
  f.region.hidden=true;
  await assert.rejects(savePublicTerritory(f.scene,f.region.id,
    {...args,expectedHidden:true}),/Unhide/);
  f.region.hidden=false;
  await assert.rejects(savePublicTerritory(f.scene,f.region.id,
    {...args,expectedName:"old"}),/changed/);
  f.setFlag({schemaVersion:99,enabled:true,label:"Secret"});
  await assert.rejects(savePublicTerritory(f.scene,f.region.id,args),/Unsupported/);
  assert.equal(f.writes.length,0);
  assert.equal(listPublicTerritorySettings(f.scene)[0].invalid,true);
});
