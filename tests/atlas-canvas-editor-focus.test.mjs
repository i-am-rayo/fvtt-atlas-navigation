import test from "node:test";
import assert from "node:assert/strict";
import {acquireAtlasCanvasEditorFocus} from "../scripts/atlas-canvas-editor-focus.js";

const tick=()=>new Promise(resolve=>setImmediate(resolve));
function windowApp({minimized=false,hasFrame=true,rendered=true}={}){
  return {minimized,hasFrame,rendered,minCalls:0,maxCalls:0,
    async minimize(){this.minCalls++;this.minimized=true;},
    async maximize(){this.maxCalls++;this.minimized=false;}};
}

test("canvas focus minimizes only active v14 framed windows and restores original state",async()=>{
  const previous=globalThis.foundry;
  const editor=windowApp(),normal=windowApp(),already=windowApp({minimized:true});
  const chrome=windowApp({hasFrame:false}),closed=windowApp({rendered:false});
  globalThis.foundry={applications:{instances:new Map([
    ["editor",editor],["normal",normal],["already",already],
    ["chrome",chrome],["closed",closed]])}};
  try{
    const restore=acquireAtlasCanvasEditorFocus({exclude:[editor]});
    await tick();
    assert.equal(normal.minCalls,1);
    assert.equal(editor.minCalls,0);
    assert.equal(already.minCalls,0);
    assert.equal(chrome.minCalls,0);
    assert.equal(closed.minCalls,0);
    restore();restore();await tick();
    assert.equal(normal.maxCalls,1);
    assert.equal(already.maxCalls,0);
    assert.equal(normal.minimized,false);
  }finally{globalThis.foundry=previous;}
});

test("overlapping canvas editors restore once after final close",async()=>{
  const previous=globalThis.foundry,app=windowApp();
  globalThis.foundry={applications:{instances:new Map([["window",app]])}};
  try{
    const closeFirst=acquireAtlasCanvasEditorFocus();
    const closeSecond=acquireAtlasCanvasEditorFocus();
    await tick();
    assert.equal(app.minCalls,1);
    closeFirst();await tick();assert.equal(app.maxCalls,0);
    closeSecond();await tick();assert.equal(app.maxCalls,1);
    const closeThird=acquireAtlasCanvasEditorFocus();
    await tick();assert.equal(app.minCalls,2);
    // If GM manually reopens a window, do not maximize it on close.
    app.minimized=false;
    closeThird();await tick();assert.equal(app.maxCalls,1);
  }finally{globalThis.foundry=previous;}
});

test("an editor that closes before minimization completes still restores safely",async()=>{
  const previous=globalThis.foundry,app=windowApp();
  let finishMinimize;
  app.minimize=()=>new Promise(resolve=>{finishMinimize=()=>{app.minimized=true;resolve();};});
  globalThis.foundry={applications:{instances:new Map([["window",app]])}};
  try{
    const close=acquireAtlasCanvasEditorFocus();
    close();finishMinimize();await tick();
    assert.equal(app.maxCalls,1);
  }finally{globalThis.foundry=previous;}
});
