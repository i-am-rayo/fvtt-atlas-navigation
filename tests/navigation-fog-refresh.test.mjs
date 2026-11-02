import assert from "node:assert/strict";
import test from "node:test";
import { AtlasManualFogController } from "../scripts/atlas-manual-fog-renderer.js";
import { applyManualFogBrush } from "../scripts/atlas-manual-fog-storage.js";
import { isManualFogOnlySceneUpdate } from "../scripts/atlas-manual-fog-refresh.js";

test("only isolated manual-fog flag updates skip expensive GM road redraws",()=>{
  assert.equal(isManualFogOnlySceneUpdate({flags:{"fvtt-atlas-navigation":{
    manualFog:{revealed:[]}}}}),true);
  assert.equal(isManualFogOnlySceneUpdate({flags:{"fvtt-atlas-navigation":{
    manualFog:{revealed:[]},atlas:{revision:9}}}}),false);
  assert.equal(isManualFogOnlySceneUpdate({flags:{"fvtt-atlas-navigation":{
    manualFog:{revealed:[]}},another:{x:1}}}),false);
  assert.equal(isManualFogOnlySceneUpdate({flags:{"fvtt-atlas-navigation":{
    manualFog:{revealed:[]}}},grid:{size:100}}),false);
});

test("explorer fog builds a complete mask before swapping; no solid-black intermediate frame",()=>{
  const old={canvas:globalThis.canvas,game:globalThis.game,
    PIXI:globalThis.PIXI,foundry:globalThis.foundry,CONST:globalThis.CONST};
  const order=[];
  class Graphics {
    constructor(){this.ops=[];this.destroyed=false;}
    beginFill(color,alpha){this.ops.push(["fill",color,alpha]);return this;}
    drawPolygon(points){this.ops.push(["polygon",points.length]);return this;}
    endFill(){return this;}
    drawRect(){this.ops.push(["full-black"]);return this;}
    destroy(){this.destroyed=true;order.push("destroy");}
  }
  let revealed=[];
  const scene={id:"fog-scene",grid:{type:1,size:10},dimensions:{rows:1,columns:2},
    getFlag(_module,key){return key==="manualFog"?{
      schemaVersion:1,enabled:true,revealed,hidden:[]}:null;}};
  const primary={children:[],addChild(g){
    order.push("add");this.children.push(g);g.parent=this;
  },removeChild(g){order.push("remove");this.children=this.children.filter(x=>x!==g);}};
  const view={ready:true,scene,primary,dimensions:{sceneX:0,sceneY:0,
    sceneWidth:20,sceneHeight:10},grid:{isGridless:false,
    getShape:()=>[{x:-5,y:-5},{x:5,y:-5},{x:5,y:5},{x:-5,y:5}],
    getCenterPoint:({j})=>({x:5+j*10,y:5})}};
  try{
    globalThis.canvas=view;globalThis.game={user:{isGM:true}};
    globalThis.PIXI={Graphics};
    globalThis.foundry={canvas:{groups:{PrimaryCanvasGroup:{SORT_LAYERS:{TILES:1}}}}};
    globalThis.CONST={GRID_TYPES:{GRIDLESS:0}};
    const fog=new AtlasManualFogController();
    fog.refresh();
    const initial=fog.layer;
    assert.equal(initial.ops.filter(op=>op[0]==="polygon").length,2);
    assert.ok(!initial.ops.some(op=>op[0]==="full-black"));
    order.length=0;
    revealed=[{x:5,y:5}];
    fog.refresh();
    assert.equal(fog.layer.ops.filter(op=>op[0]==="polygon").length,1);
    assert.deepEqual(order,["add","remove","destroy"],
      "the ready replacement is attached before the older fog can disappear");
    assert.equal(primary.children.length,1);
    assert.equal(initial.destroyed,true);
    fog.tearDown();
  }finally{Object.assign(globalThis,old);}
});

test("revisiting explored cells never writes another Scene flag or triggers its refresh",async()=>{
  const old={canvas:globalThis.canvas,game:globalThis.game,CONST:globalThis.CONST};
  let flagWrites=0;
  let fog={schemaVersion:1,enabled:true,revealed:[{x:5,y:5}],hidden:[]};
  const scene={id:"fog-revisit",grid:{type:1,size:10},dimensions:{rows:1,columns:2},
    canUserModify:()=>true,getFlag:(_module,key)=>key==="manualFog"?fog:null,
    async setFlag(_module,_key,value){fog=value;flagWrites++;}};
  const view={ready:true,scene,dimensions:{sceneX:0,sceneY:0},
    grid:{isGridless:false,getShape:()=>[{x:0,y:0},{x:1,y:0},{x:0,y:1}],
      getCenterPoint:({j})=>({x:5+j*10,y:5})}};
  try{
    globalThis.game={user:{isGM:true}};globalThis.canvas=view;
    globalThis.CONST={GRID_TYPES:{GRIDLESS:0}};
    await applyManualFogBrush(scene,[{x:5,y:5}],"reveal");
    assert.equal(flagWrites,0);
    await applyManualFogBrush(scene,[{x:15,y:5}],"reveal");
    assert.equal(flagWrites,1);
    await applyManualFogBrush(scene,[{x:15,y:5}],"reveal");
    assert.equal(flagWrites,1);
    await assert.rejects(applyManualFogBrush(scene,[{x:NaN,y:5}],"reveal"),/Invalid/);
  }finally{Object.assign(globalThis,old);}
});
