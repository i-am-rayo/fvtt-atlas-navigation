import assert from "node:assert/strict";
import test from "node:test";
import {committedJourneyAnnouncement,matchesSavedJourneyAnnouncement}
  from "../scripts/atlas-announcement-commit.js";
import {AtlasAnnouncementRuntime,validatedAtlasAnnouncementPulse,
  ATLAS_ANNOUNCEMENT_PULSE}
  from "../scripts/atlas-announcement-runtime.js";
import {MODULE_ID} from "../scripts/atlas-storage.js";
import {JOURNEY_JOURNAL_FLAG} from "../scripts/navigation-journey-state-store.js";
import {canvasRecoveryAnnouncementType}
  from "../scripts/navigation-canvas-announcement.js";
import {upgradeAtlasPlayerVisibility} from "../scripts/atlas-model.js";
import {defaultPartyExploration} from "../scripts/party-exploration-model.js";

function record(status="moving",{
  percent=0,pendingNativeMove=null,transport=null,target=null
}={}){
  return {createdAt:"2026-11-06T00:00:00.000Z",
    updatedAt:"2026-11-06T00:00:01.000Z",status,pendingNativeMove,
    lastConfirmedAnchor:{point:{x:10,y:20}},
    legs:[{completedPercent:percent,transport}],
    ...(target?{routeTargets:{
      targets:[{checkpointId:target}],nextTargetIndex:1}}:{})};
}

test("Journey banner eligibility follows durable state, not canvas or animation",()=>{
  const started=record();
  assert.equal(committedJourneyAnnouncement(null,started,{type:"journey.started"})?.type,
    "journey.started");
  assert.equal(committedJourneyAnnouncement(null,{...started,lastConfirmedAnchor:null},
    {type:"journey.started"}),null);
  assert.equal(committedJourneyAnnouncement(started,started,{type:"journey.started"}),null);
  const pending=record("completed",{percent:100,pendingNativeMove:{id:"native"}});
  assert.equal(committedJourneyAnnouncement(started,pending,{type:"destination.reached"}),null);
  const completed=record("completed",{percent:100});
  assert.equal(committedJourneyAnnouncement(started,completed,
    {type:"destination.reached"})?.type,"destination.reached");
  assert.equal(committedJourneyAnnouncement(completed,completed,
    {type:"destination.reached"}),null);
  assert.equal(committedJourneyAnnouncement(started,record("ended"),
    {type:"journey.ended"})?.type,"journey.ended");
  assert.equal(committedJourneyAnnouncement(started,record("paused"),
    {type:"journey.paused"}),null);
  assert.equal(committedJourneyAnnouncement(started,record("paused"),
    {type:"journey.paused",manualPause:true})?.type,"journey.paused");
});

test("canvas review announcement is separate from deliberate pause and automatic resume",()=>{
  const paused=record("paused"),interrupted=record("interrupted");
  const ask=options=>canvasRecoveryAnnouncementType({reason:"canvasTearDown",
    phase:"moving",requiresGM:true,record:paused,...options});
  assert.equal(ask(),"journey.awaiting-gm");
  assert.equal(ask({record:interrupted}),"journey.interrupted");
  assert.equal(ask({phase:"paused"}),null,"manual pauses already have a banner");
  assert.equal(ask({phase:"ending"}),null);
  assert.equal(ask({reason:"canvasReady"}),"journey.awaiting-gm",
    "a ready hook may itself interrupt a still-active Journey");
  assert.equal(ask({reason:"requested"}),null);
  assert.equal(ask({requiresGM:false}),null);
  assert.equal(ask({continuing:true}),null);
  assert.equal(ask({record:record("moving")}),null);
  assert.equal(ask({record:record("completed",{percent:100})}),null);
  assert.equal(ask({record:{...paused,pendingNativeMove:{operationId:"p"}}}),null);
  assert.equal(ask({record:{...interrupted,pendingNativeMove:{operationId:"p"}}}),
    "journey.interrupted","an unresolved native move needs GM review, not a fake arrival");
  assert.equal(committedJourneyAnnouncement(paused,paused,{
    type:"journey.awaiting-gm"}),null,"a raw canvas hook cannot publish");
  assert.equal(committedJourneyAnnouncement(paused,paused,{
    type:"journey.awaiting-gm",canvasRecovery:true,gmReviewRequired:true})?.type,
    "journey.awaiting-gm");
  assert.equal(committedJourneyAnnouncement(paused,interrupted,{
    type:"journey.interrupted",canvasRecovery:true,gmReviewRequired:true})?.type,
    "journey.interrupted");
  assert.equal(committedJourneyAnnouncement(paused,record("moving"),{
    type:"journey.interrupted",canvasRecovery:true,gmReviewRequired:true}),null);
});

test("checkpoint announcement requires native-confirmed terminal and target identity",()=>{
  const before=record("moving",{percent:40});
  const arrived=record("paused",{percent:100,
    transport:{arrivalCheckpointId:"dock"},target:"dock"});
  assert.equal(committedJourneyAnnouncement(before,arrived,{
    type:"checkpoint.arrived",checkpointId:"dock"})?.type,"checkpoint.arrived");
  for(const invalid of [
    record("paused",{percent:99,transport:{arrivalCheckpointId:"dock"},target:"dock"}),
    record("paused",{percent:100,transport:{arrivalCheckpointId:"dock"},target:"other"}),
    record("paused",{percent:100,transport:{arrivalCheckpointId:"other"},target:"dock"}),
    {...arrived,pendingNativeMove:{operationId:"pending"}}
  ])assert.equal(committedJourneyAnnouncement(before,invalid,{
    type:"checkpoint.arrived",checkpointId:"dock"}),null);
  assert.equal(committedJourneyAnnouncement(arrived,arrived,{
    type:"checkpoint.arrived",checkpointId:"dock"}),null);
});

test("durable Journal receipt must match status, update revision and final leg",()=>{
  const done=record("completed",{percent:100});
  assert.equal(matchesSavedJourneyAnnouncement(done,structuredClone(done)),true);
  assert.equal(matchesSavedJourneyAnnouncement(done,{...done,status:"interrupted"}),false);
  assert.equal(matchesSavedJourneyAnnouncement(done,{...done,updatedAt:"old"}),false);
  assert.equal(matchesSavedJourneyAnnouncement(done,{
    ...done,legs:[{completedPercent:99}]}),false);
  assert.equal(matchesSavedJourneyAnnouncement(done,{
    ...done,pendingNativeMove:{operationId:"unconfirmed"}}),false);
  const interrupted={...done,status:"interrupted",
    pendingNativeMove:{operationId:"unconfirmed"}};
  assert.equal(matchesSavedJourneyAnnouncement(interrupted,interrupted),false);
  assert.equal(matchesSavedJourneyAnnouncement(interrupted,interrupted,{
    allowPendingInterruption:true}),true);
  assert.equal(matchesSavedJourneyAnnouncement(interrupted,{
    ...interrupted,pendingNativeMove:{operationId:"different"}},
    {allowPendingInterruption:true}),false);
});

test("GM-only canvas review banner has saved status proof and a generic player pulse",async()=>{
  const rendered=[],sent=[];
  let saved=record("paused");
  const runtime=new AtlasAnnouncementRuntime({
    settings:{set:async(_module,_key,pulse)=>sent.push(pulse)},
    renderer:{enqueue:(type,options)=>{rendered.push({type,...options});return true;}},
    user:()=>({id:"gm",isGM:true}),activeGM:()=>({id:"gm"}),
    randomID:()=>`recovery-notice-${rendered.length}-abcde`
  });
  const journal={id:"private-journal",getFlag:()=>saved};
  assert.equal(runtime.publish({journal,committed:saved,
    type:"journey.awaiting-gm"}),false);
  assert.equal(runtime.publish({journal,committed:saved,
    type:"journey.awaiting-gm",canvasRecovery:true,gmReviewRequired:true}),true);
  assert.equal(runtime.publish({journal,committed:saved,
    type:"journey.awaiting-gm",canvasRecovery:true,gmReviewRequired:true}),false,
    "duplicate canvasReady does not send a second banner");
  saved={...record("interrupted"),updatedAt:"2026-11-06T00:00:03.000Z",
    pendingNativeMove:{operationId:"pending"}};
  assert.equal(runtime.publish({journal,committed:saved,
    type:"journey.interrupted",canvasRecovery:true,gmReviewRequired:true}),true);
  await runtime.publicWrites;
  assert.deepEqual(rendered.map(item=>item.type),[
    "journey.awaiting-gm","journey.interrupted"]);
  assert.deepEqual(sent.map(pulse=>pulse.type),rendered.map(item=>item.type));
  assert.ok(sent.every(pulse=>Object.keys(pulse).sort().join(",")==="id,schemaVersion,type"));
  assert.equal(JSON.stringify(sent).includes("private-journal"),false);
  assert.equal(runtime.publish({journal,committed:{...saved,updatedAt:"outdated"},
    type:"journey.interrupted",canvasRecovery:true,gmReviewRequired:true}),false);
});

test("a confirmed Long Rest publishes start/end once, even while already paused",()=>{
  const before={...record("paused"),legs:[{
    completedPercent:20,worldRestSeconds:0,events:[]}]};
  const after={...before,updatedAt:"2026-11-06T00:02:00.000Z",
    legs:[{completedPercent:20,worldRestSeconds:28800,events:[{
      action:"long",hours:8,atHours:1}]}]};
  for(const type of ["break.started","break.ended"]){
    assert.equal(committedJourneyAnnouncement(before,after,{type})?.type,type);
    assert.equal(committedJourneyAnnouncement(after,after,{type}),null);
  }
  assert.equal(matchesSavedJourneyAnnouncement(after,structuredClone(after)),true);
  assert.equal(matchesSavedJourneyAnnouncement(after,{...after,legs:[{
    ...after.legs[0],events:[] }]},{verifyRest:true}),false);
  assert.equal(committedJourneyAnnouncement(before,{...after,legs:[{
    ...after.legs[0],events:[{action:"continue",hours:0}]}]},
    {type:"break.started"}),null);
  assert.equal(committedJourneyAnnouncement(before,{...after,pendingNativeMove:{id:"x"}},
    {type:"break.ended"}),null);
});

test("only active GM can send a committed banner; public payload contains no names or IDs",async()=>{
  const shows=[],writes=[],stored=record("completed",{percent:100});
  let currentUser={id:"gm-1",isGM:true};
  const settings={get:()=>({schemaVersion:1,id:"previousprevious",type:"journey.started"}),
    async set(...args){writes.push(args);return true;}};
  const runtime=new AtlasAnnouncementRuntime({
    settings,renderer:{enqueue:(type,opts)=>{shows.push({type,...opts});return true;}},
    user:()=>currentUser,activeGM:()=>({id:"gm-1"}),
    randomID:()=>"unique-announcement-01"
  });
  assert.equal(runtime.receive({schemaVersion:1,id:"before-client-ready",type:"journey.paused"}),false);
  runtime.start();
  const journal={id:"private-journal",getFlag:(module,key)=>{
    assert.equal(module,MODULE_ID);assert.equal(key,JOURNEY_JOURNAL_FLAG);
    return stored;
  }};
  const previous=record("moving");
  assert.equal(runtime.publish({journal,previous,committed:stored,
    type:"destination.reached",subject:"SECRET FOG LOCATION"}),true);
  assert.deepEqual(shows,[{type:"destination.reached",subject:"SECRET FOG LOCATION"}],
    "GM may see its already-confirmed destination");
  await runtime.publicWrites;
  assert.equal(writes.length,1);
  assert.equal(writes[0][0],MODULE_ID);
  assert.equal(writes[0][1],ATLAS_ANNOUNCEMENT_PULSE);
  assert.deepEqual(writes[0][2],{
    schemaVersion:2,id:"unique-announcement-01",type:"destination.reached"});
  assert.equal(JSON.stringify(writes).includes("SECRET"),false);
  assert.equal(JSON.stringify(writes).includes("private-journal"),false);
  assert.equal(runtime.receive(writes[0][2]),false,
    "the sender's World onChange echo must retain its specific GM text");
  assert.equal(runtime.publish({journal,previous,committed:stored,
    type:"destination.reached",subject:"SECRET FOG LOCATION"}),false);
  currentUser={id:"player-1",isGM:false};
  assert.equal(runtime.publish({journal,previous,committed:stored,
    type:"journey.ended"}),false);
});

test("world-setting listener accepts only canned public content and never replays a saved pulse",()=>{
  const shows=[];
  const runtime=new AtlasAnnouncementRuntime({
    settings:{get:()=>({schemaVersion:1,id:"from-prior-session",type:"journey.paused"})},
    renderer:{enqueue:(...args)=>{shows.push(args);return true;}}
  });
  runtime.start();
  assert.equal(runtime.receive({schemaVersion:1,id:"from-prior-session",
    type:"journey.paused"}),false);
  const pulse={schemaVersion:1,id:"fresh-public-event-01",type:"checkpoint.arrived"};
  assert.equal(runtime.receive(pulse),true);
  assert.deepEqual(shows,[["checkpoint.arrived",{subject:"a waypoint"}]]);
  assert.equal(runtime.receive(pulse),false);
  assert.equal(runtime.receive({...pulse,subject:"Hidden checkpoint"}),false);
  assert.equal(runtime.receive({...pulse,type:"road.discovered"}),false);
  assert.equal(runtime.receive({...pulse,type:"constructor"}),false);
  assert.equal(validatedAtlasAnnouncementPulse(pulse)?.type,"checkpoint.arrived");
  assert.equal(validatedAtlasAnnouncementPulse({schemaVersion:2,
    id:"named-visible-01",type:"journey.started",publicSubject:"Dirwest"})?.publicSubject,
  "Dirwest");
  for(const bad of [
    {...pulse,schemaVersion:2,publicSubject:"SECRET Bridge"},
    {...pulse,schemaVersion:2,type:"journey.started",publicSubject:""},
    {...pulse,schemaVersion:2,type:"journey.started",publicSubject:"Hidden\nCity"},
    {...pulse,schemaVersion:2,type:"journey.started",publicSubject:"X".repeat(121)},
    {...pulse,publicSubject:"legacy cannot carry a name"},
    {...pulse,schemaVersion:2,type:"destination.reached",publicSubject:"Dirwest",sceneId:"private"}
  ])assert.equal(validatedAtlasAnnouncementPulse(bad),null);
  assert.equal(shows.length,1);
});

test("a Journal-verified visible Point B names both GM and player banners",async()=>{
  const atlas=upgradeAtlasPlayerVisibility({schemaVersion:4,
    coordinateSpace:"image",revision:9,enabled:true,calibration:null,
    roads:[{id:"r",name:"Road"}],
    nodes:[{id:"a",x:0,y:0},{id:"b",x:100,y:0}],
    segments:[{id:"s",roadId:"r",from:"a",to:"b",via:[],bidirectional:true}],
    checkpoints:[{id:"city",roadId:"r",nodeId:"b",name:"Dirwest",
      elevationMeters:null}]});
  atlas.checkpoints[0].playerVisible=true;
  const flags={atlas,partyExploration:defaultPartyExploration()};
  const scene={id:"scene",grid:{size:100},canUserModify:()=>true,
    getFlag:(_namespace,key)=>flags[key]};
  let saved={...record("moving"),sceneId:"scene",atlasRevision:atlas.revision,
    destination:{x:100,y:0},lastConfirmedAnchor:{point:{x:0,y:0}}};
  const journal={id:"journal",getFlag:()=>saved};
  const gm=[],writes=[];let sequence=0;
  const server=new AtlasAnnouncementRuntime({
    settings:{set:async(_ns,_key,pulse)=>writes.push(pulse)},
    renderer:{enqueue:(type,options)=>{gm.push([type,options]);return true;}},
    user:()=>({id:"gm",isGM:true}),activeGM:()=>({id:"gm"}),
    randomID:()=>`safe-named-pulse-${++sequence}-abcdefgh`
  });
  assert.equal(server.publish({journal,scene,previous:null,committed:saved,
    type:"journey.started",subject:"GM ONLY JOURNAL TITLE"}),true);
  await server.publicWrites;
  assert.deepEqual(gm,[ ["journey.started",{subject:"Dirwest"}] ]);
  assert.deepEqual(writes[0],{schemaVersion:2,
    id:"safe-named-pulse-1-abcdefgh",type:"journey.started",publicSubject:"Dirwest"});
  assert.equal(JSON.stringify(writes).includes("JOURNAL TITLE"),false);
  const player=[],client=new AtlasAnnouncementRuntime({
    settings:{get:()=>null},renderer:{enqueue:(type,options)=>{
      player.push([type,options]);return true;}}
  });
  client.start();
  assert.equal(client.receive(writes[0]),true);
  assert.deepEqual(player,[["journey.started",{subject:"Dirwest"}]]);
  const before=saved;
  saved={...saved,status:"completed",updatedAt:"2026-11-06T01:00:00.000Z",
    lastConfirmedAnchor:{point:{x:100,y:0}},legs:[{completedPercent:100}]};
  assert.equal(server.publish({journal,scene,previous:before,committed:saved,
    type:"destination.reached",subject:"your destination"}),true);
  await server.publicWrites;
  assert.equal(writes[1].publicSubject,"Dirwest");
  assert.equal(client.receive(writes[1]),true);
  assert.deepEqual(player.at(-1),["destination.reached",{subject:"Dirwest"}]);
});

test("a hidden or unmatched destination never leaves the player-safe generic fallback",async()=>{
  const atlas=upgradeAtlasPlayerVisibility({schemaVersion:4,
    coordinateSpace:"image",revision:9,enabled:true,calibration:null,
    roads:[{id:"r",name:"Road"}],
    nodes:[{id:"a",x:0,y:0},{id:"b",x:100,y:0}],
    segments:[{id:"s",roadId:"r",from:"a",to:"b",via:[],bidirectional:true}],
    checkpoints:[{id:"hidden",roadId:"r",nodeId:"b",name:"SECRET CITY",
      elevationMeters:null}]});
  const flags={atlas,partyExploration:defaultPartyExploration()};
  const scene={id:"scene",grid:{size:100},canUserModify:()=>true,
    getFlag:(_namespace,key)=>flags[key]};
  let saved={...record("moving"),sceneId:"scene",atlasRevision:atlas.revision,
    destination:{x:100,y:0}};
  const journal={id:"j",getFlag:()=>saved};
  const gm=[],writes=[];let seq=0;
  const runtime=new AtlasAnnouncementRuntime({
    settings:{set:async(_ns,_key,pulse)=>writes.push(pulse)},
    renderer:{enqueue:(type,options)=>{gm.push([type,options]);return true;}},
    user:()=>({id:"gm",isGM:true}),activeGM:()=>({id:"gm"}),
    randomID:()=>`fallback-pulse-${++seq}-abcdefgh`
  });
  assert.equal(runtime.publish({journal,scene,previous:null,committed:saved,
    type:"journey.started",subject:"SECRET CITY"}),true);
  await runtime.publicWrites;
  assert.deepEqual(gm,[ ["journey.started",{subject:"your destination"}] ]);
  assert.equal(JSON.stringify(writes).includes("SECRET"),false);
  assert.equal(Object.hasOwn(writes[0],"publicSubject"),false);
  atlas.checkpoints[0].playerVisible=true;
  saved={...saved,createdAt:"new-trip",updatedAt:"2026-11-06T02:00:00.000Z",
    destination:{x:40,y:0}};
  assert.equal(runtime.publish({journal,scene,previous:null,committed:saved,
    type:"journey.started",subject:"SECRET CITY"}),true);
  await runtime.publicWrites;
  assert.equal(Object.hasOwn(writes[1],"publicSubject"),false,
    "do not label a mid-road Point B with a visible but distant city");
});

test("a failed World announcement projection never rejects a committed journey",async()=>{
  const warnings=[],saved=record("completed",{percent:100});
  const runtime=new AtlasAnnouncementRuntime({
    settings:{set:async()=>{throw Error("player delivery offline");}},
    renderer:{enqueue:()=>true},user:()=>({id:"gm",isGM:true}),
    activeGM:()=>({id:"gm"}),randomID:()=>"safe-message-id-001",
    onWarning:error=>warnings.push(error.message)
  });
  const journal={id:"journal",getFlag:()=>saved};
  assert.equal(runtime.publish({journal,previous:record("moving"),committed:saved,
    type:"destination.reached"}),true);
  await runtime.publicWrites;
  assert.deepEqual(warnings,["player delivery offline"]);
});

test("rapid World pulses serialize without leaking any GM-only text",async()=>{
  const writes=[];let releaseFirst;
  const settings={set:async(_module,_key,value)=>{
    writes.push(value);
    if(writes.length===1)await new Promise(resolve=>{releaseFirst=resolve;});
  }};
  let sequence=0;
  const runtime=new AtlasAnnouncementRuntime({settings,
    renderer:{enqueue:()=>true},user:()=>({id:"gm",isGM:true}),
    activeGM:()=>({id:"gm"}),randomID:()=>`valid-pulse-id-${++sequence}-abc`});
  runtime.dispatch("checkpoint.discovered","SECRET Bridge");
  runtime.dispatch("road.discovered","SECRET Road");
  runtime.dispatch("break.started","Long Rest");
  await Promise.resolve();await Promise.resolve();
  assert.equal(writes.length,1,"next pulse waits for the prior server update");
  releaseFirst();
  await runtime.publicWrites;
  assert.deepEqual(writes.map(p=>p.type),[
    "checkpoint.discovered","road.discovered","break.started"]);
  assert.equal(JSON.stringify(writes).includes("SECRET"),false);
  assert.ok(writes.every(p=>Object.keys(p).sort().join(",")==="id,schemaVersion,type"));
});

test("live pause needs explicit manual proof, and live rest needs persisted events",async()=>{
  const shows=[],writes=[];let seq=0;
  const runtime=new AtlasAnnouncementRuntime({
    settings:{set:async(_module,_key,p)=>writes.push(p)},
    renderer:{enqueue:(type)=>{shows.push(type);return true;}},
    user:()=>({id:"gm",isGM:true}),activeGM:()=>({id:"gm"}),
    randomID:()=>`journal-event-${++seq}-abcdefgh`
  });
  const before=record("moving"),paused=record("paused");
  const journal={id:"j",getFlag:()=>paused};
  assert.equal(runtime.publish({journal,previous:before,committed:paused,
    type:"journey.paused"}),false);
  assert.equal(runtime.publish({journal,previous:before,committed:paused,
    type:"journey.paused",manualPause:true}),true);
  const beforeRest={...paused,legs:[{completedPercent:10,events:[],worldRestSeconds:0}]};
  const afterRest={...beforeRest,updatedAt:"2026-11-06T02:00:00.000Z",
    legs:[{completedPercent:10,events:[{action:"long",hours:8,atHours:1}],
      worldRestSeconds:28800}]};
  journal.getFlag=()=>afterRest;
  for(const type of ["break.started","break.ended"])
    assert.equal(runtime.publish({journal,previous:beforeRest,committed:afterRest,
      type,subject:"Long Rest"}),true);
  await runtime.publicWrites;
  assert.deepEqual(shows,["journey.paused","break.started","break.ended"]);
  assert.deepEqual(writes.map(p=>p.type),shows);
  assert.equal(runtime.publish({journal,previous:afterRest,committed:afterRest,
    type:"break.started"}),false);
});

test("controller issues a pause banner only after a successful Journal commit",async()=>{
  const originalFoundry=globalThis.foundry;
  globalThis.foundry={applications:{api:{ApplicationV2:class{}}}};
  const {AtlasNavigationController}=await import("../scripts/navigation-controller.js");
  globalThis.foundry=originalFoundry;
  const {createJourneyRecord}=await import("../scripts/navigation-journey-journal.js");
  const originalGame=globalThis.game;
  try{
    globalThis.game={time:{worldTime:42}};
    const events=[],payloads=[],journal={id:"journal",saved:null,getFlag(){return this.saved;}};
    const store={save:async(state)=>{events.push("save");journal.saved=state;return journal;}};
    const nav=new AtlasNavigationController({
      journeyJournalStore:store,
      announcementPublisher:input=>{events.push(input.type);payloads.push(input);return true;}
    });
    const itinerary={schemaVersion:1,
      scene:{name:"Example",units:"km"},
      endpoints:{departure:{x:0,y:0},destination:{x:100,y:0}},
      measurements:{distance:10,travelHours:4,terrainAware:false},
      travel:{speedPerHour:2.5},directions:[]};
    const start=createJourneyRecord({sceneId:"s",tokenId:"t",
      atlasRevision:1,itinerary,now:"2026-11-06T00:00:00Z"});
    const schedule={completedHours:1,todayHours:1,permittedExtraUntil:0,
      restEvents:0,lastForcedCheck:null,events:[]};
    const session={journal,journeyRecord:start,phase:"pausing",schedule,
      completedDistance:2.5,totalDistance:10,gridSize:100,
      lastConfirmedAnchor:{schemaVersion:1,point:{x:10,y:0}}};
    await nav.saveJourneyCheckpoint(session,"paused");
    assert.deepEqual(events,["save","journey.paused"]);
    assert.equal(payloads[0].manualPause,true,"explicit pause proof is mandatory");
    events.length=0;
    const failing=new AtlasNavigationController({
      journeyJournalStore:{save:async()=>{throw Error("Failed to commit");}},
      announcementPublisher:()=>{events.push("incorrect-banner");}
    });
    const unfinished={...session,journeyRecord:start,journalQueue:undefined};
    await assert.rejects(failing.saveJourneyCheckpoint(unfinished,"paused"),/Failed to commit/);
    assert.deepEqual(events,[],"a failed Journal write cannot announce a pause");
  }finally{globalThis.game=originalGame;}
});
