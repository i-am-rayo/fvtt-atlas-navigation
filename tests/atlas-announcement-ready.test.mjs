import assert from "node:assert/strict";
import test from "node:test";

test("v14 module init registers restricted preview and server-authorized public delivery",async()=>{
  const original={foundry:globalThis.foundry,Hooks:globalThis.Hooks,
    game:globalThis.game};
  try{
    const hooks=new Map(),menus=[],settings=[];
    const priorPulse={schemaVersion:1,id:"previous-world-event",type:"journey.paused"};
    globalThis.foundry={applications:{api:{ApplicationV2:class{}}}};
    globalThis.Hooks={once:(name,callback)=>{hooks.set(name,callback);}};
    globalThis.game={
      user:{id:"gm",isGM:true},
      users:{activeGM:{id:"gm"}},
      settings:{
        registerMenu:(...args)=>menus.push(args),
        register:(...args)=>settings.push(args),
        get:()=>priorPulse
      }
    };
    await import("../scripts/atlas-announcement-settings.js");
    assert.equal(typeof hooks.get("init"),"function");
    assert.equal(typeof hooks.get("ready"),"function");
    hooks.get("init")();
    assert.equal(menus.length,1);
    assert.equal(menus[0][2].restricted,true);
    assert.equal(settings.length,1);
    assert.equal(settings[0][2].scope,"world");
    assert.equal(settings[0][2].config,false);
    const {atlasAnnouncementRuntime}=await import(
      "../scripts/atlas-announcement-runtime.js");
    const shown=[];
    atlasAnnouncementRuntime.renderer={enqueue:(type,options)=>{
      shown.push([type,options]);return true;}};
    // No old Journey from another session may play on client bootstrap.
    assert.equal(settings[0][2].onChange(priorPulse),false);
    assert.deepEqual(shown,[]);
    hooks.get("ready")();
    settings[0][2].onChange(priorPulse);
    assert.deepEqual(shown,[]);
    settings[0][2].onChange({schemaVersion:1,
      id:"fresh-player-event-01",type:"destination.reached"});
    assert.deepEqual(shown,[["destination.reached",{
      subject:"your destination"}]]);
  }finally{
    globalThis.foundry=original.foundry;
    globalThis.Hooks=original.Hooks;
    globalThis.game=original.game;
  }
});
