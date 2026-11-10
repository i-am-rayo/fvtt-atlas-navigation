import test from "node:test";
import assert from "node:assert/strict";
import {createEmptyAtlas} from "../scripts/atlas-model.js";
import {addRoadCheckpoint} from "../scripts/checkpoint-model.js";
import {readAtlas} from "../scripts/atlas-storage.js";
import {saveEditedCheckpoint,saveRemovedCheckpoint} from "../scripts/road-storage.js";
import {unlinkAtlasRegion} from "../scripts/region-atlas.js";
import {readTerritoryCheckpointLink,saveTerritoryCheckpointLink,
  validateTerritoryCheckpointLink,assertNoDeletedTerritoryCheckpoints}
  from "../scripts/territory-checkpoint-link.js";

function sceneFixture(){
  let atlas=addRoadCheckpoint({...createEmptyAtlas(),revision:7,enabled:true,
    nodes:[{id:"a",x:0,y:0},{id:"b",x:100,y:0}],
    roads:[{id:"road1",name:"King's Road"}],
    segments:[{id:"ab",roadId:"road1",from:"a",to:"b",via:[],bidirectional:true}]},
  {roadId:"road1",candidate:{kind:"node",nodeId:"b"},
    name:"Dirwest",elevationMeters:0,idFactory:()=>"cp1"});
  let sceneWrites=0;
  const scene={id:"paedor",canUserModify:()=>true,
    regions:new Map(),
    getFlag:(_module,key)=>key==="atlas"?atlas:null,
    async setFlag(_module,key,value){assert.equal(key,"atlas");atlas=value;sceneWrites++;},
    get writes(){return sceneWrites;}};
  const region=(id,name)=>{
    const flags=new Map([["atlas",{schemaVersion:1,linked:true}]]);
    let writes=0;
    const result={id,name,parent:scene,shapes:[{type:"grid",coordinates:[{i:0,j:0}]}],
      behaviors:[{id:"native-behavior",active:true}],levels:{bottom:0,top:5},
      hidden:false,canUserModify:()=>true,
      getFlag:(_module,key)=>flags.get(key)??null,
      async setFlag(_module,key,value){writes++;flags.set(key,structuredClone(value));},
      async unsetFlag(_module,key){writes++;flags.delete(key);},
      get writes(){return writes;}};
    scene.regions.set(id,result);return result;
  };
  return {scene,region,checkpointId:"cp1"};
}

test("manual Territory link stores only stable Checkpoint ID on its native Region",async()=>{
  const previous=globalThis.game;globalThis.game={user:{isGM:true}};
  try{
    const {scene,region,checkpointId}=sceneFixture();
    const city=region("city","Dirwest City");
    const nativeSnapshot=JSON.stringify({shapes:city.shapes,behaviors:city.behaviors,
      levels:city.levels,hidden:city.hidden});
    assert.equal(await saveTerritoryCheckpointLink(scene,city.id,{
      checkpointId,expected:null,expectedName:city.name,
      expectedAtlasRevision:readAtlas(scene).revision}),true);
    assert.deepEqual(readTerritoryCheckpointLink(city),{schemaVersion:1,checkpointId});
    assert.equal(scene.writes,0,"Region association does not rewrite the Scene atlas");
    assert.equal(JSON.stringify({shapes:city.shapes,behaviors:city.behaviors,
      levels:city.levels,hidden:city.hidden}),nativeSnapshot);
    const oldVersion=readAtlas(scene).revision;
    await saveEditedCheckpoint(scene,{checkpointId,name:"Dirwest North",elevationMeters:0,
      expectedRevision:oldVersion});
    assert.deepEqual(readTerritoryCheckpointLink(city),{schemaVersion:1,checkpointId},
      "Checkpoint rename never rewrites or breaks its stable Region reference");
    assert.equal(await saveTerritoryCheckpointLink(scene,city.id,{
      checkpointId:null,expected:{schemaVersion:1,checkpointId},
      expectedName:city.name,expectedAtlasRevision:readAtlas(scene).revision}),true);
    assert.equal(readTerritoryCheckpointLink(city),null);
    assert.equal(city.writes,2);
  }finally{globalThis.game=previous;}
});

test("Checkpoint removal and native Atlas unlink refuse active Territory associations",async()=>{
  const previous=globalThis.game;globalThis.game={user:{isGM:true}};
  try{
    const {scene,region,checkpointId}=sceneFixture();
    const city=region("city","Dirwest City");
    await saveTerritoryCheckpointLink(scene,city.id,{checkpointId,expected:null,
      expectedName:city.name,expectedAtlasRevision:readAtlas(scene).revision});
    await assert.rejects(saveRemovedCheckpoint(scene,{checkpointId,
      expectedRevision:readAtlas(scene).revision}),/unlink it in Territories/);
    await assert.rejects(unlinkAtlasRegion(scene,city.id),/Remove.*checkpoint association/);
    assert.equal(scene.writes,0);
    await saveTerritoryCheckpointLink(scene,city.id,{checkpointId:null,
      expected:{schemaVersion:1,checkpointId},expectedName:city.name,
      expectedAtlasRevision:readAtlas(scene).revision});
    await saveRemovedCheckpoint(scene,{checkpointId,
      expectedRevision:readAtlas(scene).revision});
    assert.equal(scene.writes,1);
    assert.equal(readAtlas(scene).checkpoints.length,0);
  }finally{globalThis.game=previous;}
});

test("only one manually authored Region may own a Checkpoint identity",async()=>{
  const previous=globalThis.game;globalThis.game={user:{isGM:true}};
  try{
    const {scene,region,checkpointId}=sceneFixture();
    const one=region("one","First"),two=region("two","Second");
    await saveTerritoryCheckpointLink(scene,one.id,{checkpointId,expected:null,
      expectedName:one.name,expectedAtlasRevision:readAtlas(scene).revision});
    await assert.rejects(saveTerritoryCheckpointLink(scene,two.id,{
      checkpointId,expected:null,expectedName:two.name,
      expectedAtlasRevision:readAtlas(scene).revision}),/already associated/);
    assert.equal(two.writes,0);
  }finally{globalThis.game=previous;}
});

test("stale Scene revision, native edits and invalid newer flags all fail closed",async()=>{
  const previous=globalThis.game;globalThis.game={user:{isGM:true}};
  try{
    const {scene,region,checkpointId}=sceneFixture();
    const city=region("city","Dirwest City");
    await assert.rejects(saveTerritoryCheckpointLink(scene,city.id,{
      checkpointId,expected:null,expectedName:city.name,
      expectedAtlasRevision:readAtlas(scene).revision-1}),/changed during review/);
    await assert.rejects(saveTerritoryCheckpointLink(scene,city.id,{
      checkpointId,expected:null,expectedName:"Old name",
      expectedAtlasRevision:readAtlas(scene).revision}),/Territory association changed/);
    await city.setFlag("fvtt-atlas-navigation","territoryCheckpoint",
      {schemaVersion:2,checkpointId});
    assert.throws(()=>readTerritoryCheckpointLink(city),/Unsupported/);
    assert.throws(()=>validateTerritoryCheckpointLink({schemaVersion:1,
      checkpointId,unexpected:true}),/Unsupported/);
    assert.throws(()=>assertNoDeletedTerritoryCheckpoints(scene,readAtlas(scene),
      {...readAtlas(scene),checkpoints:[]}),/invalid native Territory/);
  }finally{globalThis.game=previous;}
});

test("non-GMs and Regions not Atlas-linked cannot write a Checkpoint association",async()=>{
  const previous=globalThis.game;globalThis.game={user:{isGM:false}};
  try{
    const {scene,region,checkpointId}=sceneFixture();
    const city=region("city","Dirwest City");
    await assert.rejects(saveTerritoryCheckpointLink(scene,city.id,{
      checkpointId,expected:null,expectedName:city.name,
      expectedAtlasRevision:readAtlas(scene).revision}),/Scene-authorized GM/);
    globalThis.game.user.isGM=true;
    await city.unsetFlag("fvtt-atlas-navigation","atlas");
    await assert.rejects(saveTerritoryCheckpointLink(scene,city.id,{
      checkpointId,expected:null,expectedName:city.name,
      expectedAtlasRevision:readAtlas(scene).revision}),/Atlas-linked/);
  }finally{globalThis.game=previous;}
});
