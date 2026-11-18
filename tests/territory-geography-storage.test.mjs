import test from "node:test";
import assert from "node:assert/strict";
import { MODULE_ID } from "../scripts/atlas-storage.js";
import { GEOGRAPHY_FLAG,readRegionGeography,listSceneGeography,saveRegionGeography }
  from "../scripts/territory-geography-storage.js";

const geography=(kind,parentRegionId=null,roadOverrides={})=>({
  schemaVersion:1,kind,parentRegionId,roadOverrides
});
function mockRegion(id,name,{linked=true,flag=null,editable=true,hidden=false}={}) {
  const flags=new Map();
  if(linked)flags.set("atlas",{schemaVersion:1,linked:true});
  if(flag)flags.set(GEOGRAPHY_FLAG,flag);
  const writes=[];
  const region={id,name,hidden,parent:{id:"scene"},
    shapes:[{type:"polygon",points:[0,0,20,0,20,20,0,20]}],
    elevation:{bottom:0,top:100},behaviors:[],color:"red",
    canUserModify:()=>editable,
    getFlag(scope,key){assert.equal(scope,MODULE_ID);return flags.get(key)??null;},
    async setFlag(scope,key,value){assert.equal(scope,MODULE_ID);
      writes.push(["set",key,structuredClone(value)]);flags.set(key,structuredClone(value));},
    async unsetFlag(scope,key){assert.equal(scope,MODULE_ID);
      writes.push(["unset",key]);flags.delete(key);}
  };
  return {region,flags,writes};
}
function mockScene(entries,editable=true){
  const regions=new Map(entries.map(entry=>[entry.region.id,entry.region]));
  return {id:"scene",regions,canUserModify:()=>editable,getFlag:()=>null};
}
const save=(scene,entry,next,expected=readRegionGeography(entry.region))=>
  saveRegionGeography(scene,entry.region.id,{next,expected,
    expectedName:entry.region.name,expectedHidden:entry.region.hidden});

test("geography reads are safe; saving edits only the Atlas native Region flag",async()=>{
  globalThis.game={user:{isGM:true}};
  const continent=mockRegion("continent","Valecor",{flag:geography("continent")});
  const city=mockRegion("city","Dirwest");
  const scene=mockScene([continent,city]);
  const listed=listSceneGeography(scene);
  assert.equal(listed.length,2);
  assert.ok(listed.every(item=>item.linked));
  assert.deepEqual(continent.writes,[]);
  assert.deepEqual(city.writes,[]);
  const nativeShape=city.region.shapes,nativeElevation=city.region.elevation;
  const next=geography("city","continent",{road1:"include"});
  // No authored Roads on this Scene yet: manual corrections must reference a real Road.
  await assert.rejects(save(scene,city,next),/unknown Road/);
  assert.deepEqual(city.writes,[]);
  assert.equal(await save(scene,city,geography("city","continent")),true);
  assert.deepEqual(city.writes,[["set",GEOGRAPHY_FLAG,geography("city","continent")]]);
  assert.equal(city.region.shapes,nativeShape);
  assert.equal(city.region.elevation,nativeElevation);
  assert.deepEqual(city.region.behaviors,[]);
  assert.equal(await save(scene,city,null),true);
  assert.deepEqual(city.writes[1],["unset",GEOGRAPHY_FLAG]);
});

test("rejects stale version, unauthorized, invalid parent and orphaned child changes",async()=>{
  globalThis.game={user:{isGM:true}};
  const root=mockRegion("root","Valecor",{flag:geography("continent")});
  const city=mockRegion("city","Millstone",{flag:geography("city","root")});
  const scene=mockScene([root,city]);
  await assert.rejects(save(scene,root,null),/classified parent Region/);
  await assert.rejects(save(scene,city,geography("town","missing")),/Select a currently/);
  const old=readRegionGeography(city.region);
  city.region.name="Millstone renamed";
  await assert.rejects(saveRegionGeography(scene,"city",{next:geography("city"),
    expected:old,expectedName:"Millstone",expectedHidden:false}),/changed/);
  globalThis.game.user.isGM=false;
  await assert.rejects(save(scene,root,geography("continent")),/Only a Scene-authorized GM/);
  globalThis.game.user.isGM=true;
  await assert.rejects(save(mockScene([root,city],false),root,geography("continent")),/Only a Scene-authorized GM/);
  assert.deepEqual(root.writes,[]);
  assert.deepEqual(city.writes,[]);
});

test("invalid future geography flags are preserved, not silently downgraded",async()=>{
  globalThis.game={user:{isGM:true}};
  const broken=mockRegion("r","Future",{flag:{schemaVersion:99,kind:"city"}});
  const scene=mockScene([broken]);
  assert.equal(listSceneGeography(scene)[0].invalid,true);
  await assert.rejects(save(scene,broken,geography("city"),null),/Unsupported/);
  assert.equal(broken.writes.length,0);
});
