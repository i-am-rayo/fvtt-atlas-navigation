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
    const scene={id:"scene-1",name:"Paedor",grid:{units:"km"},
      getFlag:()=>null,tokens:{get:()=>null},canUserModify:()=>true,
      setFlag(){throw Error("Navigation must not write Scene flags.");}};
    const listeners=new Map();
    const target={addEventListener(name,handler){listeners.set(name,handler);},
      removeEventListener(name){listeners.delete(name);}};
    const view={ready:true,scene,app:{canvas:target},
      canvasCoordinatesFromClient:({x,y})=>point(x,y),
      dimensions:{sceneRect:{contains:()=>true}}};
    const atlas={revision:7,roads:[{id:"road-a",name:"Road A"}]};
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
    assert.ok(newRoute,"New Route stays at the top while Directions can scroll");
    assert.equal(content.children[0].children.includes(newRoute),true);
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
