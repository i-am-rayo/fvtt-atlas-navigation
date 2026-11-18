import test from "node:test";
import assert from "node:assert/strict";
import {createRoadPresetStage} from "../scripts/road-settings-preset.js";
import {saveRoadSettings} from "../scripts/road-storage.js";
import {readAtlas} from "../scripts/atlas-storage.js";
import {defaultTravelPresets} from "../scripts/travel-preset-model.js";

test("Road Settings stages a real dropdown change independently of dialog form data",()=>{
  const stage=createRoadPresetStage(null,"road-dialog-123");
  const target={name:"atlasRoadPresetId",value:"land-stone",
    closest:selector=>selector==='[data-atlas-road-live="road-dialog-123"]'?{}:null};
  assert.equal(stage.value,null);
  assert.equal(stage.handle({target}),true);
  assert.equal(stage.value,"land-stone");
  target.value="land-gravel";
  stage.handle({target}); // The browser can emit input and change for one selection.
  assert.equal(stage.value,"land-gravel");
  target.value="";
  stage.handle({target});
  assert.equal(stage.value,null,"explicit None selection is staged as null");
  assert.equal(stage.handle({target:{...target,name:"unrelated"}}),false);
});

test("Road Settings saves presentation and travel preset in one Scene revision",async()=>{
  const oldGame=globalThis.game;
  globalThis.game={user:{isGM:true},settings:{get:()=>defaultTravelPresets()}};
  const initial={schemaVersion:4,coordinateSpace:"image",revision:6,enabled:true,
    calibration:null,roads:[{id:"r",name:"Trade Road"}],
    nodes:[{id:"a",x:10,y:10},{id:"b",x:90,y:90}],
    segments:[{id:"s",roadId:"r",from:"a",to:"b",via:[],bidirectional:true}],
    checkpoints:[]};
  let state=structuredClone(initial),writes=0;
  const scene={canUserModify:()=>true,getFlag:()=>state,
    async setFlag(_scope,_key,next){state=next;writes++;}};
  try{
    const saved=await saveRoadSettings(scene,{roadId:"r",name:"Trade Road",
      appearance:null,playerVisible:false,presetId:"land-stone",expectedRevision:6});
    assert.equal(writes,1,"all Road Settings changes must use one write");
    assert.equal(saved.roads[0].travelPresetId,"land-stone");
    assert.equal(readAtlas(scene).roads[0].travelPresetId,"land-stone",
      "reopening Road Settings must read the persisted value");
    assert.deepEqual(saved.segments,initial.segments,"road geometry is untouched");
    const updated=await saveRoadSettings(scene,{roadId:"r",name:"Updated Road",
      appearance:null,playerVisible:true,presetId:"land-gravel",
      expectedRevision:saved.revision});
    assert.equal(writes,2);
    assert.equal(updated.roads[0].name,"Updated Road");
    assert.equal(updated.roads[0].playerVisible,true);
    assert.equal(readAtlas(scene).roads[0].travelPresetId,"land-gravel");
  }finally{globalThis.game=oldGame;}
});
