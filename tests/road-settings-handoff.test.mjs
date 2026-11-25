import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {runInNewContext} from "node:vm";

// Exercise the real main.js handoff, not a duplicate helper. Main's actual
// Foundry lifecycle cannot run in Node; only the tightly bounded dock functions
// are executed with the native application and Scene boundaries mocked.
const main=readFileSync(fileURLToPath(new URL("../scripts/main.js",import.meta.url)),"utf8");
const start=main.indexOf("function syncRoadDock(");
const end=main.indexOf("async function centerAtlasOn(",start);
assert.ok(start>=0&&end>start,"Foundry dock functions remain discoverable");

function fixture({allowed=true,activeScene=true}={}){
  const opened=[],warnings=[],errors=[],dockInstances=[];
  let restored=0,refreshed=0,cancelled=0,teardowns=0;
  const scene={id:"scene-a",canUserModify:()=>allowed};
  const road={id:"road-stable-id",name:"Harbor Road"};
  const canvas={ready:true,scene:{id:activeScene?"scene-a":"scene-b"}};
  const sandbox={
    canvas,game:{user:{isGM:true}},
    ui:{notifications:{warn:message=>warnings.push(message),
      error:message=>errors.push(message)}},
    readAtlas:()=>({roads:[road]}),
    navigation:{tearDown(){teardowns++;}},
    roadCanvas:{getDraft:()=>null,cancel(){cancelled++;}},
    acquireAtlasCanvasEditorFocus:()=>()=>{restored++;},
    actions:()=>({editRoadAppearance:async (...args)=>{opened.push(args);}}),
    AtlasRoadEditorDock:class{
      constructor(options){Object.assign(this,options);this.rendered=true;
        dockInstances.push(this);}
      render(){return Promise.resolve(this);}
      close(){this.onClosed();return Promise.resolve();}
    },
    console
  };
  runInNewContext(`let roadDock=null; ${main.slice(start,end)}
    globalThis.handoff={beginRoadDock,syncRoadDock};`,sandbox,
    {filename:"scripts/main.js"});
  return {scene,road,canvas,sandbox,opened,warnings,errors,dockInstances,
    counters:()=>({restored,refreshed,cancelled,teardowns}),
    begin(){
      let changed,created;
      sandbox.handoff.beginRoadDock(scene,()=>{refreshed++;},
        (onChange,onCreated)=>{changed=onChange;created=onCreated;});
      return {changed,created};
    }
  };
}

for(const entry of ["Atlas Workspace → Map Directory → Add Road",
  "Scene Controls → Draw Atlas Road"]){
  test(`${entry}: saved Road opens its exact persisted Settings once`,async()=>{
    const f=fixture();
    const {changed,created}=f.begin();
    assert.equal(f.opened.length,0,"drawing does not open settings");
    created(f.road.id);
    assert.equal(f.opened.length,0,"commit callback only records the Road ID");
    changed();
    await Promise.resolve();
    assert.equal(f.opened.length,1,
      "closing after commit must invoke the authoritative Road Settings action");
    assert.equal(f.opened[0][0],f.scene);
    assert.equal(f.opened[0][1],f.road);
    assert.equal(typeof f.opened[0][2],"function");
    assert.equal(f.warnings.length,0);
    assert.equal(f.errors.length,0);
    assert.equal(f.counters().restored,1,"dock focus restoration happens once");
    f.dockInstances[0].onClosed();
    assert.equal(f.opened.length,1,"a repeated close cannot reopen Settings");
  });
}

test("cancelled Road draft does not open Settings or create records",()=>{
  const f=fixture();
  const {changed}=f.begin();
  changed();
  assert.equal(f.opened.length,0);
  assert.equal(f.warnings.length,0);
});

test("saved Road handoff fails closed when active Scene changed or permissions were removed",()=>{
  for(const options of [{activeScene:false},{allowed:false}]){
    const f=fixture(options);
    const {changed,created}=f.begin();
    created(f.road.id);
    changed();
    assert.equal(f.opened.length,0,"never open editor across Scene/GM boundary");
    assert.equal(f.warnings.length,1);
  }
});
