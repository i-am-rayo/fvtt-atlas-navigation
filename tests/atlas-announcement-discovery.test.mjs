import test from "node:test";
import assert from "node:assert/strict";
import {confirmedAutomaticCheckpointDiscovery,confirmedRoadVisibilityReveal}
  from "../scripts/atlas-announcement-discovery.js";
import {AtlasAnnouncementRuntime} from "../scripts/atlas-announcement-runtime.js";
import {saveAutomaticCheckpointVisits,readPartyExploration}
  from "../scripts/party-exploration-storage.js";
import {saveRoadSettings} from "../scripts/road-storage.js";
import {defaultPartyExploration} from "../scripts/party-exploration-model.js";
import {defaultTravelPresets} from "../scripts/travel-preset-model.js";
import {readAtlas} from "../scripts/atlas-storage.js";

function sceneFixture(){
  const atlas={schemaVersion:4,coordinateSpace:"image",revision:6,enabled:true,
    calibration:null,roads:[{id:"r",name:"Trade Road"}],
    nodes:[{id:"a",x:10,y:10},{id:"b",x:90,y:90}],
    segments:[{id:"s",roadId:"r",from:"a",to:"b",via:[],bidirectional:true}],
    checkpoints:[{id:"bridge",roadId:"r",nodeId:"a",
      name:"SECRET Northern Bridge",elevationMeters:null}]};
  const flags={atlas,partyExploration:{...defaultPartyExploration(),
    enabled:true,tokenId:"party"},checkpointDiscoveryMethods:{}};
  let writes=0;
  const scene={id:"scene-1",grid:{size:100},
    canUserModify:()=>true,getFlag:(_module,key)=>flags[key],
    async update(updates){writes++;for(const [key,value] of Object.entries(updates))
      flags[key.split(".").at(-1)]=value;},
    async setFlag(_module,key,value){writes++;flags[key]=value;}};
  return {scene,flags,get writes(){return writes;}};
}

function runtimeFixture(){
  const local=[],publicPulses=[];let sequence=0;
  let who={id:"gm",isGM:true};
  const runtime=new AtlasAnnouncementRuntime({
    settings:{get:()=>null,set:async(_ns,_key,value)=>publicPulses.push(value)},
    renderer:{enqueue:(type,options)=>{local.push({type,...options});return true;}},
    user:()=>who,activeGM:()=>({id:"gm"}),
    randomID:()=>`discovery-event-${++sequence}-abcdefgh`
  });
  return {runtime,local,publicPulses,setUser:user=>{who=user;}};
}

test("pure checkpoint rules require unknown -> visited, automatic and existing",()=>{
  const before={...defaultPartyExploration(),enabled:true,tokenId:"party"};
  const after={...before,discoveredCheckpointIds:["bridge"]};
  const input={checkpointId:"bridge",method:"automatic",exists:true};
  assert.equal(confirmedAutomaticCheckpointDiscovery(before,after,input),true);
  for(const options of [{...input,method:"gm"},{...input,exists:false}])
    assert.equal(confirmedAutomaticCheckpointDiscovery(before,after,options),false);
  assert.equal(confirmedAutomaticCheckpointDiscovery(after,after,input),false);
  assert.equal(confirmedAutomaticCheckpointDiscovery({...before,
    loreKnownCheckpointIds:["bridge"]},after,input),false);
});

test("actual saved automatic Scene visit is the only checkpoint banner source",async()=>{
  const previousGame=globalThis.game,previousDebug=console.debug,logs=[];
  const {scene,flags,writes:initialWrites}=sceneFixture();
  const {runtime,local,publicPulses,setUser}=runtimeFixture();
  try{
    console.debug=(...args)=>logs.push(args);
    globalThis.game={user:{id:"gm",isGM:true},settings:{get:(_ns,key)=>
      key==="debugConsoleLevel"?"verbose":defaultTravelPresets()}};
    const before=readPartyExploration(scene);
    assert.deepEqual(await saveAutomaticCheckpointVisits(scene,["bridge"]),["bridge"]);
    const after=readPartyExploration(scene);
    assert.equal(runtime.publishDiscovery({scene,kind:"checkpoint",recordId:"bridge",
      previous:before,committed:after}),true);
    await runtime.publicWrites;
    assert.deepEqual(local,[{type:"checkpoint.discovered",subject:"SECRET Northern Bridge"}]);
    assert.deepEqual(publicPulses.map(p=>p.type),["checkpoint.discovered"]);
    assert.equal(JSON.stringify(publicPulses).includes("SECRET"),false);
    assert.ok(logs.some(([prefix,item])=>prefix.includes("banner decision")&&
      /queued/.test(item?.decision)),"a confirmed visit logs to GM Verbose");
    // A second move past an already-seen checkpoint is not a new commit.
    const second=readPartyExploration(scene);
    assert.deepEqual(await saveAutomaticCheckpointVisits(scene,["bridge"]),[]);
    assert.equal(runtime.publishDiscovery({scene,kind:"checkpoint",recordId:"bridge",
      previous:second,committed:readPartyExploration(scene)}),false);
    assert.equal(publicPulses.length,1);
    setUser({id:"player",isGM:false});
    const logged=logs.length;
    globalThis.game.user={id:"player",isGM:false};
    runtime.diagnostic({type:"checkpoint.discovered",subject:"SECRET Bridge",
      decision:"Denied"});
    assert.equal(logs.length,logged,"players cannot inspect GM-only verbose traces");
    assert.equal(runtime.publishDiscovery({scene,kind:"checkpoint",recordId:"bridge",
      previous:before,committed:after}),false);
    assert.equal(flags.partyExploration.discoveredCheckpointIds[0],"bridge");
    assert.ok(initialWrites===0);
  }finally{globalThis.game=previousGame;console.debug=previousDebug;}
});

test("GM road Show to players announces only first saved false -> true",async()=>{
  const previousGame=globalThis.game;
  const {scene}=sceneFixture(),{runtime,local,publicPulses}=runtimeFixture();
  try{
    globalThis.game={user:{id:"gm",isGM:true},settings:{get:()=>defaultTravelPresets()}};
    const before=readAtlas(scene);
    const saved=await saveRoadSettings(scene,{roadId:"r",name:"Trade Road",
      appearance:null,playerVisible:true,presetId:"land-stone",expectedRevision:6});
    assert.equal(confirmedRoadVisibilityReveal(before,saved,"r"),true);
    assert.equal(runtime.publishDiscovery({scene,kind:"road",recordId:"r",
      previous:before,committed:saved}),true);
    await runtime.publicWrites;
    assert.deepEqual(local,[{type:"road.discovered",subject:"Trade Road"}]);
    assert.equal(JSON.stringify(publicPulses).includes("Trade Road"),false);
    const unchanged=readAtlas(scene);
    const renamed=await saveRoadSettings(scene,{roadId:"r",name:"New Name",
      appearance:null,playerVisible:true,presetId:"land-stone",
      expectedRevision:unchanged.revision});
    assert.equal(confirmedRoadVisibilityReveal(unchanged,renamed,"r"),false);
    assert.equal(runtime.publishDiscovery({scene,kind:"road",recordId:"r",
      previous:unchanged,committed:renamed}),false);
    assert.equal(publicPulses.length,1);
    assert.equal(runtime.publishDiscovery({scene,kind:"road",recordId:"r",
      previous:before,committed:saved}),false,"stale receipt cannot reannounce");
  }finally{globalThis.game=previousGame;}
});

test("Scene update failure cannot announce a checkpoint",async()=>{
  const previousGame=globalThis.game;
  const {scene}=sceneFixture(),{runtime,local,publicPulses}=runtimeFixture();
  try{
    globalThis.game={user:{id:"gm",isGM:true}};
    scene.update=async()=>{throw Error("Foundry Scene write failed");};
    const before=readPartyExploration(scene);
    await assert.rejects(saveAutomaticCheckpointVisits(scene,["bridge"]),/Scene write failed/);
    assert.equal(runtime.publishDiscovery({scene,kind:"checkpoint",recordId:"bridge",
      previous:before,committed:readPartyExploration(scene)}),false);
    await runtime.publicWrites;
    assert.deepEqual(local,[]);assert.deepEqual(publicPulses,[]);
  }finally{globalThis.game=previousGame;}
});
