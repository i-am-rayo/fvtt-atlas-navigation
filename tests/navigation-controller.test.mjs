import assert from "node:assert/strict";
import test from "node:test";
import { createNavigationItinerary } from "../scripts/navigation-itinerary.js";
import { createJourneyRecord,checkpointJourneyRecord,findRecoverableJourney,
  JOURNEY_JOURNAL_FLAG } from "../scripts/navigation-journey-journal.js";
import { estimateNavigationTotalTrip } from "../scripts/navigation-travel-day.js";
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
    nav.recoverSavedJourney=()=>{recovered++;return true;};
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
    const newRoute=find(content,item=>item.tag==="button"&&item.textContent==="New Route");
    assert.ok(newRoute,"New Route is always visible in the non-scrolling footer");
    const footer=content.children.at(-1);
    assert.equal(footer.children.includes(newRoute),true);
    assert.match(content.children[0].style.cssText,/overflow-y:auto/,
      "the route Directions scroll without hiding travel controls");
    const travelButton=find(content,item=>item.tag==="button"&&item.textContent==="Travel Route");
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
      item.textContent==="Travel Route");
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
      item.textContent==="Travel Route").disabled,false);
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
    assert.equal(footer.children.some(node=>node.textContent==="Travel Route"),true);
    const reset=find(panel,node=>node.tag==="button"&&node.textContent==="New Route");
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
    assert.ok(find(prepared,node=>node.textContent==="Open Journey Journal"));
    nav.clear();
    assert.equal(nav.recoveryRecord,null,"New Route abandons the loaded recovery");
    nav.findRecoverableJournal();
    atlas.revision=12;
    assert.throws(()=>nav.recoverSavedJourney(),/no longer matches/);
    nav.stop();
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
    assert.ok(find(movingPanel,node=>node.tag==="button"&&node.textContent==="Pause Travel"));
    assert.ok(find(movingPanel,node=>node.tag==="button"&&node.textContent==="End Journey"));
    const bar=find(movingPanel,node=>node.tag==="progress");
    assert.equal(bar.value,0);
    assert.equal(bar.max,100);
    assert.equal(nav.pauseGuidedTravel(),true);
    assert.equal(nav.travelSession.phase,"pausing");
    const pausingPanel=await nav._renderHTML();
    assert.ok(find(pausingPanel,node=>node.tag==="button"&&node.textContent==="Pausing…"));
    resolveTravel(true);
    await tickUntil(()=>nav.travelSession?.phase==="paused");
    assert.equal(nav.travelSession.phase,"paused");
    assert.equal(calls.length,1,"pausing prevents the next chunk from starting");
    assert.ok(nav.travelProgress>0&&nav.travelProgress<100);
    const pausedPanel=await nav._renderHTML();
    assert.ok(find(pausedPanel,node=>node.tag==="button"&&node.textContent==="Resume Travel"));
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

    // A complete journey progresses through its chunks and reaches 100%.
    autoResolve=true;
    token.x=50;token.y=50;
    const again=nav.startGuidedTravel();
    assert.equal(await again,true);
    assert.equal(nav.travelProgress,100);
    assert.match(nav.travelNotice,/Arrived/);

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
    assert.ok(find(stillMoving,node=>node.tag==="button"&&node.textContent==="Pause Travel"));
    assert.equal(find(stillMoving,node=>node.tag==="button"&&node.textContent==="Travel Route"),undefined);
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
    assert.equal(await nav.startGuidedTravel(),true);
    assert.equal(seconds.length,count,"disabled World setting prevents time writes");

    token.x=50;token.y=50;
    worldEnabled=true;
    game.users.activeGM={id:"another-gm"};
    await assert.rejects(nav.startGuidedTravel(),/active GM/);
    assert.equal(seconds.length,count);
    game.users.activeGM={id:"gm-1"};

    // If the GM interrupts after one completed chunk, only that part is paid.
    autoResolve=false;
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
    assert.equal(await nav.startGuidedTravel(),false);
    assert.equal(moveCount,previousMoves+1,"time failure prevents further movement chunks");
    assert.equal(nav.worldTimeAdvancedSeconds,0);
    assert.match(nav.travelNotice,/World time could not advance: Clock is unavailable/);

    // Unexpected errors inside an active movement should be visible in the
    // Navigation window rather than silently dropping the in-flight session.
    failClock=false;failMovement=true;
    token.x=50;token.y=50;
    await assert.rejects(nav.startGuidedTravel(),/Native animation failed/);
    assert.match(nav.travelNotice,/Journey interrupted: Native animation failed/);
    assert.equal(nav.travelSession,null);

    // A native operation reporting true but ending off the route is not
    // confirmed travel: neither progress nor World time may be credited.
    failClock=false;failMovement=false;
    misplaceNext=true;
    token.x=50;token.y=50;
    const beforeMismatch=seconds.reduce((a,b)=>a+b,0);
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
  nav.scene={id:"scene"};
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
  assert.match(nav.travelNotice,/Select the next transport method/);
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
    assert.equal(logs.at(-1).legs[0].completedPercent,100);
    assert.equal(nav.travelSession,null);
    assert.equal(nav.result,null,"full future route is not active after arrival");
  }finally{Object.assign(globalThis,previous);}
});
