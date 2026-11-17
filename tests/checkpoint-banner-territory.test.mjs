import test from "node:test";
import assert from "node:assert/strict";
import {checkpointBannerTerritoryCandidates,checkpointSelectedTerritoryName}
  from "../scripts/checkpoint-banner-territory.js";

const mod="fvtt-atlas-navigation";
const flags=(kind,other={})=>({
  atlas:{schemaVersion:1,linked:true},
  territoryGeography:{schemaVersion:1,kind,parentRegionId:null,roadOverrides:{}},
  ...other
});
function region(id,name,kind,{hidden=false,cell={i:12,j:22},
  explicit=null,publicLabel=null,invalid=false}={}){
  const current=flags(kind,{
    ...(explicit?{territoryCheckpoint:{schemaVersion:1,checkpointId:explicit}}:{}),
    ...(publicLabel?{publicTerritory:{schemaVersion:1,enabled:true,
      label:publicLabel}}:{})
  });
  if(invalid)current.territoryGeography={schemaVersion:999,kind};
  return {id,name,hidden,shapes:[{type:"grid",offsets:[cell]}],
    behaviors:[],getFlag(_mod,key){return current[key]??null;}};
}
function fixture(){
  const city=region("region-city","Dirwest","city");
  const continent=region("region-continent","Valecor","continent",
    {publicLabel:"Northern Valecor"});
  const entries=new Map([[city.id,city],[continent.id,continent]]);
  let writes=0;
  const scene={id:"scene",regions:entries,
    setFlag(){writes++;throw Error("Banner read must never write native Scene");}};
  const atlas={schemaVersion:10,nodes:[{id:"point",x:100,y:200}],
    checkpoints:[{id:"checkpoint",nodeId:"point",name:"Dirwest"}]};
  const checkpoint=atlas.checkpoints[0];
  let selected={i:12,j:22};
  const view={ready:true,scene,grid:{
    getOffset(){return selected;}},
    dimensions:{sceneX:0,sceneY:0}};
  return {scene,atlas,checkpoint,view,entries,city,continent,
    setOffset:offset=>{selected=offset;},writeCount:()=>writes};
}
test("nested City and Continent remain distinct explicit banner options",()=>{
  const f=fixture();
  const options=checkpointBannerTerritoryCandidates(f.scene,f.checkpoint,{
    atlas:f.atlas,view:f.view});
  assert.deepEqual(options.map(o=>[o.name,o.label]),[
    ["Dirwest","City"],["Valecor","Continent"]]);
  assert.equal(checkpointSelectedTerritoryName(f.scene,f.checkpoint,
    "region-continent",{atlas:f.atlas,view:f.view,forPlayer:true}),
    "Northern Valecor","published native Territory alias overrides internal GM name");
  assert.equal(checkpointSelectedTerritoryName(f.scene,f.checkpoint,
    "region-city",{atlas:f.atlas,view:f.view,forPlayer:true}),"Dirwest");
  assert.equal(f.writeCount(),0);
});
test("renamed, deleted, moved or hidden native Regions never produce stale player banner names",()=>{
  const f=fixture();
  f.city.name="New Dirwest";
  assert.equal(checkpointSelectedTerritoryName(f.scene,f.checkpoint,"region-city",
    {atlas:f.atlas,view:f.view,forPlayer:true}),"New Dirwest");
  f.city.hidden=true;
  assert.equal(checkpointSelectedTerritoryName(f.scene,f.checkpoint,"region-city",
    {atlas:f.atlas,view:f.view,forPlayer:true}),null);
  assert.equal(checkpointSelectedTerritoryName(f.scene,f.checkpoint,"region-city",
    {atlas:f.atlas,view:f.view,forPlayer:false}),"New Dirwest");
  f.city.hidden=false;
  f.setOffset({i:90,j:90});
  assert.equal(checkpointSelectedTerritoryName(f.scene,f.checkpoint,
    "region-city",{atlas:f.atlas,view:f.view,forPlayer:true}),null);
  f.setOffset({i:12,j:22});
  f.entries.delete("region-city");
  assert.equal(checkpointSelectedTerritoryName(f.scene,f.checkpoint,
    "region-city",{atlas:f.atlas,view:f.view,forPlayer:false}),null);
  assert.equal(f.writeCount(),0);
});
test("unsupported, unlinked, missing Scene-grid or invalid geographic association fails closed",()=>{
  const f=fixture();
  f.entries.set("invalid",region("invalid","Secret","continent",{invalid:true}));
  assert.equal(checkpointBannerTerritoryCandidates(f.scene,f.checkpoint,{
    atlas:f.atlas,view:{ready:false,scene:f.scene}}).length,0);
  assert.equal(checkpointSelectedTerritoryName(f.scene,f.checkpoint,"invalid",
    {atlas:f.atlas,view:f.view,forPlayer:true}),null);
  assert.equal(checkpointSelectedTerritoryName(f.scene,f.checkpoint,"missing",
    {atlas:f.atlas,view:f.view,forPlayer:true}),null);
  assert.equal(f.writeCount(),0);
});
test("explicit native Checkpoint association remains a candidate on unsupported grid geometry",()=>{
  const f=fixture();
  const port=region("port","Port Barthos","city",{explicit:f.checkpoint.id});
  port.shapes=[{type:"polygon",points:[1,2,3]}];
  f.entries.set("port",port);
  assert.equal(checkpointSelectedTerritoryName(f.scene,f.checkpoint,"port",
    {atlas:f.atlas,view:f.view,forPlayer:true}),"Port Barthos");
  port.getFlag=(_m,key)=>key==="territoryCheckpoint"?
    {schemaVersion:999,checkpointId:f.checkpoint.id}:
    flags("city")[key]??null;
  assert.equal(checkpointSelectedTerritoryName(f.scene,f.checkpoint,"port",
    {atlas:f.atlas,view:f.view,forPlayer:true}),null,
    "invalid native association never leaks the Region name");
});
