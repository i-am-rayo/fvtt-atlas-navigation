import test from "node:test";
import assert from "node:assert/strict";
import {createRoadPresetStage} from "../scripts/road-settings-preset.js";
import {createRoadTravelPresetRow} from "../scripts/road-settings-preset-view.js";
import {readFileSync} from "node:fs";
import {saveRoadSettings} from "../scripts/road-storage.js";
import {readAtlas} from "../scripts/atlas-storage.js";
import {defaultTravelPresets} from "../scripts/travel-preset-model.js";

test("Road Settings stages a real dropdown change independently of dialog form data",()=>{
  const stage=createRoadPresetStage(null,"road-dialog-123");
  const target={name:"atlasRoadPresetId",value:"land-stone",
    closest:selector=>selector==='[data-atlas-road-live="road-dialog-123"]'?{}:null};
  assert.equal(stage.value,null);
  assert.equal(stage.handle({target}),true);
  assert.equal(stage.value,"land-stone");
  target.value="land-gravel";
  stage.handle({target}); // The browser can emit input and change for one selection.
  assert.equal(stage.value,"land-gravel");
  target.value="";
  stage.handle({target});
  assert.equal(stage.value,null,"explicit None selection is staged as null");
  assert.equal(stage.handle({target:{...target,name:"unrelated"}}),false);
});

test("Road Settings saves presentation and travel preset in one Scene revision",async()=>{
  const oldGame=globalThis.game;
  globalThis.game={user:{isGM:true},settings:{get:()=>defaultTravelPresets()}};
  const initial={schemaVersion:4,coordinateSpace:"image",revision:6,enabled:true,
    calibration:null,roads:[{id:"r",name:"Trade Road"}],
    nodes:[{id:"a",x:10,y:10},{id:"b",x:90,y:90}],
    segments:[{id:"s",roadId:"r",from:"a",to:"b",via:[],bidirectional:true}],
    checkpoints:[]};
  let state=structuredClone(initial),writes=0;
  const scene={canUserModify:()=>true,getFlag:()=>state,
    async setFlag(_scope,_key,next){state=next;writes++;}};
  try{
    const saved=await saveRoadSettings(scene,{roadId:"r",name:"Trade Road",
      appearance:null,playerVisible:false,presetId:"land-stone",expectedRevision:6});
    assert.equal(writes,1,"all Road Settings changes must use one write");
    assert.equal(saved.roads[0].travelPresetId,"land-stone");
    assert.equal(readAtlas(scene).roads[0].travelPresetId,"land-stone",
      "reopening Road Settings must read the persisted value");
    assert.deepEqual(saved.segments,initial.segments,"road geometry is untouched");
    const updated=await saveRoadSettings(scene,{roadId:"r",name:"Updated Road",
      appearance:null,playerVisible:true,presetId:"land-gravel",
      expectedRevision:saved.revision});
    assert.equal(writes,2);
    assert.equal(updated.roads[0].name,"Updated Road");
    assert.equal(updated.roads[0].playerVisible,true);
    assert.equal(readAtlas(scene).roads[0].travelPresetId,"land-gravel");
  }finally{globalThis.game=oldGame;}
});

test("Road travel preset controls match Map Marker stage/select workflow with no early writes",()=>{
  const before={game:globalThis.game,document:globalThis.document};
  class Element{
    constructor(tag){this.tag=tag;this.children=[];this.listeners=new Map();
      this.style={};this.className="";this.value="";this.textContent="";
      this.hidden=false;this.attrs=new Map();}
    append(...children){for(const child of children)this.appendChild(child);}
    appendChild(child){this.children.push(child);return child;}
    addEventListener(type,fn){this.listeners.set(type,[...(this.listeners.get(type)??[]),fn]);}
    setAttribute(key,value){this.attrs.set(key,value);}
    focus(){this.focused=true;}
    closest(selector){return selector==='[data-atlas-road-live="road-dialog-test"]'?{}:null;}
    fire(type){for(const listener of this.listeners.get(type)??[])listener({target:this});}
  }
  let writes=0;
  const presets=defaultTravelPresets().presets;
  try{
    globalThis.document={createElement:tag=>new Element(tag)};
    globalThis.game={settings:{get:()=>defaultTravelPresets(),
      set:()=>{writes++;}}};
    const current=presets.find(item=>item.id==="land-stone");
    assert.ok(current);
    const {row,hint,select}=createRoadTravelPresetRow(current.id);
    assert.equal(row.children[0].textContent,"Travel preset");
    const controls=row.children[1];
    assert.equal(controls.className,"atlas-road-preset-controls");
    const [name,originalSelect,change]=controls.children;
    assert.equal(select,originalSelect);
    assert.equal(name.textContent,current.name,"current saved preset is visible");
    assert.equal(name.attrs.get("aria-live"),"polite");
    assert.equal(select.hidden,true,"a saved preset displays Change rather than a duplicate dropdown");
    assert.equal(change.hidden,false);
    assert.equal(change.title,"Change travel preset");
    assert.match(hint.textContent,/World presets and native Region Behaviors are unchanged/);
    change.fire("click");
    assert.equal(select.hidden,false);
    assert.equal(change.hidden,true);
    assert.equal(select.focused,true,"Change opens and focuses the original picker");
    const stage=createRoadPresetStage(current.id,"road-dialog-test");
    select.value="land-gravel";
    select.fire("change");
    assert.equal(stage.handle({target:select}),true);
    assert.equal(stage.value,"land-gravel");
    assert.equal(name.textContent,presets.find(p=>p.id==="land-gravel").name);
    assert.equal(change.focused,true,"valid choice returns keyboard focus to Change");
    assert.equal(select.hidden,true);
    assert.equal(writes,0,"selecting a Road preset edits no World/Scene/Region");
    change.fire("click");
    select.value="";
    select.fire("change");
    stage.handle({target:select});
    assert.equal(stage.value,null,"None preserves the explicit Land fallback");
    assert.equal(name.textContent,"None (Land fallback)");
    assert.equal(select.hidden,false,"None keeps the picker available");
    assert.equal(change.hidden,true);
    const empty=createRoadTravelPresetRow(null);
    assert.equal(empty.select.hidden,false,"unassigned Roads do not show a misleading Change button");
    const stale=createRoadTravelPresetRow("removed-preset");
    assert.match(stale.row.children[1].children[0].textContent,/Unavailable travel preset/);
    assert.equal(stale.select.hidden,false,"unknown presets require deliberate re-selection");
    assert.equal(createRoadPresetStage("removed-preset","road-dialog-test").value,
      "removed-preset","the save path must still fail closed on stale assignments");
    assert.equal(writes,0,"Canceling these draft-only controls never saves");
  }finally{Object.assign(globalThis,before);}
});

test("Road Settings places the World preset control above Road name in General",()=>{
  const main=readFileSync(new URL("../scripts/main.js",import.meta.url),"utf8");
  assert.match(main,/panels\\.general\\.append\\(presetRow,presetHint,nameRow,visibilityRow,journalControls\\)/);
  const css=readFileSync(new URL("../styles/road-settings-dialog.css",import.meta.url),"utf8");
  assert.match(css,/\\.atlas-road-preset-controls\\s*\\{[^}]*margin-inline-start:auto/s);
});
