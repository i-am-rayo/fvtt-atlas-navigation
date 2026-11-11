import test from "node:test";
import assert from "node:assert/strict";
import {territoryLocateCamera,TerritoryLocateHighlight,TERRITORY_LOCATE_DURATION_MS}
  from "../scripts/territory-locate-highlight.js";

class Container{
  constructor(){this.children=[];this.parent=null;this.alpha=1;}
  addChild(child){this.children.push(child);child.parent=this;return child;}
  removeChild(child){this.children=this.children.filter(item=>item!==child);child.parent=null;}
  destroy(){this.destroyed=true;}
}
class Graphics{
  constructor(){this.operations=[];}
  poly(points){this.operations.push(["poly",points]);return this;}
  stroke(options){this.operations.push(["stroke",options]);return this;}
  fill(options){this.operations.push(["fill",options]);return this;}
  destroy(){this.destroyed=true;}
}

function fixture(){
  const old={game:globalThis.game,window:globalThis.window,
    canvas:globalThis.canvas,PIXI:globalThis.PIXI};
  globalThis.PIXI={Graphics,Container};
  globalThis.game={user:{isGM:true},settings:{
    get:()=>({regionMode:"off"}),
    set:()=>{throw Error("Locate must never change persisted Atlas Layers.");}
  }};
  globalThis.window={matchMedia:()=>({matches:false})};
  const region={id:"town",name:"Genasi Village",parent:{id:"s1"},
    bounds:{x:100,y:200,width:500,height:300},
    polygons:[{points:[100,200,600,200,600,500,100,500]}]};
  const regions=new Map([[region.id,region]]);
  const scene={id:"s1",regions,canUserModify:()=>true};
  const moves=[];
  const view={scene,ready:true,interface:new Container(),
    app:{renderer:{screen:{width:1200,height:800}}},
    stage:{scale:{x:1.5}},animatePan:async options=>{moves.push(options);}};
  globalThis.canvas=view;
  let time=0,next=0;
  const timers=new Map();
  const locator=new TerritoryLocateHighlight({now:()=>time,
    schedule:(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id;},
    cancel:id=>timers.delete(id)});
  const step=ms=>{
    time+=ms;
    const tasks=[...timers.values()];timers.clear();
    for(const task of tasks)task.fn();
  };
  return {region,scene,view,locator,moves,timers,step,
    restore:()=>{locator.clear();Object.assign(globalThis,old);}};
}

test("Region bounds fit the viewport with margin, including very large territories",()=>{
  const view={app:{renderer:{screen:{width:1000,height:700}}},stage:{scale:{x:1}}};
  assert.deepEqual(territoryLocateCamera(view,{x:150,y:250,width:2000,height:1000}),
    {x:1150,y:750,scale:.39});
  assert.throws(()=>territoryLocateCamera(view,{x:0,y:0,width:0,height:1}),/bounds/);
});

test("GM Locate briefly highlights only its target while Layers are Hidden, without writes",async()=>{
  const f=fixture();
  try{
    const camera=await f.locator.focus(f.scene,f.region,{view:f.view});
    assert.deepEqual(camera,{x:350,y:350,scale:1.872});
    assert.equal(f.moves.length,1);
    assert.equal(f.moves[0].duration,750);
    assert.equal(f.view.interface.children.length,1);
    const layer=f.locator.active.layer;
    assert.equal(layer.children.length,2);
    assert.equal(layer.children[0].operations.filter(op=>op[0]==="stroke").length,0,
      "native triangulation never shares a path with outlines");
    assert.equal(layer.children[1].operations.filter(op=>op[0]==="stroke").length,2);
    assert.equal(f.timers.size,1);
    f.step(650);
    assert.ok(layer.alpha>.65,"the temporary native boundary pulses");
    f.step(TERRITORY_LOCATE_DURATION_MS);
    assert.equal(f.locator.active,null);
    assert.equal(f.view.interface.children.length,0,"the highlight is automatically removed");
    assert.equal(f.timers.size,0,"no stale animation timer remains");
  }finally{f.restore();}
});

test("switching scenes or selecting a second Region tears down the old highlight",async()=>{
  const f=fixture();
  try{
    await f.locator.focus(f.scene,f.region,{view:f.view});
    const original=f.locator.active.layer;
    await f.locator.focus(f.scene,f.region,{view:f.view});
    assert.equal(original.destroyed,true);
    assert.equal(f.view.interface.children.length,1);
    f.view.scene={id:"another-scene"};
    f.step(100);
    assert.equal(f.locator.active,null);
    assert.equal(f.view.interface.children.length,0);
  }finally{f.restore();}
});

test("non-GM cannot create a territory Locate overlay",async()=>{
  const f=fixture();
  try{
    globalThis.game.user.isGM=false;
    await assert.rejects(()=>f.locator.focus(f.scene,f.region,{view:f.view}),/GM/);
    assert.equal(f.view.interface.children.length,0);
  }finally{f.restore();}
});
