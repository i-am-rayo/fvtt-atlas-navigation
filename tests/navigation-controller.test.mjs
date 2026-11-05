import assert from "node:assert/strict";
import test from "node:test";
import { createNavigationItinerary } from "../scripts/navigation-itinerary.js";
import { createJourneyRecord,checkpointJourneyRecord,findRecoverableJourney,
  JOURNEY_JOURNAL_FLAG } from "../scripts/navigation-journey-journal.js";
import { GuidedTravelDayTracker,estimateNavigationTotalTrip }
  from "../scripts/navigation-travel-day.js";
import {planNativeCheckpointPath}
  from "../scripts/navigation-native-movement-plan.js";
import { defaultTransportationCatalog,findTransportationPreset,setTransportationPreset }
  from "../scripts/navigation-transport-catalog.js";

const journalStore={save:async(_record,{journal}={})=>journal??{id:"test-journey"},
  find:()=>null};
const tickUntil=async condition=>{
  for(let index=0;index<500;index++){
    if(condition())return;
    await Promise.resolve();
  }
  throw Error("Journey did not reach the expected state.");
};

const previousFoundry=globalThis.foundry;
globalThis.foundry={applications:{api:{ApplicationV2:class {
  render(){this.renders=(this.renders??0)+1;}
  setPosition(options){this.lastPosition=options;}
  close(){this.closed=true;}
}}}};
const { AtlasNavigationController }=await import("../scripts/navigation-controller.js");
globalThis.foundry=previousFoundry;

const point=(x,y)=>({x,y});
const pointer=(x,y,flags={})=>({button:0,clientX:x,clientY:y,
  shiftKey:false,altKey:false,ctrlKey:false,metaKey:false,
  prevented:0,stopped:0,...flags,
  preventDefault(){this.prevented++;},stopImmediatePropagation(){this.stopped++;}});

test("continuous vessel uses one native move and saves each checkpoint intent before document updates",async()=>{
  const previous={game:globalThis.game,foundry:globalThis.foundry,Hooks:globalThis.Hooks};
  try{
    const listeners=new Map(),events=[];
    globalThis.foundry={utils:{randomID:()=>"native-voyage-01"}};
    globalThis.Hooks={
      on(name,callback){listeners.set(name,callback);return callback;},
      off(name,callback){assert.equal(listeners.get(name),callback);listeners.delete(name);}
    };
    globalThis.game={time:{worldTime:100}};
    const scene={id:"native-scene",grid:{size:100}};
    const atlas={revision:4};
    const view={ready:true,scene};
    const token={id:"party-token",x:0,y:0,width:1,height:1,
      hold:null,release:null,moves:0,
      pauseMovement(){
        this.hold=new Promise(resolve=>{this.release=resolve;});
        return async()=>{this.release();};
      },
      stopMovement(){this.release?.();return true;},
      async move(path,options){
        this.moves++;
        let from={x:this.x,y:this.y};
        for(const target of path.filter(point=>point.checkpoint)){
          assert.equal(events.at(-1)?.kind,"intent",
            "a token update must always have a saved pending intent");
          const destination={x:target.x,y:target.y};
          let endAnimation;
          const animationEnded=new Promise(resolve=>{endAnimation=resolve;});
          this.hold=null;this.release=null;
          listeners.get("moveToken")(this,{
            id:options.id,chain:[],origin:from,
            destination,animation:{ended:animationEnded}
          });
          // The live v14 move hook may report an approved endpoint while the
          // authoritative document still contains the preceding checkpoint.
          assert.deepEqual({x:this.x,y:this.y},from);
          Object.assign(this,destination);
          endAnimation();
          if(this.hold)await this.hold;
          from={x:this.x,y:this.y};
        }
        return true;
      }
    };
    const nav=new AtlasNavigationController({canvasProvider:()=>view,
      atlasProvider:()=>atlas,atlasPoint:(_view,_atlas,p)=>p});
    nav.scene=scene;
    const session={token,sceneId:scene.id,gridSize:100,phase:"moving",
      totalDistance:30,completedDistance:0,clock:null,
      journeyRecord:{},schedule:{recordMovement(){}},confirmedSegments:0,
      pendingPassengerRest:null};
    nav.travelSession=session;
    nav.saveJourneyCheckpoint=async(record,status)=>{
      events.push({kind:record.journeyRecord.pendingNativeMove?"intent":"confirmed",
        status,progress:record.completedDistance});
    };
    nav.captureConfirmedJourneyAnchor=()=>({point:{x:token.x,y:token.y}});
    assert.equal(await nav.runNativeContinuousLeg(session,{
      plan:planNativeCheckpointPath([point(0,0),point(30,0)],{
        movementSpeed:.05,gridSize:100,totalMovingHours:6}),
      playback:{movementSpeed:.05,travelHours:6},atlas,view,
      guidedLeg:{checkpoint:{point:point(80,50)},
        transport:{methodName:"Warship"}}
    }),true);
    assert.equal(token.moves,1);
    assert.equal(session.completedDistance,30);
    assert.equal(session.journeyRecord.pendingNativeMove,null);
    assert.deepEqual(events.map(event=>event.kind),[
      "intent","confirmed","intent","confirmed","intent","confirmed"]);
    assert.equal(events.at(-1).status,"paused",
      "the final dock must be durable before the native movement promise resolves");
    assert.equal(listeners.size,0);
  }finally{
    globalThis.game=previous.game;globalThis.foundry=previous.foundry;
    globalThis.Hooks=previous.Hooks;
  }
});

test("native destination without committed token position preserves pending Journal intent and clock",async()=>{
  const previous={game:globalThis.game,foundry:globalThis.foundry,Hooks:globalThis.Hooks};
  try{
    const listeners=new Map(),journalWrites=[];
    globalThis.foundry={utils:{randomID:()=>"native-uncommitted-01"}};
    globalThis.Hooks={
      on(name,callback){listeners.set(name,callback);return callback;},
      off(name,callback){assert.equal(listeners.get(name),callback);listeners.delete(name);}
    };
    globalThis.game={time:{worldTime:500}};
    const scene={id:"native-scene",grid:{size:100}};
    const atlas={revision:4};
    const view={ready:true,scene};
    const token={id:"party-token",x:0,y:0,width:1,height:1,stopped:false,
      release:null,
      pauseMovement(){
        const hold=new Promise(resolve=>{this.release=resolve;});
        this.hold=hold;
        return async()=>{this.release?.();};
      },
      stopMovement(){this.stopped=true;this.release?.();return true;},
      async move(path,options){
        const destination={x:path.at(-1).x,y:path.at(-1).y};
        listeners.get("moveToken")(this,{
          id:options.id,chain:[],origin:{x:0,y:0},destination,
          animation:{ended:Promise.resolve()}
        });
        if(this.hold)await this.hold;
        return !this.stopped;
      }
    };
    const nav=new AtlasNavigationController({canvasProvider:()=>view,
      atlasProvider:()=>atlas,atlasPoint:(_view,_atlas,p)=>p});
    nav.scene=scene;
    const session={token,sceneId:scene.id,gridSize:100,phase:"moving",
      totalDistance:10,completedDistance:0,clock:null,
      journeyRecord:{},schedule:{recordMovement(){throw Error("Unconfirmed movement credited");}},
      confirmedSegments:0,pendingPassengerRest:null};
    nav.travelSession=session;
    nav.saveJourneyCheckpoint=async(_session,status)=>journalWrites.push(status);
    await assert.rejects(nav.runNativeContinuousLeg(session,{
      plan:{path:[{x:0,y:0},{x:10,y:0,checkpoint:true}],
        checkpoints:[{index:0,from:{x:0,y:0},point:{x:10,y:0},
          distance:10,completedDistance:10,completedMovingHours:1}],totalDistance:10},
      playback:{movementSpeed:1,travelHours:1},atlas,view,
      guidedLeg:{checkpoint:{point:point(60,50)},transport:{methodName:"Ship passage"}}
    }),/TokenDocument missed its approved checkpoint/);
    assert.deepEqual(journalWrites,["moving"],
      "a pending intent is saved but no confirmation is committed");
    assert.equal(session.journeyRecord.pendingNativeMove?.operationId,
      "native-uncommitted-01");
    assert.equal(session.completedDistance,0);
    assert.equal(session.confirmedSegments,0);
    assert.equal(globalThis.game.time.worldTime,500);
    assert.equal(token.x,0);
    assert.equal(token.stopped,true);
    assert.equal(listeners.size,0);
  }finally{
    globalThis.game=previous.game;globalThis.foundry=previous.foundry;
    globalThis.Hooks=previous.Hooks;
  }
});

test("changing Navigation stages releases detached progress and World-clock DOM refs",async()=>{
  const nav=new AtlasNavigationController();
  nav.completedRoute=true;
  nav.travelProgressUI={bar:{}};
  nav.journeyTimeUI={moving:{}};
  nav.worldTimeUI={};
  nav.renderJourneyStage=async stage=>stage;
  assert.equal(await nav._renderHTML(),"completed");
  assert.equal(nav.travelProgressUI,null);
  assert.equal(nav.journeyTimeUI,null);
  assert.equal(nav.worldTimeUI,null);
});

test("unexpected canvas redraw reports and safely ends the active journey",()=>{
  const old={ui:globalThis.ui,game:globalThis.game};
  const messages=[];
  try{
    globalThis.game={user:{isGM:true},settings:{get:(_module,key)=>key==="guidedTransportationCatalog"?undefined:false}};
    globalThis.ui={notifications:{warn:message=>messages.push(message)}};
    const nav=new AtlasNavigationController();
    nav.scene={id:"scene-reloaded"};
    nav.rendered=true;
    nav.travelProgress=52;
    let woke=0;
    const session={phase:"moving",resumeWaiter:()=>woke++,restWaiter:()=>{}};
    nav.travelSession=session;
    nav.tearDown("canvasTearDown");
    assert.equal(messages.length,1);
    assert.match(messages[0],/canvas redraw/);
    assert.equal(nav.travelSession,null);
    assert.equal(nav.active,false);
    assert.equal(session.phase,"ending");
    assert.equal(woke,1);
    assert.equal(nav.closed,true);
  }finally{globalThis.ui=old.ui;globalThis.game=old.game;}
});

test("canvas redraw cannot downgrade a durably confirmed final native dock",async()=>{
  const nav=new AtlasNavigationController();
  nav.scene={id:"arrival-scene"};
  const statuses=[];
  let nativeStops=0;
  nav.saveJourneyCheckpoint=async(_session,status)=>{statuses.push(status);};
  nav.travelSession={phase:"moving",nativeActive:true,
    token:{stopMovement(){nativeStops++;}},
    completedDistance:50,totalDistance:50,
    journeyRecord:{status:"paused",pendingNativeMove:null}};
  nav.stop();
  assert.deepEqual(statuses,["paused"]);
  assert.equal(nativeStops,1);
});

test("late stop and checkpoint callbacks cannot downgrade an arrived Journey Journal",async()=>{
  const saved=[];
  const nav=new AtlasNavigationController({journeyJournalStore:{
    save:async record=>{saved.push(record.status);return {id:"journal"};},find:()=>null}});
  const session={phase:"moving",completedDistance:10,totalDistance:10,
    journal:{id:"journal"},journeyRecord:{status:"completed",
      pendingNativeMove:null},token:{},schedule:{}};
  nav.scene={id:"arrival-scene"};nav.travelSession=session;
  await nav.saveJourneyCheckpoint(session,"interrupted");
  assert.deepEqual(saved,[],"late callback cannot rewrite completed history");
  nav.stop();
  assert.deepEqual(saved,[],"canvas close cannot rewrite completed history");
  assert.equal(session.journeyRecord.status,"completed");
});

test("canvas rebuild reopens the GM window and restores only a confirmed paused preview",async()=>{
  const previous={game:globalThis.game,ui:globalThis.ui};
  try{
    const scene={id:"pause-scene",canUserModify:()=>true};
    globalThis.game={user:{id:"gm",isGM:true}};
    globalThis.ui={notifications:{warn(){}}};
    const nav=new AtlasNavigationController({canvasProvider:()=>({ready:true,scene})});
    nav.scene=scene;nav.rendered=true;
    nav.render=async()=>{};
    nav.close=async()=>{nav.closed=true;};
    const writes=[];
    nav.saveJourneyCheckpoint=async(_session,status)=>writes.push(status);
    nav.travelSession={sceneId:scene.id,phase:"paused",
      journal:{id:"approved-journal"},
      journeyRecord:{status:"paused",pendingNativeMove:null},
      completedDistance:25,totalDistance:100};
    nav.tearDown("canvasTearDown");
    assert.equal(nav.active,false);
    assert.equal(nav.windowRestorePending.confirmedPause,true);
    assert.deepEqual(writes,["paused"],"a confirmed pause must not be downgraded");
    const previews=[];
    nav.activate=()=>{nav.scene=scene;
      nav.recoverableJourney={id:"approved-journal"};};
    nav.recoverSavedJourney=options=>{previews.push(options);return true;};
    assert.equal(await nav.restoreWindowAfterCanvasReady(),true);
    assert.deepEqual(previews,[{automatic:true}]);
    assert.match(nav.travelNotice,/confirmed paused route is restored/);
    assert.equal(nav.windowRestorePending,null);
    assert.equal(await nav.restoreWindowAfterCanvasReady(),false,
      "a second canvasReady must not restore again");
  }finally{globalThis.game=previous.game;globalThis.ui=previous.ui;}
});

test("an unconfirmed native checkpoint may reopen the window but never recover or restart",async()=>{
  const previous={game:globalThis.game,ui:globalThis.ui};
  try{
    const scene={id:"review-scene",canUserModify:()=>true};
    globalThis.game={user:{id:"gm",isGM:true}};
    globalThis.ui={notifications:{warn(){}}};
    const nav=new AtlasNavigationController({canvasProvider:()=>({ready:true,scene})});
    nav.scene=scene;nav.rendered=true;nav.close=async()=>{};
    nav.saveJourneyCheckpoint=async()=>{};
    const session={sceneId:scene.id,phase:"pausing",
      journal:{id:"pending-journal"},
      journeyRecord:{status:"moving",pendingNativeMove:{operationId:"op"}},
      completedDistance:25,totalDistance:100,token:{stopMovement(){}}};
    nav.travelSession=session;
    nav.tearDown("canvasTearDown");
    assert.equal(nav.windowRestorePending.confirmedPause,false);
    assert.equal(nav.autoResumePending,null);
    nav.activate=()=>{nav.scene=scene;nav.recoverableJourney={id:"pending-journal"};};
    nav.recoverSavedJourney=()=>{throw Error("Unsafe automatic recovery");};
    assert.equal(await nav.restoreWindowAfterCanvasReady(),true);
    assert.equal(session.journeyRecord.pendingNativeMove.operationId,"op");
  }finally{globalThis.game=previous.game;globalThis.ui=previous.ui;}
});

test("canvas recovery restarts only the matching GM-approved Journey after its writes settle",async()=>{
  const previous={game:globalThis.game,ui:globalThis.ui};
  try{
    const scene={id:"same-scene"},token={id:"assigned-token"};
    const canvas={ready:true,scene};
    globalThis.game={user:{id:"gm-1",isGM:true},users:{activeGM:{id:"gm-1"}}};
    globalThis.ui={notifications:{warn(){throw Error("Unexpected warning");}}};
    const nav=new AtlasNavigationController({canvasProvider:()=>canvas,
      atlasProvider:()=>({revision:17}),partyTokenProvider:()=>token});
    let recovered=0,started=0;
    nav.activate=()=>{nav.scene=scene;nav.recoverableJourney={id:"saved-journey"};};
    nav.recoverSavedJourney=()=>{
      recovered++;
      nav.recoveryRecord={legs:[{completedPercent:40}]};
      return true;
    };
    nav.startGuidedTravel=async()=>{started++;return true;};
    nav.autoResumePending={sceneId:scene.id,tokenId:token.id,
      revision:17,journalId:"saved-journey",session:{
        finished:Promise.resolve(),journalQueue:Promise.resolve()}};
    assert.equal(await nav.autoResumeAfterCanvasReady(),true);
    assert.equal(recovered,1);assert.equal(started,1);
    assert.equal(nav.autoResumePending,null);
    assert.equal(await nav.autoResumeAfterCanvasReady(),false,
      "an already recovered journey cannot queue a second restart");
    nav.scene=null;
    nav.autoResumePending={sceneId:scene.id,tokenId:token.id,
      revision:18,journalId:"saved-journey",session:{finished:Promise.resolve()}};
    // A changed road network blocks any automatic token movement.
    globalThis.ui={notifications:{warn(){}}};
    assert.equal(await nav.autoResumeAfterCanvasReady(),false);
    assert.equal(started,1);
    nav.autoResumePending={sceneId:scene.id,tokenId:token.id,
      revision:17,journalId:"saved-journey",requiresRestCheckpoint:true,
      session:{finished:Promise.resolve(),restCheckpointed:false}};
    assert.equal(await nav.autoResumeAfterCanvasReady(),false,
      "an interrupted, uncommitted rest cannot restart token movement");
    assert.equal(started,1);
  }finally{globalThis.game=previous.game;globalThis.ui=previous.ui;}
});

test("involuntary canvas redraw restores a confirmed dock without requesting approval to recover or starting a new leg",async()=>{
  const previous={game:globalThis.game,ui:globalThis.ui};
  try{
    const scene={id:"dock-scene"},token={id:"party"};
    globalThis.game={user:{id:"gm",isGM:true},users:{activeGM:{id:"gm"}}};
    const messages=[];
    globalThis.ui={notifications:{warn:message=>messages.push(message)}};
    const nav=new AtlasNavigationController({
      canvasProvider:()=>({ready:true,scene}),
      atlasProvider:()=>({revision:19}),partyTokenProvider:()=>token
    });
    nav.activate=()=>{nav.scene=scene;nav.recoverableJourney={id:"saved-journal"};};
    let recovered=0,started=0;
    nav.recoverSavedJourney=({automatic})=>{
      assert.equal(automatic,true);
      recovered++;
      nav.recoveryRecord={status:"paused",legs:[{completedPercent:100}]};
      nav.pendingTransfer={checkpoint:{id:"port-barthos",name:"Port Barthos"},
        journalId:"saved-journal"};
      return true;
    };
    nav.startGuidedTravel=async()=>{started++;throw Error("Unapproved next leg");};
    nav.autoResumePending={sceneId:scene.id,tokenId:token.id,
      revision:19,journalId:"saved-journal",session:{
        finished:Promise.resolve(),journalQueue:Promise.resolve()}};
    assert.equal(await nav.autoResumeAfterCanvasReady(),true);
    assert.equal(recovered,1,"the previously approved Journey recovers automatically");
    assert.equal(started,0,"no new transport or checkpoint leg can start automatically");
    assert.equal(nav.pendingTransfer.checkpoint.id,"port-barthos");
    assert.deepEqual(messages,[],"confirmed checkpoint recovery is not an error");
    assert.equal(nav.autoResumePending,null);
    assert.equal(await nav.autoResumeAfterCanvasReady(),false,
      "canvasReady duplication cannot start travel again");
  }finally{globalThis.game=previous.game;globalThis.ui=previous.ui;}
});

test("canvas recovery never auto-replays a fully confirmed leg without an onward decision",async()=>{
  const previous={game:globalThis.game,ui:globalThis.ui};
  try{
    const scene={id:"last-leg-scene"},token={id:"party"};
    globalThis.game={user:{id:"gm",isGM:true},users:{activeGM:{id:"gm"}}};
    globalThis.ui={notifications:{warn(){throw Error("Unexpected warning");}}};
    const nav=new AtlasNavigationController({
      canvasProvider:()=>({ready:true,scene}),
      atlasProvider:()=>({revision:9}),partyTokenProvider:()=>token});
    nav.activate=()=>{nav.scene=scene;nav.recoverableJourney={id:"journal"};};
    nav.recoverSavedJourney=()=>{
      nav.recoveryRecord={status:"interrupted",legs:[{completedPercent:100}]};
      return true;
    };
    nav.render=async()=>{};
    nav.startGuidedTravel=async()=>{throw Error("Full leg should never be replayed");};
    nav.autoResumePending={sceneId:scene.id,tokenId:token.id,
      revision:9,journalId:"journal",session:{finished:Promise.resolve()}};
    assert.equal(await nav.autoResumeAfterCanvasReady(),true);
    assert.match(nav.travelNotice,/last approved leg is already confirmed/);
    assert.equal(nav.autoResumePending,null);
  }finally{globalThis.game=previous.game;globalThis.ui=previous.ui;}
});

test("interrupted voyage writes the last confirmed native anchor, not an in-flight document position",async()=>{
  const previous=globalThis.game;
  try{
    globalThis.game={time:{worldTime:1111}};
    const scene={id:"voyage",grid:{size:100,units:"mi"}};
    const view={ready:true,scene};
    const atlas={revision:3,roads:[{id:"sea",name:"Sea Lane"}],
      nodes:[{id:"port",x:0,y:0},{id:"dock",x:1000,y:0}],
      segments:[{id:"sea-segment",roadId:"sea",from:"port",to:"dock",via:[]}]};
    const token={id:"party",x:870,y:-50,width:1,height:1,elevation:0};
    const route={status:"ok",start:point(0,0),end:point(1000,0),
      distance:100,cost:100,terrainAware:false,legs:[{
        kind:"road",roadId:"sea",segmentId:"sea-segment",distance:100,cost:100,
        points:[point(0,0),point(1000,0)]}]};
    const itinerary=createNavigationItinerary({sceneId:scene.id,route,
      travel:{speed:20},roadName:()=>"Sea Lane"});
    const record=createJourneyRecord({sceneId:scene.id,tokenId:token.id,
      atlasRevision:3,itinerary,initialAnchor:{point:point(0,0),
        roadId:"sea",segmentId:"sea-segment",checkpointId:null,
        levelId:null,elevation:0}});
    const stored=[];
    const nav=new AtlasNavigationController({canvasProvider:()=>view,
      atlasProvider:()=>atlas,atlasPoint:(_view,_atlas,at)=>at,
      journeyJournalStore:{save:async saved=>{stored.push(saved);return {id:"journal"};}}});
    nav.scene=scene;
    const schedule=new GuidedTravelDayTracker({travelHours:5,rules:{
      dailyHours:8,overnightHours:16,longRestHours:8,shortRestHours:1,
      forcedMarch:"custom"}});
    schedule.recordMovement(4.6);
    const session={token,sceneId:scene.id,gridSize:100,journal:{id:"journal"},
      journeyRecord:record,schedule,completedDistance:92,totalDistance:100,
      currentChunk:null,clock:{advancedSeconds:16560,restSeconds:0}};
    session.lastConfirmedAnchor=nav.captureConfirmedJourneyAnchor(session,view,atlas);
    assert.equal(session.lastConfirmedAnchor.point.x,920);
    assert.equal(session.lastConfirmedAnchor.roadId,"sea");
    assert.equal(session.lastConfirmedAnchor.segmentId,"sea-segment");
    // Foundry updates its TokenDocument before the visible movement finishes.
    // This native coordinate has NOT earned any travel hours yet.
    token.x=940;
    session.currentChunk={distance:8};
    view.ready=false;
    await nav.saveJourneyCheckpoint(session,"interrupted");
    assert.equal(stored.length,1);
    assert.equal(stored[0].status,"interrupted");
    assert.equal(stored[0].legs.at(-1).completedPercent,92);
    assert.equal(stored[0].legs.at(-1).completedMovingHours,4.6);
    assert.deepEqual(stored[0].lastConfirmedAnchor.point,point(920,0),
      "canvas teardown never drops the last confirmed sea coordinate");
    view.ready=true;
    await nav.saveJourneyCheckpoint(session,"interrupted");
    assert.deepEqual(stored.at(-1).lastConfirmedAnchor.point,point(920,0),
      "a ready canvas must not promote an unconfirmed in-flight TokenDocument location");
  }finally{globalThis.game=previous;}
});

test("a refreshed checkpoint-bound Riding Horse journey recovers its physical route and original destination",()=>{
  const previous={game:globalThis.game,ui:globalThis.ui};
  try{
    const scene={id:"paedor",name:"Paedor",grid:{size:100,units:"mi"}};
    const atlas={revision:7,roads:[{id:"road",name:"Hearth's Heart"}],
      nodes:[{id:"a",x:0,y:0},{id:"b",x:48,y:0}],
      checkpoints:[{id:"hearth-dock",name:"Hearth's Heart Dock",
        nodeId:"b",roadId:"road"}]};
    const token={id:"party",x:-26,y:-50,width:1,height:1,
      canUserModify:()=>true};
    const initial={status:"ok",start:point(0,0),end:point(48,0),
      distance:48,cost:48,terrainAware:false,legs:[{
        kind:"road",roadId:"road",segmentId:"segment",
        distance:48,cost:48,points:[point(0,0),point(48,0)]}]};
    const itinerary=createNavigationItinerary({sceneId:scene.id,
      sceneName:scene.name,sceneUnits:"mi",atlasRevision:7,
      route:initial,travel:{speed:3}});
    itinerary.transport={methodId:"riding-horse",methodName:"Riding Horse",
      kind:"mount",arrangement:"owned",surface:"land",
      departureCheckpointName:null,arrivalCheckpointId:"hearth-dock",
      arrivalCheckpointName:"Hearth's Heart Dock",
      roadNames:["Hearth's Heart"],estimatedFareCp:0,operation:"normal"};
    const saved=createJourneyRecord({sceneId:scene.id,tokenId:token.id,
      atlasRevision:7,itinerary,journeyDestination:point(60,0)});
    saved.status="interrupted";
    saved.legs[0].completedPercent=50;
    saved.legs[0].completedMovingHours=8;
    saved.legs[0].worldTravelSeconds=8*3600;
    saved.legs[0].worldRestSeconds=8*3600;
    const seen=[];
    const routeCalculator=(_view,_scene,_atlas,start,end,options)=>{
      seen.push(options);
      // Walking's terrain-aware route may choose a different attachment.
      // Recovery must select the saved mount before this calculation.
      const destination=options.terrainAware===false?end:point(end.x,end.y+10);
      return {status:"ok",start,end:destination,distance:24,cost:24,
        terrainAware:options.terrainAware!==false,legs:[{
          kind:"road",roadId:"road",segmentId:"segment",
          distance:24,cost:24,points:[start,destination]}]};
    };
    globalThis.game={user:{id:"gm",isGM:true},system:{id:"dnd5e"},
      settings:{get:()=>undefined}};
    globalThis.ui={notifications:{warn(message){throw Error(message);},
      error(message){throw Error(message);}}};
    const nav=new AtlasNavigationController({canvasProvider:()=>({ready:true,scene}),
      atlasProvider:()=>atlas,partyTokenProvider:()=>token,
      atlasPoint:(_view,_atlas,center)=>center,routeCalculator});
    nav.scene=scene;nav.draw=()=>{};nav.render=async()=>{};
    nav.resolveTravel=()=>({sceneUnit:"mi",travel:{speed:3,hoursPerDay:8,
      source:"group-method",methodId:"riding-horse"}});
    nav.recoverableJourney={id:"journal",getFlag:()=>saved};
    assert.equal(nav.recoverSavedJourney(),true);
    assert.equal(nav.travelMethod,"riding-horse");
    assert.equal(nav.transportArrangement,"owned");
    assert.deepEqual(seen,[{terrainAware:false}]);
    assert.deepEqual(nav.end,point(48,0),"recovery targets the approved checkpoint");
    assert.deepEqual(nav.recoveryRecord.destination,point(60,0),
      "the original final Point B survives an interrupted checkpoint leg");
    const plan=nav.transportationTransitionPlan();
    assert.equal(plan.legs[0].recovered,true);
    assert.equal(plan.legs[0].selectedOption.method.id,"riding-horse");
    assert.equal(plan.legs[0].costCp,0,"recovery never books a second fare");
    assert.equal(nav.recoveryRecord.legs[0].worldTravelSeconds,8*3600);
    assert.equal(nav.recoveryRecord.legs[0].worldRestSeconds,8*3600);
  }finally{globalThis.game=previous.game;globalThis.ui=previous.ui;}
});

test("manual pauses never arm automatic journey continuation",()=>{
  const previous={game:globalThis.game,ui:globalThis.ui};
  try{
    globalThis.game={user:{isGM:true}};
    globalThis.ui={notifications:{warn(){}}};
    const nav=new AtlasNavigationController();
    nav.scene={id:"manual-paused-scene"};
    nav.travelSession={sceneId:"manual-paused-scene",token:{id:"t"},
      journal:{id:"j"},journeyRecord:{atlasRevision:7},phase:"paused",
      schedule:{completedHours:0,todayHours:0,permittedExtraUntil:0,
        restEvents:0,lastForcedCheck:null,events:[]},completedDistance:0,totalDistance:1};
    nav.tearDown("canvasTearDown");
    assert.equal(nav.autoResumePending,null);
  }finally{globalThis.game=previous.game;globalThis.ui=previous.ui;}
});

test("a manual pause permits a long rest without moving, resuming or double-counting World time",async()=>{
  const previous={game:globalThis.game,ui:globalThis.ui};
  try{
    globalThis.game={user:{isGM:true},time:{worldTime:72000}};
    globalThis.ui={notifications:{error(message){throw Error(message);}}};
    const route={status:"ok",start:point(0,0),end:point(10,0),
      distance:10,cost:10,terrainAware:false,legs:[{
        kind:"road",roadId:"road",segmentId:"segment",
        points:[point(0,0),point(10,0)],distance:10,cost:10}]};
    const itinerary=createNavigationItinerary({sceneId:"pause-scene",route,
      travel:{speed:2},roadName:()=>"Road"});
    const record=createJourneyRecord({sceneId:"pause-scene",tokenId:"party",
      atlasRevision:7,itinerary});
    const rules={dailyHours:8,overnightHours:16,shortRestHours:1,
      longRestHours:8,forcedMarch:"dnd5e2024"};
    const schedule=new GuidedTravelDayTracker({travelHours:5,rules});
    schedule.recordMovement(1);
    let clockCommits=0,breakCommits=0,resumed=0;
    const clock={advancedSeconds:3600,restSeconds:0,
      commit:async()=>{clockCommits++;return 0;},
      commitBreak:async seconds=>{
        breakCommits++;clock.restSeconds+=seconds;
        globalThis.game.time.worldTime+=seconds;
      }};
    const saves=[];
    const nav=new AtlasNavigationController({journeyJournalStore:{
      save:async data=>{saves.push(structuredClone(data));return {id:"journal"};},
      find:()=>null}});
    nav.scene={id:"pause-scene"};nav.render=async()=>{};
    const session={sceneId:"pause-scene",phase:"paused",schedule,clock,
      journal:{id:"journal"},journeyRecord:record,completedDistance:2,
      totalDistance:10,resumeWaiter:()=>resumed++};
    nav.travelSession=session;
    assert.equal(await nav.choosePausedTravelRest("long"),true);
    assert.equal(session.phase,"paused");
    assert.equal(session.manualRestApplying,false);
    assert.equal(clockCommits,1,"pending moving time is settled before rest");
    assert.equal(breakCommits,1,"World downtime is committed only once");
    assert.equal(clock.restSeconds,8*3600);
    assert.equal(globalThis.game.time.worldTime,72000+8*3600);
    assert.equal(resumed,0,"rest must not wake the movement loop");
    assert.equal(schedule.completedHours,1,"confirmed distance is preserved");
    assert.equal(schedule.todayHours,0,"long rest resets daily allowance");
    assert.equal(saves.length,1);
    assert.equal(saves[0].status,"paused");
    assert.equal(saves[0].legs[0].worldRestSeconds,8*3600);
    assert.equal(saves[0].legs[0].worldTravelSeconds,3600);
    assert.equal(saves[0].legs[0].events[0].action,"long");
    assert.equal(saves[0].legs[0].events[0].atHours,1);
    assert.match(nav.travelNotice,/journey remains paused/);
    assert.equal(await nav.choosePausedTravelRest("continue"),false,
      "forced march is not a rest available mid-day");
    session.phase="moving";
    assert.equal(await nav.choosePausedTravelRest("short"),false,
      "rest actions require an actual paused movement boundary");
    session.phase="paused";
    nav.journeyJournalStore.save=async()=>{throw Error("Journal write failed");};
    await assert.rejects(nav.choosePausedTravelRest("short"),/Journal write failed/);
    assert.equal(session.phase,"rest-error",
      "if the World clock advances but Journal persistence fails, movement locks");
    assert.equal(nav.resumeGuidedTravel(),false);
    assert.equal(await nav.choosePausedTravelRest("short"),false,
      "a failed rest cannot be booked a second time while recovery is needed");
    assert.equal(resumed,0);
  }finally{globalThis.game=previous.game;globalThis.ui=previous.ui;}
});

test("canvas refresh during an optional paused rest never arms automatic token continuation",()=>{
  const previous={ui:globalThis.ui,game:globalThis.game};
  try{
    globalThis.game={user:{isGM:true}};
    globalThis.ui={notifications:{warn(){}}};
    const nav=new AtlasNavigationController();
    nav.scene={id:"pause-scene"};
    nav.travelSession={phase:"rest-applying",manualRestApplying:true,
      sceneId:"pause-scene",token:{id:"party"},journal:{id:"journal"},
      journeyRecord:{atlasRevision:7}};
    let stops=0;
    nav.stop=()=>{stops++;};
    nav.tearDown("canvasTearDown");
    assert.equal(stops,1);
    assert.equal(nav.autoResumePending,null,
      "a manually paused rest must recover manually after canvas replacement");
  }finally{globalThis.ui=previous.ui;globalThis.game=previous.game;}
});

test("navigation locks the completed route until deliberate endpoint gestures or New Route",async()=>{
  const previous={foundry:globalThis.foundry,game:globalThis.game,window:globalThis.window,
    PIXI:globalThis.PIXI,ui:globalThis.ui,document:globalThis.document};
  try{
    globalThis.foundry={applications:{api:{ApplicationV2:class {}}}};
    globalThis.game={user:{isGM:true},system:{id:"test"},settings:{get:(_module,key)=>["guidedTransportationCatalog","corridorTravelPresets"].includes(key)?undefined:5}};
    globalThis.window={innerWidth:1200,innerHeight:850};
    globalThis.PIXI=undefined;
    globalThis.ui={notifications:{error(message){throw Error(message);}}};
    globalThis.document={createElement:tag=>({tag,style:{},children:[],textContent:"",
      listeners:new Map(),append(...nodes){this.children.push(...nodes);},
      appendChild(node){this.children.push(node);},
      addEventListener(name,handler){this.listeners.set(name,handler);}})};
    const scene={id:"scene-1",name:"Paedor",grid:{units:"km",size:100},
      getFlag:(_module,key)=>key==="checkpointTransportOffers"?
        {schemaVersion:1,entries:{"stop-a":[
          {methodId:"mounted",mode:"land",overrides:{hireEnabled:true,hireCostCp:50}},
          {methodId:"carriage",mode:"land",overrides:{hireEnabled:true}},
          {methodId:"rowboat",mode:"water",overrides:{hireEnabled:true}}
        ]}}:null,
      tokens:{get:()=>null},canUserModify:()=>true,
      setFlag(){throw Error("Navigation must not write Scene flags.");}};
    const listeners=new Map();
    const target={addEventListener(name,handler){listeners.set(name,handler);},
      removeEventListener(name){listeners.delete(name);}};
    const view={ready:true,scene,app:{canvas:target},
      canvasCoordinatesFromClient:({x,y})=>point(x,y),
      dimensions:{sceneRect:{contains:()=>true}}};
    const atlas={revision:7,roads:[{id:"road-a",name:"Road A"}],
      checkpoints:[{id:"stop-a",nodeId:"n1",name:"Starting Town"}],
      nodes:[{id:"n1",x:10,y:10}],segments:[]};
    let calculations=0;
    const nav=new AtlasNavigationController({canvasProvider:()=>view,atlasProvider:()=>atlas,
      atlasPoint:(_view,_atlas,location)=>location,
      routeCalculator:(_view,_scene,_atlas,start,end)=>{
        calculations++;
        const distance=Math.hypot(end.x-start.x,end.y-start.y);
        return {status:"ok",start:{...start},end:{...end},distance,cost:distance,
          terrainAware:false,legs:[{kind:"road",roadId:"road-a",segmentId:"segment-a",
            points:[{...start},{...end}],distance,cost:distance}]};
      }});
    nav.activate();
    assert.equal(nav.sourceMode,"map","Scenes without an assigned explorer keep map-point mode");
    const find=(item,match)=>match(item)?item:item.children.map(child=>find(child,match)).find(Boolean);
    const beforeRoute=await nav._renderHTML();
    assert.equal(find(beforeRoute,item=>item.id==="atlas-navigation-travel-method"),undefined,
      "Travel method is hidden until a route has been calculated");
    assert.equal(listeners.has("pointerdown"),true);
    const first=pointer(10,20);listeners.get("pointerdown")(first);
    assert.deepEqual(nav.start,point(10,20));assert.equal(nav.end,null);
    assert.equal(first.prevented,1);
    listeners.get("pointerdown")(pointer(100,20));
    assert.equal(calculations,1);
    const saved=nav.getItinerarySnapshot();
    assert.equal(saved.legs[0].roadName,"Road A");
    assert.deepEqual(nav.end,point(100,20));

    const plain=pointer(200,200);listeners.get("pointerdown")(plain);
    assert.equal(plain.prevented,0,"ordinary click must remain available to Foundry");
    assert.equal(calculations,1);assert.deepEqual(nav.getItinerarySnapshot(),saved);
    const shift=pointer(20,40,{shiftKey:true});listeners.get("pointerdown")(shift);
    assert.deepEqual(nav.start,point(20,40));
    assert.deepEqual(nav.end,point(100,20));assert.equal(calculations,2);
    assert.equal(shift.stopped,1);
    const alt=pointer(120,50,{altKey:true});listeners.get("pointerdown")(alt);
    assert.deepEqual(nav.start,point(20,40));
    assert.deepEqual(nav.end,point(120,50));assert.equal(calculations,3);
    for(const modifiers of [{metaKey:true},{ctrlKey:true},{shiftKey:true,altKey:true}]){
      const blocked=pointer(80,80,modifiers);listeners.get("pointerdown")(blocked);
      assert.equal(blocked.prevented,0);
    }
    const copy=nav.getItinerarySnapshot();copy.legs[0].points[0].x=999;
    assert.equal(nav.getItinerarySnapshot().legs[0].points[0].x,20);
    const content=await nav._renderHTML();
    const newRoute=find(content,item=>item.tag==="button"&&item.ariaLabel==="New Route");
    assert.ok(newRoute,"New Route is always visible in the non-scrolling footer");
    const footer=content.children.at(-1);
    assert.equal(footer.children.includes(newRoute),true);
    assert.equal(newRoute.children[0].className,"fa-solid fa-route");
    assert.equal(newRoute.ariaLabel,"New Route","icon-only controls retain accessible labels");
    assert.equal(find(content,item=>item.tag==="button"&&
      item.ariaLabel==="Exit Navigation"),undefined,
      "the redundant Exit Navigation footer button is removed");
    assert.match(content.children[0].style.cssText,/overflow-y:auto/,
      "the route Directions scroll without hiding travel controls");
    const travelButton=find(content,item=>item.tag==="button"&&item.ariaLabel==="Travel Route");
    assert.equal(footer.children.includes(travelButton),true);
    assert.ok(find(content,item=>item.textContent?.startsWith?.("Token playback:")),
      "Navigation displays the estimated animation duration independently of travel time");
    nav.onSceneUpdated(scene,{flags:{unrelated:true}});
    assert.equal(calculations,3);assert.deepEqual(nav.end,point(120,50));
    nav.onSceneUpdated(scene,{flags:{"fvtt-atlas-navigation":{irrelevant:true}}});
    assert.equal(calculations,3);assert.deepEqual(nav.end,point(120,50));
    atlas.revision++;
    nav.onSceneUpdated(scene,{flags:{atlas:true}});
    assert.equal(nav.start,null);assert.equal(nav.end,null);
    assert.match(nav.notice,/road network changed/);
    listeners.get("pointerdown")(pointer(1,1));
    listeners.get("pointerdown")(pointer(2,2));
    assert.equal(calculations,4);
    nav.onRegionUpdated({parent:scene});
    assert.equal(nav.result,null);
    assert.match(nav.notice,/Terrain Regions changed/);
    listeners.get("pointerdown")(pointer(3,3));
    nav.onSceneUpdated(scene,{flags:{"fvtt-atlas-navigation":{routingRegionOrder:[]}}});
    assert.equal(nav.start,null);
    assert.match(nav.notice,/Terrain Region priority changed/);
    listeners.get("pointerdown")(pointer(4,4));
    nav.onSceneUpdated(scene,{grid:{size:100}});
    assert.equal(nav.start,null);
    assert.match(nav.notice,/Scene Grid/);
    newRoute.listeners.get("click")();
    assert.equal(nav.notice,"");
    listeners.get("pointerdown")(pointer(10,10));
    listeners.get("pointerdown")(pointer(40,10));
    nav.setTravelMethod("mounted");
    assert.equal(nav.travelMethod,"mounted");
    assert.equal(nav.result.status,"ok");
    const transportPanel=await nav._renderHTML();
    const methodSelect=find(transportPanel,item=>item.tag==="select"&&
      item.id==="atlas-navigation-travel-method");
    assert.equal(methodSelect.value,"hire|mounted");
    assert.equal(find(transportPanel,item=>item.tag==="option"&&
      item.value==="hire|rowboat"),undefined,
      "water offers must not appear for an all-land route");
    assert.ok(find(transportPanel,item=>item.tag==="optgroup"&&item.label==="Party"));
    assert.ok(find(transportPanel,item=>item.tag==="optgroup"&&item.label==="Starting Town"));
    const transportButton=find(transportPanel,item=>item.tag==="button"&&
      item.ariaLabel==="Travel Route");
    assert.equal(transportButton.disabled,true,
      "transport planning never silently starts native walking token movement");
    await assert.rejects(nav.startGuidedTravel(),/checkpoint transfers/);
    const methodAssessment=nav.assessTravelMethod;
    nav.assessTravelMethod=()=>({compatible:true,guided:false,reason:null});
    nav.setTravelMethod("carriage");
    assert.equal(nav.transportArrangement,"hire",
      "a carriage offered at the departure checkpoint defaults to hired service");
    const hired=await nav._renderHTML();
    assert.ok(find(hired,item=>item.textContent?.startsWith?.("World preset estimate:")));
    const pencil=find(hired,item=>item.tag==="button"&&
      item.title?.startsWith?.("Edit this journey's travel method"));
    assert.ok(pencil,"Journey uses the shared method editor pencil");
    assert.equal(find(hired,item=>item.textContent==="Arrangement"),undefined,
      "the method's dropdown group already selects owned versus hired");
    assert.equal(find(hired,item=>item.textContent==="Operating schedule"),undefined,
      "the operating schedule belongs in the method editor");
    assert.equal(find(hired,item=>item.textContent==="GM pricing for this journey only"),undefined,
      "the duplicate inline pricing form was removed");
    assert.equal(nav.transportJourneyOverrides,null);
    nav.transportJourneyOverrides={hireCostCp:500,hireBasis:"trip",
      hireApplies:"passenger"};
    const repriced=await nav._renderHTML();
    assert.ok(find(repriced,item=>item.textContent?.startsWith?.(
      "Current hired service estimate:")));
    const reset=find(repriced,item=>item.tag==="button"&&
      item.textContent==="Reset journey overrides");
    assert.ok(reset,"journey-only pricing can be reset");
    reset.listeners.get("click")();
    assert.equal(nav.transportJourneyOverrides,null);
    assert.equal(nav.transportQuoteAdjustmentCp,undefined);
    assert.equal(find(hired,item=>item.textContent==="Additional negotiated adjustment (CP)"),undefined);
    nav.assessTravelMethod=methodAssessment;
    nav.setTravelMethod("walking");
    assert.equal(nav.travelMethod,"walking");
    const walkingPanel=await nav._renderHTML();
    assert.equal(find(walkingPanel,item=>item.tag==="button"&&
      item.ariaLabel==="Travel Route").disabled,false);
    nav.stop();
    assert.equal(listeners.has("pointerdown"),false);
  }finally{Object.assign(globalThis,previous);}
});

test("party departure chooses B with one click, tracks live token center, and preserves map mode",async()=>{
  const previous={game:globalThis.game,window:globalThis.window,PIXI:globalThis.PIXI,
    ui:globalThis.ui,document:globalThis.document};
  try{
    globalThis.game={user:{isGM:true},system:{id:"test"},settings:{get:(_module,key)=>key==="guidedTransportationCatalog"?undefined:5}};
    globalThis.window={innerWidth:1200,innerHeight:850};
    globalThis.PIXI=undefined;
    const warnings=[];
    globalThis.ui={notifications:{error(message){throw Error(message);},warn(message){warnings.push(message);}}};
    globalThis.document={createElement:tag=>({tag,style:{},children:[],textContent:"",
      listeners:new Map(),append(...nodes){this.children.push(...nodes);},
      appendChild(node){this.children.push(node);},
      addEventListener(name,handler){this.listeners.set(name,handler);}})};
    const token={x:250,y:150,width:2,height:1,canUserModify:()=>true};
    const scene={id:"party-scene",name:"Paedor",grid:{size:50,units:"km"},
      getFlag:()=>null,tokens:{get:()=>token},canUserModify:()=>true};
    const target={addEventListener(){},removeEventListener(){}};
    const view={ready:true,scene,app:{canvas:target},
      canvasCoordinatesFromClient:({x,y})=>point(x,y),
      dimensions:{sceneRect:{contains:()=>true}}};
    const atlas={revision:9,roads:[{id:"road-a",name:"Road A"}]};
    const origins=[];
    const nav=new AtlasNavigationController({canvasProvider:()=>view,atlasProvider:()=>atlas,
      partyTokenProvider:()=>token,
      atlasPoint:(_view,_atlas,p)=>point(p.x-200,p.y-100),
      routeCalculator:(_view,_scene,_atlas,start,end)=>{
        origins.push({...start});
        const distance=Math.hypot(end.x-start.x,end.y-start.y);
        return {status:"ok",start:{...start},end:{...end},distance,cost:distance,terrainAware:false,
          legs:[{kind:"road",roadId:"road-a",segmentId:"s",points:[start,end],distance,cost:distance}]};
      }});
    nav.activate();
    assert.equal(nav.sourceMode,"party","assigned Atlas explorer is the default on open");
    assert.deepEqual(nav.start,point(100,75));
    const destination=pointer(500,300);nav.onPointerDown(destination);
    assert.deepEqual(nav.end,point(300,200));
    assert.deepEqual(origins,[point(100,75)]);
    assert.equal(destination.prevented,1);
    const miss=pointer(700,400,{shiftKey:true});nav.onPointerDown(miss);
    assert.equal(miss.prevented,0,"Shift must never overwrite token departure");
    token.x+=20;token.y+=10;
    nav.refreshPartyDeparture();
    assert.deepEqual(nav.start,point(120,85));
    assert.deepEqual(origins.at(-1),point(120,85));
    const panel=await nav._renderHTML();
    const find=(node,match)=>match(node)?node:node.children.map(child=>find(child,match)).find(Boolean);
    const selector=find(panel,node=>node.tag==="select"&&node.id==="atlas-navigation-departure");
    assert.equal(selector.value,"party");
    const footer=panel.children.at(-1);
    assert.equal(footer.children.some(node=>node.ariaLabel==="Travel Route"),true);
    const reset=find(panel,node=>node.tag==="button"&&node.ariaLabel==="New Route");
    reset.listeners.get("click")();
    assert.deepEqual(nav.start,point(120,85),"New Route keeps token departure in party mode");
    assert.equal(nav.end,null);
    nav.setSourceMode("map");
    assert.equal(nav.start,null,"map mode requires an intentional map Point A");
    nav.onPointerDown(pointer(450,210));
    assert.deepEqual(nav.start,point(250,110));
    nav.stop();
    assert.deepEqual(warnings,[]);
  }finally{Object.assign(globalThis,previous);}
});

test("a saved Journal offers deliberate recovery from the actual token without replaying movement",async()=>{
  const previous={game:globalThis.game,window:globalThis.window,PIXI:globalThis.PIXI,
    ui:globalThis.ui,document:globalThis.document};
  try{
    globalThis.window={innerWidth:1200,innerHeight:900};
    globalThis.PIXI=undefined;
    globalThis.ui={notifications:{warn(message){throw Error(message);}}};
    globalThis.document={createElement:tag=>({tag,style:{},children:[],textContent:"",
      listeners:new Map(),append(...nodes){this.children.push(...nodes);},
      appendChild(node){this.children.push(node);},
      addEventListener(name,handler){this.listeners.set(name,handler);}})};
    const token={id:"party-one",x:100,y:50,width:1,height:1,
      canUserModify:()=>true,move(){throw Error("Recovery must never move a token.");}};
    const scene={id:"saved-scene",name:"Paedor",grid:{size:50,units:"km"},
      canUserModify:()=>true,getFlag:()=>null,tokens:{get:()=>token}};
    const atlas={revision:11,roads:[{id:"road",name:"Trade Route"}]};
    const priorRoute={status:"ok",start:point(10,20),end:point(300,200),
      distance:15,cost:15,terrainAware:false,legs:[{
        kind:"road",roadId:"road",segmentId:"segment",
        points:[point(10,20),point(300,200)],distance:15,cost:15}]};
    const itinerary=createNavigationItinerary({sceneId:scene.id,sceneName:scene.name,
      sceneUnits:"km",atlasRevision:11,route:priorRoute,travel:{speed:5}});
    const record=checkpointJourneyRecord(createJourneyRecord({sceneId:scene.id,
      tokenId:token.id,atlasRevision:11,itinerary}),{
      schedule:{completedHours:1,todayHours:1,permittedExtraUntil:0,
        restEvents:0,lastForcedCheck:null,events:[]},
      progress:33,status:"interrupted"});
    const journal={id:"recover-1",getFlag:(scope,key)=>
      scope==="fvtt-atlas-navigation"&&key===JOURNEY_JOURNAL_FLAG?record:null};
    globalThis.game={user:{isGM:true},journal:{contents:[journal]},
      settings:{get:(_module,key)=>key==="guidedTransportationCatalog"?undefined:5},system:{id:"test"}};
    const target={addEventListener(){},removeEventListener(){}};
    const view={ready:true,scene,app:{canvas:target},
      canvasCoordinatesFromClient:({x,y})=>point(x,y)};
    const starts=[];
    const nav=new AtlasNavigationController({canvasProvider:()=>view,
      atlasProvider:()=>atlas,partyTokenProvider:()=>token,
      atlasPoint:(_view,_atlas,p)=>point(p.x,p.y),
      journeyJournalStore:{find:findRecoverableJourney,
        save:async()=>{throw Error("Recovery preview must not write a Journal.");}},
      routeCalculator:(_view,_scene,_atlas,start,end)=>{
        starts.push({...start});
        return {...priorRoute,start:{...start},end:{...end},
          legs:[{...priorRoute.legs[0],points:[{...start},{...end}]}]};
      }});
    nav.activate();
    const original=await nav._renderHTML();
    const find=(node,match)=>match(node)?node:
      node.children.map(item=>find(item,match)).find(Boolean);
    assert.ok(find(original,node=>node.textContent==="Recover Saved Journey"));
    assert.equal(nav.recoverSavedJourney(),true);
    assert.equal(nav.sourceMode,"party");
    assert.deepEqual(starts,[point(125,75)],
      "recovery uses the placed token, not the original Point A");
    assert.deepEqual(nav.end,point(300,200));
    assert.equal(nav.recoveryJournal,journal);
    assert.equal(nav.recoveryRecord.status,"interrupted");
    const prepared=await nav._renderHTML();
    assert.ok(find(prepared,node=>node.ariaLabel==="Open Journey Journal"));
    nav.clear();
    assert.equal(nav.recoveryRecord,null,"New Route abandons the loaded recovery");
    nav.findRecoverableJournal();
    record.pendingNativeMove={schemaVersion:1,operationId:"native-voyage-01",
      tokenId:token.id,checkpointIndex:3,
      from:point(100,50),to:point(125,75),nativeDistance:35,
      movingHours:.1,worldTimeBefore:420,worldAdvanceSeconds:0,
      atlasRevision:11};
    assert.throws(()=>nav.recoverSavedJourney(),/stopped during native checkpoint/,
      "an unconfirmed native movement cannot be silently credited on recovery");
    delete record.pendingNativeMove;
    atlas.revision=12;
    assert.throws(()=>nav.recoverSavedJourney(),/no longer matches/);
    nav.stop();
  }finally{Object.assign(globalThis,previous);}
});

test("canvas automatic restart refuses same-road drift beyond the confirmed anchor",()=>{
  const previous=globalThis.game;
  try{
    globalThis.game={user:{isGM:true}};
    const scene={id:"drift-scene",grid:{size:100,units:"mi"},
      canUserModify:()=>true};
    const atlas={revision:9,roads:[{id:"sea",name:"Sea Road"}],
      nodes:[{id:"a",x:0,y:0},{id:"b",x:200,y:0}],
      segments:[{id:"sea-segment",roadId:"sea",from:"a",to:"b",via:[]}],
      checkpoints:[]};
    const token={id:"party",x:70,y:-50,width:1,height:1,
      canUserModify:()=>true};
    const route={status:"ok",start:point(20,0),end:point(200,0),
      distance:50,cost:50,terrainAware:false,legs:[{
        kind:"road",roadId:"sea",segmentId:"sea-segment",
        points:[point(20,0),point(200,0)],distance:50,cost:50}]};
    const itinerary=createNavigationItinerary({sceneId:scene.id,route,
      travel:{speed:2}});
    const record=createJourneyRecord({sceneId:scene.id,tokenId:token.id,
      atlasRevision:9,itinerary,initialAnchor:{point:point(20,0),
        roadId:"sea",segmentId:"sea-segment",checkpointId:null,
        levelId:null,elevation:0}});
    record.status="interrupted";
    const journal={id:"saved",getFlag:()=>record};
    let calculated=0;
    const nav=new AtlasNavigationController({canvasProvider:()=>({ready:true,scene}),
      atlasProvider:()=>atlas,partyTokenProvider:()=>token,
      atlasPoint:(_view,_atlas,position)=>position,
      routeCalculator:()=>{calculated++;return route;}});
    nav.scene=scene;nav.recoverableJourney=journal;
    assert.throws(()=>nav.recoverSavedJourney({automatic:true}),
      /Automatic continuation is withheld/);
    assert.equal(calculated,0,"no new route or native token movement may start");
    assert.equal(nav.recoveryRecord,null,"an unchecked anchor is not promoted into recovery");
  }finally{globalThis.game=previous;}
});

test("an unconfirmed native ship checkpoint preserves transport and offers deliberate abandonment",async()=>{
  const previous={game:globalThis.game,window:globalThis.window,ui:globalThis.ui,
    document:globalThis.document};
  try{
    globalThis.game={user:{isGM:true},system:{id:"test"},
      settings:{get:()=>undefined}};
    globalThis.window={innerWidth:1200,innerHeight:900};
    globalThis.ui={notifications:{warn(){},error(){}}};
    globalThis.document={createElement:tag=>({tag,style:{},children:[],
      listeners:new Map(),textContent:"",append(...nodes){this.children.push(...nodes);},
      appendChild(node){this.children.push(node);},
      addEventListener(name,handler){this.listeners.set(name,handler);}})};
    const scene={id:"native-review-scene",name:"Paedor",
      grid:{size:100,units:"mi"},canUserModify:()=>true,getFlag:()=>null};
    const token={id:"review-party",x:14,y:0,width:1,height:1,
      canUserModify:()=>true,move(){throw Error("Unconfirmed movement may not replay");}};
    const route={status:"ok",start:point(0,0),end:point(100,0),
      distance:95.48,cost:95.48,terrainAware:false,
      legs:[{kind:"road",roadId:"harbor-road",segmentId:"harbor-segment",
        points:[point(0,0),point(100,0)],distance:95.48,cost:95.48}]};
    const itinerary=createNavigationItinerary({sceneId:scene.id,
      sceneName:scene.name,sceneUnits:"mi",route,travel:{speed:2}});
    const record=createJourneyRecord({sceneId:scene.id,tokenId:token.id,
      atlasRevision:1,itinerary:{...itinerary,transport:{
        methodId:"ship-passage",methodName:"Ship passage (hired)",
        arrangement:"hire",kind:"vessel",surface:"water",
        departureCheckpointName:"Port Barthos",arrivalCheckpointId:"dock",
        arrivalCheckpointName:"Hearth's Heart Dock",roadNames:["Sea Road"],
        estimatedFareCp:500,operation:"continuous"}}});
    record.status="interrupted";
    record.pendingNativeMove={schemaVersion:1,operationId:"native-ship-52",
      tokenId:token.id,checkpointIndex:0,from:point(0,0),to:point(10,0),
      nativeDistance:10,movingHours:.2,worldTimeBefore:420,
      worldAdvanceSeconds:0,atlasRevision:1};
    let opened=0;
    const journal={id:"saved-ship",getFlag:()=>structuredClone(record),
      sheet:{render(){opened++;}}};
    const nav=new AtlasNavigationController({
      canvasProvider:()=>({ready:true,scene}),
      atlasProvider:()=>({revision:1,roads:[],nodes:[],segments:[]}),
      partyTokenProvider:()=>token});
    nav.scene=scene;nav.sourceMode="party";
    nav.travelMethod="walking";nav.start=point(0,0);nav.end=point(100,0);
    nav.result=route;nav.recoverableJourney=journal;
    const panel=await nav._renderHTML();
    const find=(node,predicate)=>predicate(node)?node:
      node.children?.map(child=>find(child,predicate)).find(Boolean);
    const selector=find(panel,node=>node.id==="atlas-navigation-travel-method");
    assert.equal(selector.disabled,true);
    const labels=[];
    const collect=(node)=>{
      if(typeof node.textContent==="string")labels.push(node.textContent);
      node.children?.forEach(collect);
    };
    collect(panel);
    assert.ok(labels.some(label=>label.includes("Ship passage (hired)")),
      "the active saved method must remain visible despite Walking preview state");
    const recover=find(panel,node=>node.textContent==="Recover Saved Journey");
    assert.equal(recover.disabled,true);
    const newRoute=find(panel,node=>node.ariaLabel==="New Route");
    assert.equal(newRoute.disabled,false,"New Route must allow GM-confirmed abandonment");
    const forget=find(panel,node=>node.textContent==="Forget Saved Journey");
    assert.equal(forget.disabled,false);
    let attempts=0;
    nav.startNewRoute=async()=>{attempts++;return true;};
    newRoute.listeners.get("click")();
    await Promise.resolve();
    assert.equal(attempts,1,"New Route invokes the guarded abandonment workflow");
    const journalButton=find(panel,node=>node.ariaLabel==="Open Journey Journal");
    assert.ok(journalButton,"GM can inspect the preserved Journey Journal");
    journalButton.listeners.get("click")();
    assert.equal(opened,1);
    assert.equal(nav.travelMethod,"walking","rendering is a read-only projection");
    assert.equal(record.pendingNativeMove.operationId,"native-ship-52");
    assert.equal(find(panel,node=>node.textContent==="Travel Route"),undefined);
    assert.equal(find(panel,node=>node.textContent==="Speed:"),undefined);
    record.pendingNativeMove.operationId="";
    const invalid=await nav._renderHTML();
    assert.equal(find(invalid,node=>node.ariaLabel==="New Route").disabled,false);
    assert.equal(find(invalid,node=>node.textContent==="Recover Saved Journey").disabled,true);
  }finally{Object.assign(globalThis,previous);}
});

test("GM-confirmed New Route ends only the saved recovery and keeps native evidence",async()=>{
  const previous={foundry:globalThis.foundry,game:globalThis.game,
    document:globalThis.document};
  try{
    globalThis.document={createElement:tag=>({tag,textContent:""})};
    let prompts=0,saves=0,moves=0;
    globalThis.foundry={applications:{api:{DialogV2:{confirm:async()=>{
      prompts++;return true;
    }}}}};
    globalThis.game={user:{id:"gm",isGM:true},time:{worldTime:980}};
    const token={id:"party",x:200,y:120,width:1,height:1,
      move(){moves++;throw Error("No native replay may occur");}};
    const scene={id:"current",grid:{size:50,units:"mi"},
      canUserModify:()=>true};
    const route={status:"ok",start:point(10,20),end:point(800,200),
      distance:80,cost:80,legs:[{kind:"road",roadId:"sea",
        segmentId:"sea-segment",points:[point(10,20),point(800,200)],
        distance:80,cost:80}]};
    const itinerary=createNavigationItinerary({sceneId:scene.id,route,travel:{speed:2}});
    let record=createJourneyRecord({sceneId:scene.id,tokenId:token.id,
      atlasRevision:2,itinerary});
    record.status="interrupted";
    record.legs[0].completedPercent=20;
    record.legs[0].completedMovingHours=8;
    record.pendingNativeMove={schemaVersion:1,operationId:"native-77",
      tokenId:token.id,checkpointIndex:1,from:point(40,40),to:point(100,90),
      nativeDistance:60,movingHours:2,worldTimeBefore:950,
      worldAdvanceSeconds:0,atlasRevision:2};
    const original=structuredClone(record);
    const journal={id:"old-voyage",getFlag:()=>structuredClone(record)};
    const nav=new AtlasNavigationController({
      canvasProvider:()=>({ready:true,scene}),
      atlasProvider:()=>({revision:2}),partyTokenProvider:()=>token,
      journeyJournalStore:{save:async next=>{saves++;record=structuredClone(next);
        return journal;},find:()=>null}});
    nav.scene=scene;nav.sourceMode="party";
    nav.recoverableJourney=journal;
    nav.travelMethod="ship-passage";nav.transportArrangement="hire";
    nav.transportOperation="continuous";
    nav.start=point(10,20);nav.end=point(800,200);nav.result=route;
    nav.draw=()=>{};nav.render=async()=>{};
    nav.syncPartyDeparture=()=>{nav.start=point(token.x+25,token.y+25);return true;};
    nav.autoResumePending={journalId:journal.id};
    nav.autoResumeAttempts.set(journal.id,1);
    assert.equal(await nav.startNewRoute(),true);
    assert.equal(prompts,1);assert.equal(saves,1);
    assert.equal(record.status,"ended");
    assert.equal(record.pendingNativeMove.operationId,"native-77",
      "do not erase unconfirmed native checkpoint evidence");
    assert.deepEqual(record.legs,original.legs,"confirmed progress and hours stay untouched");
    assert.equal(moves,0);assert.equal(globalThis.game.time.worldTime,980);
    assert.equal(nav.recoverableJourney,null);
    assert.deepEqual(nav.start,point(225,145),"new Point A reads the physical token");
    assert.equal(nav.end,null);assert.equal(nav.result,null);
    assert.equal(nav.travelMethod,"walking");
    assert.equal(nav.transportArrangement,"owned");
    assert.equal(nav.autoResumePending,null);
    assert.equal(nav.autoResumeAttempts.has(journal.id),false);
    assert.match(nav.notice,/Saved Journey ended/);
    assert.equal(findRecoverableJourney([journal],{sceneId:scene.id,
      tokenId:token.id,atlasRevision:2}),null,
      "an Ended historical Journal must never relock a later Navigation session");
    // The same operation also applies after Recover has loaded an approved leg.
    record=structuredClone(original);
    nav.recoverableJourney=null;nav.recoveryJournal=journal;
    nav.recoveryRecord=structuredClone(record);
    nav.end=point(800,200);
    assert.equal(await nav.forgetSavedJourney(),true);
    assert.equal(prompts,2);assert.equal(saves,2);
    assert.equal(record.status,"ended");
    assert.equal(nav.recoveryJournal,null);
  }finally{Object.assign(globalThis,previous);}
});

test("forgetting a saved Journey fails closed on cancellation, save error and stale state",async()=>{
  const previous={foundry:globalThis.foundry,game:globalThis.game,
    document:globalThis.document};
  try{
    globalThis.document={createElement:tag=>({tag,textContent:""})};
    globalThis.game={user:{id:"gm",isGM:true}};
    const scene={id:"scene",canUserModify:()=>true};
    const token={id:"party"};
    const itinerary=createNavigationItinerary({sceneId:scene.id,
      route:{status:"ok",start:point(0,0),end:point(20,0),distance:5,cost:5,
        legs:[{kind:"road",roadId:"road",segmentId:"segment",
          points:[point(0,0),point(20,0)],distance:5,cost:5}]},
      travel:{speed:2}});
    let record=createJourneyRecord({sceneId:scene.id,tokenId:token.id,
      atlasRevision:1,itinerary});
    record.status="interrupted";
    const journal={id:"stored",getFlag:()=>structuredClone(record)};
    let attempts=0;
    const nav=new AtlasNavigationController({partyTokenProvider:()=>token,
      journeyJournalStore:{save:async()=>{attempts++;throw Error("Journal read-only");}}});
    nav.scene=scene;nav.recoverableJourney=journal;
    nav.start=point(0,0);nav.end=point(20,0);
    globalThis.foundry={applications:{api:{DialogV2:{confirm:async()=>false}}}};
    assert.equal(await nav.startNewRoute(),false);
    assert.equal(attempts,0);assert.deepEqual(nav.end,point(20,0));
    assert.equal(nav.recoverableJourney,journal);
    globalThis.foundry.applications.api.DialogV2.confirm=async()=>true;
    await assert.rejects(nav.forgetSavedJourney(),/Journal read-only/);
    assert.equal(attempts,1);assert.equal(record.status,"interrupted");
    assert.equal(nav.journalStarting,false);
    assert.equal(nav.recoverableJourney,journal);
    globalThis.foundry.applications.api.DialogV2.confirm=async()=>{
      record.updatedAt="2026-12-01T00:00:00Z";return true;
    };
    await assert.rejects(nav.forgetSavedJourney(),/changed during confirmation/);
    assert.equal(attempts,1);
    globalThis.game.user.isGM=false;
    await assert.rejects(nav.forgetSavedJourney(),/Only a GM/);
    assert.equal(attempts,1);
  }finally{Object.assign(globalThis,previous);}
});

test("an interrupted Riding Horse journey never renders or resumes as Walking",async()=>{
  const previous={game:globalThis.game,window:globalThis.window,ui:globalThis.ui,
    document:globalThis.document};
  try{
    globalThis.game={user:{isGM:true},system:{id:"dnd5e"},
      settings:{get:()=>undefined}};
    globalThis.window={innerWidth:1200,innerHeight:900};
    globalThis.ui={notifications:{warn(){},error(){}}};
    globalThis.document={createElement:tag=>({tag,style:{},children:[],
      listeners:new Map(),textContent:"",append(...nodes){this.children.push(...nodes);},
      appendChild(node){this.children.push(node);},
      addEventListener(name,handler){this.listeners.set(name,handler);}})};
    const scene={id:"horse-scene",name:"Paedor",grid:{size:100,units:"mi"},
      canUserModify:()=>true,getFlag:()=>null};
    const token={id:"horse-party",x:0,y:0,width:1,height:1,
      canUserModify:()=>true,move(){throw Error("No movement is authorized");}};
    const atlas={revision:7,roads:[],nodes:[],segments:[]};
    const route={status:"ok",start:point(0,0),end:point(100,0),
      distance:10,cost:10,terrainAware:false,legs:[{kind:"road",roadId:"road",
        segmentId:"s",points:[point(0,0),point(100,0)],distance:10,cost:10}]};
    const itinerary=createNavigationItinerary({sceneId:scene.id,route,
      travel:{speed:5}});
    const record=createJourneyRecord({sceneId:scene.id,tokenId:token.id,
      atlasRevision:7,itinerary:{...itinerary,travel:{...itinerary.travel,
        methodId:"riding-horse",methodName:"Riding Horse",
        arrangement:"owned",operation:"normal"}}});
    record.status="interrupted";record.legs[0].completedPercent=56;
    const nav=new AtlasNavigationController({canvasProvider:()=>({ready:true,scene}),
      atlasProvider:()=>atlas,partyTokenProvider:()=>token});
    nav.scene=scene;nav.sourceMode="party";nav.travelMethod="riding-horse";
    nav.transportArrangement="owned";nav.recoveryRecord=record;
    nav.routeRevision=atlas.revision;nav.result=route;
    assert.equal(nav.transportAvailability().owned.has("riding-horse"),false,
      "a recovered approval must not invent Group ownership");
    assert.ok(nav.transportAvailability().methods.some(method=>method.id==="riding-horse"),
      "the saved method must remain visible during recovery");
    const panel=await nav._renderHTML();
    const find=(item,predicate)=>predicate(item)?item:
      item.children?.map(child=>find(child,predicate)).find(Boolean);
    const selector=find(panel,node=>node.id==="atlas-navigation-travel-method");
    assert.equal(selector.value,"owned|riding-horse");
    assert.equal(nav.travelMethod,"riding-horse",
      "rendering may not silently downgrade the approved Journey to Walking");
    nav.syncPartyDeparture=()=>false;
    nav.travelMethod="walking";
    await assert.rejects(nav.startGuidedTravel(),/cannot silently resume/,
      "even a stale UI choice cannot resume an approved horse journey on foot");
  }finally{Object.assign(globalThis,previous);}
});

test("a blocked hired ship recovery keeps the approved method and explains why it cannot play",async()=>{
  const previous={game:globalThis.game,ui:globalThis.ui,document:globalThis.document};
  try{
    globalThis.game={user:{isGM:true},system:{id:"dnd5e"},
      settings:{get:()=>undefined}};
    globalThis.ui={notifications:{warn(){},error(){}}};
    globalThis.document={createElement:tag=>({tag,style:{},children:[],
      textContent:"",listeners:new Map(),append(...nodes){this.children.push(...nodes);},
      appendChild(node){this.children.push(node);},
      addEventListener(name,handler){this.listeners.set(name,handler);},
      setAttribute(){}})};
    const scene={id:"ship-scene",name:"Paedor",grid:{size:49,distance:7.5,units:"km"},
      canUserModify:()=>true,getFlag:()=>null};
    const atlas={revision:8,roads:[{id:"water",name:"Sea Route",travelPresetId:"water-sea"}],
      nodes:[],segments:[],checkpoints:[]};
    const route={status:"ok",start:point(0,0),end:point(100,0),distance:10,
      cost:10,terrainAware:false,legs:[{kind:"road",roadId:"water",segmentId:"s",
        points:[point(0,0),point(100,0)],distance:10,cost:10}]};
    const itinerary={...createNavigationItinerary({sceneId:scene.id,route,
      travel:{speed:2},roadName:()=>"Sea Route"}),transport:{
      methodId:"ship-passage",methodName:"Ship passage (hired)",kind:"vehicle",
      arrangement:"hire",surface:"water",arrivalCheckpointId:"port",
      arrivalCheckpointName:"Port Barthos",roadNames:["Sea Route"],
      departureCheckpointName:"Hearth's Heart Dock",estimatedFareCp:50,
      operation:"continuous"}};
    const record=createJourneyRecord({sceneId:scene.id,tokenId:"party",atlasRevision:8,
      itinerary});
    record.status="interrupted";record.legs[0].completedPercent=86;
    const nav=new AtlasNavigationController({atlasProvider:()=>atlas});
    nav.scene=scene;nav.sourceMode="party";nav.start=route.start;nav.end=route.end;
    nav.result=route;nav.routeRevision=atlas.revision;
    nav.travelMethod="ship-passage";nav.transportArrangement="hire";
    nav.recoveryRecord=record;
    nav.transportationTransitionPlan=()=>{throw Error("projected leg count changed");};
    const panel=await nav._renderHTML();
    const all=node=>[node,...(node.children??[]).flatMap(all)];
    const nodes=all(panel);
    const selector=nodes.find(node=>node.id==="atlas-navigation-travel-method");
    assert.equal(selector.value,"hire|ship-passage");
    assert.equal(selector.disabled,true);
    assert.equal(nav.travelMethod,"ship-passage");
    assert.equal(nav.transportArrangement,"hire",
      "rendering cannot downgrade a paid hire to party-owned transportation");
    assert.ok(nodes.some(node=>node.textContent?.includes?.(
      "Approved Journey cannot continue yet: projected leg count changed")));
    const play=nodes.find(node=>node.ariaLabel==="Travel Route");
    assert.equal(play?.disabled,true,
      "an unresolved approved route must remain blocked rather than start Walking");
  }finally{Object.assign(globalThis,previous);}
});

test("active ship Journey displays the approved method and saved sailing hours, not Walking",async()=>{
  const previous={game:globalThis.game,window:globalThis.window,
    ui:globalThis.ui,document:globalThis.document};
  try{
    globalThis.game={user:{isGM:true},system:{id:"dnd5e"},
      settings:{get:()=>undefined}};
    globalThis.window={innerWidth:1200,innerHeight:900};
    globalThis.ui={notifications:{warn(){},error(){}}};
    globalThis.document={createElement:tag=>({tag,style:{},children:[],
      listeners:new Map(),textContent:"",append(...nodes){this.children.push(...nodes);},
      appendChild(node){this.children.push(node);},
      addEventListener(name,handler){this.listeners.set(name,handler);},
      setAttribute(){}})};
    const scene={id:"sea-scene",name:"Paedor",grid:{size:100,units:"mi"},
      canUserModify:()=>true,getFlag:()=>null};
    const atlas={revision:4,roads:[{id:"sea",name:"Sea Lane"}],
      nodes:[],segments:[],checkpoints:[]};
    const route={status:"ok",start:point(0,0),end:point(500,0),
      distance:95.48,cost:95.48,terrainAware:false,legs:[{
        kind:"road",roadId:"sea",segmentId:"ocean",distance:95.48,cost:95.48,
        points:[point(0,0),point(500,0)]}]};
    const nav=new AtlasNavigationController({
      canvasProvider:()=>({ready:true,scene}),atlasProvider:()=>atlas});
    nav.scene=scene;nav.sourceMode="party";nav.result=route;
    nav.start=route.start;nav.end=route.end;nav.routeRevision=atlas.revision;
    nav.travelMethod="walking"; // stale UI state must not replace Journal approval
    nav.transportationTransitionPlan=()=>({hasTransitions:false,legs:[]});
    nav.resolveTravel=()=>({sceneUnit:"mi",travel:{speed:3,source:"party",
      actorName:"The Party",pace:"normal"}});
    const schedule=new GuidedTravelDayTracker({travelHours:47+44/60,
      rules:{dailyHours:24,overnightHours:0,longRestHours:8,
        shortRestHours:1,forcedMarch:"custom"}});
    const approved={methodId:"ship-passage",methodName:"Ship passage (hired)",
      kind:"vehicle",arrangement:"hire",surface:"water",operation:"continuous"};
    nav.travelSession={phase:"moving",transportLeg:{transport:approved},
      schedule,journeyRecord:{legs:[{speedPerHour:2,movingHours:47+44/60,
        transport:approved}]}};
    const panel=await nav._renderHTML();
    const all=node=>[node,...(node.children??[]).flatMap(all)];
    const nodes=all(panel);
    const method=nodes.find(node=>node.id==="atlas-navigation-travel-method");
    assert.ok(method);
    assert.equal(method.disabled,true,"approved transportation is read-only mid-voyage");
    assert.equal(method.value,"approved");
    assert.ok(nodes.some(node=>node.tag==="option"&&
      node.textContent==="Ship passage (hired)"));
    assert.ok(nodes.some(node=>node.textContent?.includes?.(
      "Speed: Ship passage (hired) (approved hire Journey leg)")));
    const card=nodes.find(node=>node.tag==="div"&&
      node.children?.[0]?.textContent==="Travel Time");
    assert.ok(card);
    assert.match(card.children[1].textContent,/47h 44m|1d 23h 44m/);
    assert.equal(nav.travelMethod,"walking",
      "presenting a saved method must not write transient selection or Journey state");
    // A schema-one mounted leg can have approved travelMethod metadata without
    // the richer checkpoint transport shape; its saved method also wins.
    nav.travelSession.transportLeg=null;
    nav.travelSession.journeyRecord.legs[0].transport=undefined;
    nav.travelSession.journeyRecord.legs[0].travelMethod={
      id:"riding-horse",name:"Riding Horse",arrangement:"owned",operation:"normal"};
    const mounted=await nav._renderHTML();
    assert.ok(all(mounted).some(node=>node.textContent?.includes?.(
      "Speed: Riding Horse (approved owned Journey leg)")));
  }finally{Object.assign(globalThis,previous);}
});

test("GM guided travel pauses and ends at native chunk boundaries with honest progress",async()=>{
  const previous={game:globalThis.game,window:globalThis.window,PIXI:globalThis.PIXI,
    ui:globalThis.ui,document:globalThis.document};
  let nav;
  try{
    globalThis.game={user:{isGM:true},settings:{get:(_module,key)=>
      key==="guidedTransportationCatalog"?undefined:
      key==="guidedTravelSecondsPerHour"?2:5}};
    globalThis.window={innerWidth:1200,innerHeight:800};
    globalThis.PIXI=undefined;
    globalThis.ui={notifications:{error(message){throw Error(message);}}};
    globalThis.document={createElement:tag=>({tag,style:{},children:[],textContent:"",
      listeners:new Map(),append(...nodes){this.children.push(...nodes);},
      appendChild(node){this.children.push(node);},
      addEventListener(name,handler){this.listeners.set(name,handler);}})};
    const calls=[];
    let resolveTravel,autoResolve=false;
    const token={id:"token-guided",x:50,y:50,width:1,height:1,canUserModify:()=>true,
      move(waypoints,options){
        calls.push({waypoints,options});
        const target=waypoints.at(-1);
        const complete=value=>{
          if(value){this.x=target.x;this.y=target.y;}
          return value;
        };
        return autoResolve?Promise.resolve(complete(true)):new Promise(resolve=>{
          resolveTravel=value=>resolve(complete(value));
        });
      },
      pauseMovement(){throw Error("Native pause should not be called after Document completion.");},
      stopMovement(){throw Error("Native stop should not be required for Atlas control.");}
    };
    const scene={id:"scene-guided",name:"Paedor",grid:{size:100,units:"km"},
      canUserModify:()=>true,getFlag:()=>null};
    const view={ready:true,scene};
    const atlas={revision:7,nodes:[{id:"a",...point(100,100)},{id:"b",...point(300,200)}],
      segments:[{id:"segment-a",roadId:"road-a",from:"a",to:"b",via:[]}],
      roads:[{id:"road-a",name:"Road A"}]};
    nav=new AtlasNavigationController({canvasProvider:()=>view,
      atlasProvider:()=>atlas,partyTokenProvider:()=>token,
      journeyJournalStore:journalStore});
    nav.scene=scene;nav.routeRevision=7;
    nav.start=point(100,100);nav.end=point(300,200);
    nav.result={status:"ok",start:nav.start,end:nav.end,
      distance:20,cost:20,terrainAware:false,
      legs:[{kind:"road",roadId:"road-a",segmentId:"segment-a",
        points:[point(100,100),point(200,150),point(300,200)],distance:20,cost:20}]};
    nav.itinerary=createNavigationItinerary({sceneId:scene.id,sceneName:scene.name,
      sceneUnits:scene.grid.units,atlasRevision:atlas.revision,route:nav.result,
      travel:{speed:5}});
    const pending=nav.startGuidedTravel();
    assert.equal(calls.length,0,"render the Pause button before native movement begins");
    await tickUntil(()=>calls.length===1);
    assert.equal(calls.length,1);
    assert.deepEqual(calls[0].waypoints[0],point(50,50));
    assert.notDeepEqual(calls[0].waypoints.at(-1),point(250,150),
      "long journeys are divided into short native chunks");
    assert.equal(calls[0].options.animate,true);
    assert.equal(calls[0].options.showRuler,false);
    assert.ok(calls[0].options.animation.movementSpeed>0);
    assert.equal(calls[0].options.constrainOptions,undefined,
      "Foundry native movement constraints are not bypassed");
    const find=(item,match)=>match(item)?item:item.children.map(child=>find(child,match)).find(Boolean);
    const movingPanel=await nav._renderHTML();
    assert.ok(find(movingPanel,node=>node.tag==="button"&&node.ariaLabel==="Pause Travel"));
    assert.ok(find(movingPanel,node=>node.tag==="button"&&node.ariaLabel==="End Journey"));
    const bar=find(movingPanel,node=>node.tag==="progress");
    assert.equal(bar.value,0);
    assert.equal(bar.max,100);
    assert.equal(nav.pauseGuidedTravel(),true);
    assert.equal(nav.travelSession.phase,"pausing");
    const pausingPanel=await nav._renderHTML();
    assert.ok(find(pausingPanel,node=>node.tag==="button"&&
      node.ariaLabel==="Pausing…"&&node.disabled===true),
      "the icon-only Pause action exposes its busy state without accepting a second pause");
    resolveTravel(true);
    await tickUntil(()=>nav.travelSession?.phase==="paused");
    assert.equal(nav.travelSession.phase,"paused");
    assert.equal(calls.length,1,"pausing prevents the next chunk from starting");
    assert.ok(Math.abs(nav.travelSession.lastConfirmedAnchor.point.x-(token.x+50))<.001);
    assert.ok(Math.abs(nav.travelSession.lastConfirmedAnchor.point.y-(token.y+50))<.001);
    assert.ok(nav.travelSession.lastConfirmedAnchor.point.x>100,
      "the confirmed native chunk advances the cached recovery anchor");
    assert.ok(nav.travelProgress>0&&nav.travelProgress<100);
    const pausedPanel=await nav._renderHTML();
    assert.ok(find(pausedPanel,node=>node.tag==="button"&&node.ariaLabel==="Resume Travel"));
    for(const label of ["Short Rest (","Long Rest (","Overnight Camp ("])
      assert.ok(find(pausedPanel,node=>node.tag==="button"&&
        node.ariaLabel?.startsWith(label)),
      "all optional rest actions appear at a manual pause: "+label);
    nav.travelSession.phase="rest-applying";
    const savingPanel=await nav._renderHTML();
    assert.ok(find(savingPanel,node=>node.tag==="button"&&
      node.ariaLabel==="Recording Break…"&&node.disabled),
    "movement is locked during a World-time and Journal rest checkpoint");
    assert.ok(find(savingPanel,node=>node.tag==="button"&&
      node.ariaLabel==="End Journey"&&node.disabled),
    "ending is locked until a rest checkpoint is durable");
    nav.travelSession.phase="paused";
    assert.equal(nav.resumeGuidedTravel(),true);
    await tickUntil(()=>calls.length===2);
    assert.equal(calls.length,2,"resume begins at the last completed stretch");
    assert.equal(nav.stopGuidedTravel(),true);
    assert.equal(nav.travelSession.phase,"ending");
    resolveTravel(true);
    assert.equal(await pending,false);
    assert.equal(nav.travelSession,null);
    assert.match(nav.travelNotice,/Journey ended/);
    assert.ok(nav.travelProgress>0&&nav.travelProgress<100);
    assert.equal(nav.completedRoute,false,"ending early must not lock future travel");

    // A complete journey progresses through its chunks and reaches 100%.
    autoResolve=true;
    token.x=50;token.y=50;
    const again=nav.startGuidedTravel();
    assert.equal(await again,true);
    assert.equal(nav.travelProgress,100);
    assert.match(nav.travelNotice,/Arrived/);
    assert.equal(nav.completedRoute,true,"only a confirmed completed Journey locks its preview");
    const completedPanel=await nav._renderHTML();
    assert.equal(find(completedPanel,node=>node.tag==="button"&&
      node.ariaLabel==="Travel Route"),undefined);
    assert.ok(find(completedPanel,node=>node.tag==="button"&&
      node.ariaLabel==="New Route"));
    await assert.rejects(nav.startGuidedTravel(),/Journey is completed/,
      "stale UI actions cannot restart a completed Journey");

    // An explicit recalculation represents a fresh GM-selected route.
    const previousRoute=nav.result;
    nav.routeCalculator=()=>previousRoute;
    nav.calculateRoute(view,atlas);
    assert.equal(nav.completedRoute,false);
    assert.equal(nav.travelProgress,0);

    // Native Document movement may finish while the Canvas animation remains active.
    // The in-progress lock and Pause/End controls must persist until it ends.
    let endVisibleAnimation;
    token.x=50;token.y=50;
    token.object={movementAnimationPromise:new Promise(resolve=>{endVisibleAnimation=resolve;})};
    const before=calls.length;
    const third=nav.startGuidedTravel();
    await tickUntil(()=>calls.length===before+1);
    assert.equal(calls.length,before+1);
    await assert.rejects(nav.startGuidedTravel(),/already in progress/);
    const stillMoving=await nav._renderHTML();
    assert.ok(find(stillMoving,node=>node.tag==="button"&&node.ariaLabel==="Pause Travel"));
    assert.equal(find(stillMoving,node=>node.tag==="button"&&node.ariaLabel==="Travel Route"),undefined);
    assert.equal(nav.pauseGuidedTravel(),true,"pause requests remain possible after native Document completion");
    assert.equal(nav.stopGuidedTravel(),true,"End Journey works while only Canvas animation remains");
    endVisibleAnimation();
    assert.equal(await third,false);
    assert.equal(calls.length,before+1,"ending during Canvas animation prevents subsequent native chunks");
    assert.equal(nav.travelSession,null);
    assert.ok(nav.travelProgress<100);

    // End Journey must also wake a travel loop waiting on the paused state.
    token.object={movementAnimationPromise:null};
    token.x=50;token.y=50;
    autoResolve=false;
    const previousCount=calls.length;
    const pausedJourney=nav.startGuidedTravel();
    await tickUntil(()=>calls.length===previousCount+1);
    assert.equal(calls.length,previousCount+1);
    nav.pauseGuidedTravel();
    resolveTravel(true);
    await tickUntil(()=>nav.travelSession?.phase==="paused");
    assert.equal(nav.travelSession.phase,"paused");
    assert.equal(nav.stopGuidedTravel(),true);
    assert.equal(await pausedJourney,false);
    assert.equal(calls.length,previousCount+1,"no chunk may start after End Journey wakes a pause");
    nav.stop();
  }finally{nav?.stop();Object.assign(globalThis,previous);}
});

test("guided travel rejects missing GM permission and a stale route before native movement",async()=>{
  const previous={game:globalThis.game,PIXI:globalThis.PIXI};
  try{
    globalThis.game={user:{isGM:false}};
    globalThis.PIXI=undefined;
    const scene={id:"scene-guided",grid:{size:100},canUserModify:()=>true};
    const view={ready:true,scene};
    const token={x:0,y:0,width:1,height:1,canUserModify:()=>true,
      move(){throw Error("This must not be called.");},stopMovement:()=>true};
    const atlas={revision:2,nodes:[],segments:[],roads:[]};
    const nav=new AtlasNavigationController({canvasProvider:()=>view,atlasProvider:()=>atlas,
      partyTokenProvider:()=>token});
    nav.scene=scene;nav.routeRevision=1;
    nav.result={status:"ok",legs:[{kind:"road",roadId:"road-a",segmentId:"segment-a"}]};
    await assert.rejects(nav.startGuidedTravel(),/A GM must/);
    globalThis.game.user.isGM=true;
    await assert.rejects(nav.startGuidedTravel(),/road network changed/);
  }finally{Object.assign(globalThis,previous);}
});

test("World setting alone advances Foundry time only for confirmed active-GM journey chunks",async()=>{
  const previous={game:globalThis.game,window:globalThis.window,PIXI:globalThis.PIXI,
    ui:globalThis.ui,document:globalThis.document};
  let nav;
  try{
    const seconds=[];
    let failClock=false,moveCount=0,worldEnabled=true;
    globalThis.game={user:{id:"gm-1",isGM:true},users:{activeGM:{id:"gm-1"}},
      settings:{get:(_module,key)=>key==="guidedTransportationCatalog"?undefined:
        key==="guidedTravelAdvanceWorldTime"?worldEnabled:
        key==="guidedTravelSecondsPerHour"?2:5},
      time:{advance:async amount=>{
        if(failClock)throw Error("Clock is unavailable");
        seconds.push(amount);return seconds.reduce((a,b)=>a+b,0);
      }}};
    globalThis.window={innerWidth:1200,innerHeight:800};
    globalThis.PIXI=undefined;
    globalThis.ui={notifications:{error(message){throw Error(message);}}};
    globalThis.document={createElement:tag=>({tag,style:{},children:[],textContent:"",
      listeners:new Map(),append(...nodes){this.children.push(...nodes);},
      appendChild(node){this.children.push(node);},
      addEventListener(name,handler){this.listeners.set(name,handler);}})};
    let autoResolve=true,completeMovement,misplaceNext=false,failMovement=false;
    const token={id:"token-clock",x:50,y:50,width:1,height:1,canUserModify:()=>true,
      move(waypoints){
        moveCount++;
        if(failMovement)throw Error("Native animation failed");
        const goal=waypoints.at(-1);
        const finish=value=>{
          if(value&&!misplaceNext){this.x=goal.x;this.y=goal.y;}
          return value;
        };
        return autoResolve?Promise.resolve(finish(true)):
          new Promise(resolve=>{completeMovement=value=>resolve(finish(value));});
      }};
    const scene={id:"clock-scene",name:"Paedor",grid:{size:100,units:"km"},
      canUserModify:()=>true,getFlag:()=>null};
    const view={ready:true,scene};
    const atlas={revision:9,nodes:[{id:"a",...point(100,100)},{id:"b",...point(300,200)}],
      segments:[{id:"segment-a",roadId:"road-a",from:"a",to:"b",via:[]}],
      roads:[{id:"road-a",name:"Road A"}]};
    nav=new AtlasNavigationController({canvasProvider:()=>view,
      atlasProvider:()=>atlas,partyTokenProvider:()=>token,
      journeyJournalStore:journalStore});
    nav.scene=scene;nav.routeRevision=9;
    nav.start=point(100,100);nav.end=point(300,200);
    nav.result={status:"ok",start:nav.start,end:nav.end,
      distance:20,cost:20,terrainAware:false,
      legs:[{kind:"road",roadId:"road-a",segmentId:"segment-a",
        points:[point(100,100),point(200,150),point(300,200)],distance:20,cost:20}]};
    nav.itinerary=createNavigationItinerary({sceneId:scene.id,sceneName:scene.name,
      sceneUnits:scene.grid.units,atlasRevision:atlas.revision,route:nav.result,
      travel:{speed:5}});

    // Each later call in this test represents a fresh, explicitly planned
    // Journey. A completed route may no longer be replayed as-is.
    const newRoute=()=>{
      const preview=nav.result;
      nav.routeCalculator=()=>preview;
      nav.calculateRoute(view,atlas);
    };

    const find=(node,match)=>match(node)?node:
      node.children.map(child=>find(child,match)).find(Boolean);
    const prepared=await nav._renderHTML();
    const optIn=find(prepared,node=>node.tag==="input"&&node.type==="checkbox");
    assert.equal(optIn,undefined,"Navigation has no per-journey clock checkbox");
    assert.ok(find(prepared,node=>node.textContent?.startsWith?.(
      "Foundry World time advances for confirmed movement")));
    assert.equal(await nav.startGuidedTravel(),true);
    assert.equal(seconds.reduce((a,b)=>a+b,0),14400,
      "four real travel hours advance exactly four World hours, not displayed days");
    assert.equal(nav.worldTimeAdvancedSeconds,14400);
    assert.equal(nav.travelProgress,100);

    token.x=50;token.y=50;
    const count=seconds.length;
    worldEnabled=false;
    newRoute();
    assert.equal(await nav.startGuidedTravel(),true);
    assert.equal(seconds.length,count,"disabled World setting prevents time writes");

    token.x=50;token.y=50;
    worldEnabled=true;
    game.users.activeGM={id:"another-gm"};
    newRoute();
    await assert.rejects(nav.startGuidedTravel(),/active GM/);
    assert.equal(seconds.length,count);
    game.users.activeGM={id:"gm-1"};

    // If the GM interrupts after one completed chunk, only that part is paid.
    autoResolve=false;
    newRoute();
    const interrupted=nav.startGuidedTravel();
    for(let i=0;i<5;i++)await Promise.resolve();
    nav.pauseGuidedTravel();
    completeMovement(true);
    await tickUntil(()=>nav.travelSession?.phase==="paused");
    assert.equal(nav.travelSession.phase,"paused");
    const beforeEnd=seconds.reduce((a,b)=>a+b,0);
    assert.ok(beforeEnd>14400&&beforeEnd<28800,
      "only the completed stretch advances time during a pause");
    nav.stopGuidedTravel();
    assert.equal(await interrupted,false);
    assert.equal(seconds.reduce((a,b)=>a+b,0),beforeEnd,
      "ending a paused journey does not advance untraveled hours");

    // A rejected Foundry clock update stops subsequent native moves without
    // pretending that the failed delta was applied or restarting the route.
    token.x=50;token.y=50;
    autoResolve=true;
    failClock=true;
    const previousMoves=moveCount;
    newRoute();
    assert.equal(await nav.startGuidedTravel(),false);
    assert.equal(moveCount,previousMoves+1,"time failure prevents further movement chunks");
    assert.equal(nav.worldTimeAdvancedSeconds,0);
    assert.match(nav.travelNotice,/World time could not advance: Clock is unavailable/);

    // Unexpected errors inside an active movement should be visible in the
    // Navigation window rather than silently dropping the in-flight session.
    failClock=false;failMovement=true;
    token.x=50;token.y=50;
    newRoute();
    await assert.rejects(nav.startGuidedTravel(),/Native animation failed/);
    assert.match(nav.travelNotice,/Journey interrupted: Native animation failed/);
    assert.equal(nav.travelSession,null);

    // A native operation reporting true but ending off the route is not
    // confirmed travel: neither progress nor World time may be credited.
    failClock=false;failMovement=false;
    misplaceNext=true;
    token.x=50;token.y=50;
    const beforeMismatch=seconds.reduce((a,b)=>a+b,0);
    newRoute();
    assert.equal(await nav.startGuidedTravel(),false);
    assert.equal(nav.worldTimeAdvancedSeconds,0);
    assert.equal(nav.travelProgress,0);
    assert.match(nav.travelNotice,/left the planned road path/);
    assert.equal(seconds.reduce((a,b)=>a+b,0),beforeMismatch);

    // Eight-hour travel-day estimates must never be mistaken for 24-hour
    // calendar days when the World clock advances only active movement time.
    nav.resolveTravel=()=>({sceneUnit:"km",travel:{speed:6.38,hoursPerDay:8,
      source:"party",actorName:"The Party",pace:"fast"}});
    game.system={id:"dnd5e"};
    nav.result={...nav.result,cost:110.44,distance:93.85,terrainAware:true};
    const durationPanel=await nav._renderHTML();
    assert.ok(find(durationPanel,node=>node.tag==="strong"&&node.textContent==="17h 19m"));
    assert.ok(find(durationPanel,node=>node.tag==="strong"&&node.textContent==="2d 1h 19m"),
      "the third card includes two overnight downtime periods");
    const travelDays=find(durationPanel,node=>node.textContent?.startsWith?.("Plan:"));
    assert.match(travelDays.textContent,/8h travel\/day.*2 overnight stops/);
  }finally{nav?.stop();Object.assign(globalThis,previous);}
});

test("mounts, wagons, and ships use explicit daily operating policies",()=>{
  const priorGame=globalThis.game;
  try{
    let profile="dnd5e2024",catalog=defaultTransportationCatalog();
    globalThis.game={system:{id:"dnd5e"},settings:{
      get(_module,key){
        if(key==="guidedTravelRulesProfile")return profile;
        if(key==="guidedTravelCustomDayHours")return 6;
        if(key==="guidedTransportationCatalog")return catalog;
        return undefined;
      }
    }};
    const nav=new AtlasNavigationController();
    const mounted=nav.resolveTravelRules({methodId:"riding-horse",hoursPerDay:null});
    assert.equal(mounted.dailyHours,8);
    assert.equal(mounted.overnightHours,16);
    const plan=estimateNavigationTotalTrip(31+34/60,mounted);
    assert.equal(plan.overnights,3);
    assert.ok(Math.abs(plan.totalHours-(79+34/60))<1e-8);
    const wagon=nav.resolveTravelRules({methodId:"wagon"});
    assert.equal(wagon.dailyHours,8,"a land vehicle is not an always-moving ship");
    const wagonPlan=estimateNavigationTotalTrip(30+5/60,wagon);
    assert.equal(wagonPlan.overnights,3);
    assert.ok(Math.abs(wagonPlan.totalHours-(78+5/60))<1e-8);
    const ship=nav.resolveTravelRules({methodId:"warship"});
    assert.equal(ship.dailyHours,8,"ships no longer operate 24h without an explicit GM policy");
    assert.equal(estimateNavigationTotalTrip(31+34/60,ship).overnights,3);
    const warship=findTransportationPreset("warship",globalThis.game.settings,"dnd5e");
    catalog=setTransportationPreset(catalog,"dnd5e2024",
      {...warship,continuousEnabled:true});
    nav.transportOperation="continuous";
    const sailing=nav.resolveTravelRules({methodId:"warship"});
    assert.equal(sailing.dailyHours,null,
      "a verified continuously crewed vessel never triggers the party travel-day limit");
    assert.equal(estimateNavigationTotalTrip(31+34/60,sailing).overnights,0);
    profile="custom";
    assert.equal(nav.resolveTravelRules({methodId:"camel"}).dailyHours,6,
      "custom World travel-day hours also apply to overland mount estimates");
  }finally{globalThis.game=priorGame;}
});

test("GM checkpoint choice ends the confirmed Journal before allowing a new route",async()=>{
  const previous={game:globalThis.game,ui:globalThis.ui};
  try{
    globalThis.game={user:{isGM:true}};
    const route={status:"ok",start:point(0,0),end:point(10,0),
      distance:10,cost:10,terrainAware:false,legs:[
        {kind:"road",roadId:"road",segmentId:"segment",
          points:[point(0,0),point(10,0)],distance:10,cost:10}]};
    const itinerary=createNavigationItinerary({sceneId:"scene",route,
      travel:{speed:2},roadName:()=> "Road"});
    const record=createJourneyRecord({sceneId:"scene",tokenId:"token",
      atlasRevision:7,itinerary});
    record.status="paused";record.legs[0].completedPercent=100;
    record.legs[0].completedMovingHours=5;
    const saves=[];
    const nav=new AtlasNavigationController({journeyJournalStore:{
      save:async value=>{saves.push(value);return {id:"journal"};},find:()=>null
    }});
    nav.scene={id:"scene"};
    nav.recoveryJournal={id:"journal"};nav.recoveryRecord=record;
    nav.pendingTransfer={journalId:"journal",checkpoint:{name:"Port Barthos"}};
    nav.verifyPendingTransfer=()=>({pending:nav.pendingTransfer});
    let cleared=0;
    nav.clear=()=>{cleared++;nav.recoveryRecord=null;};
    nav.render=async()=>{};
    assert.equal(await nav.stopAndReplanAtCheckpoint(),true);
    assert.equal(saves[0].status,"ended");
    assert.equal(cleared,1);
    assert.equal(nav.pendingTransfer,null);
  }finally{globalThis.game=previous.game;globalThis.ui=previous.ui;}
});

test("continuing from checkpoint never moves the token and requires a new route decision",async()=>{
  const nav=new AtlasNavigationController({atlasProvider:()=>({revision:7})});
  nav.scene={id:"scene",grid:{size:100}};
  nav.pendingTransfer={checkpoint:{name:"Port Barthos"}};
  const view={ready:true};
  nav.verifyPendingTransfer=()=>({pending:nav.pendingTransfer,view});
  const actions=[];
  nav.syncPartyDeparture=()=>actions.push("sync");
  nav.calculateRoute=()=>actions.push("calculate");
  nav.draw=()=>actions.push("draw");
  nav.render=async()=>actions.push("render");
  assert.equal(await nav.continueFromCheckpoint(),true);
  assert.deepEqual(actions,["sync","calculate","draw","render"]);
  assert.equal(nav.pendingTransfer,null);
  assert.equal(nav.sourceMode,"party");
  assert.match(nav.travelNotice,/Choose the next destination/);
  assert.match(nav.travelNotice,/without replaying past travel/);
});

test("multi-surface guided travel stops at the first actual port and checkpoints its Journal",async()=>{
  const previous={game:globalThis.game,ui:globalThis.ui,foundry:globalThis.foundry,
    document:globalThis.document};
  try{
    globalThis.document={createElement:tag=>({tag,style:{},children:[],
      listeners:new Map(),textContent:"",
      append(...nodes){this.children.push(...nodes);},
      appendChild(node){this.children.push(node);},
      addEventListener(name,handler){this.listeners.set(name,handler);},
      setAttribute(){}})};
    let confirmed=0;
    globalThis.foundry={applications:{api:{DialogV2:{
      confirm:async()=>{confirmed++;return true;}
    }}}};
    globalThis.game={user:{id:"gm",isGM:true},users:{activeGM:{id:"gm"}},
      system:{id:"dnd5e"},settings:{get:(_module,key)=>
        key==="guidedTravelSecondsPerHour"?2:
        key==="guidedTravelAdvanceWorldTime"?false:undefined},
      time:{worldTime:0}};
    globalThis.ui={notifications:{error(message){throw Error(message);}}};
    const cp=point(200,100);
    const atlas={revision:7,
      nodes:[{id:"a",...point(100,100)},{id:"dock",...cp},{id:"other",...point(300,100)}],
      roads:[{id:"land",name:"Port Road"},
        {id:"sea",name:"Strait",travelPresetId:"water-sea"}],
      segments:[{id:"s1",roadId:"land",from:"a",to:"dock",via:[]},
        {id:"s2",roadId:"sea",from:"dock",to:"other",via:[]}],
      checkpoints:[{id:"port",name:"Port Barthos",nodeId:"dock",roadId:"land"}]};
    const scene={id:"test-scene",name:"Paedor",grid:{size:100,units:"mi"},
      canUserModify:()=>true};
    const view={ready:true,scene};
    let nativeMoves=0;
    const token={id:"group",x:50,y:50,width:1,height:1,
      canUserModify:()=>true,move:async waypoints=>{
        nativeMoves++;
        const last=waypoints.at(-1);
        token.x=last.x;token.y=last.y;
        assert.ok(last.x<=150.0001,"never move past the port into the waterway");
        return true;
      }};
    const full={status:"ok",start:point(100,100),end:point(300,100),
      distance:20,cost:20,terrainAware:false,legs:[
        {kind:"road",roadId:"land",segmentId:"s1",
          points:[point(100,100),cp],distance:10,cost:10},
        {kind:"road",roadId:"sea",segmentId:"s2",
          points:[cp,point(300,100)],distance:10,cost:10}]};
    const logs=[];
    const journal={id:"saved-journey"};
    const nav=new AtlasNavigationController({canvasProvider:()=>view,
      atlasProvider:()=>atlas,atlasPoint:(_v,_a,p)=>p,
      partyTokenProvider:()=>token,journeyJournalStore:{
        save:async data=>{logs.push(structuredClone(data));return journal;},
        find:()=>null
      }});
    nav.scene=scene;nav.sourceMode="party";nav.routeRevision=atlas.revision;
    nav.start=full.start;nav.end=full.end;nav.result=full;
    nav.syncPartyDeparture=()=>false;
    nav.draw=()=>{};
    nav.render=async()=>{
      // Reproduce Foundry's immediate render after GM approval. This must use
      // the current checkpoint leg, not the full land-water itinerary.
      await nav._renderHTML();
      if(nav.travelSession?.transportLeg){
        assert.ok(Math.abs(nav.journeyTimeUI.travelHours-10/3)<1e-6);
        assert.ok(Math.abs(nav.journeyTimeUI.plan.movingHours-10/3)<1e-6);
      }
    };
    nav.resolveTravel=()=>({sceneUnit:"mi",travel:{speed:3}});
    nav.itinerary=createNavigationItinerary({sceneId:scene.id,route:full,
      travel:{speed:3},roadName:id=>id});
    const leg={index:0,firstRouteLeg:0,lastRouteLeg:0,
      start:full.start,end:cp,distance:10,hours:10/3,
      surface:"land",roadNames:["Port Road"],costCp:0,errors:[],
      options:[{value:"owned|walking",label:"Walking (party pace)",group:"Party"}],
      narration:["The party heads toward Port Barthos."],
      transferValid:true,arrivalCheckpoint:{id:"port",name:"Port Barthos"},
      selectedValue:"owned|walking",
      selectedOption:{arrangement:"owned",value:"owned|walking",
        method:{id:"walking",name:"Walking (party pace)",kind:"foot"}}};
    nav.transportationTransitionPlan=()=>({hasTransitions:true,
      legs:[leg,{index:1,surface:"water",roadNames:["Strait"],errors:[]}]});
    assert.equal(await nav.startGuidedTravel(),true);
    assert.equal(confirmed,1);
    assert.ok(nativeMoves>0);
    assert.equal(token.x,150);
    assert.equal(token.y,50);
    assert.equal(nav.pendingTransfer.checkpoint.name,"Port Barthos");
    assert.equal(logs.at(-1).status,"paused");
    assert.deepEqual(logs.at(-1).destination,full.end,
      "the Journal retains the entire route's original Point B beyond Port Barthos");
    assert.deepEqual(logs.at(-1).legs[0].destination,cp,
      "the committed leg itself must end at the first checkpoint");
    assert.equal(logs.at(-1).legs[0].completedPercent,100);
    assert.equal(nav.travelSession,null);
    assert.equal(nav.result,null,"full future route is not active after arrival");
  }finally{Object.assign(globalThis,previous);}
});

test("the original destination checkpoint completes the Journey without another tiny leg",async()=>{
  const oldGame=globalThis.game;
  try{
    globalThis.game={user:{isGM:true},time:{worldTime:86400}};
    const route={status:"ok",start:point(0,0),end:point(10,0),
      distance:10,cost:10,terrainAware:false,legs:[{
        kind:"road",roadId:"sea",segmentId:"segment",
        points:[point(0,0),point(10,0)],distance:10,cost:10}]};
    const itinerary={...createNavigationItinerary({sceneId:"scene",route,
      travel:{speed:2},roadName:()=>"Strait"}),
      transport:{methodId:"ship-passage",methodName:"Ship passage (hired)",
        kind:"vehicle",arrangement:"hire",surface:"water",
        departureCheckpointName:"Port Barthos",arrivalCheckpointId:"dock",
        arrivalCheckpointName:"Hearth's Heart Dock",roadNames:["Strait"],
        estimatedFareCp:100,operation:"continuous"}};
    const record=createJourneyRecord({sceneId:"scene",tokenId:"token",
      atlasRevision:7,itinerary});
    record.status="paused";record.legs[0].completedPercent=100;
    record.legs[0].completedMovingHours=5;
    const saved=[];
    const nav=new AtlasNavigationController({journeyJournalStore:{
      save:async data=>{saved.push(data);return {id:"journal"};},find:()=>null
    }});
    nav.scene={id:"scene",grid:{size:100}};
    nav.recoveryJournal={id:"journal"};nav.recoveryRecord=record;
    nav.pendingTransfer={journalId:"journal",checkpoint:{
      id:"dock",name:"Hearth's Heart Dock",point:point(10,0)}};
    nav.verifyPendingTransfer=()=>({pending:nav.pendingTransfer});
    let replanned=0,cleared=0;
    nav.syncPartyDeparture=()=>{replanned++;};
    nav.calculateRoute=()=>{replanned++;};
    nav.clear=()=>{cleared++;nav.recoveryRecord=null;};
    nav.render=async()=>{};
    assert.equal(await nav.completeJourneyAtCheckpoint(),true);
    assert.equal(replanned,0,"completing does not create another 0.07-mile leg");
    assert.equal(saved.length,1);
    assert.equal(saved[0].status,"completed");
    assert.equal(cleared,1);
    assert.equal(nav.pendingTransfer,null);
    assert.equal(nav.navigationStage(),"completed",
      "the confirmed Journal remains visible in its own completed stage");
    assert.equal(nav.completedRecord.status,"completed");
    assert.equal(nav.journeyJournal.id,"journal",
      "the completed panel may open the Journal but cannot replay movement");
  }finally{globalThis.game=oldGame;}
});

test("guided boarding refuses a repeated arrival at the just-reached dock",async()=>{
  const previous={game:globalThis.game,foundry:globalThis.foundry};
  try{
    let moved=0,confirmed=0;
    globalThis.game={user:{id:"gm",isGM:true},system:{id:"dnd5e"},
      settings:{get:()=>undefined}};
    globalThis.foundry={applications:{api:{DialogV2:{
      confirm:async()=>{confirmed++;return true;}
    }}}};
    const at=point(100,100),end=point(110,100),onward=point(200,100);
    const scene={id:"scene",grid:{size:100,units:"mi"},canUserModify:()=>true};
    const atlas={revision:7,roads:[{id:"sea",name:"Sea Route",travelPresetId:"water-sea"},
      {id:"land",name:"Coastal Road"}],
      nodes:[{id:"a",...at},{id:"b",...end},{id:"c",...onward}],segments:[]};
    const token={id:"party",canUserModify:()=>true,move:async()=>{moved++;}};
    const route={status:"ok",start:at,end:onward,distance:20,cost:20,
      legs:[{kind:"road",roadId:"sea",segmentId:"segment",
        points:[at,end],distance:10,cost:10},
      {kind:"road",roadId:"land",segmentId:"other-segment",
        points:[end,onward],distance:10,cost:10}]};
    const itinerary={...createNavigationItinerary({sceneId:"scene",route,
      travel:{speed:2},roadName:()=>"Sea Route"}),transport:{
      methodId:"ship-passage",methodName:"Ship passage (hired)",kind:"vehicle",
      arrangement:"hire",surface:"water",departureCheckpointName:"Old Harbor",
      arrivalCheckpointId:"port",
      arrivalCheckpointName:"Port Barthos",roadNames:["Sea Route"],
      estimatedFareCp:2,operation:"continuous"}};
    const record=createJourneyRecord({sceneId:"scene",tokenId:"party",
      atlasRevision:7,itinerary});
    record.status="paused";
    record.legs.at(-1).completedPercent=100;
    const nav=new AtlasNavigationController({canvasProvider:()=>({ready:true,scene}),
      atlasProvider:()=>atlas,partyTokenProvider:()=>token});
    nav.scene=scene;nav.sourceMode="party";nav.routeRevision=7;nav.result=route;
    nav.recoveryRecord=record;nav.syncPartyDeparture=()=>false;
    nav.transportationTransitionPlan=()=>({hasTransitions:true,legs:[{
      index:0,firstRouteLeg:0,lastRouteLeg:0,start:at,end,distance:10,
      hours:5,surface:"water",roadNames:["Sea Route"],costCp:2,errors:[],
      transferValid:true,arrivalCheckpoint:{id:"port",name:"Port Barthos"},
      selectedOption:{method:{id:"ship-passage",name:"Ship passage (hired)",
        kind:"vehicle"},arrangement:"hire"}
    }]});
    await assert.rejects(nav.startGuidedTravel(),/Already arrived at Port Barthos/);
    assert.equal(moved,0,"no native token move may start for a duplicate port");
    assert.equal(confirmed,0,"no repeat transport booking is presented");
  }finally{globalThis.game=previous.game;globalThis.foundry=previous.foundry;}
});

test("legacy final-checkpoint metadata permits onward choice but never routes back to the same point",async()=>{
  const route={status:"ok",start:point(0,0),end:point(10,0),
    distance:10,cost:10,terrainAware:false,legs:[{
      kind:"road",roadId:"land",segmentId:"road",
      points:[point(0,0),point(10,0)],distance:10,cost:10}]};
  const itinerary=createNavigationItinerary({sceneId:"scene",route,
    travel:{speed:2},roadName:()=>"Dock Road"});
  const record=createJourneyRecord({sceneId:"scene",tokenId:"token",
    atlasRevision:7,itinerary});
  record.status="paused";record.legs[0].completedPercent=100;
  record.legs[0].completedMovingHours=5;
  record.legs[0].transport={methodId:"walking",methodName:"Walking (party pace)",
    kind:"foot",arrangement:"owned",surface:"land",
    arrivalCheckpointId:"dock",arrivalCheckpointName:"Port Barthos",
    roadNames:["Dock Road"],estimatedFareCp:0,operation:"normal"};
  const nav=new AtlasNavigationController({atlasProvider:()=>({revision:7})});
  nav.scene={id:"scene",grid:{size:100}};
  nav.recoveryRecord=record;
  nav.end=point(10,0);
  nav.pendingTransfer={checkpoint:{id:"dock",name:"Port Barthos",point:point(10,0)}};
  nav.verifyPendingTransfer=()=>({pending:nav.pendingTransfer,view:{ready:true}});
  let calculations=0;
  nav.syncPartyDeparture=()=>{};
  nav.calculateRoute=()=>{calculations++;assert.equal(nav.end,null,
    "no attempt to route to the dock the party already occupies");};
  nav.draw=()=>{};nav.render=async()=>{};
  assert.equal(await nav.continueFromCheckpoint(),true);
  assert.equal(calculations,1);
  assert.equal(nav.pendingTransfer,null);
  assert.match(nav.travelNotice,/Choose the next destination/);
  assert.match(nav.travelNotice,/without replaying past travel/);
  assert.equal(nav.recoveryRecord.status,"paused",
    "choosing onward travel does not erase confirmed Journey history");
});

test("a recovered intermediate checkpoint resumes the saved final destination",async()=>{
  const route={status:"ok",start:point(0,0),end:point(10,0),
    distance:10,cost:10,terrainAware:false,legs:[{
      kind:"road",roadId:"land",segmentId:"road",
      points:[point(0,0),point(10,0)],distance:10,cost:10}]};
  const itinerary=createNavigationItinerary({sceneId:"scene",route,
    travel:{speed:2},roadName:()=>"Dock Road"});
  const record=createJourneyRecord({sceneId:"scene",tokenId:"token",
    atlasRevision:7,itinerary,journeyDestination:point(200,0)});
  record.status="paused";record.legs[0].completedPercent=100;
  record.legs[0].completedMovingHours=5;
  record.legs[0].transport={methodId:"walking",methodName:"Walking (party pace)",
    kind:"foot",arrangement:"owned",surface:"land",
    arrivalCheckpointId:"dock",arrivalCheckpointName:"Port Barthos",
    roadNames:["Dock Road"],estimatedFareCp:0,operation:"normal"};
  const nav=new AtlasNavigationController({atlasProvider:()=>({revision:7})});
  nav.scene={id:"scene",grid:{size:100}};
  nav.recoveryRecord=record;nav.end=point(200,0);
  nav.pendingTransfer={checkpoint:{id:"dock",name:"Port Barthos",point:point(10,0)}};
  nav.verifyPendingTransfer=()=>({pending:nav.pendingTransfer,view:{ready:true}});
  let confirmedEnd=null;
  nav.syncPartyDeparture=()=>{};
  nav.calculateRoute=()=>{confirmedEnd={...nav.end};};
  nav.draw=()=>{};nav.render=async()=>{};
  assert.equal(nav.isAtJourneyDestination(),false,
    "Port Barthos is a transfer, not the final destination");
  assert.equal(await nav.continueFromCheckpoint(),true);
  assert.deepEqual(confirmedEnd,point(200,0));
  assert.equal(nav.pendingTransfer,null);
  assert.match(nav.travelNotice,/saved destination/);
});

test("ABC checkpoint continuation targets the next saved coordinate without replacing final Point B",async()=>{
  const port={id:"port",name:"Port Barthos",point:point(100,0)};
  const record={status:"paused",destination:point(300,0),
    legs:[{completedPercent:100,transport:{arrivalCheckpointId:"port"}}],
    routeTargets:{schemaVersion:1,nextTargetIndex:2,targets:[
      {id:"A",point:point(0,0)},
      {id:"B",point:port.point,checkpointId:"port"},
      {id:"C",point:point(200,0),checkpointId:"next-port"},
      {id:"D",point:point(300,0)}
    ]}};
  const nav=new AtlasNavigationController({atlasProvider:()=>({revision:7})});
  nav.scene={id:"scene",grid:{size:100}};
  nav.recoveryRecord=record;nav.end={...record.destination};
  nav.pendingTransfer={checkpoint:port};
  nav.verifyPendingTransfer=()=>({pending:nav.pendingTransfer,view:{ready:true}});
  nav.syncPartyDeparture=()=>{};
  let previewEnd;
  nav.calculateRoute=()=>{previewEnd={...nav.end};nav.result={status:"ok"};};
  nav.transportationTransitionPlan=()=>({legs:[{
    arrivalCheckpoint:{id:"next-port",name:"Next Port"}
  }]});
  nav.draw=()=>{};nav.render=async()=>{};
  assert.equal(await nav.continueFromCheckpoint(),true);
  assert.deepEqual(previewEnd,point(200,0));
  assert.deepEqual(nav.end,point(200,0));
  assert.deepEqual(record.destination,point(300,0),
    "previewing the saved next target cannot overwrite the final destination");
  assert.equal(record.routeTargets.nextTargetIndex,2,
    "Continue never commits progress or advances the plan");
});

test("saved B to C all-water route exposes a checkpoint ship transfer, not preview-only travel",()=>{
  const previous={game:globalThis.game};
  try{
    globalThis.game={user:{id:"gm",isGM:true},system:{id:"unknown"},
      settings:{get:()=>undefined}};
    const port={x:100,y:100},dock={x:300,y:100};
    const atlas={revision:12,nodes:[{id:"p",...port},{id:"d",...dock}],
      roads:[{id:"sea",name:"Dirwest-Hearth's Heart",travelPresetId:"water-sea"}],
      segments:[{id:"s",roadId:"sea",from:"p",to:"d",via:[]}],
      checkpoints:[{id:"port",name:"Port Barthos",nodeId:"p",roadId:"sea"},
        {id:"dock",name:"Hearth's Heart Dock",nodeId:"d",roadId:"sea"}]};
    const scene={id:"paedor",grid:{size:100,units:"mi"},getFlag:(_ns,key)=>
      key==="checkpointTransportOffers"?{schemaVersion:1,entries:{
        port:[{methodId:"ship-passage",mode:"sea",overrides:{hireEnabled:true}}]
      }}:undefined};
    const route={status:"ok",start:port,end:dock,distance:95.48,cost:95.48,
      legs:[{kind:"road",roadId:"sea",segmentId:"s",points:[port,dock],
        distance:95.48,cost:95.48}]};
    const nav=new AtlasNavigationController({atlasProvider:()=>atlas});
    nav.scene=scene;nav.sourceMode="party";nav.result=route;nav.end=dock;
    nav.recoveryRecord={status:"paused",destination:{x:340,y:100},
      legs:[{completedPercent:100,travelMethod:{id:"walking"}}],
      routeTargets:{schemaVersion:1,nextTargetIndex:2,targets:[
        {id:"A",point:{x:0,y:0}},
        {id:"B",point:port,checkpointId:"port"},
        {id:"C",point:dock,checkpointId:"dock"},
        {id:"D",point:{x:340,y:100}}
      ]}};
    nav.transferSelections[0]="hire|ship-passage";
    const plan=nav.transportationTransitionPlan();
    assert.equal(plan.checkpointContinuation,true);
    assert.equal(plan.hasTransitions,true,"force checkpoint choice UI despite one surface");
    assert.equal(plan.legs.length,1);
    assert.equal(plan.legs[0].arrivalCheckpoint.id,"dock");
    assert.equal(plan.legs[0].selectedOption.value,"hire|ship-passage");
    assert.deepEqual(plan.legs[0].errors,[]);
    assert.ok(plan.legs[0].hours>0);
    assert.equal(nav.recoveryRecord.routeTargets.nextTargetIndex,2,
      "planning must not confirm C or change the Journal");
  }finally{globalThis.game=previous.game;}
});

test("Continue from a completed port never previews another voyage to that same port",async()=>{
  const port={id:"port",name:"Port Barthos",point:point(100,0)};
  const record={status:"paused",destination:point(120,0),
    legs:[{completedPercent:100,transport:{arrivalCheckpointId:port.id}}]};
  const nav=new AtlasNavigationController({atlasProvider:()=>({revision:7})});
  nav.scene={id:"scene",grid:{size:100}};
  nav.recoveryRecord=record;
  nav.end={...record.destination};
  nav.pendingTransfer={checkpoint:port};
  nav.verifyPendingTransfer=()=>({pending:nav.pendingTransfer,view:{ready:true}});
  nav.syncPartyDeparture=()=>{};
  const endpoints=[];
  nav.calculateRoute=()=>{
    endpoints.push(nav.end);
    nav.result=nav.end?{status:"ok"}:null;
  };
  nav.transportationTransitionPlan=()=>({legs:[{arrivalCheckpoint:port}]});
  nav.draw=()=>{};nav.render=async()=>{};
  assert.equal(nav.isAtJourneyDestination(),false,
    "an offset Point B must not be silently reclassified as final");
  assert.equal(await nav.continueFromCheckpoint(),true);
  assert.deepEqual(endpoints,[point(120,0),null]);
  assert.equal(nav.end,null,"the new Point B must be chosen deliberately");
  assert.equal(nav.pendingTransfer,null);
  assert.equal(nav.recoveryRecord,record,"the Journal snapshot remains unchanged");
  assert.match(nav.travelNotice,/resolves back to this same checkpoint/);
});

test("confirmed checkpoint choices can be reopened from their Journal after a blocked preview",()=>{
  const previous={game:globalThis.game,ui:globalThis.ui};
  try{
    const scene={id:"paedor",grid:{size:100}};
    const port={id:"port",name:"Port Barthos",nodeId:"port-node"};
    const atlas={revision:7,roads:[],nodes:[{id:"port-node",x:100,y:0}],
      checkpoints:[port]};
    const token={id:"party"};
    const route={status:"ok",start:point(0,0),end:point(100,0),
      distance:100,cost:100,legs:[{kind:"road",roadId:"sea",
        segmentId:"s",distance:100,cost:100,
        points:[point(0,0),point(100,0)]}]};
    const itinerary={...createNavigationItinerary({sceneId:scene.id,
      route,travel:{speed:2}}),transport:{methodId:"ship-passage",
      methodName:"Ship passage (hired)",kind:"vehicle",arrangement:"hire",
      surface:"water",departureCheckpointName:null,arrivalCheckpointId:"port",
      arrivalCheckpointName:port.name,roadNames:["Sea Route"],
      estimatedFareCp:100,operation:"continuous"}};
    const saved=createJourneyRecord({sceneId:scene.id,tokenId:token.id,
      atlasRevision:atlas.revision,itinerary,journeyDestination:point(120,0)});
    saved.status="paused";saved.legs[0].completedPercent=100;
    saved.legs[0].completedMovingHours=50;
    const journal={id:"journal",getFlag:()=>saved};
    globalThis.game={user:{id:"gm",isGM:true}};
    globalThis.ui={notifications:{warn(message){throw Error(message);}}};
    const nav=new AtlasNavigationController({canvasProvider:()=>({ready:true,scene}),
      atlasProvider:()=>atlas,partyTokenProvider:()=>token});
    nav.scene=scene;nav.draw=()=>{};nav.render=async()=>{};
    nav.syncPartyDeparture=()=>{nav.start=point(100,0);};
    nav.recoverableJourney=null;nav.recoveryJournal=journal;
    nav.recoveryRecord=saved;
    nav.result={status:"ok",end:point(120,0)};
    assert.equal(nav.recoverSavedJourney(),true);
    assert.equal(nav.pendingTransfer.checkpoint.name,port.name);
    assert.deepEqual(nav.end,point(120,0));
    assert.equal(nav.result,null,"an obsolete preview cannot trigger movement");
    assert.equal(journal.getFlag(),saved,"reviewing checkpoint must not write to Journal");
  }finally{globalThis.game=previous.game;globalThis.ui=previous.ui;}
});
