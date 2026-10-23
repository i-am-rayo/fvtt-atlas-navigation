import test from "node:test";
import assert from "node:assert/strict";
import { planSceneGeneratedRegion, saveGeneratedNativeRegion, listGeneratedRegions }
  from "../scripts/generated-region.js";
import { MODULE_ID } from "../scripts/atlas-storage.js";

function atlas() {
 return {
  schemaVersion:4,coordinateSpace:"image",revision:1,enabled:true,calibration:null,
  roads:[{id:"r",name:"Ridge Path"}],
  nodes:[{id:"a",x:10,y:20},{id:"b",x:100,y:20}],
  segments:[{id:"s",roadId:"r",from:"a",to:"b",via:[],bidirectional:true}],
  checkpoints:[{id:"cp1",roadId:"r",nodeId:"a",name:"Toll",elevationMeters:0},
   {id:"cp2",roadId:"r",nodeId:"b",name:"Pass",elevationMeters:10}]
 };
}
function setup() {
 const existing=new Map(), records=[];
 const scene={
  id:"scene1",grid:{size:100},regions:existing,
  canUserModify:()=>true,
  getFlag:()=>scene.state,
  state:atlas(),
  async createEmbeddedDocuments(kind,items) {
   records.push({kind,items});
   const d=items[0];
   const region={
    id:"new1",parent:scene,name:d.name,shapes:JSON.parse(JSON.stringify(d.shapes)),
    behaviors:[{type:"custom",active:true}], flags:d.flags,
    getFlag(ns,key){return this.flags[ns]?.[key];},
    canUserModify:()=>true,
    async update(data) {
      if(data.shapes) this.shapes=data.shapes;
      this.flags[MODULE_ID].generatedRegion=
        data["flags."+MODULE_ID+".generatedRegion"];
    }
   };
   existing.set(region.id,region);
   return [region];
  }
 };
 globalThis.game={user:{isGM:true}};
 globalThis.canvas={ready:true,scene,dimensions:{sceneX:100,sceneY:50}};
 return {scene,records,existing};
}
const settings={kind:"corridor",roadId:"r",checkpointId:"cp1",
 endCheckpointId:"cp2",widthCells:0.5};
test("GM can create one native Region, no Behaviors added, duplicate rejected",async()=>{
 const {scene,records,existing}=setup();
 const plan=planSceneGeneratedRegion(scene,settings);
 const result=await saveGeneratedNativeRegion(scene,plan);
 assert.equal(result.created,true);
 assert.equal(records.length,1);
 assert.equal(records[0].kind,"Region");
 assert.deepEqual(records[0].items[0].behaviors,[]);
 assert.equal(records[0].items[0].flags[MODULE_ID].atlas.linked,true);
 assert.equal(existing.size,1);
 await assert.rejects(()=>saveGeneratedNativeRegion(scene,plan),/already exists/);
});
test("regeneration keeps native Behaviors, name, and blocks manual shape edits",async()=>{
 const {scene,existing}=setup();
 const initial=planSceneGeneratedRegion(scene,settings);
 await saveGeneratedNativeRegion(scene,initial);
 const native=existing.get("new1");
 native.name="GM customized";
 native.behaviors=[{type:"pauseGame",active:true}];
 const updated=planSceneGeneratedRegion(scene,{...settings,widthCells:1});
 const result=await saveGeneratedNativeRegion(scene,updated,{regenerate:true});
 assert.equal(result.created,false);
 assert.equal(native.name,"GM customized");
 assert.deepEqual(native.behaviors,[{type:"pauseGame",active:true}]);
 native.shapes[0].points[0]+=2;
 assert.equal(listGeneratedRegions(scene)[0].modified,true);
 await assert.rejects(()=>saveGeneratedNativeRegion(scene,updated,{regenerate:true}),/edited by the GM/);
});
test("stale graph revision and padding refuse generation",async()=>{
 const {scene,records}=setup();
 const plan=planSceneGeneratedRegion(scene,settings);
 scene.state.revision++;
 await assert.rejects(()=>saveGeneratedNativeRegion(scene,plan),/changed since preview/);
 assert.equal(records.length,0);
 scene.state.revision--;
 globalThis.canvas.dimensions.sceneX+=10;
 await assert.rejects(()=>saveGeneratedNativeRegion(scene,plan),/changed since preview/);
});
test("non-GM and scene mismatch cannot generate",()=>{
 const {scene}=setup();
 globalThis.game.user.isGM=false;
 assert.throws(()=>planSceneGeneratedRegion(scene,settings),/Only a GM/);
 globalThis.game.user.isGM=true;
 globalThis.canvas.scene={id:"other"};
 assert.throws(()=>planSceneGeneratedRegion(scene,settings),/Open the chosen Scene/);
});
