import test from "node:test";
import assert from "node:assert/strict";
import {reviewIndependentCheckpointConnections}
  from "../scripts/road-checkpoint-review-dialog.js";

class El {
  constructor(tag){
    this.tagName=tag.toUpperCase();
    this.children=[];this.dataset={};this.style={};this.listeners=new Map();
    this.checked=false;this.value="";this.name="";
  }
  appendChild(child){this.children.push(child);return child;}
  append(...children){children.forEach(child=>this.appendChild(child));}
  setAttribute(){}
  addEventListener(name,listener){this.listeners.set(name,listener);}
  querySelectorAll(selector){
    const all=this.children.flatMap(child=>[child,...child.descendants()]);
    if(selector==="[data-atlas-checkpoint-selection]")
      return all.filter(e=>e.dataset.atlasCheckpointSelection);
    if(selector==='input[name="atlasCheckpointConnection"]')
      return all.filter(e=>e.tagName==="INPUT"&&e.name==="atlasCheckpointConnection");
    if(selector==='input[name="atlasCheckpointConnection"]:checked')
      return all.filter(e=>e.tagName==="INPUT"&&e.name==="atlasCheckpointConnection"&&e.checked);
    throw Error("Unexpected selector: "+selector);
  }
  descendants(){return this.children.flatMap(child=>[child,...child.descendants()]);}
  clone(){
    const cloned=new El(this.tagName);
    Object.assign(cloned,{name:this.name,value:this.value,checked:this.checked,
      textContent:this.textContent,type:this.type});
    cloned.dataset={...this.dataset};
    this.children.forEach(child=>cloned.appendChild(child.clone()));
    return cloned;
  }
}
const doc={createElement:tag=>new El(tag)};
const candidates=[
  {checkpointId:"north",name:"North Gate",distance:0,endpoint:"start"},
  {checkpointId:"bridge",name:"Bridge",distance:4,endpoint:null}
];

test("Foundry v14 dialog root is a plain DIV and checked selection comes from cloned live form",async()=>{
  const prev=globalThis.game;
  globalThis.game={user:{isGM:true}};
  try{
    const Dialog={wait:async config=>{
      assert.equal(config.content.tagName,"DIV");
      const live=config.content.clone();
      assert.equal(live.querySelectorAll('input[name="atlasCheckpointConnection"]').length,2);
      config.render(null,{element:live});
      const boxes=live.querySelectorAll('input[name="atlasCheckpointConnection"]');
      boxes[1].checked=false;
      return config.buttons.find(b=>b.action==="connect")
        .callback(null,{form:live});
    }};
    const saved=await reviewIndependentCheckpointConnections({
      roadName:"West Road",candidates
    },{Dialog,doc});
    assert.deepEqual(saved,["north"],
      "closing over pre-render elements would incorrectly save both Checkpoints");
  }finally{globalThis.game=prev;}
});

test("Select All/None works on cloned dialog and cancel/none never invent connections",async()=>{
  const prev=globalThis.game;
  globalThis.game={user:{isGM:true}};
  try{
    const Dialog={wait:async config=>{
      const live=config.content.clone();
      config.render(null,{element:live});
      const inputs=()=>live.querySelectorAll('input[name="atlasCheckpointConnection"]');
      const controls=live.querySelectorAll("[data-atlas-checkpoint-selection]");
      const none=controls.find(c=>c.dataset.atlasCheckpointSelection==="none");
      const all=controls.find(c=>c.dataset.atlasCheckpointSelection==="all");
      none.listeners.get("click")({preventDefault(){}});
      assert.ok(inputs().every(c=>!c.checked));
      all.listeners.get("click")({preventDefault(){}});
      assert.ok(inputs().every(c=>c.checked));
      none.listeners.get("click")({preventDefault(){}});
      assert.equal(config.buttons[0].label,"Save Edits + Selected Connections");
      return config.buttons[0].callback(null,{form:live});
    }};
    assert.deepEqual(await reviewIndependentCheckpointConnections({
      roadName:"Existing",candidates,mode:"edited"
    },{Dialog,doc}),[]);
    assert.deepEqual(await reviewIndependentCheckpointConnections({
      roadName:"Existing",candidates
    },{Dialog:{wait:async()=> "none"},doc}),[]);
    assert.equal(await reviewIndependentCheckpointConnections({
      roadName:"Existing",candidates
    },{Dialog:{wait:async()=> "cancel"},doc}),null);
  }finally{globalThis.game=prev;}
});

test("Road attachment dialog rejects unauthorized or fabricated GM selections",async()=>{
  const prev=globalThis.game;
  globalThis.game={user:{isGM:false}};
  try{
    await assert.rejects(reviewIndependentCheckpointConnections({
      roadName:"Road",candidates
    },{Dialog:{wait:async()=>[]},doc}),/Only a GM/);
    globalThis.game.user.isGM=true;
    await assert.rejects(reviewIndependentCheckpointConnections({
      roadName:"Road",candidates
    },{Dialog:{wait:async()=>["fake"]},doc}),/Invalid Checkpoint selection/);
  }finally{globalThis.game=prev;}
});
