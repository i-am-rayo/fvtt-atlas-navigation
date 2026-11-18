import test from "node:test";
import assert from "node:assert/strict";
import {acquireAtlasTerritoryEditorFog}
  from "../scripts/atlas-territory-editor-fog.js";

test("Territory editing hides both local fog renderers and restores their original states",()=>{
  const old={game:globalThis.game,canvas:globalThis.canvas,Hooks:globalThis.Hooks};
  const listeners=new Map(),changes=[];
  const view={ready:true,scene:{id:"current"},visibility:{visible:true}};
  const manualFog={editorHidden:false,setEditorHidden(value){
    this.editorHidden=value;changes.push(value);
  }};
  try{
    globalThis.game={user:{isGM:true}};
    globalThis.canvas=view;
    globalThis.Hooks={on(name,fn){listeners.set(name,fn);return fn;},
      off(name,fn){if(listeners.get(name)===fn)listeners.delete(name);}};
    const restore=acquireAtlasTerritoryEditorFog({view,manualFog});
    assert.equal(view.visibility.visible,false);
    assert.equal(manualFog.editorHidden,true);
    view.visibility.visible=true;
    listeners.get("visibilityRefresh")();
    assert.equal(view.visibility.visible,false,"native refresh stays hidden in editor");
    restore();restore();
    assert.equal(view.visibility.visible,true);
    assert.equal(manualFog.editorHidden,false);
    assert.deepEqual(changes,[true,false],"release is idempotent");
    assert.equal(listeners.size,0);
  }finally{Object.assign(globalThis,old);}
});

test("GM fog view never overrides an already-hidden native layer or a different Scene",()=>{
  const old={game:globalThis.game,canvas:globalThis.canvas,Hooks:globalThis.Hooks};
  try{
    globalThis.game={user:{isGM:true}};
    const view={ready:true,scene:{id:"original"},visibility:{visible:false}};
    globalThis.canvas=view;globalThis.Hooks=undefined;
    const restore=acquireAtlasTerritoryEditorFog({view});
    view.scene={id:"different"};restore();
    assert.equal(view.visibility.visible,false);
    globalThis.game.user.isGM=false;
    assert.throws(()=>acquireAtlasTerritoryEditorFog({view}),/GM/);
  }finally{Object.assign(globalThis,old);}
});
