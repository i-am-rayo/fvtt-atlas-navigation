import assert from "node:assert/strict";
import test from "node:test";

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
    globalThis.game={user:{isGM:true},settings:{get:()=>false}};
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

test("navigation locks the completed route until deliberate endpoint gestures or New Route",async()=>{
  const previous={foundry:globalThis.foundry,game:globalThis.game,window:globalThis.window,
    PIXI:globalThis.PIXI,ui:globalThis.ui,document:globalThis.document};
  try{
    globalThis.foundry={applications:{api:{ApplicationV2:class {}}}};
    globalThis.game={user:{isGM:true},system:{id:"test"},settings:{get:()=>5}};
    globalThis.window={innerWidth:1200,innerHeight:850};
    globalThis.PIXI=undefined;
    globalThis.ui={notifications:{error(message){throw Error(message);}}};
    globalThis.document={createElement:tag=>({tag,style:{},children:[],textContent:"",
      listeners:new Map(),append(...nodes){this.children.push(...nodes);},
      appendChild(node){this.children.push(node);},
      addEventListener(name,handler){this.listeners.set(name,handler);}})};
    const scene={id:"scene-1",name:"Paedor",grid:{units:"km",size:100},
      getFlag:()=>null,tokens:{get:()=>null},canUserModify:()=>true,
      setFlag(){throw Error("Navigation must not write Scene flags.");}};
    const listeners=new Map();
    const target={addEventListener(name,handler){listeners.set(name,handler);},
      removeEventListener(name){listeners.delete(name);}};
    const view={ready:true,scene,app:{canvas:target},
      canvasCoordinatesFromClient:({x,y})=>point(x,y),
      dimensions:{sceneRect:{contains:()=>true}}};
    const atlas={revision:7,roads:[{id:"road-a",name:"Road A"}],nodes:[],segments:[]};
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
    const find=(item,match)=>match(item)?item:item.children.map(child=>find(child,match)).find(Boolean);
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
    nav.stop();
    assert.equal(listeners.has("pointerdown"),false);
  }finally{Object.assign(globalThis,previous);}
});

test("party departure chooses B with one click, tracks live token center, and preserves map mode",async()=>{
  const previous={game:globalThis.game,window:globalThis.window,PIXI:globalThis.PIXI,
    ui:globalThis.ui,document:globalThis.document};
  try{
    globalThis.game={user:{isGM:true},system:{id:"test"},settings:{get:()=>5}};
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
    nav.setSourceMode("party");
    assert.equal(nav.sourceMode,"party");
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

test("GM guided travel pauses and ends at native chunk boundaries with honest progress",async()=>{
  const previous={game:globalThis.game,window:globalThis.window,PIXI:globalThis.PIXI,
    ui:globalThis.ui,document:globalThis.document};
  let nav;
  try{
    globalThis.game={user:{isGM:true},settings:{get:(_module,key)=>
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
    const token={x:50,y:50,width:1,height:1,canUserModify:()=>true,
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
      atlasProvider:()=>atlas,partyTokenProvider:()=>token});
    nav.scene=scene;nav.routeRevision=7;
    nav.start=point(100,100);nav.end=point(300,200);
    nav.result={status:"ok",start:nav.start,end:nav.end,
      distance:20,cost:20,terrainAware:false,
      legs:[{kind:"road",roadId:"road-a",segmentId:"segment-a",
        points:[point(100,100),point(200,150),point(300,200)],distance:20,cost:20}]};
    const pending=nav.startGuidedTravel();
    assert.equal(calls.length,0,"render the Pause button before native movement begins");
    for(let i=0;i<5;i++)await Promise.resolve();
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
    for(let i=0;i<10;i++)await Promise.resolve();
    assert.equal(nav.travelSession.phase,"paused");
    assert.equal(calls.length,1,"pausing prevents the next chunk from starting");
    assert.ok(nav.travelProgress>0&&nav.travelProgress<100);
    const pausedPanel=await nav._renderHTML();
    assert.ok(find(pausedPanel,node=>node.tag==="button"&&node.textContent==="Resume Travel"));
    assert.equal(nav.resumeGuidedTravel(),true);
    for(let i=0;i<4;i++)await Promise.resolve();
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
    for(let i=0;i<4;i++)await Promise.resolve();
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
    for(let i=0;i<5;i++)await Promise.resolve();
    assert.equal(calls.length,previousCount+1);
    nav.pauseGuidedTravel();
    resolveTravel(true);
    for(let i=0;i<10;i++)await Promise.resolve();
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
      settings:{get:(_module,key)=>key==="guidedTravelAdvanceWorldTime"?worldEnabled:
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
    const token={x:50,y:50,width:1,height:1,canUserModify:()=>true,
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
      atlasProvider:()=>atlas,partyTokenProvider:()=>token});
    nav.scene=scene;nav.routeRevision=9;
    nav.start=point(100,100);nav.end=point(300,200);
    nav.result={status:"ok",start:nav.start,end:nav.end,
      distance:20,cost:20,terrainAware:false,
      legs:[{kind:"road",roadId:"road-a",segmentId:"segment-a",
        points:[point(100,100),point(200,150),point(300,200)],distance:20,cost:20}]};

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
    for(let i=0;i<15;i++)await Promise.resolve();
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
