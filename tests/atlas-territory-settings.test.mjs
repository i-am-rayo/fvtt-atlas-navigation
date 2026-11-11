import test from "node:test";
import assert from "node:assert/strict";

class MockApplicationV2{
  constructor(options={}){this.options=options;this.rendered=false;this.minimized=false;}
  async render(){
    if(this.constructor.name==="AtlasRegionGeneratorWindow"){
      this.rendered=true;return this;
    }
    this.result=await this._renderHTML();this.rendered=true;return this;
  }
  async minimize(){this.minimized=true;}
  async maximize(){this.minimized=false;}
  async close(){this.rendered=false;return this;}
}
globalThis.foundry={applications:{api:{ApplicationV2:MockApplicationV2}}};
const {AtlasTerritorySettings,openAtlasTerritorySettings}=
  await import("../scripts/atlas-territory-settings.js");
const {openAtlasRegionGenerator,closeCheckpointRegionGenerator}=
  await import("../scripts/scene-config.js");

class Element{
  constructor(tag){
    this.tag=tag;this.children=[];this.listeners=new Map();this.dataset={};
    this.style={};this.attributes=new Map();this.classList={add:()=>{}};
  }
  setAttribute(key,value){this.attributes.set(key,String(value));}
  appendChild(child){this.children.push(child);return child;}
  append(...nodes){for(const node of nodes)this.appendChild(node);}
  addEventListener(type,fn){this.listeners.set(type,fn);}
}
const all=(root,predicate)=>[root,...root.children.flatMap(child=>all(child,predicate))]
  .filter(predicate);
const buttons=root=>all(root,node=>node.tag==="button");
const text=root=>[root.textContent??"",...root.children.map(text)].join(" ");
const click=async button=>button.listeners.get("click")({preventDefault(){},stopPropagation(){}});
const page=async(app,label)=>{
  await click(buttons(app.result).find(button=>
    button.dataset.atlasTerritoryPage===label));
  await new Promise(resolve=>setImmediate(resolve));
};
const action=(app,label)=>buttons(app.result).find(button=>button.textContent===label);

function fixture({linked=true,kind="town",checkpoint=null,polygon=true}={}){
  const previous={game:globalThis.game,document:globalThis.document,
    window:globalThis.window,ui:globalThis.ui};
  globalThis.document={createElement:tag=>new Element(tag)};
  globalThis.window={innerWidth:1280,innerHeight:950};
  globalThis.game={user:{isGM:true},i18n:{lang:"en",localize:k=>k},
    settings:{get:()=>null}};
  const errors=[];globalThis.ui={notifications:{error:msg=>errors.push(msg)}};
  const flags={atlas:linked?{schemaVersion:1,linked:true}:null,
    territoryGeography:linked?{schemaVersion:1,kind,parentRegionId:null,
      roadOverrides:{}}:null,
    territoryCheckpoint:checkpoint?{schemaVersion:1,checkpointId:checkpoint}:null};
  const region={id:"r1",name:"Hearth's Heart",hidden:false,
    behaviors:[],color:"#aabbcc",shapes:polygon?[{type:"polygon",points:[0,0,20,0,20,20]}]:[],
    getFlag:(_module,key)=>flags[key]??null};
  const regions=[region];regions.get=id=>regions.find(item=>item.id===id);
  const scene={id:"s1",regions,getFlag:()=>null,canUserModify:()=>true};
  const calls=[];
  const track=name=>(...args)=>{calls.push([name,args[1]]);};
  const actions={draft:()=>null,
    configureRegion:track("native"),configureGeography:track("geography"),
    setNativeRegionLink:track("atlas-link"),
    configureTerritoryCheckpoint:track("checkpoint-link"),
    configurePublicTerritory:(...args)=>{calls.push(["public",args[2]]);},
    configureTerritorySharing:track("sharing"),
    editTerritoryBoundary:track("paint"),
    previewTerritoryGridConversion:track("convert"),
    restoreTerritoryPolygon:track("restore"),
    adoptNativeTerritoryBoundary:track("adopt"),smoothNativeRegion:track("smooth"),
    editCheckpointAppearance:track("checkpoint-appearance")};
  return {scene,region,flags,calls,errors,actions,
    restore:()=>Object.assign(globalThis,previous)};
}

test("single modeless Territory Settings window retains tabs, permissions and all original actions",async()=>{
  const f=fixture();
  try{
    const app=openAtlasTerritorySettings(f.scene,"r1",f.actions,()=>{},()=>f.calls.push(["locate"]));
    await app.render();
    assert.equal(app.options.window.title,"Atlas — Hearth's Heart — Territory Settings");
    assert.equal(AtlasTerritorySettings.DEFAULT_OPTIONS.window.minimizable,true);
    assert.equal(AtlasTerritorySettings.DEFAULT_OPTIONS.window.resizable,true);
    assert.match(text(app.result),/Geographic kind/);
    assert.equal(f.calls.length,0,"opening and switching Settings never performs a write");
    const reopened=openAtlasTerritorySettings(f.scene,"r1",f.actions,()=>{});
    assert.equal(reopened,app,"Scene + Region editor is reused");
    await app.minimize();assert.equal(app.minimized,true);
    await app.maximize();assert.equal(app.minimized,false);
    await page(app,"Checkpoint & Journal");
    assert.match(text(app.result),/No Atlas Checkpoint linked/);
    assert.ok(action(app,"Link or unlink Checkpoint")?.disabled===false);
    await click(action(app,"Link or unlink Checkpoint"));
    assert.deepEqual(f.calls.at(-1),["checkpoint-link","r1"]);
    assert.equal(action(app,"Link or unlink Checkpoint").disabled,false,
      "a successful action must not leave newly rendered buttons greyed out");
    await page(app,"Map & Visibility");
    await click(action(app,"Public Journey name"));
    await click(action(app,"Player boundary sharing"));
    assert.equal(action(app,"Public Journey name").disabled,false);
    assert.equal(action(app,"Player boundary sharing").disabled,false);
    assert.deepEqual(f.calls.slice(-2),[["public","r1"],["sharing","r1"]]);
    await page(app,"Boundary & Native");
    assert.ok(action(app,"Convert polygon to hex/grid"));
    assert.ok(action(app,"Adopt native boundary")?.disabled,
      "the adoption shortcut must remain gated until native Shapes change");
    await click(action(app,"Paint / edit boundary"));
    await click(action(app,"Convert polygon to hex/grid"));
    assert.deepEqual(f.calls.slice(-2),[["paint","r1"],["convert","r1"]]);
    await page(app,"General");
    await click(action(app,"Geographic classification"));
    assert.equal(action(app,"Geographic classification").disabled,false,
      "General buttons recover immediately without switching tabs");
    assert.equal(f.calls.at(-1)[0],"geography");
    assert.deepEqual(f.errors,[]);
    await app.close();
  }finally{f.restore();}
});

test("unlinked or unauthorized Territories fail closed without side effects",async()=>{
  const f=fixture({linked:false});
  try{
    const app=new AtlasTerritorySettings({scene:f.scene,regionId:"r1",actions:f.actions,refresh:()=>{}});
    await app.render();
    assert.equal(action(app,"Geographic classification").disabled,true);
    await page(app,"Map & Visibility");
    assert.equal(action(app,"Player boundary sharing").disabled,true);
    await page(app,"Boundary & Native");
    assert.equal(action(app,"Paint / edit boundary").disabled,true);
    assert.equal(f.calls.length,0);
    globalThis.game.user.isGM=false;
    await assert.rejects(()=>app.render(),/GM/);
    assert.throws(()=>openAtlasTerritorySettings(f.scene,"r1",f.actions,()=>{}),/GM/);
  }finally{f.restore();}
});

test("Locate minimizes Territory Settings without refreshing a minimized Workspace",async()=>{
  const f=fixture();
  try{
    let refreshes=0,locates=0;
    const app=new AtlasTerritorySettings({scene:f.scene,regionId:"r1",
      actions:f.actions,refresh:()=>refreshes++,onLocate:async()=>{locates++;}});
    await app.render();
    await click(action(app,"Locate on map"));
    assert.equal(locates,1);
    assert.equal(refreshes,0,"Locate is visual-only and must not restore the Workspace");
    assert.equal(app.minimized,true);
    assert.equal(action(app,"Locate on map").disabled,false);
    assert.deepEqual(f.errors,[]);
  }finally{f.restore();}
});

test("open Checkpoint membership report refreshes after saved Region/Scene changes and unhooks on close",async()=>{
  const f=fixture(),priorHooks=globalThis.Hooks,priorCanvas=globalThis.canvas;
  const handlers=new Map();let added=0,removed=0;
  globalThis.Hooks={on(event,fn){handlers.set(event,fn);added++;return fn;},
    off(event,fn){if(handlers.get(event)===fn){handlers.delete(event);removed++;}}};
  globalThis.canvas={ready:true,scene:f.scene};
  try{
    const app=openAtlasTerritorySettings(f.scene,"r1",f.actions,()=>{});
    await app.render();await page(app,"Checkpoint & Journal");
    assert.equal(added,4,"one set of membership lifecycle hooks");
    let refreshes=0;
    const original=app.render.bind(app);
    app.render=async(...args)=>{refreshes++;return original(...args);};
    handlers.get("updateRegion")({parent:{id:f.scene.id}});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(refreshes,1,"native Region update refreshes the active inspector");
    handlers.get("updateScene")({id:"another-scene"});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(refreshes,1,"unrelated Scene changes do not refresh");
    await app.close();
    assert.equal(removed,4,"closing Settings removes registered hooks");
  }finally{globalThis.Hooks=priorHooks;globalThis.canvas=priorCanvas;f.restore();}
});

test("auto generator lifecycle closes only the checkpoint that completed a link",async()=>{
  const f=fixture();
  try{
    // The generator's full UI is heavyweight; verify only its app lifecycle.
    const first=openAtlasRegionGenerator(f.scene,"road-a",f.actions,()=>{},"cp-a");
    const second=openAtlasRegionGenerator(f.scene,"road-a",f.actions,()=>{},"cp-b");
    assert.equal(await closeCheckpointRegionGenerator(f.scene,"cp-a"),true);
    assert.equal(first.rendered,false);
    assert.equal(await closeCheckpointRegionGenerator(f.scene,"cp-a"),false);
    assert.equal(await closeCheckpointRegionGenerator(f.scene,"cp-b"),true);
    assert.equal(second.rendered,false);
    assert.equal(AtlasTerritorySettings.DEFAULT_OPTIONS.window.minimizable,true);
  }finally{f.restore();}
});
