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

test("GM guided travel uses native TokenDocument.move and can be stopped without teleporting",async()=>{
  const previous={game:globalThis.game,window:globalThis.window,PIXI:globalThis.PIXI,
    ui:globalThis.ui,document:globalThis.document};
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
    let resolveTravel;
    const token={x:50,y:50,width:1,height:1,
      canUserModify:()=>true,
      move(waypoints,options){
        calls.push({waypoints,options});
        return new Promise(resolve=>{resolveTravel=resolve;});
      },
      pauseMovement(){this.pauses=(this.pauses??0)+1;return ()=>{
        this.resumes=(this.resumes??0)+1;return Promise.resolve(true);
      };},
      stopMovement(){this.stops=(this.stops??0)+1;return true;}
    };
    const scene={id:"scene-guided",name:"Paedor",grid:{size:100,units:"km"},
      canUserModify:()=>true,getFlag:()=>null};
    const view={ready:true,scene};
    const atlas={revision:7,nodes:[{id:"a",...point(100,100)},{id:"b",...point(300,200)}],
      segments:[{id:"segment-a",roadId:"road-a",from:"a",to:"b",via:[]}],
      roads:[{id:"road-a",name:"Road A"}]};
    const nav=new AtlasNavigationController({canvasProvider:()=>view,
      atlasProvider:()=>atlas,partyTokenProvider:()=>token});
    nav.scene=scene;
    nav.routeRevision=7;
    nav.start=point(100,100);
    nav.end=point(300,200);
    nav.result={status:"ok",start:nav.start,end:nav.end,
      distance:2,cost:2,terrainAware:false,
      legs:[{kind:"road",roadId:"road-a",segmentId:"segment-a",
        points:[point(100,100),point(200,150),point(300,200)],distance:2,cost:2}]};
    const pending=nav.startGuidedTravel();
    assert.equal(calls.length,0,"render the Pause button before native movement begins");
    await Promise.resolve();
    assert.equal(calls.length,1);
    assert.deepEqual(calls[0].waypoints[0],point(50,50));
    assert.deepEqual(calls[0].waypoints.at(-1),point(250,150));
    assert.equal(calls[0].options.animate,true);
    assert.equal(calls[0].options.showRuler,false);
    assert.ok(calls[0].options.animation.movementSpeed>0);
    assert.notEqual(calls[0].options.animation.movementSpeed,8,
      "native animation speed must be derived from calculated travel time");
    assert.equal(calls[0].options.constrainOptions,undefined,
      "Foundry native movement constraints are not bypassed");
    assert.ok(nav.travelSession);
    const find=(item,match)=>match(item)?item:item.children.map(child=>find(child,match)).find(Boolean);
    const movingPanel=await nav._renderHTML();
    assert.ok(find(movingPanel,node=>node.tag==="button"&&node.textContent==="Pause Travel"));
    assert.ok(find(movingPanel,node=>node.tag==="button"&&node.textContent==="End Journey"));
    assert.equal(nav.pauseGuidedTravel(),true);
    assert.equal(nav.travelSession.phase,"paused");
    assert.equal(token.pauses,1);
    const pausedPanel=await nav._renderHTML();
    assert.ok(find(pausedPanel,node=>node.tag==="button"&&node.textContent==="Resume Travel"));
    assert.equal(nav.resumeGuidedTravel(),true);
    assert.equal(token.resumes,1);
    assert.equal(nav.travelSession.phase,"moving");
    assert.equal(nav.stopGuidedTravel(),true);
    assert.equal(token.stops,1);
    resolveTravel(false);
    assert.equal(await pending,false);
    assert.equal(nav.travelSession,null);
    assert.match(nav.travelNotice,/stopped before arrival/);

    const again=nav.startGuidedTravel();
    await Promise.resolve();
    assert.equal(calls.length,2);
    resolveTravel(true);
    assert.equal(await again,true);
    assert.match(nav.travelNotice,/Arrived/);
    nav.stop();
  }finally{Object.assign(globalThis,previous);}
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
