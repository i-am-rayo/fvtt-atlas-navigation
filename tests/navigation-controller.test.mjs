import assert from "node:assert/strict";
import test from "node:test";
import {installNativeJourneyFixture} from "./support/native-journey-fixture.mjs";
import { createNavigationItinerary } from "../scripts/navigation-itinerary.js";
import { createJourneyRecord,checkpointJourneyRecord,findRecoverableJourney,
  JOURNEY_JOURNAL_FLAG } from "../scripts/navigation-journey-journal.js";
import { GuidedTravelDayTracker,estimateNavigationTotalTrip }
  from "../scripts/navigation-travel-day.js";
import {planNativeCheckpointPath}
  from "../scripts/navigation-native-movement-plan.js";
import {projectPartyTravelSelection} from "../scripts/navigation-party-selection.js";
import {defaultGroupTransportation,setGroupTransportationMember} from "../scripts/navigation-group-transport.js";
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

installNativeJourneyFixture(AtlasNavigationController);

const point=(x,y)=>({x,y});
const pointer=(x,y,flags={})=>({button:0,clientX:x,clientY:y,
  shiftKey:false,altKey:false,ctrlKey:false,metaKey:false,
  prevented:0,stopped:0,...flags,
  preventDefault(){this.prevented++;},stopImmediatePropagation(){this.stopped++;}});

test("continuous vessel submits one bounded move per durable checkpoint",async()=>{
  const previous={game:globalThis.game,foundry:globalThis.foundry,Hooks:globalThis.Hooks};
  try{
    const listeners=new Map(),events=[];
    let nativeId=0;
    globalThis.foundry={utils:{randomID:()=>"NativeVoyage"+String(++nativeId).padStart(4,"0")}};
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
      getCompleteMovementPath(path){
        const [from,to]=path;
        return [from,{x:from.x+5,y:8},to];
      },
      pauseMovement(){
        this.hold=new Promise(resolve=>{this.release=resolve;});
        return async()=>{this.release();};
      },
      stopMovement(){this.release?.();return true;},
      async move(path,options){
        assert.match(options.id,/^[A-Za-z0-9]{16}$/);
        this.moves++;
        let from={x:this.x,y:this.y};
        for(const target of path.filter(point=>point.checkpoint)){
          assert.equal(events.at(-1)?.kind,"intent",
            "a token update must always have a saved pending intent");
          const destination={x:target.x,y:target.y};
          let endAnimation;
          const animationEnded=new Promise(resolve=>{endAnimation=resolve;});
          this.hold=null;this.release=null;
          const intermediate={x:from.x+5,y:8,intermediate:true,snapped:true,
            explicit:false,checkpoint:false,movementId:options.id};
          const movement={id:options.id,chain:[],origin:from,destination,
            constrained:false,passed:{waypoints:[intermediate,{...destination,movementId:options.id}]},
            pending:{waypoints:[]},animation:{ended:animationEnded}};
          assert.deepEqual(events.at(-1).nativePath,[from,
            {x:from.x+5,y:8},destination]);
          assert.notEqual(listeners.get("preMoveToken")(this,movement),false);
          listeners.get("moveToken")(this,movement);
          // The live v14 move hook may report an approved endpoint while the
          // authoritative document still contains the preceding checkpoint.
          assert.deepEqual({x:this.x,y:this.y},from);
          Object.assign(this,destination);
          listeners.get("updateToken")?.(this,{x:this.x,y:this.y});
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
      const pending=record.journeyRecord.pendingNativeMove;
      events.push({kind:pending?(pending.arrivalEvidence?"evidence":"intent"):"confirmed",
        status,progress:record.completedDistance,nativePath:pending?.nativePath});
    };
    nav.captureConfirmedJourneyAnchor=()=>({point:{x:token.x,y:token.y}});
    assert.equal(await nav.runNativeContinuousLeg(session,{
      plan:planNativeCheckpointPath([point(0,0),point(30,0)],{
        movementSpeed:.05,gridSize:100,totalMovingHours:6}),
      playback:{movementSpeed:.05,travelHours:6},atlas,view,
      guidedLeg:{checkpoint:{point:point(80,50)},
        transport:{methodName:"Warship"}}
    }),true);
    assert.equal(token.moves,3);
    assert.equal(session.completedDistance,30);
    assert.equal(session.journeyRecord.pendingNativeMove,null);
    assert.deepEqual(events.map(event=>event.kind),[
      "intent","evidence","confirmed","intent","evidence","confirmed","intent","evidence","confirmed"]);
    assert.equal(events.at(-1).status,"paused",
      "the final dock must be durable before the native movement promise resolves");
    assert.equal(listeners.size,0);
  }finally{
    globalThis.game=previous.game;globalThis.foundry=previous.foundry;
    globalThis.Hooks=previous.Hooks;
  }
});

test("ordinary scheduled native chunk preserves a durable intent and does not claim early dock arrival",async()=>{
  const prior={game:globalThis.game,foundry:globalThis.foundry,Hooks:globalThis.Hooks};
  try{
    const listeners=new Map(),writes=[];
    globalThis.foundry={utils:{randomID:()=>"OrdinaryMove0001"}};
    globalThis.Hooks={on(key,fn){listeners.set(key,fn);return fn;},
      off(key,fn){assert.equal(listeners.get(key),fn);listeners.delete(key);}};
    globalThis.game={time:{worldTime:500}};
    const scene={id:"normal-scene",grid:{size:100}};
    const atlas={revision:4},view={ready:true,scene};
    const token={id:"group-token",x:0,y:0,width:1,height:1,
      stopMovement(){return true;},
      getCompleteMovementPath(path){return path;},
      async move(waypoints,options){
        assert.equal(writes.at(-1)?.type,"intent",
          "native TokenDocument.move must never precede the durable intent");
        const from={x:this.x,y:this.y},to=waypoints.at(-1);
        const movement={id:options.id,chain:[],origin:from,
          destination:{x:to.x,y:to.y},constrained:false,
          passed:{waypoints:[{...to,movementId:options.id}]},
          pending:{waypoints:[]},animation:{ended:Promise.resolve()},state:"completed"};
        assert.notEqual(listeners.get("preMoveToken")?.(this,movement),false);
        listeners.get("moveToken")(this,movement);
        this.x=to.x;this.y=to.y;this.movement=movement;
        listeners.get("updateToken")(this,{x:this.x,y:this.y});
        return true;
      }
    };
    const nav=new AtlasNavigationController({canvasProvider:()=>view,
      atlasProvider:()=>atlas,atlasPoint:(_view,_atlas,p)=>p});
    nav.scene=scene;
    const session={token,sceneId:scene.id,gridSize:100,phase:"moving",
      totalDistance:20,completedDistance:0,clock:null,journeyRecord:{},
      schedule:{recordMovement(){}},confirmedSegments:0,pendingPassengerRest:null};
    nav.travelSession=session;
    nav.captureConfirmedJourneyAnchor=()=>({point:{x:token.x,y:token.y}});
    nav.saveJourneyCheckpoint=async(record,status)=>{
      writes.push({type:record.journeyRecord.pendingNativeMove?"intent":"confirmed",status,
        completedDistance:record.completedDistance});
    };
    assert.equal(await nav.runNativeContinuousLeg(session,{
      plan:{path:[{x:0,y:0},{x:10,y:0,checkpoint:true}],
        checkpoints:[{index:0,from:{x:0,y:0},point:{x:10,y:0},
          distance:10,completedDistance:10,completedMovingHours:1,
          pathStartIndex:0,pathEndIndex:1}],totalDistance:20},
      playback:{movementSpeed:1,travelHours:2},atlas,view,
      guidedLeg:{checkpoint:{point:{x:100,y:100}},transport:{methodName:"Cart"}},
      ordinary:true
    }),true);
    assert.deepEqual(writes.map(w=>w.status),["moving","moving","moving"]);
    assert.equal(session.completedDistance,10,"exactly one approved chunk was credited");
    assert.equal(session.journeyRecord.pendingNativeMove,null);
    assert.equal(listeners.size,0);
  }finally{Object.assign(globalThis,prior);}
});

test("native destination without committed token position preserves pending Journal intent and clock",async()=>{
  const previous={game:globalThis.game,foundry:globalThis.foundry,Hooks:globalThis.Hooks};
  try{
    const listeners=new Map(),journalWrites=[];
    globalThis.foundry={utils:{randomID:()=>"NativeUncommit01"}};
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
      "NativeUncommit01");
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

test("pending native checkpoint cannot publish uncredited World time after canvas teardown",async()=>{
  const previous=globalThis.game;
  try{
    globalThis.game={user:{id:"gm",isGM:true},time:{worldTime:4600}};
    const sceneId="clock-scene",tokenId="party";
    const route={status:"ok",start:point(0,0),end:point(100,0),
      distance:2,cost:2,legs:[{kind:"road",roadId:"r",segmentId:"s",
        points:[point(0,0),point(100,0)],distance:2,cost:2}]};
    const itinerary=createNavigationItinerary({sceneId,sceneUnits:"mi",route,
      travel:{speed:2}});
    const record=createJourneyRecord({sceneId,tokenId,atlasRevision:3,itinerary});
    record.pendingNativeMove={schemaVersion:1,bounded:true,operationId:"PendingMove00001",
      tokenId,checkpointIndex:0,from:point(0,0),to:point(50,0),
      previousMovementId:null,path:[point(0,0),point(50,0)],
      completedPercent:50,nativeDistance:50,movingHours:1,
      worldTimeBefore:1000,worldAdvanceSeconds:3600,atlasRevision:3};
    let saved=null;
    const nav=new AtlasNavigationController({journeyJournalStore:{
      save:async value=>{saved=structuredClone(value);return {id:"journal"};}
    }});
    const session={journal:{id:"journal"},journeyRecord:record,journalQueue:Promise.resolve(),
      completedDistance:0,totalDistance:100,gridSize:100,clock:{
        advancedSeconds:3600,restSeconds:0
      },schedule:{completedHours:0,todayHours:0,permittedExtraUntil:0,
        restEvents:0,lastForcedCheck:null,events:[]}};
    await nav.saveJourneyCheckpoint(session,"interrupted");
    assert.equal(saved.pendingNativeMove.operationId,"PendingMove00001");
    assert.equal(saved.legs[0].completedMovingHours,0,
      "native movement has not yet become credited Journey progress");
    assert.equal(saved.legs[0].worldTravelSeconds,0,
      "World time may already be advanced but must not enter the confirmed ledger until recovery");
  }finally{globalThis.game=previous;}
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

test("canvas review announcement waits for recovery and a matching saved Journey",async()=>{
  const prior={game:globalThis.game};
  try{
    const scene={id:"review-scene",canUserModify:()=>true};
    const tokenId="party-token",now="2026-11-06T03:00:00.000Z";
    const itinerary={schemaVersion:1,
      scene:{name:"Test Road",units:"mi"},
      endpoints:{departure:point(0,0),destination:point(100,0)},
      measurements:{distance:10,travelHours:5,terrainAware:false},
      travel:{speedPerHour:2},directions:[]};
    const begun=createJourneyRecord({sceneId:scene.id,tokenId,
      atlasRevision:3,itinerary,now});
    let stored={...begun,status:"interrupted",updatedAt:"2026-11-06T03:01:00.000Z"};
    const journal={id:"private-journal",getFlag:()=>stored};
    const published=[];
    globalThis.game={user:{id:"gm",isGM:true},users:{activeGM:{id:"gm"}}};
    const nav=new AtlasNavigationController({canvasProvider:()=>({ready:true,scene}),
      announcementPublisher:payload=>{published.push(payload);return true;}});
    const notice={reason:"canvasTearDown",phase:"moving",sceneId:scene.id,
      tokenId,createdAt:now,journal,session:{
        finished:Promise.resolve(),journalQueue:Promise.resolve()}};
    nav.canvasRecoveryNotice=notice;
    nav.autoResumePending={journalId:journal.id};
    assert.equal(await nav.announceCanvasReviewAfterCanvasReady(),false,
      "a possible automatic continuation must decide first");
    assert.deepEqual(published,[]);
    nav.autoResumePending=null;
    assert.equal(await nav.announceCanvasReviewAfterCanvasReady(),true);
    assert.deepEqual(published.map(item=>item.type),["journey.interrupted"]);
    assert.equal(published[0].canvasRecovery,true);
    assert.equal(published[0].gmReviewRequired,true);
    assert.equal(await nav.announceCanvasReviewAfterCanvasReady(),false,
      "the same ready hook cannot re-announce");

    stored={...begun,status:"paused",updatedAt:"2026-11-06T03:02:00.000Z"};
    nav.canvasRecoveryNotice={...notice};
    assert.equal(await nav.announceCanvasReviewAfterCanvasReady(),true);
    assert.deepEqual(published.map(item=>item.type),[
      "journey.interrupted","journey.awaiting-gm"]);

    // After a Scene switch, a failed Journal write, or a terminal Journey,
    // the notification is withheld and no private data is broadcast.
    nav.canvasRecoveryNotice={...notice,sceneId:"other-scene"};
    assert.equal(await nav.announceCanvasReviewAfterCanvasReady(),false);
    nav.canvasRecoveryNotice={...notice};
    stored={...begun,status:"completed",updatedAt:"2026-11-06T03:03:00.000Z"};
    assert.equal(await nav.announceCanvasReviewAfterCanvasReady(),false);
    nav.canvasRecoveryNotice={...notice};
    journal.getFlag=()=>{throw Error("Journal is unavailable");};
    assert.equal(await nav.announceCanvasReviewAfterCanvasReady(),false);
    assert.equal(published.length,2);
  }finally{globalThis.game=prior.game;}
});

test("canvas teardown captures a provisional review only for active non-manual travel",()=>{
  const prior={game:globalThis.game,ui:globalThis.ui};
  try{
    globalThis.game={user:{isGM:true},time:{worldTime:0}};
    globalThis.ui={notifications:{warn(){}}};
    const scene={id:"scene"};
    const nav=new AtlasNavigationController();
    nav.scene=scene;
    const session={sceneId:scene.id,phase:"rest-choice",journal:{id:"j"},
      journeyRecord:{createdAt:"2026-11-06T03:00:00Z",tokenId:"t",status:"paused"},
      completedDistance:2,totalDistance:10};
    nav.travelSession=session;
    nav.saveJourneyCheckpoint=async()=>{};
    nav.tearDown("canvasTearDown");
    assert.equal(nav.canvasRecoveryNotice.reason,"canvasTearDown");
    assert.equal(nav.canvasRecoveryNotice.phase,"rest-choice");
    assert.equal(nav.autoResumePending,null,
      "an unresolved daily decision cannot start native movement itself");
    nav.tearDown("canvasReady");
    assert.equal(nav.canvasRecoveryNotice.phase,"rest-choice",
      "the second Foundry hook does not erase the first pending notice");
    nav.scene=scene;nav.travelSession={...session,phase:"paused"};
    nav.tearDown("canvasTearDown");
    assert.equal(nav.canvasRecoveryNotice,null,
      "the already-announced deliberate manual pause cannot be repeated");
  }finally{globalThis.game=prior.game;globalThis.ui=prior.ui;}
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

test("successful automatic canvas continuation suppresses pending-GM banners",async()=>{
  const prior=globalThis.game;
  try{
    const scene={id:"auto-continue",canUserModify:()=>true};
    const token={id:"party"},events=[];
    globalThis.game={user:{id:"gm",isGM:true},users:{activeGM:{id:"gm"}}};
    const nav=new AtlasNavigationController({
      canvasProvider:()=>({ready:true,scene}),
      atlasProvider:()=>({revision:12}),partyTokenProvider:()=>token,
      announcementPublisher:payload=>{events.push(payload.type);return true;}
    });
    nav.activate=()=>{nav.scene=scene;nav.recoverableJourney={id:"saved"};};
    nav.recoverSavedJourney=()=>{
      nav.recoveryRecord={status:"interrupted",legs:[{completedPercent:45}]};
      return true;
    };
    let finish;
    nav.startGuidedTravel=()=>new Promise(resolve=>{finish=resolve;});
    const notice={reason:"canvasTearDown",phase:"moving",sceneId:scene.id,
      tokenId:token.id,createdAt:"original",journal:{id:"saved"},
      session:{finished:Promise.resolve(),journalQueue:Promise.resolve()}};
    nav.canvasRecoveryNotice=notice;
    nav.autoResumePending={sceneId:scene.id,tokenId:token.id,journalId:"saved",
      revision:12,session:notice.session};
    assert.equal(await nav.autoResumeAfterCanvasReady(),true);
    assert.equal(nav.canvasRecoveryContinuing,notice);
    assert.equal(await nav.announceCanvasReviewAfterCanvasReady(),false);
    assert.deepEqual(events,[]);
    finish(true);
    await Promise.resolve();
    assert.equal(nav.canvasRecoveryNotice,null);
    assert.equal(await nav.announceCanvasReviewAfterCanvasReady(),false);
    assert.deepEqual(events,[],"an automatically resumed route never says it awaits approval");
  }finally{globalThis.game=prior;}
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
    const saves=[],announcements=[];
    const nav=new AtlasNavigationController({journeyJournalStore:{
      save:async data=>{saves.push(structuredClone(data));return {id:"journal"};},
      find:()=>null},announcementPublisher:payload=>{
      announcements.push(payload.type);return true;}});
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
    assert.deepEqual(announcements,["break.started","break.ended"],
      "one confirmed rest produces two queued visual phases");
    assert.match(nav.travelNotice,/journey remains paused/);
    assert.equal(await nav.choosePausedTravelRest("continue"),false,
      "forced march is not a rest available mid-day");
    session.phase="moving";
    assert.equal(await nav.choosePausedTravelRest("short"),false,
      "rest actions require an actual paused movement boundary");
    session.phase="paused";
    nav.journeyJournalStore.save=async()=>{throw Error("Journal write failed");};
    await assert.rejects(nav.choosePausedTravelRest("short"),/Journal write failed/);
    assert.deepEqual(announcements,["break.started","break.ended"],
      "a failed rest Journal write must not produce banners");
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
      addEventListener(name,handler){this.listeners.set(name,handler);},
      setAttribute(name,value){if(name==="aria-label")this.ariaLabel=value;}})};
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
    const lockedPoint={...nav.end};
    nav.recoveryRecord={status:"interrupted"};
    const recoveredClick=pointer(555,100,{altKey:true});
    listeners.get("pointerdown")(recoveredClick);
    assert.equal(recoveredClick.prevented,0,
      "saved Journey recovery must not intercept an unrelated map click");
    assert.deepEqual(nav.end,lockedPoint,
      "a map click cannot rewrite the approved Journey Point B");
    nav.recoveryRecord=null;
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
    assert.ok(find(content,item=>item.style?.cssText?.includes("overflow-y:auto")),
      "tab panels scroll independently without hiding the Journey footer");
    const travelButton=find(content,item=>item.tag==="button"&&item.ariaLabel==="Travel Route");
    assert.equal(footer.children.includes(travelButton),true);
    assert.ok(find(content,item=>item.textContent==="Playback speed · this trip only"),
      "Navigation exposes per-trip animation controls independently of travel time");
    const previewSpeed=find(content,item=>item.tag==="input"&&
      item.type==="range"&&item.max==="30");
    assert.ok(previewSpeed,"the GM can choose 0.5–30 seconds/hour before departure");
    previewSpeed.value="20";
    previewSpeed.listeners.get("input")();
    previewSpeed.listeners.get("change")();
    assert.equal(nav.playbackSecondsPerHourOverride,20,
      "planning no longer silently rejects visual seconds/hour above 8");
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
    const methodSelect=find(transportPanel,item=>item.tag==="input"&&
      item.name==="atlas-navigation-travel-method"&&item.checked);
    assert.equal(methodSelect.value,"hire|mounted");
    assert.equal(find(transportPanel,item=>item.tag==="input"&&
      item.value==="hire|rowboat"),undefined,
      "water offers must not appear for an all-land route");
    assert.ok(find(transportPanel,item=>item.textContent==="Party Owned"));
    assert.ok(find(transportPanel,item=>item.textContent==="Available at Starting Town"));
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
      item.ariaLabel==="Edit Carriage transportation");
    assert.ok(pencil,"one selected method has an accessible pencil on its tile");
    assert.equal(find(hired,item=>item.tag==="button"&&
      item.textContent==="Edit selected method"),undefined);
    assert.equal(find(hired,item=>item.textContent==="Arrangement"),undefined,
      "the method's radio group already selects owned versus hired");
    assert.equal(find(hired,item=>item.tag==="select"&&
      item.ariaLabel?.startsWith("Operating schedule for ")),undefined,
      "the Navigation panel has no redundant operating-schedule selector");
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
    const ordinaryClick=pointer(500,300);nav.onPointerDown(ordinaryClick);
    assert.equal(ordinaryClick.prevented,0,
      "party Navigation no longer captures Scene clicks until Pick on map is active");
    assert.equal(nav.end,null);
    nav.mapPickActive=true;
    nav.maximize=async()=>{};
    const destination=pointer(500,300);nav.onPointerDown(destination);
    assert.deepEqual(nav.end,point(300,200));
    assert.deepEqual(origins,[point(100,75)]);
    assert.equal(destination.prevented,1);
    assert.equal(nav.mapPickActive,false,"map selection exits after setting Point B");
    const miss=pointer(700,400,{shiftKey:true});nav.onPointerDown(miss);
    assert.equal(miss.prevented,0,"Shift must never overwrite token departure");
    token.x+=20;token.y+=10;
    nav.refreshPartyDeparture();
    assert.deepEqual(nav.start,point(120,85));
    assert.deepEqual(origins.at(-1),point(120,85));
    const panel=await nav._renderHTML();
    const find=(node,match)=>match(node)?node:node.children.map(child=>find(child,match)).find(Boolean);
    const selector=find(panel,node=>node.tag==="select"&&node.id==="atlas-navigation-departure");
    assert.equal(selector,undefined,"departure and refresh controls are removed from the GM planner");
    const mapButton=find(panel,node=>node.tag==="button"&&node.textContent==="Pick on map");
    assert.ok(mapButton);
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
    assert.throws(()=>nav.recoverSavedJourney(),
      /manual recovery is also blocked/,
      "a GM cannot accidentally reroute past uncredited native movement");
    assert.equal(calculated,0,"neither automatic nor manual recovery may create a route");
    assert.equal(nav.recoveryRecord,null,"an unchecked anchor is not promoted into recovery");
    assert.equal(nav.recoverableJourney,journal,"the recoverable Journal remains intact");
  }finally{globalThis.game=previous;}
});

test("a recovered 100%-moved port with stale A/B/C target stops before any new route",()=>{
  const previous=globalThis.game;
  try{
    globalThis.game={user:{id:"gm",isGM:true},settings:{get:()=>null}};
    const scene={id:"port-scene",grid:{size:100,units:"mi"},
      canUserModify:()=>true};
    const token={id:"party",x:150,y:-50,width:1,height:1,
      canUserModify:()=>true,move(){throw Error("no travel on read");}};
    const cp={id:"port",name:"Port Barthos",nodeId:"port-node"};
    const atlas={revision:7,roads:[],segments:[],
      nodes:[{id:"port-node",x:200,y:0}],checkpoints:[cp]};
    const route={status:"ok",start:point(0,0),end:point(200,0),
      distance:20,cost:20,terrainAware:false,legs:[{
        kind:"road",roadId:"land",segmentId:"land-segment",
        points:[point(0,0),point(200,0)],distance:20,cost:20}]};
    const itinerary=createNavigationItinerary({sceneId:scene.id,route,
      travel:{speed:2}});
    itinerary.transport={methodId:"walking",methodName:"Walking",
      kind:"foot",arrangement:"owned",surface:"land",
      departureCheckpointName:"Hearth's Heart",
      arrivalCheckpointId:"port",arrivalCheckpointName:"Port Barthos",
      roadNames:["Dock Road"],estimatedFareCp:0,operation:"normal"};
    const journalRecord=createJourneyRecord({sceneId:scene.id,tokenId:token.id,
      atlasRevision:7,itinerary,initialAnchor:{point:point(200,0),
        roadId:"land",segmentId:"land-segment",checkpointId:"port",
        levelId:null,elevation:null},routeTargets:{schemaVersion:1,
        nextTargetIndex:1,targets:[
          {id:"A",point:point(0,0),checkpointId:null},
          {id:"B",point:point(200,0),checkpointId:"port"},
          {id:"C",point:point(300,0),checkpointId:"dock"}]}});
    journalRecord.status="interrupted";
    journalRecord.legs[0].completedPercent=100;
    journalRecord.legs[0].completedMovingHours=
      journalRecord.legs[0].movingHours;
    let routes=0;
    const nav=new AtlasNavigationController({canvasProvider:()=>({ready:true,scene}),
      atlasProvider:()=>atlas,partyTokenProvider:()=>token,
      atlasPoint:(_view,_atlas,p)=>p,
      routeCalculator:()=>{routes++;return route;}});
    nav.scene=scene;nav.recoverableJourney={id:"saved",getFlag:()=>journalRecord};
    assert.throws(()=>nav.recoverSavedJourney({automatic:true}),
      /checkpoint\/target decision is not fully confirmed/);
    assert.equal(routes,0,"a stale target never becomes a new route preview");
    assert.equal(nav.pendingTransfer,null,"the UI cannot invent a transfer");
    assert.equal(nav.recoveryRecord,null,"no incomplete approval enters active state");
  }finally{globalThis.game=previous;}
});

test("stopped vessel at pending origin reconciles once without replaying movement or advancing time",async()=>{
  const previous={game:globalThis.game,window:globalThis.window,ui:globalThis.ui,
    document:globalThis.document};
  try{
    const op="Av0z7n6VoN4tbjcC";
    const scene={id:"recovery-scene",name:"Paedor",grid:{size:49,units:"km"},
      canUserModify:()=>true,getFlag:()=>null};
    const atlas={revision:587,roads:[],nodes:[],segments:[],checkpoints:[]};
    const token={id:"party",x:3963,y:1769,width:1,height:1,elevation:0,
      level:"defaultLevel0000",canUserModify:()=>true,
      movement:{id:"previous-native-id",chain:[op],state:"stopped",
        destination:point(3963,1769)},
      move(){throw Error("Reconciliation cannot move native token");}};
    const route={status:"ok",start:point(3856.5,1709.5),end:point(3918.41,2370.02),
      distance:153.669,cost:153.669,terrainAware:false,legs:[{
        kind:"road",roadId:"sea",segmentId:"s",
        points:[point(3856.5,1709.5),point(3918.41,2370.02)],distance:153.669,cost:153.669}]};
    const itinerary={...createNavigationItinerary({sceneId:scene.id,
      sceneName:scene.name,sceneUnits:"km",route,travel:{speed:3.218688}}),
      transport:{methodId:"ship-passage",methodName:"Ship passage (hired)",
        arrangement:"hire",kind:"vehicle",surface:"water",departureCheckpointName:null,
        arrivalCheckpointId:"port",arrivalCheckpointName:"Port Barthos",roadNames:["Sea"],
        estimatedFareCp:3819.431055187695,operation:"continuous"}};
    const anchor={point:point(4056.5,1803.5),roadId:"sea",segmentId:"s",
      checkpointId:null,levelId:token.level,elevation:0};
    let record=checkpointJourneyRecord(createJourneyRecord({sceneId:scene.id,tokenId:token.id,
      atlasRevision:587,itinerary,journeyDestination:point(5000,2500)}),{
      schedule:{completedHours:12.01549466097752,todayHours:12,
        permittedExtraUntil:0,restEvents:0,lastForcedCheck:null,events:[]},
      status:"interrupted",progress:25.1670879507724,
      worldTravelSeconds:43256,confirmedAnchor:anchor});
    record.pendingNativeMove={schemaVersion:1,operationId:op,tokenId:token.id,
      checkpointIndex:3,from:point(3963,1769),to:point(4015,1815),
      nativeDistance:74.80603416676962,movingHours:4.005164886992505,
      worldTimeBefore:28978218042,worldAdvanceSeconds:14418,atlasRevision:587};
    globalThis.game={user:{id:"gm",isGM:true},users:{activeGM:{id:"gm"}},
      time:{worldTime:28978218042,advance(){throw Error("Recovery cannot advance time");}},
      system:{id:"test"},settings:{get:()=>undefined}};
    const journal={id:"saved-vessel",canUserModify:()=>true,getFlag:()=>structuredClone(record)};
    let writes=0,restores=0;
    const nav=new AtlasNavigationController({canvasProvider:()=>({ready:true,scene}),
      atlasProvider:()=>atlas,partyTokenProvider:()=>token,
      atlasPoint:(_view,_atlas,p)=>point(p.x+69,p.y+10),
      journeyJournalStore:{save:async(next,{updatePage})=>{
        assert.equal(updatePage,false);writes++;record=structuredClone(next);}}});
    nav.scene=scene;nav.recoverableJourney=journal;
    const before=structuredClone(record);
    assert.equal(nav.canRecoverUnexecutedNativeMove(record),true);
    token.movement.state="pending";
    assert.equal(nav.canRecoverUnexecutedNativeMove(record),false);
    token.movement.state="stopped";
    token.x=4015;token.y=1815;
    assert.equal(nav.canRecoverUnexecutedNativeMove(record),false);
    token.x=3963;token.y=1769;
    game.time.worldTime+=14418;
    assert.equal(nav.canRecoverUnexecutedNativeMove(record),false);
    game.time.worldTime-=14418;
    token.movement.chain=[];
    assert.equal(nav.canRecoverUnexecutedNativeMove(record),false);
    token.movement.chain=[op];
    token.elevation=1;
    assert.equal(nav.canRecoverUnexecutedNativeMove(record),false);
    token.elevation=0;
    game.users.activeGM.id="other";
    assert.equal(nav.canRecoverUnexecutedNativeMove(record),false);
    game.users.activeGM.id="gm";
    assert.equal(writes,0);
    nav.recoverSavedJourney=()=>{
      restores++;
      assert.equal(record.pendingNativeMove,null);
      return true;
    };
    assert.equal(await nav.recoverSavedJourneyWithNativeReview(),true);
    assert.equal(writes,1);
    assert.equal(restores,1);
    assert.deepEqual(record.legs,before.legs,"Do not credit pending travel");
    assert.deepEqual(record.destination,before.destination);
    assert.deepEqual(record.lastConfirmedAnchor,before.lastConfirmedAnchor);
    assert.equal(game.time.worldTime,28978218042);
    assert.equal(await nav.recoverSavedJourneyWithNativeReview(),true);
    assert.equal(writes,1,"A repeated recovery cannot clear or credit the intent again");
  }finally{Object.assign(globalThis,previous);}
});

test("bounded vessel recovery credits only its verified delta and retries a failed Journal write without duplicating time",async()=>{
  const previous={game:globalThis.game,ui:globalThis.ui};
  try{
    const op="bounded-voyage-01";
    const scene={id:"bounded-scene",name:"Paedor",grid:{size:100,units:"mi"},
      canUserModify:()=>true};
    const atlas={revision:4,roads:[],nodes:[],segments:[],checkpoints:[]};
    const token={id:"party",x:50,y:0,width:1,height:1,elevation:0,
      level:"surface",canUserModify:()=>true,
      movement:{id:op,state:"completed",origin:point(0,0),destination:point(50,0),
        constrained:false,passed:{waypoints:[point(50,0)]},pending:{waypoints:[]}},
      move(){throw Error("Recovery must not move the token");}};
    const route={status:"ok",start:point(50,50),end:point(150,50),
      distance:8,cost:8,terrainAware:false,legs:[{kind:"road",
        roadId:"sea",segmentId:"s",points:[point(50,50),point(150,50)],distance:8,cost:8}]};
    const itinerary={...createNavigationItinerary({sceneId:scene.id,
      sceneName:scene.name,sceneUnits:"mi",route,travel:{speed:2}}),
      transport:{methodId:"ship-passage",methodName:"Ship passage (hired)",
        arrangement:"hire",kind:"vehicle",surface:"water",departureCheckpointName:null,
        arrivalCheckpointId:"port",arrivalCheckpointName:"Port",roadNames:["Sea"],
        estimatedFareCp:10,operation:"continuous"}};
    const anchor={point:point(50,50),roadId:"sea",segmentId:"s",
      checkpointId:null,levelId:"surface",elevation:0};
    let record=createJourneyRecord({sceneId:scene.id,tokenId:token.id,
      atlasRevision:4,itinerary,journeyDestination:point(400,50),initialAnchor:anchor,
      approvedPath:{schemaVersion:1,legs:route.legs}});
    record.status="interrupted";
    record.pendingNativeMove={schemaVersion:1,bounded:true,previousMovementId:null,
      operationId:op,tokenId:token.id,checkpointIndex:0,from:point(0,0),to:point(50,0),
      path:[point(0,0),point(50,0)],completedPercent:50,nativeDistance:50,
      movingHours:2,worldTimeBefore:1000,worldAdvanceSeconds:7200,atlasRevision:4};
    let advances=0,writes=0,restores=0,failWrite="receipt";
    globalThis.game={user:{id:"gm",isGM:true},users:{activeGM:{id:"gm"}},
      settings:{get:()=>true},time:{worldTime:1000,async advance(delta){
        advances++;this.worldTime+=delta;
      }}};
    const journal={id:"bounded-journal",canUserModify:()=>true,
      getFlag:()=>structuredClone(record)};
    const nav=new AtlasNavigationController({canvasProvider:()=>({ready:true,scene}),
      atlasProvider:()=>atlas,partyTokenProvider:()=>token,atlasPoint:(_v,_a,p)=>p,
      journeyJournalStore:{save:async next=>{
        writes++;
        if(failWrite==="receipt"&&next.pendingNativeMove?.arrivalEvidence||
            failWrite==="confirmation"&&!next.pendingNativeMove)
          throw Error("Journal temporarily unavailable");
        record=structuredClone(next);
      }}});
    nav.scene=scene;nav.recoverableJourney=journal;
    nav.recoverSavedJourney=()=>{restores++;return true;};
    record.legs[0].transport.operation="normal";
    assert.equal(nav.boundedNativeArrival(record)?.clockAction,"advance",
      "normal operated transport with a verified bounded ID and path is recoverable");
    record.legs[0].transport.operation="continuous";
    assert.equal(nav.boundedNativeArrival(record)?.clockAction,"advance");
    token.movement.origin=point(4,0);
    let reason;
    assert.equal(nav.boundedNativeArrival(record,value=>{reason=value;}),null);
    assert.match(reason,/ordered path/);
    token.movement.origin=point(0,0);
    await assert.rejects(nav.recoverSavedJourneyWithNativeReview(),/Journal temporarily unavailable/);
    assert.equal(advances,0,"a failed durable evidence write must not advance the clock");
    assert.equal(game.time.worldTime,1000);
    failWrite="confirmation";
    await assert.rejects(nav.recoverSavedJourneyWithNativeReview(),/Journal temporarily unavailable/);
    assert.equal(advances,1);assert.ok(record.pendingNativeMove?.arrivalEvidence);
    assert.equal(game.time.worldTime,8200);
    // Simulate the browser reload that removes the public last-movement ID.
    token.movement={id:"",state:"completed"};
    failWrite=false;
    assert.equal(nav.boundedNativeArrival(record)?.clockAction,"already-advanced");
    assert.equal(await nav.recoverSavedJourneyWithNativeReview(),true);
    assert.equal(advances,1);assert.equal(writes,4);assert.equal(restores,1);
    assert.equal(record.pendingNativeMove,null);
    await nav.recoverSavedJourneyWithNativeReview();
    assert.equal(advances,1,"repeating recovery cannot credit the same interval");
    assert.equal(record.legs[0].completedPercent,50);
    assert.equal(record.legs[0].completedMovingHours,2);
    assert.equal(record.legs[0].worldTravelSeconds,7200);
    assert.deepEqual(record.destination,point(400,50));
    assert.deepEqual(record.lastConfirmedAnchor.point,point(100,50));
  }finally{Object.assign(globalThis,previous);}
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
    nav.result=route;
    nav.retainInterruptedJourney({sceneId:scene.id,journal,journeyRecord:record});
    assert.equal(nav.recoverableJourney,journal);
    assert.equal(nav.canDraftTravelMethods(),false);
    await assert.rejects(nav.startGuidedTravel(),/Recover or deliberately end/);
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
    assert.ok(find(panel,node=>node.textContent==="Review Saved Journey"));
    assert.ok(labels.some(label=>label.startsWith("Recovery blocked: ")));
    const inspect=find(panel,node=>node.textContent==="Open Saved Journey Journal");
    assert.ok(inspect);
    // Review is read-only; the same Journal remains inspectable via the footer.
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
    assert.equal(nodes.find(node=>node.id==="atlas-navigation-travel-method"),undefined,
      "approved method is no longer repeated as a disabled dropdown in the GM Journey view");
    assert.ok(nodes.some(node=>node.textContent==="Journey Speed"),
      "the active Journey offers a separate speed tab");
    assert.ok(nodes.some(node=>node.textContent?.startsWith?.(
      "Journey in progress to selected destination")),
      "unnamed map destinations use a neutral heading");
    assert.equal(nodes.some(node=>node.textContent?.includes?.(
      "Speed: Ship passage (hired) (approved hire Journey leg)")),false,
      "verbose saved speed detail was intentionally removed from the GM Journey tab");
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
    assert.equal(all(mounted).some(node=>node.textContent?.includes?.(
      "Speed: Riding Horse (approved owned Journey leg)")),false,
      "mount recovery retains saved method authority without redundant GM copy");
    assert.equal(nav.travelSession.journeyRecord.legs[0].travelMethod.id,"riding-horse");
  }finally{Object.assign(globalThis,previous);}
});

test("checkpoint-hired Cart follows a land-only road with explicit GM confirmation and no automatic fare",async()=>{
  const previous={game:globalThis.game,foundry:globalThis.foundry,
    document:globalThis.document,PIXI:globalThis.PIXI};
  let nav;
  try{
    let offers=[{methodId:"cart",mode:"land",overrides:{hireEnabled:true,
      hireCostCp:250,hireBasis:"day",hireApplies:"unit",
      continuousEnabled:true}}];
    const writes=[],dialogTitles=[];
    let approve=false;
    globalThis.game={user:{id:"gm",isGM:true},system:{id:"dnd5e"},
      settings:{get:()=>undefined}};
    globalThis.PIXI=undefined;
    globalThis.document={createElement:tag=>({tag,style:{},textContent:""})};
    globalThis.foundry={applications:{api:{DialogV2:{confirm:async options=>{
      dialogTitles.push(options.window.title);return approve;
    }}}}};
    const token={id:"party",x:-50,y:-50,width:1,height:1,actor:null,
      moves:0,canUserModify:()=>true,
      async move(waypoints){this.moves++;Object.assign(this,waypoints.at(-1));return true;}};
    const scene={id:"port-scene",name:"Paedor",grid:{size:100,units:"mi"},
      canUserModify:()=>true,
      getFlag:(_module,key)=>key==="checkpointTransportOffers"?{
        schemaVersion:1,entries:{port:offers}}:null};
    const atlas={revision:7,nodes:[{id:"p",x:0,y:0},{id:"g",x:300,y:0}],
      roads:[{id:"land",name:"Dirwest-Port Barthos"}],
      segments:[{id:"segment",roadId:"land",from:"p",to:"g",via:[]}],
      checkpoints:[{id:"port",name:"Port Barthos",nodeId:"p",roadId:"land"}]};
    const view={ready:true,scene};
    const route={status:"ok",start:point(0,0),end:point(300,0),
      distance:6,cost:6,terrainAware:false,legs:[{kind:"road",roadId:"land",
        segmentId:"segment",points:[point(0,0),point(300,0)],distance:6,cost:6}]};
    nav=new AtlasNavigationController({canvasProvider:()=>view,
      atlasProvider:()=>atlas,partyTokenProvider:()=>token,
      atlasPoint:(_view,_atlas,location)=>location,
      journeyJournalStore:{find:()=>null,save:async record=>{
        writes.push(structuredClone(record));return {id:"cart-journey"};}}});
    nav.scene=scene;nav.sourceMode="party";nav.routeRevision=7;
    nav.start=route.start;nav.end=route.end;nav.result=route;
    nav.travelMethod="cart";nav.transportArrangement="hire";
    nav.render=async()=>{};nav.draw=()=>{};
    nav.itinerary=createNavigationItinerary({sceneId:scene.id,sceneName:scene.name,
      sceneUnits:"mi",atlasRevision:7,route,travel:{speed:3}});
    // Port Barthos is also the arrival after a previously completed hired
    // ship checkpoint leg. Approving the Cart must append a new land leg to
    // that Journal, not demand another authored checkpoint at South-East Gate.
    const priorItinerary=createNavigationItinerary({sceneId:scene.id,
      sceneName:scene.name,sceneUnits:"mi",atlasRevision:7,route,
      travel:{speed:2}});
    priorItinerary.transport={methodId:"ship-passage",methodName:"Ship passage (hired)",
      kind:"vehicle",arrangement:"hire",surface:"water",
      departureCheckpointName:"Hearth's Heart Dock",arrivalCheckpointId:"port",
      arrivalCheckpointName:"Port Barthos",roadNames:["Coastal Passage"],
      estimatedFareCp:500,operation:"continuous"};
    const previousRecord=createJourneyRecord({sceneId:scene.id,tokenId:token.id,
      atlasRevision:7,itinerary:priorItinerary});
    previousRecord.status="paused";
    previousRecord.legs[0].completedPercent=100;
    previousRecord.legs[0].completedMovingHours=previousRecord.legs[0].movingHours;
    nav.recoveryRecord=previousRecord;
    nav.recoveryJournal={id:"prior-voyage"};
    assert.equal(nav.transportAvailability().owned.has("cart"),false);
    assert.equal(nav.transportAvailability().offers.get("cart").checkpointId,"port");
    assert.equal(nav.assessTravelMethod().guided,true,
      "a checkpoint-offered Cart is eligible even without a party-owned Cart");
    assert.equal(nav.transportOperation,"normal",
      "the unapproved default contains no separate continuous choice");
    assert.equal(nav.resolveTravelRules({methodId:"cart"}).dailyHours,null,
      "the effective offered Cart automatically determines the continuous plan");
    assert.equal(await nav.startGuidedTravel(),false,
      "declining the explicit GM hire leaves the Journey unchanged");
    assert.equal(token.moves,0);assert.equal(writes.length,0);
    // Even after the GM clicks Confirm, the same full native Group must still
    // be selected; a concurrent change to the draft must not launch movement.
    const originalPartySelection=nav.partyTravelSelection;
    const demoRoster={travelers:2,members:[
      {actorId:"a",actorName:"Alba",actorType:"character",role:"passenger"},
      {actorId:"b",actorName:"Kori",actorType:"character",role:"passenger"}]};
    nav.partyTravelSelection=()=>({roster:demoRoster,members:[
      {id:"a",name:"Alba",type:"character",seats:1},
      {id:"b",name:"Kori",type:"character",seats:1}],
      selectedIds:nav.partySelectionMode==="selected"?["a"]:["a","b"],
      empty:false,partial:nav.partySelectionMode==="selected"});
    globalThis.foundry.applications.api.DialogV2.confirm=async()=>{
      nav.partySelectionMode="selected";return true;};
    await assert.rejects(()=>nav.startGuidedTravel(),/participation changed|selection changed/,
      "late selection changes must fail before native move or Journal writes");
    assert.equal(token.moves,0);assert.equal(writes.length,0);
    nav.partySelectionMode="all";nav.partyTravelSelection=originalPartySelection;
    globalThis.foundry.applications.api.DialogV2.confirm=async options=>{
      dialogTitles.push(options.window.title);return true;};
    approve=true;
    assert.equal(await nav.startGuidedTravel(),true);
    assert.ok(token.moves>0,"a native TokenDocument move completes the Cart journey");
    assert.deepEqual(dialogTitles,["Confirm land travel","Confirm land travel"]);
    assert.equal(writes.at(-1).status,"completed");
    assert.equal(writes.at(-1).legs.length,2);
    assert.deepEqual(writes.at(-1).legs[1].approvedPath.legs.map(leg=>({
      roadId:leg.roadId,segmentId:leg.segmentId})),[
      {roadId:"land",segmentId:"segment"}],
    "every newly approved continuation leg persists its exact Road identity");
    assert.equal(writes.at(-1).legs[0].transport.methodId,"ship-passage");
    assert.deepEqual(writes.at(-1).legs[1].travelMethod,{
      id:"cart",name:"Cart",arrangement:"hire",operation:"continuous"});
    assert.equal(writes.at(-1).legs[1].speedPerHour,3);
    assert.equal(writes.at(-1).legs[1].worldTravelSeconds,0,
      "without the World-clock setting the Cart cannot advance time");
    assert.equal(nav.completedRoute,true);
    assert.equal(scene.setFlag,undefined,"no Scene offer is written or charged");
    // Another World/custom method is not licensed merely because the road is land.
    nav.recoveryRecord=null;nav.completedRoute=false;nav.transportArrangement="hire";
    offers=[];
    assert.equal(nav.assessTravelMethod().guided,false);
    assert.match(nav.assessTravelMethod().reason,/no longer offered/);
  }finally{nav?.stop();Object.assign(globalThis,previous);}
});

test("a changed hired Cart offer during GM confirmation never starts a Journey",async()=>{
  const previous={game:globalThis.game,foundry:globalThis.foundry,
    document:globalThis.document};
  try{
    let hireCostCp=250,moves=0,saves=0;
    globalThis.game={user:{id:"gm",isGM:true},system:{id:"dnd5e"},
      settings:{get:()=>undefined}};
    globalThis.document={createElement:tag=>({tag,textContent:""})};
    globalThis.foundry={applications:{api:{DialogV2:{confirm:async()=>{
      hireCostCp=500;return true;
    }}}}};
    const token={id:"party",x:-50,y:-50,width:1,height:1,
      canUserModify:()=>true,move(){moves++;return true;}};
    const scene={id:"port-scene",grid:{size:100,units:"mi"},
      canUserModify:()=>true,getFlag:(_module,key)=>key==="checkpointTransportOffers"?{
        schemaVersion:1,entries:{port:[{methodId:"cart",mode:"land",overrides:{
          hireEnabled:true,hireCostCp,hireBasis:"day",hireApplies:"unit"}}]}}:null};
    const atlas={revision:7,nodes:[{id:"p",x:0,y:0},{id:"g",x:300,y:0}],
      roads:[{id:"land",name:"Road"}],segments:[],
      checkpoints:[{id:"port",name:"Port Barthos",nodeId:"p",roadId:"land"}]};
    const route={status:"ok",start:point(0,0),end:point(300,0),
      distance:6,cost:6,terrainAware:false,legs:[{
        kind:"road",roadId:"land",points:[point(0,0),point(300,0)],
        distance:6,cost:6}]};
    const nav=new AtlasNavigationController({canvasProvider:()=>({ready:true,scene}),
      atlasProvider:()=>atlas,partyTokenProvider:()=>token,
      atlasPoint:(_view,_atlas,p)=>p,
      journeyJournalStore:{find:()=>null,save:async()=>{saves++;}}});
    nav.scene=scene;nav.sourceMode="party";nav.routeRevision=7;
    nav.start=route.start;nav.end=route.end;nav.result=route;
    nav.travelMethod="cart";nav.transportArrangement="hire";
    nav.render=async()=>{};nav.draw=()=>{};
    await assert.rejects(nav.startGuidedTravel(),/terms changed during confirmation/);
    assert.equal(moves,0);assert.equal(saves,0);
  }finally{Object.assign(globalThis,previous);}
});

test("a partially completed hired Cart leg remains hired and locked on recovery",async()=>{
  const previous={game:globalThis.game,document:globalThis.document};
  try{
    globalThis.game={user:{id:"gm",isGM:true},system:{id:"dnd5e"},
      settings:{get:()=>undefined}};
    const dom=(tag)=>({tag,style:{},children:[],listeners:new Map(),
      append(...nodes){this.children.push(...nodes);},
      appendChild(node){this.children.push(node);},
      addEventListener(event,cb){this.listeners.set(event,cb);},
      setAttribute(){}});
    globalThis.document={createElement:dom};
    const scene={id:"port-scene",name:"Paedor",grid:{size:100,units:"mi"},
      canUserModify:()=>true,getFlag:()=>null};
    const atlas={revision:7,nodes:[{id:"p",x:0,y:0},{id:"g",x:300,y:0}],
      roads:[{id:"land",name:"Road"}],segments:[],checkpoints:[]};
    const token={id:"party",x:100,y:-50,width:1,height:1};
    const route={status:"ok",start:point(150,0),end:point(300,0),
      distance:3,cost:3,terrainAware:false,legs:[{
        kind:"road",roadId:"land",segmentId:"segment",
        points:[point(150,0),point(300,0)],
        distance:3,cost:3}]};
    const nav=new AtlasNavigationController({canvasProvider:()=>({ready:true,scene}),
      atlasProvider:()=>atlas,partyTokenProvider:()=>token,
      atlasPoint:(_view,_atlas,p)=>p});
    nav.scene=scene;nav.sourceMode="party";nav.routeRevision=7;
    nav.start=route.start;nav.end=route.end;nav.result=route;
    nav.travelMethod="cart";nav.transportArrangement="hire";
    const itinerary=createNavigationItinerary({sceneId:scene.id,sceneName:scene.name,
      sceneUnits:"mi",atlasRevision:7,route,travel:{speed:3,
        methodId:"cart",methodName:"Cart",arrangement:"hire",operation:"normal"}});
    // Native Journey creation captures the GM-approved arrangement separately
    // from the read-only itinerary's speed and method identifier.
    itinerary.travel={...itinerary.travel,methodName:"Cart",arrangement:"hire",
      operation:"normal"};
    const record=createJourneyRecord({sceneId:scene.id,tokenId:token.id,
      atlasRevision:7,itinerary});
    record.legs[0].completedPercent=50;
    record.legs[0].completedMovingHours=.5;
    nav.recoveryRecord=record;
    assert.equal(nav.transportAvailability().offers.has("cart"),false,
      "the token is no longer at the original hiring checkpoint");
    assert.equal(nav.assessTravelMethod().guided,true,
      "the previously approved hired Cart survives moving away from the checkpoint: "+
        nav.assessTravelMethod().reason);
    const view=await nav._renderHTML();
    const find=(node,predicate)=>predicate(node)?node:
      node.children?.map(child=>find(child,predicate)).find(Boolean);
    const select=find(view,item=>item.tag==="select"&&
      item.id==="atlas-navigation-travel-method");
    assert.equal(select?.value,"hire|cart");
    assert.equal(select?.disabled,true,"recovery cannot change an approved hire to owned");
    nav.transportArrangement="owned";
    assert.equal(nav.assessTravelMethod().guided,false);
    assert.match(nav.assessTravelMethod().reason,/approved land method and arrangement/);
  }finally{Object.assign(globalThis,previous);}
});

test("GM guided travel pauses and ends at native chunk boundaries with honest progress",async()=>{
  const previous={game:globalThis.game,window:globalThis.window,PIXI:globalThis.PIXI,
    ui:globalThis.ui,document:globalThis.document};
  let nav;
  try{
    globalThis.game={user:{isGM:true,id:"gm-1"},users:{activeGM:{id:"gm-1"}},
      settings:{get:(_module,key)=>
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
    const firstVisualSpeed=calls[0].options.animation.movementSpeed;
    assert.equal(nav.setLiveJourneyPlaybackSpeed(20),true,
      "values above 8s/hour must be accepted during an active Journey");
    assert.equal(nav.travelSession.playbackSecondsPerHour,20);
    assert.equal(calls[0].options.animation.movementSpeed,firstVisualSpeed,
      "the current native movement cannot be retimed mid-flight");
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
    assert.ok(calls[1].options.animation.movementSpeed<firstVisualSpeed,
      "the next native movement must actually honor a slower 20s/hour visual setting");
    assert.equal(calls[1].options.constrainOptions,undefined,
      "visual retiming never disables native movement constraints");
    assert.equal(nav.stopGuidedTravel(),true);
    assert.equal(nav.travelSession.phase,"ending");
    resolveTravel(true);
    assert.equal(await pending,false);
    assert.equal(nav.travelSession,null);
    assert.match(nav.travelNotice,/Journey ended/);
    assert.ok(nav.travelProgress>0&&nav.travelProgress<100);
    assert.equal(nav.completedRoute,false,"ending early must not lock future travel");

    // A stopped native operation must NOT be silently discarded. Only a
    // separate, explicitly planned test Journey may clear this synthetic
    // fixture's pending record; production requires GM New Route approval.
    await assert.rejects(nav.startGuidedTravel(),/Recover or deliberately end/);
    nav.recoverableJourney=null;nav.recoveryRecord=null;
    nav.recoveryJournal=null;nav.journeyJournal=null;
    // A complete new Journey progresses through its chunks and reaches 100%.
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

    // An unconfirmed native interval still blocks replay. The next
    // independent fixture scenario is a GM-simulated New Route choice.
    await assert.rejects(nav.startGuidedTravel(),/Recover or deliberately end/);
    nav.recoverableJourney=null;nav.recoveryRecord=null;
    nav.recoveryJournal=null;nav.journeyJournal=null;
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
      time:{worldTime:0,async advance(amount){
        if(failClock)throw Error("Clock is unavailable");
        seconds.push(amount);this.worldTime+=amount;return this.worldTime;
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
      // Independent test scenarios: discard the synthetic fixture Journal
      // only here. Production New Route requires explicit GM abandonment.
      nav.recoverableJourney=null;
      nav.recoveryRecord=null;nav.recoveryJournal=null;
      nav.journeyJournal=null;
      nav.routeCalculator=()=>preview;
      nav.calculateRoute(view,atlas);
    };

    const find=(node,match)=>match(node)?node:
      node.children.map(child=>find(child,match)).find(Boolean);
    const prepared=await nav._renderHTML();
    const checkboxes=[];
    const collect=node=>{
      if(node.tag==="input"&&node.type==="checkbox")checkboxes.push(node);
      for(const child of node.children)collect(child);
    };
    collect(prepared);
    assert.ok(checkboxes.length>0,"travel methods now use explicit checkboxes");
    assert.ok(checkboxes.every(input=>input.name==="atlas-navigation-travel-method"),
      "only method selections are checkboxes; there is no per-journey clock override");
    assert.equal(find(prepared,node=>node.textContent?.startsWith?.(
      "Foundry World time advances for confirmed movement")),undefined,
      "redundant World-time note is removed from the GM planning view; actual clock logic is unchanged");
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
    await tickUntil(()=>typeof completeMovement==="function");
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
    assert.match(nav.travelNotice,/Native ordinary movement could not be reconciled: Clock is unavailable/);
    assert.ok(nav.recoverableJourney,"same-canvas interruption retains the Journal");
    await assert.rejects(nav.startGuidedTravel(),/Recover or deliberately end/);
    assert.equal(moveCount,previousMoves+1,"unresolved Journey cannot start another move");

    // Unexpected errors inside an active movement should be visible in the
    // Navigation window rather than silently dropping the in-flight session.
    failClock=false;failMovement=true;
    token.x=50;token.y=50;
    newRoute();
    assert.equal(await nav.startGuidedTravel(),false,
      "a failed native move cannot report a completed Journey");
    assert.match(nav.travelNotice,/Native ordinary movement could not be reconciled: Native animation failed/);
    assert.equal(nav.travelSession,null);
    assert.ok(nav.recoverableJourney,"unexpected exception also retains the Journal");

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
    assert.match(nav.travelNotice,/native TokenDocument missed its approved checkpoint/);
    assert.equal(seconds.reduce((a,b)=>a+b,0),beforeMismatch);

    // Eight-hour travel-day estimates must never be mistaken for 24-hour
    // calendar days when the World clock advances only active movement time.
    nav.resolveTravel=()=>({sceneUnit:"km",travel:{speed:6.38,hoursPerDay:8,
      source:"party",actorName:"The Party",pace:"fast"}});
    game.system={id:"dnd5e"};
    nav.result={...nav.result,cost:110.44,distance:93.85,terrainAware:true};
    const durationPanel=await nav._renderHTML();
    assert.ok(find(durationPanel,node=>node.tag==="strong"&&node.textContent==="17h 19m"));
    assert.ok(find(durationPanel,node=>node.tag==="strong"&&node.textContent==="1d 9h 19m"),
      "the primary third card estimates two 8h Long Rests rather than automatically applying them");
    assert.ok(find(durationPanel,node=>node.tag==="small"&&
      node.textContent==="With 16h overnight stops: 2d 1h 19m"),
      "the World-rule 16h overnight projection remains a smaller reference");
    const travelDays=find(durationPanel,node=>node.textContent?.startsWith?.("Plan:"));
    assert.match(travelDays.textContent,/8h travel\/day.*2 overnight stops/);
  }finally{nav?.stop();Object.assign(globalThis,previous);}
});

test("mixed land method overrides are per-method and remain preview-only",()=>{
  const gameBefore=globalThis.game;
  try{
    globalThis.game={user:{isGM:true}};
    const nav=new AtlasNavigationController();
    const worldMethod={id:"carriage",name:"Carriage",surface:"land",kind:"vehicle",
      hireEnabled:true,hireCostCp:400,continuousEnabled:false};
    const walking={id:"walking",name:"Walking",surface:"land",kind:"foot"};
    nav.mixedKeys=["owned|walking","hire|carriage"];
    nav.mixedMethodOverrides={"hire|carriage":{hireCostCp:900,continuousEnabled:true}};
    const offer={methodId:"carriage",mode:"land",checkpointId:"port",
      overrides:{hireEnabled:true,hireCostCp:400}};
    const availability={methods:[walking,worldMethod],
      offers:new Map([["carriage",offer]]),owned:new Set()};
    const choices=nav.mixedLandChoices(availability);
    assert.equal(choices[1].method.hireCostCp,900);
    assert.equal(choices[1].method.continuousEnabled,true);
    assert.equal(choices[0].method.id,"walking");
    assert.equal(worldMethod.hireCostCp,400);
    assert.equal(offer.overrides.hireCostCp,400,
      "previewing an edited trip must not change Map Marker stock or rates");
  }finally{globalThis.game=gameBefore;}
});

test("mixed carriage pencil opens the shared journey and Map Marker editor without saving",async()=>{
  const previous={game:globalThis.game,foundry:globalThis.foundry,
    document:globalThis.document};
  const writes=[],dialogs=[];let response=null;
  class Node {
    constructor(tag){this.tagName=tag.toUpperCase();this.children=[];
      this.style={cssText:""};this.attributes=new Map();
      this.value="";this.defaultValue="";this.checked=false;}
    appendChild(item){this.children.push(item);return item;}
    append(...items){this.children.push(...items);}
    setAttribute(key,value){this.attributes.set(key,String(value));}
    addEventListener(){}
  }
  try{
    globalThis.document={createElement:tag=>new Node(tag)};
    globalThis.foundry={applications:{api:{DialogV2:{
      input:async data=>{dialogs.push(data);return response;}
    }}}};
    globalThis.game={system:{id:"dnd5e"},user:{id:"gm",isGM:true},
      settings:{get:()=>undefined,set:async()=>writes.push("world")}};
    const carriage=findTransportationPreset("carriage",game.settings,"dnd5e");
    const offer={methodId:"carriage",mode:"land",
      overrides:{hireEnabled:true,hireCostCp:400,continuousEnabled:true},
      checkpointId:"port",checkpointName:"Dirwest"};
    const nav=new AtlasNavigationController({
      atlasProvider:()=>({revision:7})});
    nav.scene={id:"scene",canUserModify:()=>true,getFlag:(_module,key)=>
      key==="checkpointTransportOffers"?
        {schemaVersion:1,entries:{port:[{
          methodId:offer.methodId,mode:offer.mode,overrides:offer.overrides
        }]}}:undefined,
      setFlag:async()=>writes.push("scene")};
    nav.mixedKeys=["owned|walking","hire|carriage"];
    nav.transportAvailability=()=>({all:[carriage],methods:[{id:"walking",name:"Walking",surface:"land",kind:"foot"},carriage],
      offers:new Map([["carriage",offer]]),owned:new Set()});
    nav.canDraftTravelMethods=()=>true;
    nav.render=async()=>{};
    await nav.editMixedTravelMethod("hire|carriage");
    assert.equal(dialogs.length,1);
    assert.equal(dialogs[0].ok.label,"Save for this trip");
    assert.ok(dialogs[0].buttons.some(button=>/Save to Dirwest/.test(button.label)));
    assert.match(dialogs[0].window.title,/Edit Carriage/);
    assert.deepEqual(writes,[],"opening or cancelling cannot write World or Map Marker");
    assert.deepEqual(nav.mixedKeys,["owned|walking","hire|carriage"]);
    const flatten=n=>[n,...(n.children??[]).flatMap(flatten)];
    const select=flatten(dialogs[0].content).find(n=>n.name==="atlasJourneyServiceLevel");
    assert.ok(select,"mixed hire editor exposes service selection");
    response={name:carriage.name,kind:carriage.kind,speedDisplay:carriage.speedMph,
      capacity:carriage.capacity,crewCount:carriage.crewCount??0,costBasis:"none",costApplies:"unit",
      crewWageBasis:"day",hireBasis:"day",hireApplies:"unit",hire_gp:"4",
      hireEnabled:true,hireUnlimited:true,hireQuantity:1,continuousEnabled:true,
      overtimeExtraHours:8,overtimeMultiplier:1.5,atlasJourneyServiceLevel:"full"};
    await nav.editMixedTravelMethod("hire|carriage");
    assert.equal(nav.mixedLandChoices()[1].serviceLevel,"full");
    assert.equal(nav.mixedLandChoices()[0].serviceLevel,undefined);
    assert.deepEqual(writes,[],"tier applies to Journey draft only");
    assert.equal(offer.overrides.serviceLevel,undefined);
    globalThis.game.user.isGM=false;
    await assert.rejects(nav.editMixedTravelMethod("hire|carriage"),/authorized GM/);
    assert.equal(dialogs.length,2,"a non-GM cannot open the editing workflow");
  }finally{Object.assign(globalThis,previous);}
});


test("single hired Cart uses active Map Marker schedule for approval, not World defaults",()=>{
  const previous=globalThis.game;
  try{
    globalThis.game={user:{isGM:true},system:{id:"dnd5e"},
      settings:{get:()=>undefined}};
    const nav=new AtlasNavigationController();
    nav.travelMethod="cart";nav.transportArrangement="hire";
    nav.transportOperation="normal";
    const world=findTransportationPreset("cart",game.settings,"dnd5e");
    assert.notEqual(world.continuousEnabled,true);
    const offer={methodId:"cart",mode:"land",checkpointId:"port",overrides:{
      hireEnabled:true,continuousEnabled:true}};
    const availability={methods:[world],offers:new Map([["cart",offer]])};
    nav.transportAvailability=()=>availability;
    const preview=nav.resolveTravelRules({methodId:"cart",hoursPerDay:8});
    assert.equal(preview.dailyHours,null,
      "read-only estimates must use the Map Marker schedule without downgrading it");
    assert.equal(nav.transportOperation,"normal",
      "read-only preview must not mutate an implicit mode into a new trip decision");
    const approved=nav.resolveCurrentLegRules({methodId:"cart",hoursPerDay:8});
    assert.equal(approved.dailyHours,null,
      "the 24-hour schedule cannot silently become an 8-hour rest decision");
    assert.equal(approved.overnightHours,0);
    const tracker=new GuidedTravelDayTracker({travelHours:12,rules:approved});
    tracker.recordMovement(8);
    assert.equal(tracker.needsDecision,false,
      "a genuinely approved continuous Cart must not ask for a Long Rest at 8h");
    tracker.recordMovement(4);
    assert.equal(tracker.completedHours,12);
    assert.equal(tracker.breakHours,0);
    offer.overrides.continuousEnabled=false;
    assert.equal(nav.resolveCurrentLegRules({methodId:"cart",hoursPerDay:8})
      .dailyHours,8,"removing an unapproved capability returns to standard planning");
    nav.transportOperation="continuous";
    assert.throws(()=>nav.resolveCurrentLegRules({methodId:"cart",hoursPerDay:8}),
      /Continuous operation/,
      "if a saved or selected capability disappears, fail closed before movement");
  }finally{globalThis.game=previous;}
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
    const carriage=findTransportationPreset("carriage",globalThis.game.settings,"dnd5e");
    catalog=setTransportationPreset(catalog,"dnd5e2024",
      {...carriage,continuousEnabled:true});
    const rolling=nav.resolveTravelRules({methodId:"carriage"},null,"continuous");
    assert.equal(rolling.dailyHours,null,
      "a GM-enabled carriage may rotate drivers under the same rules as a ship");
    assert.equal(rolling.overnightHours,0);
    assert.throws(()=>nav.resolveTravelRules({methodId:"carriage"},
      {...carriage,continuousEnabled:false},"continuous"),/Continuous/,
    "an approved operating schedule cannot silently revert to standard");
    catalog=setTransportationPreset(catalog,"dnd5e2024",
      {...carriage,continuousEnabled:false});
    nav.recoveryRecord={status:"interrupted",legs:[{
      completedPercent:25,travelMethod:{id:"carriage",operation:"continuous"}
    }]};
    nav.transportOperation="continuous";
    assert.throws(()=>nav.resolveTravelRules({methodId:"carriage"}),
      /Continuous/,"a resumed land Journey cannot downgrade an approved operation");
    nav.recoveryRecord=null;
    nav.transportOperation="continuous";
    assert.equal(nav.resolveTravelRules({methodId:"carriage"},undefined,undefined).dailyHours,8,
      "an unapproved stale UI choice may safely return to normal");
    assert.equal(nav.transportOperation,"normal");
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
    assert.equal(logs.filter(row=>row.legs[0].completedPercent>=99.999)
      .every(row=>row.status==="paused"),true,
    "the last confirmed land chunk must commit its checkpoint target together " +
      "with its 100% Journal progress before any redraw can interrupt the finalizer");
    assert.equal(nav.travelSession,null);
    assert.equal(nav.result,null,"full future route is not active after arrival");
  }finally{Object.assign(globalThis,previous);}
});

test("mixed land planner uses only the first checkpoint leg and commits the assigned convoy",async()=>{
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
    const owned=setGroupTransportationMember(defaultGroupTransportation(),"group1","horse",{
      role:"mount",quantity:1,capacity:1,surface:"land",profileId:"riding-horse"});
    globalThis.game={user:{id:"gm",isGM:true},users:{activeGM:{id:"gm"}},
      system:{id:"dnd5e"},settings:{get:(_module,key)=>
        key==="guidedGroupTransportation"?owned:
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
      actor:{id:"group1",name:"Party",type:"group",system:{members:[
        {actor:{id:"pc1",name:"Walker",type:"character"}},
        {actor:{id:"pc2",name:"Rider",type:"character"}},
        {actor:{id:"horse",name:"Horse",type:"npc"}}
      ]}},
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
      if(!nav.travelSession)return;
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
    assert.ok(nav.transportAvailability().methods.some(m=>m.id==="riding-horse"));
    nav.toggleTravelMethodChoice("owned|riding-horse",true);
    nav.mixedAssignments={pc1:"owned|walking",pc2:"owned|riding-horse"};
    assert.deepEqual(nav.mixedKeys,["owned|walking","owned|riding-horse"]);
    const plan=nav.transportationTransitionPlan();
    assert.equal(plan.legs.length,2);
    assert.equal(plan.legs[0].selectedOption.method.kind,"mixed");
    assert.equal(plan.legs[0].convoy.movingHours,10/3);
    assert.equal(plan.legs[0].convoy.totalCp,5);
    assert.equal(plan.legs[1].selectedOption,null);
    assert.equal(logs.length,0);
    assert.equal(nativeMoves,0);
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
    assert.equal(logs.at(-1).legs[0].transport.kind,"mixed");
    assert.equal(logs.at(-1).legs[0].transport.estimatedFareCp,null);
    assert.deepEqual(logs.at(-1).legs[0].convoy,plan.legs[0].convoy);
    assert.equal(logs.at(-1).routeTargets.targets[1].approvedTransport.arrangement,"mixed");
    assert.equal(logs.at(-1).routeTargets.nextTargetIndex,2);
    assert.equal(logs.filter(row=>row.legs[0].completedPercent>=99.999)
      .every(row=>row.status==="paused"),true,
    "the last confirmed land chunk must commit its checkpoint target together " +
      "with its 100% Journal progress before any redraw can interrupt the finalizer");
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

test("saved B to C all-water route uses current-leg tiles rather than the old menu",async()=>{
  const previous={game:globalThis.game,document:globalThis.document,
    window:globalThis.window,ui:globalThis.ui};
  try{
    globalThis.window={innerWidth:1300,innerHeight:900};
    globalThis.ui={notifications:{error(){},warn(){}}};
    globalThis.document={createElement:tag=>({tag,style:{},children:[],textContent:"",
      listeners:new Map(),append(...nodes){this.children.push(...nodes);},
      appendChild(node){this.children.push(node);},
      addEventListener(name,handler){this.listeners.set(name,handler);},
      setAttribute(name,value){if(name==="aria-label")this.ariaLabel=value;}})};
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
    const groupRoster={travelers:2,members:[
      {actorId:"cass",actorName:"Cassian",actorType:"character",
        role:"passenger",quantity:1,needsSeat:true},
      {actorId:"luc",actorName:"Lucious",actorType:"character",
        role:"passenger",quantity:1,needsSeat:true}
    ]};
    nav.partyTravelSelection=()=>({roster:groupRoster,
      ...projectPartyTravelSelection(groupRoster,{
        mode:nav.partySelectionMode,ids:nav.partySelectedIds})});
    nav.render=async()=>{};
    // A saved checkpoint can retain a live Journal handle while the next
    // departure is previewed. This must not hide the water traveler deck.
    nav.canDraftTravelMethods=()=>false;

    const plan=nav.transportationTransitionPlan();
    assert.equal(plan.checkpointContinuation,true);
    assert.equal(plan.hasTransitions,true,"force checkpoint choice UI despite one surface");
    assert.equal(plan.legs.length,1);
    assert.equal(plan.legs[0].arrivalCheckpoint.id,"dock");
    assert.equal(plan.legs[0].selectedOption.value,"hire|ship-passage");
    assert.deepEqual(plan.legs[0].errors,[]);
    assert.ok(plan.legs[0].hours>0);
    const root=await nav._renderHTML();
    const find=(node,predicate)=>predicate(node)?node:
      node.children?.map(child=>find(child,predicate)).find(Boolean);
    const tiles=find(root,node=>node.className==="atlas-navigation-methods");
    assert.ok(tiles,"the onward water leg uses the same method cards as land");
    const ship=find(tiles,node=>node.tag==="input"&&node.value==="hire|ship-passage");
    assert.equal(ship.type,"radio");
    assert.equal(ship.checked,true);
    const edit=find(tiles,node=>node.tag==="button"&&
      node.ariaLabel?.includes("Ship passage"));
    assert.ok(edit,"a selected water transfer has a method-specific pencil");
    const deck=find(root,node=>node.className==="atlas-navigation-traveler-deck");
    assert.ok(deck,"the current water checkpoint offers the same traveler choices as land");
    const staying=find(deck,node=>node.tag==="input"&&
      node.ariaLabel==="Travel with Lucious");
    assert.equal(staying?.type,"checkbox",
      "onward ship uses first-leg single-method checkboxes for including travelers");
    assert.equal(staying.checked,true);
    const before=JSON.stringify(nav.recoveryRecord);
    const nativeRoster=JSON.stringify(groupRoster);
    staying.checked=false;staying.listeners.get("change")();
    assert.equal(JSON.stringify(groupRoster),nativeRoster,
      "unchecking a later-leg traveler never changes native Group membership");
    assert.equal(nav.partySelectionMode,"selected");
    assert.deepEqual(nav.partySelectedIds,["cass"]);
    assert.equal(JSON.stringify(nav.recoveryRecord),before,
      "changing who boards is strictly transient before GM approval");

    assert.equal(find(root,node=>node.ariaLabel==="Transportation method for current leg"),
      undefined,"the legacy dropdown is no longer used on a fresh transfer");
    assert.equal(find(root,node=>node.tag==="select"&&
      node.ariaLabel?.startsWith("Operating schedule for ")),undefined,
      "water transfers also omit the redundant Journey schedule selector");
    assert.equal(nav.recoveryRecord.routeTargets.nextTargetIndex,2,
      "rendering the checkpoint preview must never advance saved targets");
  }finally{Object.assign(globalThis,previous);}
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

test("GM skip-visual control does not move a Token or approve any rest",async()=>{
  const prior={game:globalThis.game,foundry:globalThis.foundry};
  try{
    const answers=[true,true],modalCalls=[];
    globalThis.game={user:{id:"gm",isGM:true},users:{activeGM:{id:"gm"}}};
    globalThis.foundry={applications:{api:{DialogV2:{async confirm(options){
      modalCalls.push(options.window.title);return answers.shift();
    }}}}};
    const nav=Object.create(AtlasNavigationController.prototype);
    nav.scene={id:"scene"};nav.render=async()=>{};
    let finished=0;
    const session={phase:"rest-holding",nativeActive:false,
      playbackSecondsPerHour:15,skipVisualPlayback:false,
      visualRestHold:{finish(){finished++;}},
      schedule:{travelHours:40,completedHours:0,
        rules:{dailyHours:8}}};
    nav.travelSession=session;
    assert.equal(await nav.setSkipVisualJourney(true),true);
    assert.equal(session.skipVisualPlayback,true);
    assert.equal(session.consolidatePlayerRestPrompts,true);
    assert.equal(finished,1,"only a confirmed visual hold is released");
    assert.deepEqual(modalCalls,[
      "Skip visual Journey playback","Consolidate player rest notices?"]);
    assert.equal(nav.setLiveJourneyPlaybackSpeed(25),true);
    assert.equal(session.playbackSecondsPerHour,25);
    assert.equal(await nav.setSkipVisualJourney(false),true);
    assert.equal(session.skipVisualPlayback,false);
  }finally{Object.assign(globalThis,prior);}
});

test("player rest completion prompt requires a saved rest and explicit active-GM approval",async()=>{
  const prior={game:globalThis.game,foundry:globalThis.foundry,
    ChatMessage:globalThis.ChatMessage};
  try{
    const messages=[],prompts=[];
    globalThis.game={user:{id:"gm",isGM:true},users:{activeGM:{id:"gm"}}};
    globalThis.foundry={applications:{api:{DialogV2:{async confirm(o){
      prompts.push(o.window.title);return true;
    }}}}};
    globalThis.ChatMessage={async create(data){messages.push(data);}};
    const nav=Object.create(AtlasNavigationController.prototype);
    const session={phase:"paused",journeyRecord:{legs:[{events:[]}]}};
    nav.travelSession=session;
    assert.equal(await nav.offerPlayerRestPrompt(session,"long"),false);
    assert.deepEqual(messages,[],"no ChatMessage without a confirmed Journal event");
    session.journeyRecord.legs[0].events.push({action:"long",hours:8});
    assert.equal(await nav.offerPlayerRestPrompt(session,"long"),true);
    assert.equal(messages.length,1);
    assert.match(messages[0].content,/Review character resources/);
    assert.deepEqual(messages[0].whisper,[]);
    assert.equal(messages[0].blind,false);
    assert.deepEqual(prompts,["Notify players: rest complete?"]);
    game.users.activeGM={id:"other-gm"};
    assert.equal(await nav.offerPlayerRestPrompt(session,"long"),false);
    assert.equal(messages.length,1,"inactive GM cannot duplicate the player notice");
  }finally{Object.assign(globalThis,prior);}
});

test("GM cargo convoy rechecks finite checkpoint stock before Journey Journal or movement",async()=>{
  const prior={game:globalThis.game,foundry:globalThis.foundry,
    document:globalThis.document};
  try{
    let available=1,moves=0,writes=0;
    globalThis.game={user:{id:"gm",isGM:true},system:{id:"dnd5e"},
      settings:{get:()=>undefined}};
    globalThis.document={createElement:tag=>({tag,textContent:""})};
    globalThis.foundry={applications:{api:{DialogV2:{confirm:async()=>{
      available=0;return true;
    }}}}};
    const group={id:"group1",type:"group",name:"Party",system:{members:[
      {actor:{id:"pc1",name:"Traveler",type:"character"}}
    ]}};
    const token={id:"explorer",actor:group,x:-50,y:-50,width:1,height:1,
      canUserModify:()=>true,async move(){moves++;}};
    const scene={id:"scene",name:"Paedor",grid:{size:100,units:"mi"},
      canUserModify:()=>true,getFlag:(_m,key)=>key==="checkpointTransportOffers"?{
        schemaVersion:1,entries:{hearth:[{methodId:"cart",mode:"land",
          overrides:{hireEnabled:true,hireApplies:"unit",hireQuantity:available,
            hireUnlimited:false,capacity:2,speedMph:4}}]}}:null};
    const atlas={revision:3,nodes:[{id:"a",x:0,y:0},{id:"b",x:100,y:0}],
      roads:[{id:"road",name:"Road"}],segments:[{id:"s",roadId:"road",
        from:"a",to:"b",via:[]}],
      checkpoints:[{id:"hearth",name:"Hearth",nodeId:"a",roadId:"road"}]};
    const route={status:"ok",start:point(0,0),end:point(100,0),
      distance:20,cost:20,terrainAware:false,
      legs:[{kind:"road",roadId:"road",segmentId:"s",
        points:[point(0,0),point(100,0)],distance:20,cost:20}]};
    const view={ready:true,scene};
    const nav=new AtlasNavigationController({canvasProvider:()=>view,
      atlasProvider:()=>atlas,partyTokenProvider:()=>token,
      atlasPoint:(_v,_a,p)=>p,journeyJournalStore:{
        save:async()=>{writes++;throw Error("Unexpected Journal write");},
        find:()=>null
      }});
    nav.scene=scene;nav.sourceMode="party";nav.routeRevision=3;
    nav.start=route.start;nav.end=route.end;nav.result=route;
    nav.travelMethod="walking";nav.transportArrangement="owned";
    nav.convoyEnabled=true;nav.convoyCargoQuantities={cart:1};
    nav.render=async()=>{};nav.draw=()=>{};
    const a=nav.transportAvailability();
    assert.ok(a.offers.has("cart"),JSON.stringify({offers:[...a.offers.keys()],
      methods:a.methods.map(m=>m.id)}));
    assert.ok(a.methods.some(m=>m.id==="cart"),JSON.stringify({
      methods:a.methods.map(m=>m.id),offer:a.offers.get("cart")}));
    assert.ok(nav.cargoConvoyChoices(a).some(x=>x.id==="cart"),
      JSON.stringify({methods:a.methods.map(m=>m.id),choice:nav.cargoConvoyChoices(a)}));
    const preview=nav.mixedConvoyPlan();
    assert.equal(preview.hires[0].units,1);
    assert.equal(nav.assessTravelMethod().guided,true);
    nav.convoyPace=7;
    assert.equal(nav.assessTravelMethod().guided,false,
      "a too-fast pace must not authorize a joint Token move");
    assert.match(nav.assessTravelMethod().reason,/slowest hired vehicle speed/,
      "a GM may raise walking pace, but must not outrun the hired cart");
    nav.convoyPace=null;
    await assert.rejects(nav.startGuidedTravel(),/inventory/);
    assert.equal(moves,0,"stock change must not move the native token");
    assert.equal(writes,0,"stock change must not create a Journey Journal");
  }finally{Object.assign(globalThis,prior);}
});

test("mixed checkbox selection stages owned, hired and walking methods without moving a token",()=>{
  const prior={game:globalThis.game,ui:globalThis.ui};
  try{
    const notices=[];
    globalThis.game={user:{isGM:true}};
    globalThis.ui={notifications:{warn:message=>notices.push(message),
      info:message=>notices.push(message)}};
    const nav=new AtlasNavigationController();
    nav.scene={id:"scene"};nav.sourceMode="party";
    nav.result={status:"ok",distance:20};
    nav.render=()=>{};nav.draw=()=>{};
    nav.canvasProvider=()=>({ready:false});
    nav.transportAvailability=()=>({
      methods:[
        {id:"walking",surface:"land",kind:"foot"},
        {id:"cart",surface:"land",kind:"vehicle"},
        {id:"coach-hire",surface:"land",kind:"vehicle"},
        {id:"riding-horse",surface:"land",kind:"mount"}
      ],owned:new Set(["riding-horse"]),
      offers:new Map([["cart",{}],["coach-hire",{}]])
    });
    nav.partyTravelSelection=()=>({
      partial:false,empty:false,
      previewRoster:{travelers:2,members:[
        {actorId:"pc1",actorName:"PC 1",actorType:"character",
          role:"passenger",quantity:1},
        {actorId:"pc2",actorName:"PC 2",actorType:"character",
          role:"passenger",quantity:1}]}
    });
    nav.travelMethod="walking";nav.transportArrangement="owned";
    nav.toggleTravelMethodChoice("hire|coach-hire",true);
    assert.deepEqual(nav.mixedKeys,["owned|walking","hire|coach-hire"]);
    assert.deepEqual(nav.mixedRiderCounts,{},
      "method selection does not invent per-character travel assignments");
    nav.toggleTravelMethodChoice("owned|riding-horse",true);
    assert.deepEqual(nav.mixedKeys,[
      "owned|walking","hire|coach-hire","owned|riding-horse"]);
    assert.equal(nav.convoyEnabled,false,"passenger assignments replace cargo-only mode");
    nav.toggleTravelMethodChoice("hire|cart",true);
    assert.equal(nav.mixedKeys.length,4);
    nav.toggleTravelMethodChoice("hire|cart",false);
    nav.toggleTravelMethodChoice("owned|riding-horse",false);
    assert.deepEqual(nav.mixedKeys,["owned|walking","hire|coach-hire"]);
    nav.setTravelMethod=(method,arrangement)=>{
      nav.travelMethod=method;nav.transportArrangement=arrangement;
    };
    nav.toggleTravelMethodChoice("owned|walking",false);
    assert.equal(nav.mixedKeys.length,0);
    assert.equal(nav.travelMethod,"coach-hire");
    assert.equal(nav.transportArrangement,"hire");
    assert.equal(notices.length,0);
  }finally{globalThis.game=prior.game;globalThis.ui=prior.ui;}
});

test("mixed passenger GM authorization rechecks fares and passengers before a Journey write",async()=>{
  const previous={game:globalThis.game,foundry:globalThis.foundry,
    document:globalThis.document};
  let price=300.1,dialog=0,moves=0,writes=0;
  try{
    globalThis.game={user:{id:"gm",isGM:true},system:{id:"dnd5e"},
      settings:{get:()=>undefined}};
    globalThis.document={createElement:tag=>({tag,textContent:"",children:[],
      append(...items){this.children.push(...items);}})};
    const texts=node=>[node.textContent,...node.children.flatMap(texts)];
    globalThis.foundry={applications:{api:{DialogV2:{confirm:async({content})=>{
      const labels=texts(content);
      assert.ok(labels.includes("Transportation summary"));
      assert.ok(labels.includes("PC 1"));
      assert.ok(labels.includes("Nyx"));
      assert.ok(labels.includes("Cargo only"));
      assert.ok(labels.includes("8h"));
      assert.ok(labels.includes("3 GP · 1 CP"));
      assert.ok(labels.includes("1 SP · 1 CP"));
      assert.ok(labels.includes("3 GP · 1 SP · 2 CP"),
        "round each method before summing; match planner and Journal");
      assert.ok(!labels.some(label=>label.includes("310.2 CP")));
      dialog++;price=400.1;return true;
    }}}}};
    const scene={id:"scene",name:"Paedor",
      grid:{size:100,units:"mi"},canUserModify:()=>true};
    const atlas={revision:3};
    const token={id:"explorer",x:-50,y:-50,width:1,height:1,
      canUserModify:()=>true,async move(){moves++;}};
    const view={scene,ready:true};
    const nav=new AtlasNavigationController({
      canvasProvider:()=>view,atlasProvider:()=>atlas,
      partyTokenProvider:()=>token,
      atlasPoint:(_v,_a,p)=>p,journeyJournalStore:{
        save:async()=>{writes++;throw Error("Unexpected Journey write");}
      }
    });
    nav.scene=scene;nav.sourceMode="party";nav.routeRevision=3;
    nav.result={status:"ok",start:{x:0,y:0}};
    nav.assessTravelMethod=()=>({guided:true});
    nav.mixedLandPlan=()=>({
      schemaVersion:2,mode:"mixed-land",
      travelers:[{actorId:"pc1",name:"PC 1",methodKey:"hire|coach-hire",
        role:"riding",passengers:1,seatsNeeded:1},
        {actorId:"npc1",name:"Nyx",methodKey:"owned|walking",
          role:"walking",passengers:1,seatsNeeded:0}],
      methods:[{key:"hire|coach-hire",methodName:"Coach",role:"riders",
        passengers:1,seatsUsed:1,units:1,estimatedCostCp:price},
        {key:"owned|walking",methodName:"Walking",role:"walking",
          passengers:1,seatsUsed:0,units:0,estimatedCostCp:0},
        {key:"hire|cart",methodName:"Cart",role:"cargo",
          passengers:0,seatsUsed:0,units:1,estimatedCostCp:10.1}],
      speedPerHour:3,movingHours:8,totalCp:price+10.1
    });
    await assert.rejects(()=>nav.confirmMixedLandJourney(view,token),
      /Passenger assignments, vehicle stock, speeds, fares/);
    assert.equal(dialog,1);
    assert.equal(moves,0);
    assert.equal(writes,0);
    globalThis.foundry.applications.api.DialogV2.confirm=async()=>false;
    assert.equal(await nav.confirmMixedLandJourney(view,token),null,
      "Cancel must not authorize or persist a Journey");
    globalThis.game.user.isGM=false;
    await assert.rejects(()=>nav.confirmMixedLandJourney(view,token),
      /Only an authorized GM/);
  }finally{Object.assign(globalThis,previous);}
});

test("single-method travel toggles subset preview without editing native Group",()=>{
  const previous={document:globalThis.document,game:globalThis.game};
  try{
    globalThis.document={createElement:tag=>({
      tag,children:[],style:{},listeners:new Map(),hidden:false,
      append(...items){this.children.push(...items);},
      addEventListener(name,fn){this.listeners.set(name,fn);},
      setAttribute(){},focus(){}
    })};
    globalThis.game={settings:{get:()=>undefined},system:{id:"dnd5e"},
      user:{isGM:true}};
    const nav=new AtlasNavigationController();
    nav.scene={id:"scene",grid:{units:"mi",size:100}};
    nav.sourceMode="party";nav.travelMethod="walking";
    nav.transportArrangement="owned";
    nav.render=()=>{};nav.resolveTravel=()=>({travel:{speed:3}});
    const members=["Cassian","Lucious","Torrus","Jonathan","Nyx"]
      .map((name,i)=>({actorId:"p"+i,actorName:name,
        actorType:i===4?"npc":"character",role:"passenger",
        needsSeat:i!==4,quantity:1}));
    const roster={travelers:4,members};
    const ids=members.map(m=>m.actorId);
    const selection={previewRoster:roster,selectedIds:ids,partial:false};
    const available={methods:[{id:"walking",name:"Walking",
      surface:"land",kind:"foot"}]};
    const before=structuredClone(roster);
    const view=nav.renderTravelersAndPace(selection,available);
    const flat=node=>[node,...node.children.flatMap(flat)];
    const checks=flat(view).filter(n=>n.type==="checkbox");
    assert.equal(checks.length,5);
    assert.ok(checks.every(n=>n.checked));
    checks.at(-1).checked=false;
    checks.at(-1).listeners.get("change")();
    assert.equal(nav.partySelectionMode,"selected");
    assert.deepEqual(nav.partySelectedIds,ids.slice(0,-1));
    assert.deepEqual(roster,before);
    const projected=projectPartyTravelSelection(roster,{
      mode:nav.partySelectionMode,ids:nav.partySelectedIds});
    assert.equal(projected.partial,true);
    assert.equal(projected.travelerCount,4);
  }finally{Object.assign(globalThis,previous);}
});

test("onward vessel roster ignores obsolete mixed-land methods from the previous leg",()=>{
  const previous={document:globalThis.document,game:globalThis.game};
  try{
    globalThis.document={createElement:tag=>({
      tag,children:[],style:{},listeners:new Map(),hidden:false,textContent:"",
      append(...items){this.children.push(...items);},
      addEventListener(name,fn){this.listeners.set(name,fn);},
      setAttribute(name,value){this[name==="aria-label"?"ariaLabel":name]=value;}
    })};
    globalThis.game={settings:{get:()=>undefined},system:{id:"dnd5e"},
      user:{id:"gm",isGM:true}};
    const nav=new AtlasNavigationController();
    nav.scene={id:"scene",grid:{units:"mi",size:100}};
    nav.sourceMode="party";nav.render=()=>{};
    nav.resolveTravel=()=>({travel:{speed:3}});
    // These allocations belong to the completed land leg, not the new ship.
    nav.mixedKeys=["owned|walking","owned|warhorse","owned|riding-horse"];
    nav.mixedAssignments={cass:"owned|riding-horse",luc:"owned|warhorse"};
    const roster={travelers:2,members:[
      {actorId:"cass",actorName:"Cassian",actorType:"character",role:"passenger",
        needsSeat:true,quantity:1},
      {actorId:"luc",actorName:"Lucious",actorType:"character",role:"passenger",
        needsSeat:true,quantity:1}
    ]};
    const ship={id:"ship-passage",name:"Ship passage (hired)",surface:"water",
      kind:"vehicle",capacity:8,speedMph:2,hireCostCp:250,
      hireBasis:"trip",hireApplies:"passenger",hireUnlimited:true};
    const view=nav.renderTravelersAndPace({
      previewRoster:roster,selectedIds:["cass","luc"],partial:false
    },{methods:[ship]},{singleChoice:{
      value:"hire|ship-passage",method:ship,arrangement:"hire"
    },transferColumns:true});
    const flat=node=>[node,...node.children.flatMap(flat)];
    const nodes=flat(view);
    assert.ok(nodes.some(node=>node.className==="atlas-navigation-traveler-deck"),
      "the selected ship must render its own traveler deck");
    assert.ok(nodes.some(node=>String(node.textContent??"").includes("Ship passage")),
      "the current ship must replace the obsolete land methods");
    assert.equal(nodes.some(node=>String(node.textContent??"").includes("Mixed method")),
      false,"an old land-only method error must not erase the water roster");
  }finally{Object.assign(globalThis,previous);}
});

test("Navigation retains the travel tab scroll position after a traveler drag rerender",()=>{
  const nav=Object.create(AtlasNavigationController.prototype);
  assert.equal(AtlasNavigationController.DEFAULT_OPTIONS.position.width,900);
  const before=[
    {id:"atlas-navigation-panel-travel",scrollTop:612,scrollLeft:4},
    {id:"atlas-navigation-panel-playback",scrollTop:27,scrollLeft:0}
  ];
  const after=before.map(({id})=>({id,scrollTop:0,scrollLeft:0}));
  const content={scrollTop:15,replaced:false,
    querySelectorAll(){return this.replaced?after:before;},
    querySelector(selector){return after.find(n=>selector==='[id="'+n.id+'"]');},
    replaceChildren(node){this.replaced=true;this.child=node;this.scrollTop=0;}
  };
  const replacement={id:"new-navigation-stage"};
  nav._replaceHTML(replacement,content);
  assert.equal(content.child,replacement);
  assert.equal(content.scrollTop,15);
  assert.deepEqual(after.map(x=>[x.scrollTop,x.scrollLeft]),[[612,4],[27,0]]);
});

test("partial vessel recovery persists evidence and retries without duplicating time",async()=>{
  const previous={game:globalThis.game,ui:globalThis.ui};
  try{
    const op="bounded-voyage-01";
    const scene={id:"bounded-scene",name:"Paedor",grid:{size:100,units:"mi"},
      canUserModify:()=>true};
    const atlas={revision:4,roads:[],nodes:[],segments:[],checkpoints:[]};
    const token={id:"party",x:25,y:0,width:1,height:1,elevation:0,
      level:"surface",canUserModify:()=>true,
      movement:{id:op,state:"completed",origin:point(0,0),destination:point(25,0),
        constrained:false,passed:{waypoints:[{...point(25,0),movementId:op}]},pending:{waypoints:[]}},
      move(){throw Error("Recovery must not move the token");}};
    const route={status:"ok",start:point(50,50),end:point(150,50),
      distance:8,cost:8,terrainAware:false,legs:[{kind:"road",
        roadId:"sea",segmentId:"s",points:[point(50,50),point(150,50)],distance:8,cost:8}]};
    const itinerary={...createNavigationItinerary({sceneId:scene.id,
      sceneName:scene.name,sceneUnits:"mi",route,travel:{speed:2}}),
      transport:{methodId:"ship-passage",methodName:"Ship passage (hired)",
        arrangement:"hire",kind:"vehicle",surface:"water",departureCheckpointName:null,
        arrivalCheckpointId:"port",arrivalCheckpointName:"Port",roadNames:["Sea"],
        estimatedFareCp:10,operation:"continuous"}};
    const anchor={point:point(50,50),roadId:"sea",segmentId:"s",
      checkpointId:null,levelId:"surface",elevation:0};
    let record=createJourneyRecord({sceneId:scene.id,tokenId:token.id,
      atlasRevision:4,itinerary,journeyDestination:point(400,50),initialAnchor:anchor,
      approvedPath:{schemaVersion:1,legs:route.legs}});
    record.status="interrupted";
    record.pendingNativeMove={schemaVersion:1,bounded:true,previousMovementId:null,
      operationId:op,tokenId:token.id,checkpointIndex:0,from:point(0,0),to:point(50,0),
      path:[point(0,0),point(50,0)],nativePath:[point(0,0),point(50,0)],completedPercent:50,nativeDistance:50,
      movingHours:2,worldTimeBefore:1000,worldAdvanceSeconds:7200,atlasRevision:4};
    let advances=0,writes=0,restores=0,failWrite="receipt";
    globalThis.game={user:{id:"gm",isGM:true},users:{activeGM:{id:"gm"}},
      settings:{get:()=>true},time:{worldTime:1000,async advance(delta){
        advances++;this.worldTime+=delta;
      }}};
    const journal={id:"bounded-journal",canUserModify:()=>true,
      getFlag:()=>structuredClone(record)};
    const nav=new AtlasNavigationController({canvasProvider:()=>({ready:true,scene}),
      atlasProvider:()=>atlas,partyTokenProvider:()=>token,atlasPoint:(_v,_a,p)=>p,
      journeyJournalStore:{save:async next=>{
        writes++;
        if(failWrite==="receipt"&&next.pendingNativeMove?.partialEvidence||
            failWrite==="confirmation"&&!next.pendingNativeMove)
          throw Error("Journal temporarily unavailable");
        record=structuredClone(next);
      }}});
    nav.scene=scene;nav.recoverableJourney=journal;
    nav.recoverSavedJourney=()=>{restores++;return true;};
    assert.equal(nav.boundedNativeArrival(record)?.clockAction,"advance");
    token.movement.origin=point(4,0);
    let reason;
    assert.equal(nav.boundedNativeArrival(record,value=>{reason=value;}),null);
    assert.ok(reason);
    token.movement.origin=point(0,0);
    await assert.rejects(nav.recoverSavedJourneyWithNativeReview(),/Journal temporarily unavailable/);
    assert.equal(advances,0,"a failed durable evidence write must not advance the clock");
    assert.equal(game.time.worldTime,1000);
    failWrite="confirmation";
    await assert.rejects(nav.recoverSavedJourneyWithNativeReview(),/Journal temporarily unavailable/);
    assert.equal(advances,1);assert.ok(record.pendingNativeMove?.partialEvidence);
    assert.equal(game.time.worldTime,4600);
    // Simulate the browser reload that removes the public last-movement ID.
    token.movement={id:"",state:"completed"};
    failWrite=false;
    assert.equal(nav.boundedNativeArrival(record)?.clockAction,"already-advanced");
    assert.equal(await nav.recoverSavedJourneyWithNativeReview(),true);
    assert.equal(advances,1);assert.equal(writes,4);assert.equal(restores,1);
    assert.equal(record.pendingNativeMove,null);
    await nav.recoverSavedJourneyWithNativeReview();
    assert.equal(advances,1,"repeating recovery cannot credit the same interval");
    assert.equal(record.legs[0].completedPercent,25);
    assert.equal(record.legs[0].completedMovingHours,1);
    assert.equal(record.legs[0].worldTravelSeconds,3600);
    assert.deepEqual(record.destination,point(400,50));
    assert.deepEqual(record.lastConfirmedAnchor.point,point(75,50));
  }finally{Object.assign(globalThis,previous);}
});
test("canvas teardown suspends a submitted continuous operation instead of ending it",async()=>{
  const old=globalThis.game;
  try{
    globalThis.game={user:{isGM:true},time:{worldTime:100}};
    const nav=new AtlasNavigationController();
    nav.scene={id:"sea"};
    let stopped=0,finish;
    const writes=[];
    const session={phase:"moving",sceneId:"sea",nativeActive:true,
      nativeAbort:new AbortController(),nativeSuspension:new AbortController(),
      token:{id:"party",stopMovement(){stopped++;}},
      journeyRecord:{status:"moving",atlasRevision:4},journal:{id:"voyage"},
      finished:new Promise(resolve=>{finish=resolve;})};
    nav.travelSession=session;
    nav.saveJourneyCheckpoint=async(_session,status)=>writes.push(status);
    nav.tearDown("canvasTearDown");
    assert.equal(stopped,0);
    assert.equal(session.nativeAbort.signal.aborted,false);
    assert.equal(session.nativeSuspension.signal.aborted,true);
    assert.equal(nav.travelSession,null);
    assert.equal(nav.suspendedNativeSession,session);
    assert.deepEqual(writes,[],"do not persist an interruption while the old operation can still write");
    finish();
  }finally{globalThis.game=old;}
});

test("suspended Journal finalization waits for its writer and preserves the durable clock boundary",async()=>{
  const old=globalThis.game;
  try{
    globalThis.game={user:{id:"gm",isGM:true},users:{activeGM:{id:"gm"}},time:{worldTime:3700}};
    const scene={id:"sea",name:"Paedor",grid:{size:100,units:"mi"}};
    const route={status:"ok",start:point(50,50),end:point(150,50),distance:8,cost:8,
      terrainAware:false,legs:[{kind:"road",roadId:"sea",segmentId:"s",
        points:[point(50,50),point(150,50)],distance:8,cost:8}]};
    const itinerary=createNavigationItinerary({sceneId:scene.id,sceneName:scene.name,
      sceneUnits:"mi",route,travel:{speed:2}});
    let record=createJourneyRecord({sceneId:scene.id,tokenId:"party",atlasRevision:4,itinerary,
      initialAnchor:{point:point(50,50),roadId:"sea",segmentId:"s",
        checkpointId:null,levelId:"surface",elevation:0}});
    record.pendingNativeMove={schemaVersion:1,bounded:true,previousMovementId:null,
      operationId:"pending-op",tokenId:"party",checkpointIndex:0,from:point(0,0),to:point(25,0),
      path:[point(0,0),point(25,0)],nativePath:[point(0,0),point(25,0)],
      completedPercent:25,nativeDistance:25,movingHours:1,worldTimeBefore:100,
      worldAdvanceSeconds:3600,atlasRevision:4};
    let writes=0,release;
    const session={canvasSuspended:true,journal:{id:"sea-journey",getFlag:()=>structuredClone(record),
      canUserModify:()=>true},journalQueue:new Promise(resolve=>{release=resolve;}),
      clock:{advancedSeconds:3600},completedDistance:25};
    const nav=new AtlasNavigationController({journeyJournalStore:{save:async next=>{
      writes++;record=structuredClone(next);
    }}});
    nav.suspendedNativeSession=session;
    const settled=nav.settleSuspendedNativeJourney(session);
    await Promise.resolve();
    assert.equal(writes,0);assert.equal(nav.suspendedNativeSession,session);
    release();await settled;
    assert.equal(writes,1);
    assert.equal(record.status,"interrupted");
    assert.equal(record.legs[0].worldTravelSeconds,0,"do not duplicate outstanding clock credit in Journal");
    assert.equal(record.legs[0].completedPercent,0);
    assert.ok(record.pendingNativeMove);
    assert.equal(nav.suspendedNativeSession,null);
    assert.equal(game.time.worldTime,3700);
  }finally{globalThis.game=old;}
});

test("current water-leg per-person estimate follows selected Group IDs without booking",()=>{
  const previous=globalThis.game;
  try{
    globalThis.game={user:{id:"gm",isGM:true},system:{id:"dnd5e"},
      settings:{get:()=>undefined}};
    const from=point(0,0),to=point(300,0);
    const actor={id:"groupA",type:"group",name:"Party",system:{members:[
      {actor:{id:"pcA",name:"Alba",type:"character"}},
      {actor:{id:"pcB",name:"Brent",type:"character"}}
    ]}};
    const token={id:"group-token",actor};
    const atlas={revision:1,nodes:[{id:"start",...from},{id:"end",...to}],
      roads:[{id:"sea",name:"Sea passage",travelPresetId:"water-sea"}],
      segments:[{id:"segment",roadId:"sea",from:"start",to:"end",via:[]}],
      checkpoints:[{id:"dock",name:"Dock",nodeId:"start",roadId:"sea"},
        {id:"port",name:"Port",nodeId:"end",roadId:"sea"}]};
    const scene={id:"sea-scene",grid:{size:100,units:"mi"},getFlag:(_ns,key)=>
      key==="checkpointTransportOffers"?{schemaVersion:1,entries:{dock:[
        {methodId:"ship-passage",mode:"sea",overrides:{
          hireEnabled:true,hireCostCp:250,hireBasis:"trip",hireApplies:"passenger",
          capacity:6}}
      ]}}:undefined};
    const route={status:"ok",start:from,end:to,distance:10,cost:10,
      legs:[{kind:"road",roadId:"sea",segmentId:"segment",points:[from,to],
        distance:10,cost:10}]};
    const nav=new AtlasNavigationController({atlasProvider:()=>atlas,
      partyTokenProvider:()=>token});
    nav.scene=scene;nav.result=route;nav.sourceMode="party";
    nav.transferSelections[0]="hire|ship-passage";
    const full=nav.transportationTransitionPlan().legs[0];
    assert.equal(full.costCp,500,"2 human travelers cost 2 × 250 CP");
    assert.equal(full.livestock,null,
      "Groups without mounts never gain phantom animal boarding Journal metadata");
    nav.partySelectionMode="selected";nav.partySelectedIds=["pcA"];
    const partial=nav.transportationTransitionPlan().legs[0];
    assert.equal(partial.costCp,250,
      "a prospective single passenger quote does not bill the excluded Group member");
    assert.deepEqual(partial.errors,[]);
    assert.deepEqual(actor.system.members.map(m=>m.actor.id),["pcA","pcB"],
      "preview never changes the native Group roster");
  }finally{globalThis.game=previous;}
});


test("water-to-land handoff preserves the partial embarked mount inventory as an editable draft",async()=>{
  const previous=globalThis.game;
  try{
    const config={version:7,groups:{groupA:{members:{
      horseA:{role:"mount",quantity:1,capacity:1,surface:"land",
        enabled:true,assignedTo:null,profileId:"warhorse"},
      horseB:{role:"mount",quantity:3,capacity:1,surface:"land",
        enabled:true,assignedTo:null,profileId:"riding-horse"}
    }}}};
    globalThis.game={user:{id:"gm",isGM:true},system:{id:"dnd5e"},
      settings:{get:(_module,key)=>key==="guidedGroupTransportation"?config:undefined}};
    const actor={id:"groupA",type:"group",name:"Party",system:{members:[
      {actor:{id:"pcA",name:"Alba",type:"character"}},
      {actor:{id:"pcB",name:"Brent",type:"character"}},
      {actor:{id:"horseA",name:"Warhorse",type:"npc"}},
      {actor:{id:"horseB",name:"Riding Horse",type:"npc"}}
    ]}};
    const before=structuredClone(actor.system.members.map(m=>m.actor.id));
    const token={id:"group-token",actor};
    const from=point(0,0),to=point(300,0);
    const atlas={revision:1,nodes:[{id:"start",...from},{id:"end",...to}],
      roads:[{id:"sea",name:"Sea passage",travelPresetId:"water-sea"}],
      segments:[{id:"segment",roadId:"sea",from:"start",to:"end",via:[]}],
      checkpoints:[{id:"dock",name:"Dock",nodeId:"start",roadId:"sea"},
        {id:"port",name:"Port",nodeId:"end",roadId:"sea"}]};
    let animalCapacity=3,stock=2;
    const scene={id:"sea-scene",grid:{size:100,units:"mi"},getFlag:(_ns,key)=>
      key==="checkpointTransportOffers"?{schemaVersion:1,entries:{dock:[
        {methodId:"ship-passage",mode:"sea",overrides:{
          hireEnabled:true,hireCostCp:250,hireBasis:"trip",
          hireApplies:"passenger",capacity:6,livestockCapacity:animalCapacity,
          hireUnlimited:false,hireQuantity:stock}}
      ]}}:undefined};
    const route={status:"ok",start:from,end:to,distance:10,cost:10,
      legs:[{kind:"road",roadId:"sea",segmentId:"segment",points:[from,to],
        distance:10,cost:10}]};
    const nav=new AtlasNavigationController({atlasProvider:()=>atlas,
      partyTokenProvider:()=>token});
    nav.scene=scene;nav.result=route;nav.sourceMode="party";
    nav.transferSelections[0]="hire|ship-passage";
    nav.livestockDecisions={horseA:1,horseB:2};
    const plan=nav.transportationTransitionPlan().legs[0];
    assert.deepEqual(plan.errors,[]);
    assert.equal(plan.costCp,875,"2 human fares + 3 physical mounts at 50%");
    assert.equal(plan.livestock.estimatedFareCp,375);
    assert.equal(plan.livestock.resources.find(m=>m.actorId==="horseB").aboard,2);
    animalCapacity=null;
    const defaultUnlimited=nav.transportationTransitionPlan().legs[0];
    assert.deepEqual(defaultUnlimited.errors,[]);
    assert.equal(defaultUnlimited.livestock.capacityPerUnit,null);
    assert.equal(defaultUnlimited.costCp,875);
    animalCapacity=0;
    assert.ok(nav.transportationTransitionPlan().legs[0].errors.some(error=>
      /does not allow/i.test(error)));
    animalCapacity=2;stock=1;
    assert.ok(nav.transportationTransitionPlan().legs[0].errors.some(error=>
      /Not enough hired transportation units/i.test(error)));
    animalCapacity=3;stock=2;
    nav.livestockDecisions={horseA:0,horseB:0};
    assert.equal(nav.transportationTransitionPlan().legs[0].costCp,500);
    const prior=plan.livestock;
    nav.recoveryRecord={status:"paused",legs:[{completedPercent:100,
      livestock:prior}]};
    const journalBefore=structuredClone(nav.recoveryRecord);
    // The real checkpoint-continuation workflow restores the manifest and
    // immediately recalculates the next route. Neither step commits the draft.
    nav.pendingTransfer={checkpoint:{id:"dock",name:"Dock",point:from}};
    nav.verifyPendingTransfer=()=>({pending:nav.pendingTransfer,view:{}});
    nav.isAtJourneyDestination=()=>false;
    nav.syncPartyDeparture=()=>{nav.start=from;};
    nav.draw=()=>{};nav.render=async()=>{};
    nav.routeCalculator=()=>({status:"unreachable"});
    nav.end=to;
    assert.equal(await nav.continueFromCheckpoint(),true);
    assert.deepEqual(nav.livestockDecisions,{horseA:1,horseB:2},
      "Continue and its route recalculation retain the exact embarked quantities");
    const landed=nav.partyTravelSelection([]).previewRoster;
    assert.equal(landed.members.find(m=>m.actorId==="horseB").quantity,2,
      "only the two confirmed disembarking Riding Horses are available for land riding");
    assert.equal(landed.members.find(m=>m.actorId==="horseA").quantity,1);
    assert.deepEqual(nav.recoveryRecord,journalBefore,
      "disembarking defaults never rewrite the confirmed vessel Journal");
    nav.result=route;
    // A confirmed sea leg can precede a partially decided land draft.
    // The draft UI must remain available even though Play is prohibited.
    nav.livestockDecisions={horseA:1};
    const partialLand=nav.partyTravelSelection([]);
    assert.ok(partialLand,"incomplete mount decisions cannot hide the traveler deck");
    assert.equal(partialLand.previewRoster.members.find(m=>
      m.actorId==="horseA").quantity,1);
    assert.equal(partialLand.previewRoster.members.some(m=>
      m.actorId==="horseB"),false,"undecided horses provide no inferred seats");
    assert.deepEqual(nav.livestockDecisions,{horseA:1},
      "the preview must not invent a zero boarding decision");
    assert.match(nav.assessTravelMethod().reason,/Decide Embark or Stay behind/,
      "a missing mount decision blocks the next leg before approval");
    atlas.roads[0].travelPresetId="land-dirt";
    nav.transferSelections[0]="owned|riding-horse";
    const missing=nav.transportationTransitionPlan().legs[0];
    assert.ok(missing.errors.some(error=>/Decide Embark or Stay behind/.test(error)),
      "the checkpoint land planner also rejects incomplete mount participation");
    nav.livestockDecisions={horseA:0,horseB:1};
    const land=nav.transportationTransitionPlan().legs[0];
    assert.ok(!land.errors.some(error=>/Decide Embark or Stay behind/.test(error)),
      "complete decisions clear the spurious capacity-preflight failure");
    const newLandDraft=nav.partyTravelSelection([]).previewRoster;
    assert.equal(newLandDraft.members.some(m=>m.actorId==="horseA"),false);
    assert.equal(newLandDraft.members.find(m=>m.actorId==="horseB").quantity,1);
    assert.deepEqual(actor.system.members.map(m=>m.actor.id),before,
      "Boarding and rejoining never change the native Group");
    assert.deepEqual(nav.recoveryRecord,journalBefore,
      "draft edits and status checks cannot mutate confirmed Journey history");
    nav.calculateRoute({},atlas);
    assert.deepEqual(nav.livestockDecisions,{horseA:0,horseB:1},
      "a GM's next-leg corrections survive subsequent route recalculation");
    nav.clear();
    assert.deepEqual(nav.livestockDecisions,{},
      "a deliberate new route never inherits old Journey mount choices");
  }finally{globalThis.game=previous;}
});


test("interrupted Journey timing ignores the old leg schedule instead of crashing the Navigation window",()=>{
  const nav=new AtlasNavigationController();
  nav.journeySchedule={travelHours:9,breakHours:16,estimate:{totalHours:8}};
  nav.travelProgress=88;
  const moving={textContent:""},elapsed={textContent:""},eta={textContent:""};
  nav.journeyTimeUI={travelHours:1,plan:{totalHours:1},moving,elapsed,eta};
  nav.updateJourneyTiming();
  assert.ok(moving.textContent);
  assert.ok(elapsed.textContent);
  assert.ok(eta.textContent,"the recovered preview stays renderable");
  nav.travelSession={schedule:{travelHours:1,breakHours:1,
    estimate:{totalHours:2}}};
  nav.updateJourneyTiming();
  assert.notEqual(elapsed.textContent,moving.textContent,
    "the matching live schedule still contributes confirmed downtime");
});

test("unmovable day-boundary requests explicit early GM consent without native movement",async()=>{
  const nav=new AtlasNavigationController();
  const schedule=new GuidedTravelDayTracker({travelHours:9.2,rules:{
    dailyHours:8,overnightHours:16,longRestHours:8,shortRestHours:1,
    forcedMarch:"dnd5e"}});
  schedule.recordMovement(7.99);
  const session={sceneId:"scene",phase:"moving",schedule};
  nav.travelSession=session;
  let durable=0,commits=0;
  nav.saveJourneyCheckpoint=async()=>{durable++;};
  nav.commitGuidedTravelBreak=async(_session,choice)=>{
    commits++;schedule.applyBreak(choice);
  };
  const decision=nav.waitForDailyTravelChoice(session,{allowEarly:true});
  await tickUntil(()=>typeof session.restWaiter==="function");
  assert.equal(schedule.permittedExtraUntil,0,
    "the pending GM choice cannot grant forced-march hours");
  assert.equal(durable,1,"the Journal is paused before the early choice");
  session.restWaiter("continue");
  assert.equal(await decision,true);
  assert.equal(commits,1);
  assert.equal(schedule.permittedExtraUntil,9);
  assert.equal(session.phase,"moving");
});


test("land vehicle boarding prices physical animals without changing passenger seats or native roster",()=>{
  const previous=globalThis.game;
  try{
    globalThis.game={system:{id:"dnd5e"},settings:{get:()=>undefined}};
    const nav=new AtlasNavigationController();
    nav.scene={id:"land-scene",grid:{size:100,units:"mi"}};
    nav.result={status:"ok",distance:12,cost:12};
    nav.resolveTravel=()=>({travel:{speed:3}});
    nav.plannedTravelOperation=()=> "normal";
    nav.livestockDecisions={horseA:1,horseB:2};
    const roster={members:[
      {actorId:"horseA",actorName:"Warhorse",quantity:1,assignedTo:null,
        enabled:true,role:"mount"},
      {actorId:"horseB",actorName:"Riding Horse",quantity:3,assignedTo:null,
        enabled:true,role:"mount"}]};
    const saved=structuredClone(roster);
    const party={roster,travelerCount:2};
    const wagon={id:"coach-hire",name:"Coach",kind:"vehicle",surface:"land",
      capacity:4,hireEnabled:true,hireCostCp:40,hireBasis:"trip",
      hireApplies:"passenger",livestockCapacity:null,
      hireUnlimited:false,hireQuantity:1};
    const planned=nav.planLandVehicleBoarding(wagon,"hire",party);
    assert.equal(planned.quote.units,1);
    assert.equal(planned.quote.baseCp,80);
    assert.equal(planned.quote.livestockFareCp,60);
    assert.equal(planned.manifest.carried,true);
    assert.equal(planned.manifest.capacityPerUnit,null);
    assert.deepEqual(planned.manifest.resources.map(m=>m.aboard),[1,2]);
    assert.deepEqual(roster,saved,"draft boarding never mutates native Group");
    assert.throws(()=>nav.planLandVehicleBoarding({...wagon,livestockCapacity:0},
      "hire",party),/does not allow/);
    assert.throws(()=>nav.planLandVehicleBoarding({...wagon,livestockCapacity:2},
      "hire",party),/Not enough hired transportation units/);
    assert.equal(nav.planLandVehicleBoarding({...wagon,livestockCapacity:2,
      hireQuantity:2},"hire",party).quote.units,2);
    nav.livestockDecisions={horseA:0,horseB:0};
    assert.equal(nav.planLandVehicleBoarding({...wagon,livestockCapacity:0},
      "hire",party).quote.totalCp,80,
      "zero animal spaces do not prevent vehicle travel with no animals");
    assert.deepEqual(roster,saved);
  }finally{globalThis.game=previous;}
});

test("checkpoint Journey explicitly selected hired tier drives schedule and quote without changing local offer",()=>{
  const previous=globalThis.game;
  try{
    globalThis.game={user:{id:"gm",isGM:true},system:{id:"dnd5e"},settings:{get:()=>undefined}};
    const from=point(0,0),to=point(300,0);
    const atlas={revision:1,nodes:[{id:"start",...from},{id:"end",...to}],
      roads:[{id:"sea",name:"Sea passage",travelPresetId:"water-sea"}],
      segments:[{id:"segment",roadId:"sea",from:"start",to:"end",via:[]}],
      checkpoints:[{id:"dock",name:"Dock",nodeId:"start",roadId:"sea"},
        {id:"port",name:"Port",nodeId:"end",roadId:"sea"}]};
    const stock={schemaVersion:1,entries:{dock:[{methodId:"warship",mode:"sea",overrides:{
      hireEnabled:true,hireCostCp:1000,hireBasis:"day",hireApplies:"unit",
      overtimeEnabled:true,overtimeExtraHours:8,continuousEnabled:true,
      hireServiceLevels:{minimum:{hireCostCp:500},optimal:{hireCostCp:800}}}}]}};
    const scene={id:"sea-scene",grid:{size:100,units:"mi"},getFlag:(_ns,key)=>
      key==="checkpointTransportOffers"?stock:undefined};
    const nav=new AtlasNavigationController({atlasProvider:()=>atlas,partyTokenProvider:()=>null});
    nav.scene=scene;nav.result={status:"ok",start:from,end:to,distance:60,cost:60,
      legs:[{kind:"road",roadId:"sea",segmentId:"segment",points:[from,to],distance:60,cost:60}]};
    nav.transferSelections[0]="hire|warship";
    const before=JSON.stringify(stock);
    nav.transferLegOverrides[0]={selection:"hire|warship",overrides:{},serviceLevel:"minimum"};
    const minimum=nav.transportationTransitionPlan().legs[0];
    assert.deepEqual(minimum.errors,[]);
    assert.equal(minimum.operation,"normal");
    assert.equal(minimum.dailyHours,8);
    assert.equal(minimum.serviceQuote.serviceLevel,"minimum");
    assert.equal(minimum.serviceQuote.advertisedCrew,15);
    assert.equal(minimum.serviceQuote.hireTerms.hireCostCp,500);
    nav.transferLegOverrides[0].serviceLevel="optimal";
    const optimal=nav.transportationTransitionPlan().legs[0];
    assert.equal(optimal.operation,"overtime");
    assert.equal(optimal.dailyHours,16);
    assert.equal(optimal.serviceQuote.advertisedCrew,30);
    nav.transferLegOverrides[0].serviceLevel="full";
    const full=nav.transportationTransitionPlan().legs[0];
    assert.equal(full.operation,"continuous");
    assert.equal(full.dailyHours,24);
    assert.equal(full.serviceQuote.advertisedCrew,60);
    delete nav.transferLegOverrides[0];
    assert.equal(nav.transportationTransitionPlan().legs[0].serviceQuote.serviceLevel,undefined);
    assert.equal(JSON.stringify(stock),before);
  }finally{globalThis.game=previous;}
});

test("ordinary hired land service keeps explicit tier and immutable approved fare",async()=>{
  const previous={game:globalThis.game,foundry:globalThis.foundry,
    document:globalThis.document,PIXI:globalThis.PIXI};
  let nav;
  try{
    let offers=[{methodId:"cart",mode:"land",overrides:{hireEnabled:true,
      hireCostCp:250,hireBasis:"day",hireApplies:"unit",
      continuousEnabled:true,hireServiceLevels:{minimum:{hireCostCp:123}}}}];
    const writes=[],dialogTitles=[];
    let approve=false;
    globalThis.game={user:{id:"gm",isGM:true},system:{id:"dnd5e"},
      settings:{get:()=>undefined}};
    globalThis.PIXI=undefined;
    globalThis.document={createElement:tag=>({tag,style:{},textContent:""})};
    globalThis.foundry={applications:{api:{DialogV2:{confirm:async options=>{
      dialogTitles.push(options.window.title);return approve;
    }}}}};
    const token={id:"party",x:-50,y:-50,width:1,height:1,actor:null,
      moves:0,canUserModify:()=>true,
      async move(waypoints){this.moves++;Object.assign(this,waypoints.at(-1));return true;}};
    const scene={id:"port-scene",name:"Paedor",grid:{size:100,units:"mi"},
      canUserModify:()=>true,
      getFlag:(_module,key)=>key==="checkpointTransportOffers"?{
        schemaVersion:1,entries:{port:offers}}:null};
    const atlas={revision:7,nodes:[{id:"p",x:0,y:0},{id:"g",x:300,y:0}],
      roads:[{id:"land",name:"Dirwest-Port Barthos"}],
      segments:[{id:"segment",roadId:"land",from:"p",to:"g",via:[]}],
      checkpoints:[{id:"port",name:"Port Barthos",nodeId:"p",roadId:"land"}]};
    const view={ready:true,scene};
    const route={status:"ok",start:point(0,0),end:point(300,0),
      distance:6,cost:6,terrainAware:false,legs:[{kind:"road",roadId:"land",
        segmentId:"segment",points:[point(0,0),point(300,0)],distance:6,cost:6}]};
    nav=new AtlasNavigationController({canvasProvider:()=>view,
      atlasProvider:()=>atlas,partyTokenProvider:()=>token,
      atlasPoint:(_view,_atlas,location)=>location,
      journeyJournalStore:{find:()=>null,save:async record=>{
        writes.push(structuredClone(record));return {id:"cart-journey"};}}});
    nav.scene=scene;nav.sourceMode="party";nav.routeRevision=7;
    nav.start=route.start;nav.end=route.end;nav.result=route;
    nav.travelMethod="cart";nav.transportArrangement="hire";
    nav.transportServiceLevel="minimum";
    nav.render=async()=>{};nav.draw=()=>{};
    nav.itinerary=createNavigationItinerary({sceneId:scene.id,sceneName:scene.name,
      sceneUnits:"mi",atlasRevision:7,route,travel:{speed:3}});
    // Port Barthos is also the arrival after a previously completed hired
    // ship checkpoint leg. Approving the Cart must append a new land leg to
    // that Journal, not demand another authored checkpoint at South-East Gate.
    const priorItinerary=createNavigationItinerary({sceneId:scene.id,
      sceneName:scene.name,sceneUnits:"mi",atlasRevision:7,route,
      travel:{speed:2}});
    priorItinerary.transport={methodId:"ship-passage",methodName:"Ship passage (hired)",
      kind:"vehicle",arrangement:"hire",surface:"water",
      departureCheckpointName:"Hearth's Heart Dock",arrivalCheckpointId:"port",
      arrivalCheckpointName:"Port Barthos",roadNames:["Coastal Passage"],
      estimatedFareCp:500,operation:"continuous"};
    const previousRecord=createJourneyRecord({sceneId:scene.id,tokenId:token.id,
      atlasRevision:7,itinerary:priorItinerary});
    previousRecord.status="paused";
    previousRecord.legs[0].completedPercent=100;
    previousRecord.legs[0].completedMovingHours=previousRecord.legs[0].movingHours;
    nav.recoveryRecord=previousRecord;
    nav.recoveryJournal={id:"prior-voyage"};
    assert.equal(nav.transportAvailability().owned.has("cart"),false);
    assert.equal(nav.transportAvailability().offers.get("cart").checkpointId,"port");
    assert.equal(nav.assessTravelMethod().guided,true,
      "a checkpoint-offered Cart is eligible even without a party-owned Cart");
    assert.equal(nav.transportOperation,"normal",
      "the unapproved default contains no separate continuous choice");
    assert.equal(nav.resolveTravelRules({methodId:"cart"}).dailyHours,8,
      "explicit minimum service must not be silently promoted to continuous");
    assert.equal(await nav.startGuidedTravel(),false,
      "declining the explicit GM hire leaves the Journey unchanged");
    assert.equal(token.moves,0);assert.equal(writes.length,0);
    approve=true;
    assert.equal(await nav.startGuidedTravel(),true);
    assert.ok(token.moves>0,"a native TokenDocument move completes the Cart journey");
    assert.deepEqual(dialogTitles,["Confirm land travel","Confirm land travel"]);
    assert.equal(writes.at(-1).status,"completed");
    assert.equal(writes.at(-1).legs.length,2);
    assert.deepEqual(writes.at(-1).legs[1].approvedPath.legs.map(leg=>({
      roadId:leg.roadId,segmentId:leg.segmentId})),[
      {roadId:"land",segmentId:"segment"}],
    "every newly approved continuation leg persists its exact Road identity");
    assert.equal(writes.at(-1).legs[0].transport.methodId,"ship-passage");
    const approved=writes.at(-1).legs[1].travelMethod;
    assert.equal(approved.operation,"normal");
    assert.equal(approved.serviceApproval.serviceLevel,"minimum");
    assert.equal(approved.serviceApproval.totalCp,123);
    assert.equal(approved.serviceApproval.dailyHours,8);
    assert.equal(approved.serviceApproval.hireTerms.hireCostCp,123);
    assert.equal(offers[0].overrides.hireCostCp,250);
    assert.equal(writes.at(-1).legs[1].speedPerHour,3);
    assert.equal(writes.at(-1).legs[1].worldTravelSeconds,0,
      "without the World-clock setting the Cart cannot advance time");
    assert.equal(nav.completedRoute,true);
    assert.equal(scene.setFlag,undefined,"no Scene offer is written or charged");
    // Another World/custom method is not licensed merely because the road is land.
    nav.recoveryRecord=null;nav.completedRoute=false;nav.transportArrangement="hire";
    offers=[];
    assert.equal(nav.assessTravelMethod().guided,false);
    assert.match(nav.assessTravelMethod().reason,/no longer offered/);
  }finally{nav?.stop();Object.assign(globalThis,previous);}
});

test("approved mixed convoy retains the common travel day even after World rules change",()=>{
  const before=globalThis.game;
  try{
    globalThis.game={system:{id:"dnd5e"},settings:{get:()=>undefined}};
    const nav=new AtlasNavigationController();
    nav.resolveTravelRules=()=>({dailyHours:8,overnightHours:16});
    const approved={schemaVersion:2,sharedDailyHours:6};
    const rules=nav.resolveCurrentLegRules({methodId:"walking"},null,null,approved);
    assert.equal(rules.dailyHours,6);
    assert.equal(rules.overnightHours,18);
    assert.equal(nav.resolveCurrentLegRules({methodId:"walking"}).dailyHours,8);
  }finally{globalThis.game=before;}
});

test("owned checkpoint unit selection is a scoped draft with selected capacity, pace and wages",async()=>{
  const previous={game:globalThis.game,foundry:globalThis.foundry,document:globalThis.document};
  try{
    const owned=setGroupTransportationMember(defaultGroupTransportation(),"group1","ship",{
      role:"unassigned",quantity:2,capacity:2,surface:"water",profileId:"warship",
      speedMphOverride:5,crewPolicyOverride:{crewCount:60,crewThresholds:{minimum:15,optimal:30,excellent:45},
        includeCrewWages:true,crewWageCpPerDay:200,crewWageBasis:"day"},crewRoster:[{unitIndex:1,named:[{actorId:"sailor"}],hired:10},{unitIndex:2,named:[],hired:30}]});
    const writes=[],journals=[];
    let dialogs=0;
    globalThis.document={createElement:tag=>({tag,style:{},textContent:"",children:[],append(...items){this.children.push(...items);}})};
    const labels=node=>[node.textContent,...node.children.flatMap(labels)];
    globalThis.foundry={applications:{api:{DialogV2:{confirm:async options=>{
      dialogs++;assert.match(labels(options.content).join(" "),/below.minimum/i);
      assert.match(options.yes?.label??"",/acknowledge/i);
      return false;
    }}}}};
    globalThis.game={user:{id:"gm",isGM:true},system:{id:"dnd5e"},time:{worldTime:0},settings:{
      get:(_module,key)=>key==="guidedGroupTransportation"?owned:undefined,
      set:(...args)=>writes.push(args)}};
    const from=point(0,0),to=point(300,0),end=point(400,0);
    const atlas={revision:1,nodes:[{id:"start",...from},{id:"end",...to},{id:"final",...end}],
      roads:[{id:"sea",name:"Sea passage",travelPresetId:"water-sea"},{id:"land",name:"Onward road"}],
      segments:[{id:"segment",roadId:"sea",from:"start",to:"end",via:[]},{id:"onward",roadId:"land",from:"end",to:"final",via:[]}],
      checkpoints:[{id:"dock",name:"Dock",nodeId:"start",roadId:"sea"},
        {id:"port",name:"Port",nodeId:"end",roadId:"sea"}]};
    const token={id:"party",x:-50,y:-50,width:1,height:1,moves:0,
      canUserModify:()=>true,move:async()=>{token.moves++;throw Error("Unexpected native movement");},actor:{id:"group1",type:"group",system:{members:[
      {actor:{id:"pc",name:"Traveler",type:"character"}},
      {actor:{id:"sailor",name:"Sailor",type:"npc"}},
      {actor:{id:"ship",name:"Warship",type:"vehicle"}}]}}};
    const scene={id:"sea-scene",grid:{size:100,units:"mi"},getFlag:()=>undefined,canUserModify:()=>true};
    const nav=new AtlasNavigationController({atlasProvider:()=>atlas,partyTokenProvider:()=>token,
      canvasProvider:()=>({ready:true,scene}),atlasPoint:(_v,_a,p)=>p,
      journeyJournalStore:{save:async record=>{journals.push(structuredClone(record));throw Error("Test Journal boundary");}}});
    nav.routeRevision=1;nav.syncPartyDeparture=()=>false;
    nav.scene=scene;nav.sourceMode="party";nav.render=async()=>{};
    nav.start=from;nav.end=end;
    nav.result={status:"ok",start:from,end,distance:65,cost:65,
      legs:[{kind:"road",roadId:"sea",segmentId:"segment",points:[from,to],distance:60,cost:60},
        {kind:"road",roadId:"land",segmentId:"onward",points:[to,end],distance:5,cost:5}]};
    nav.transferSelections[0]="owned|warship";
    nav.transferLegOperations[0]="normal";
    const original=JSON.stringify(owned);
    const initial=nav.transportationTransitionPlan().legs[0];
    assert.equal(initial.ownedUnitChoices.length,2);
    assert.deepEqual(initial.operatedUnits,[{actorId:"ship",unitIndex:1},{actorId:"ship",unitIndex:2}]);
    await nav.setCheckpointOperatedUnits([{actorId:"ship",unitIndex:1}]);
    const leg=nav.transportationTransitionPlan().legs[0];
    assert.deepEqual(leg.errors,[]);
    assert.equal(leg.hours,12);
    assert.equal(leg.serviceQuote.units,1);
    assert.equal(leg.ownedDraft.units[0].unitIndex,1);
    assert.equal(leg.ownedDraft.units[0].staffedCrew,11);
    assert.equal(leg.ownedDraft.crewWagesCp,4400);
    assert.equal(leg.serviceQuote.crewWagesCp,4400);
    assert.equal(await nav.startGuidedTravel(),false,"Cancel must not approve or save a Journey");
    assert.equal(dialogs,1);assert.equal(journals.length,0);
    globalThis.foundry.applications.api.DialogV2.confirm=async()=>{
      await nav.setCheckpointOperatedUnits([{actorId:"ship",unitIndex:2}]);return true;
    };
    await assert.rejects(()=>nav.startGuidedTravel(),/changed.*confirmation|review/i);
    assert.equal(journals.length,0);
    await nav.setCheckpointOperatedUnits([{actorId:"ship",unitIndex:1}]);
    globalThis.foundry.applications.api.DialogV2.confirm=async()=>{
      globalThis.game.user.isGM=false;return true;
    };
    await assert.rejects(()=>nav.startGuidedTravel(),/GM|changed.*confirmation/i);
    assert.equal(journals.length,0);
    globalThis.game.user.isGM=true;
    globalThis.foundry.applications.api.DialogV2.confirm=async()=>true;
    await assert.rejects(()=>nav.startGuidedTravel(),/Test Journal boundary/);
    assert.equal(journals.length,1,"Only a confirmed, revalidated plan reaches the Journal");
    const recorded=journals[0].legs[0];
    assert.deepEqual(recorded.transport.ownedApproval,{...leg.ownedDraft,belowMinimumAcknowledged:true});
    assert.deepEqual(recorded.participation.people.map(p=>[p.actorId,p.traveling,p.seats]),
      [["pc",true,1],["sailor",true,0]]);
    assert.equal(token.moves,0);
    // An empty passenger selection can travel with named non-passenger crew.
    nav.partySelectionMode="selected";nav.partySelectedIds=[];
    await assert.rejects(()=>nav.startGuidedTravel(),/Test Journal boundary/);
    assert.equal(journals.length,2);
    assert.deepEqual(journals[1].legs[0].participation.people.map(p=>[p.actorId,p.traveling,p.seats]),
      [["pc",false,1],["sailor",true,0]]);
    nav.partySelectionMode="all";nav.partySelectedIds=[];
    // Resume an interrupted approved departure with changed wage policy.
    // No native movement occurred yet, so its verified start anchor is intact.
    const fullRoute=nav.result;
    const saved=structuredClone(journals[0]);saved.status="interrupted";
    nav.recoveryRecord=saved;nav.recoveryJournal={id:"existing-journey"};
    nav.result={...fullRoute,end:to,distance:60,cost:60,legs:[fullRoute.legs[0]]};
    nav.end=to;nav.travelMethod="warship";nav.transportArrangement="owned";
    const storedShip=owned.groups.group1.members.ship;
    storedShip.crewPolicyOverride.crewWageCpPerDay=900;
    const restored=nav.transportationTransitionPlan().legs[0];
    assert.deepEqual(restored.ownedApproval,recorded.transport.ownedApproval);
    assert.equal(restored.costCp,0);
    await assert.rejects(()=>nav.startGuidedTravel(),/Test Journal boundary/);
    assert.equal(journals.length,3);
    const continued=journals[2].legs.at(-1);
    assert.deepEqual(continued.transport.ownedApproval,recorded.transport.ownedApproval);
    assert.deepEqual(continued.participation,recorded.participation);
    assert.equal(continued.transport.estimatedFareCp,0);
    assert.equal(continued.transport.continuation,true);
    const removed=token.actor.system.members.splice(1,1)[0];
    await assert.rejects(()=>nav.startGuidedTravel(),/roster changed|crew/i);
    assert.equal(journals.length,3);
    token.actor.system.members.splice(1,0,removed);
    storedShip.crewPolicyOverride.crewWageCpPerDay=200;
    nav.recoveryRecord=null;nav.recoveryJournal=null;
    nav.result=fullRoute;nav.end=end;nav.travelMethod="walking";
    assert.equal(leg.ownedDraft.belowMinimum,true);
    assert.equal(leg.ownedDraft.belowMinimumAcknowledged,undefined);
    assert.equal(leg.ownedApproval,undefined);
    // Only a confirmed snapshot may drive the execution/recovery schedule.
    const confirmed={...leg.ownedDraft,belowMinimumAcknowledged:true};
    const guidedLeg={transport:{methodId:"warship",operation:confirmed.operation,ownedApproval:confirmed}};
    const historical=nav.resolveCurrentLegRules({methodId:"warship",hoursPerDay:4},
      leg.selectedOption,guidedLeg);
    assert.equal(historical.dailyHours,confirmed.dailyHours,
      "execution must use the approved day, not the changed World travel hours");
    assert.equal(historical.overnightHours,confirmed.overnightHours);
    const invalid={...guidedLeg,transport:{...guidedLeg.transport,
      ownedApproval:{...confirmed,belowMinimumAcknowledged:false}}};
    assert.throws(()=>nav.resolveCurrentLegRules({methodId:"warship",hoursPerDay:4},
      leg.selectedOption,invalid),/acknowledg/i);

    await assert.rejects(()=>nav.setCheckpointOperatedUnits([{actorId:"ship",unitIndex:3}]),/unit/i);
    await nav.setCheckpointOperatedUnits([]);
    assert.ok(nav.transportationTransitionPlan().legs[0].errors.some(e=>/unit/i.test(e)));
    await nav.setCheckpointOperatedUnits([{actorId:"ship",unitIndex:2}]);
    token.actor.system.members.pop();
    assert.ok(nav.transportationTransitionPlan().legs[0].errors.length,"a vanished fleet cannot authorize travel");
    globalThis.game.user.isGM=false;
    await assert.rejects(()=>nav.setCheckpointOperatedUnits([{actorId:"ship",unitIndex:2}]),/GM/i);
    assert.deepEqual(writes,[]);
    assert.equal(JSON.stringify(owned),original);
  }finally{Object.assign(globalThis,previous);}
});
