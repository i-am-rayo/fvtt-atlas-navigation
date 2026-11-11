import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

class MockApplicationV2 {
  constructor(){this.rendered=false;}
  async render(){this.result=await this._renderHTML();this.rendered=true;return this;}
}
globalThis.foundry={applications:{api:{ApplicationV2:MockApplicationV2}}};
const {AtlasLayersController,AtlasLayersWindow}=
  await import("../scripts/atlas-layers.js");
const {ATLAS_LAYERS_SETTING,DEFAULT_ATLAS_LAYERS,validateAtlasLayers,
  updateAtlasLayers}=await import("../scripts/atlas-layer-preferences.js");

test("Atlas Layers preferences have versioned, validated client-local defaults",()=>{
  assert.deepEqual(validateAtlasLayers(null),DEFAULT_ATLAS_LAYERS);
  const chosen=updateAtlasLayers(null,{roadMode:"terrain",regionMode:"combined",
    showRegionNames:true,continentFillOpacity:.4,settlementFillOpacity:0});
  assert.deepEqual(validateAtlasLayers(chosen),chosen);
  for(const change of [{roadMode:"unknown"},{regionMode:"everyone"},
    {showRegionNames:"true"},{continentFillOpacity:-1},{settlementFillOpacity:.9},
    {schemaVersion:2},{nativeRegions:true}])
    assert.throws(()=>updateAtlasLayers(null,change),/Invalid|Unknown/);
  assert.throws(()=>validateAtlasLayers({...chosen,schemaVersion:5}),/Unknown/);
  assert.throws(()=>validateAtlasLayers({...chosen,secretFlag:1}),/Unknown/);
});

test("GM and player map preferences remain client-local; players cannot select GM Road modes",async()=>{
  const previous={game:globalThis.game,Hooks:globalThis.Hooks,canvas:globalThis.canvas,
    document:globalThis.document};
  const values=new Map(),hooks=new Map(),registrations=new Map(),viewModes=[];
  const scene={id:"scene1",regions:new Map(),getFlag:()=>null,
    update:()=>{throw Error("Atlas Layers must not write Scenes");}};
  globalThis.game={user:{id:"gm1",isGM:true},settings:{
    register(_scope,key,options){registrations.set(key,options);
      values.set(key,structuredClone(options.default));},
    get(_scope,key){return values.get(key);},
    async set(_scope,key,value){values.set(key,structuredClone(value));
      registrations.get(key).onChange?.(value);}
  }};
  globalThis.Hooks={on(event,callback){if(!hooks.has(event))hooks.set(event,[]);
    hooks.get(event).push(callback);}};
  globalThis.canvas={scene,ready:true,interface:{addChild(){}}};
  globalThis.document={createElement:tag=>new Element(tag)};
  try{
    const suppressed=[];
    const roadCanvas={setViewMode:mode=>viewModes.push(mode),
      setTerritoryLabelCheckpointIds:ids=>suppressed.push([...ids])};
    const controller=new AtlasLayersController(roadCanvas);
    controller.register();
    assert.equal(registrations.get(ATLAS_LAYERS_SETTING).scope,"client");
    assert.equal(registrations.get(ATLAS_LAYERS_SETTING).config,false);
    let regionOpts=null;
    controller.regions.sync=(_scene,entries,options)=>{
      assert.deepEqual(entries,[]);regionOpts=options;
      controller.regions.labelCheckpointIds=new Set(["checkpoint1"]);
    };
    await controller.update({roadMode:"terrain",regionMode:"combined",
      showRegionNames:true,continentFillOpacity:.33});
    assert.equal(viewModes.at(-1),"terrain");
    assert.equal(regionOpts.mode,"combined");
    assert.equal(regionOpts.showNames,true);
    assert.equal(regionOpts.continentFillOpacity,.33);
    assert.equal(controller.read().continentFillOpacity,.33);
    assert.deepEqual(suppressed.at(-1),["checkpoint1"],
      "only currently drawn Territory labels suppress the duplicate Checkpoint Always label");
    hooks.get("canvasReady")[0]();
    assert.equal(viewModes.at(-1),"terrain");
    const recreated=new AtlasLayersController(roadCanvas);
    assert.equal(recreated.read().showRegionNames,true,
      "client persisted setting survives window/controller recreation");
    assert.equal(recreated.read().roadMode,"terrain");
    globalThis.game.user.isGM=false;
    await controller.open();
    const playerUI=controller.window.result;
    assert.equal(all(playerUI).filter(element=>element.type==="radio").length,4,
      "only Region filter radio buttons are shown to players");
    assert.match(playerUI.children[0].textContent,/explicitly shared by the GM/);
    await controller.update({regionMode:"off"});
    assert.equal(controller.read().regionMode,"off");
    controller.refresh();
    assert.equal(viewModes.at(-1),"terrain","non-GM cannot change the Road overlay");
    globalThis.game.user.isGM=true;
    values.set(ATLAS_LAYERS_SETTING,{schemaVersion:900});
    assert.throws(()=>controller.read(),/Unknown/,
      "invalid old preferences are not silently repaired by a read");
    await controller.reset();
    assert.deepEqual(controller.read(),DEFAULT_ATLAS_LAYERS,
      "only deliberate GM reset can rewrite an invalid setting");
    assert.deepEqual(suppressed.at(-1),[],
      "hiding geographic names restores the Checkpoint's stored label mode");
  }finally{Object.assign(globalThis,previous);}
});

class Element {
  constructor(tag){this.tagName=tag;this.children=[];this.listeners=new Map();
    this.textContent="";this.attributes={};}
  append(...children){this.children.push(...children);}
  appendChild(child){this.children.push(child);return child;}
  setAttribute(k,v){this.attributes[k]=v;}
  addEventListener(k,fn){this.listeners.set(k,fn);}
}
function all(node){return [node,...node.children.flatMap(all)];}

test("Atlas Layers modeless palette exposes Road/Region modes, names and fill controls",async()=>{
  const previous={game:globalThis.game,document:globalThis.document};
  globalThis.game={user:{isGM:true}};
  globalThis.document={createElement:tag=>new Element(tag)};
  const updates=[],controller={read:()=>({...DEFAULT_ATLAS_LAYERS}),
    listColorRegions:()=>[],
    async update(change){updates.push(change);}};
  try{
    const window=new AtlasLayersWindow(controller);
    const root=await window._renderHTML();
    const radios=all(root).filter(e=>e.type==="radio");
    assert.deepEqual(radios.map(e=>e.value),
      ["roads","terrain","corridors","off","continents","settlements","combined"]);
    assert.equal(radios.filter(e=>e.checked).length,2);
    const terrain=radios.find(e=>e.value==="terrain");
    terrain.checked=true;terrain.listeners.get("change")();
    await window.updates;
    assert.deepEqual(updates[0],{roadMode:"terrain"});
    const sliders=all(root).filter(e=>e.type==="range");
    assert.equal(sliders.length,2);
    assert.equal(sliders[0].max,"50");
    const names=all(root).find(e=>e.attributes?.["aria-label"]==="Show Region names");
    assert.ok(names);
    assert.match(root.children[0].textContent,/saved for this client/);
    let reset=false;
    controller.read=()=>{if(!reset)throw Error("Invalid preferences");
      return {...DEFAULT_ATLAS_LAYERS};};
    controller.reset=async()=>{reset=true;};
    const invalid=await window._renderHTML();
    assert.match(invalid.children[0].textContent,/Invalid preferences/);
    const button=all(invalid).find(e=>e.tagName==="button");
    await button.listeners.get("click")();
    assert.equal(reset,true,"invalid preferences require an explicit reset click");
    assert.equal(window.rendered,true);
  }finally{Object.assign(globalThis,previous);}
});

test("Atlas Layers omits native Region color editor without altering native colors",async()=>{
  const previous={game:globalThis.game,canvas:globalThis.canvas,
    document:globalThis.document};
  globalThis.document={createElement:tag=>new Element(tag)};
  const region={id:"nativeRegion1",name:"Reshara",color:"#5ccc28",behaviors:[],
    parent:{id:"scene1"},canUserModify:()=>true,
    getFlag(_scope,key){return key==="atlas"?{schemaVersion:1,linked:true}:
      key==="territoryGeography"?{schemaVersion:1,kind:"continent",
        parentRegionId:null,roadOverrides:{}}:null;},
    update(){throw Error("Viewing colors must not write native Regions");}};
  const scene={id:"scene1",regions:new Map([[region.id,region]]),
    canUserModify:()=>true};
  globalThis.game={user:{isGM:true}};
  globalThis.canvas={scene,ready:true};
  let opened=0;
  const controller=new AtlasLayersController({setViewMode:()=>false});
  controller.read=()=>({...DEFAULT_ATLAS_LAYERS});
  controller.configureRegion=(_scene,id)=>{assert.equal(id,"nativeRegion1");opened++;};
  try{
    assert.deepEqual(controller.listColorRegions(),
      [{id:"nativeRegion1",name:"Reshara",color:"#5ccc28"}]);
    const palette=new AtlasLayersWindow(controller),root=await palette._renderHTML();
    assert.equal(all(root).some(item=>item.type==="color"),false);
    const edit=all(root).find(item=>item.tagName==="button"&&
      item.textContent==="Edit native Region color");
    assert.equal(edit,undefined);
    assert.equal(opened,0);
    assert.equal(region.color,"#5ccc28","Atlas never silently alters native color");
    region.color=new Number(0x4d972b);
    const updatedPalette=await palette._renderHTML();
    assert.equal(all(updatedPalette).some(item=>item.type==="color"),false);
    globalThis.game.user.isGM=false;
    await assert.rejects(()=>controller.configureColorRegion(region.id),/authorized GM/);
    assert.equal(opened,0);
  }finally{Object.assign(globalThis,previous);}
});

test("player Atlas Layers projects only shared Territories and leaves Road rendering unchanged",()=>{
  const previous={game:globalThis.game,canvas:globalThis.canvas};
  try{
    const region={id:"dirwest",name:"Private Region Name",hidden:false,
      parent:{id:"scene"},getFlag(_scope,key){
        if(key==="atlas")return {schemaVersion:1,linked:true};
        if(key==="territoryGeography")return {schemaVersion:1,kind:"city",
          parentRegionId:null,roadOverrides:{}};
        if(key==="playerTerritory")return {schemaVersion:1,visible:true};
        if(key==="publicTerritory")return {schemaVersion:1,enabled:true,label:"Dirwest"};
        return null;
      }};
    const scene={id:"scene",regions:new Map([[region.id,region]]),getFlag:()=>null};
    const viewModes=[],labelIds=[];
    globalThis.game={user:{isGM:false},settings:{get:()=>({
      ...DEFAULT_ATLAS_LAYERS,roadMode:"corridors",regionMode:"settlements",
      showRegionNames:true})}};
    globalThis.canvas={scene,ready:true,interface:{addChild(){}}};
    const controller=new AtlasLayersController({
      setViewMode:mode=>viewModes.push(mode),
      setTerritoryLabelCheckpointIds:ids=>labelIds.push([...ids])
    });
    let projection;
    controller.regions.sync=(_scene,entries,options)=>{
      projection=entries;
      assert.equal(options.mode,"settlements");
      assert.equal(options.showNames,true);
    };
    controller.refresh();
    assert.deepEqual(projection,[{id:"dirwest",name:"Dirwest",publicName:"Dirwest",
      playerShared:true,linked:true,invalid:false,geography:{kind:"city"}}]);
    assert.deepEqual(viewModes,[],"player cannot request GM-only corridor Road mode");
    assert.deepEqual(labelIds.at(-1),[]);
    region.hidden=true;
    controller.refresh();
    assert.deepEqual(projection,[],"hidden native Region disappears immediately");
  }finally{Object.assign(globalThis,previous);}
});

test("layer tool supersedes the one-click Road/Corridor toggle",()=>{
  const main=readFileSync(new URL("../scripts/main.js",import.meta.url),"utf8");
  assert.match(main,/name:"atlasLayers",title:"Atlas Layers"/);
  assert.match(main,/controls\.atlasPlayerLayers=\{/);
  assert.doesNotMatch(main,/atlasRoadLayerView/);
});
