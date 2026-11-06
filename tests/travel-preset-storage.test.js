import test from "node:test";
import assert from "node:assert/strict";
import { saveRoadTravelPreset } from "../scripts/road-storage.js";
import { readAtlas } from "../scripts/atlas-storage.js";
import { defaultTravelPresets } from "../scripts/travel-preset-model.js";

function sceneFixture() {
 const initial={
  schemaVersion:4,coordinateSpace:"image",revision:6,enabled:true,calibration:null,
  roads:[{id:"r",name:"Sea Passage"}],
  nodes:[{id:"a",x:10,y:10},{id:"b",x:90,y:90}],
  segments:[{id:"s",roadId:"r",from:"a",to:"b",via:[],bidirectional:true}],
  checkpoints:[{id:"cp",roadId:"r",nodeId:"a",name:"Harbor",elevationMeters:0}]
 };
 const scene={
  state:structuredClone(initial),
  canUserModify:()=>true,
  getFlag:()=>scene.state,
  async setFlag(module,key,next){scene.state=next;}
 };
 globalThis.game={user:{isGM:true},
   settings:{get:()=>defaultTravelPresets()}};
 return {scene,initial};
}

test("GM's first road preset selection safely upgrades v4 and increments revision",async()=>{
 const {scene,initial}=sceneFixture();
 const result=await saveRoadTravelPreset(scene,{
   roadId:"r",presetId:"water-calm",expectedRevision:6
 });
 assert.equal(result.schemaVersion,5);
 assert.equal(result.revision,7);
 assert.equal(result.roads[0].travelPresetId,"water-calm");
 assert.deepEqual(result.segments,initial.segments);
 assert.deepEqual(result.nodes,initial.nodes);
 assert.deepEqual(result.checkpoints,initial.checkpoints);
 assert.equal(readAtlas(scene).roads[0].travelPresetId,"water-calm");
 const cleared=await saveRoadTravelPreset(scene,{roadId:"r",presetId:null,
   expectedRevision:7});
 assert.equal(cleared.schemaVersion,5);
 assert.equal(cleared.roads[0].travelPresetId,null);
});

test("permissions, missing presets, and stale revisions never change a Scene",async()=>{
 const {scene,initial}=sceneFixture();
 await assert.rejects(()=>saveRoadTravelPreset(scene,{
   roadId:"r",presetId:"no-such-preset",expectedRevision:6
 }),/existing world travel preset/);
 assert.deepEqual(scene.state,initial);
 globalThis.game.user.isGM=false;
 await assert.rejects(()=>saveRoadTravelPreset(scene,{
   roadId:"r",presetId:null,expectedRevision:6
 }),/Only a GM/);
 globalThis.game.user.isGM=true;
 await assert.rejects(()=>saveRoadTravelPreset(scene,{
   roadId:"r",presetId:"water-calm",expectedRevision:5
 }),/changed since/);
 assert.deepEqual(scene.state,initial);
});
