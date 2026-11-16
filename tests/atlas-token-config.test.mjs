import test from "node:test";
import assert from "node:assert/strict";
import { addAtlasExplorerToTokenConfig, assignCreatedAtlasExplorer } from "../scripts/atlas-token-config.js";

class ElementStub {
  constructor(tag="div") {
    this.tag=tag;this.children=[];this.dataset={};this.style={};
    this.textContent="";this.listeners=new Map();
  }
  append(...children){this.children.push(...children);}
  setAttribute(name,value){this[name]=String(value);}
  addEventListener(name,callback){this.listeners.set(name,callback);}
  querySelector(selector){
    if(selector===".tab.active"||selector==="form")return null;
    if(selector==="[data-atlas-explorer-config]")return this.children.find(c=>c.dataset?.atlasExplorerConfig!==undefined)??null;
    return null;
  }
}

test("Placed Token shows only party assignment without mutation",()=>{
  const before={game:globalThis.game,document:globalThis.document,
    HTMLElement:globalThis.HTMLElement};
  try{
    globalThis.HTMLElement=ElementStub;
    globalThis.document={createElement:tag=>new ElementStub(tag),
      createTextNode:text=>({textContent:text})};
    const scene={grid:{units:"km"},tokens:{get:id=>id==="party"?token:null},
      canUserModify:()=>true,getFlag:()=>null};
    const token={id:"party",parent:scene,actor:{type:"character"}};
    globalThis.game={user:{isGM:true},system:{id:"dnd5e"}};
    const root=new ElementStub();
    addAtlasExplorerToTokenConfig({document:token},root);
    assert.equal(root.children.length,1);
    const panel=root.children[0];
    const sections=panel.children.filter(child=>child.tag==="section");
    assert.deepEqual(sections.map(section=>section.children[0].textContent),[
      "Party explorer"
    ]);
    assert.equal(sections.length,1);
    assert.equal(scene.flags,undefined);
  }finally{
    globalThis.game=before.game;globalThis.document=before.document;
    globalThis.HTMLElement=before.HTMLElement;
  }
});


test("Prototype explorer saves only Actor prototype flag and never assigns an existing token",async()=>{
  const previous={game:globalThis.game,document:globalThis.document,HTMLElement:globalThis.HTMLElement,ui:globalThis.ui};
  try{
    globalThis.HTMLElement=ElementStub;
    globalThis.document={createElement:tag=>new ElementStub(tag),createTextNode:text=>({textContent:text})};
    const writes=[];
    const actor={canUserModify:()=>true,update:async data=>writes.push(data)};
    const token={parent:actor,flags:{"fvtt-atlas-navigation":{partyExplorer:true}}};
    globalThis.game={user:{isGM:true}};globalThis.ui={notifications:{error:assert.fail}};
    const root=new ElementStub();
    addAtlasExplorerToTokenConfig({isPrototype:true,actor,token},root);
    const fieldset=root.children[0],section=fieldset.children.find(c=>c.tag==="section");
    const label=section.children.find(c=>c.tag==="label");
    assert.equal(label.children[1].textContent,"Use this token as the party explorer");
    assert.equal(label.children[0].checked,true);
    assert.equal(writes.length,0);
    const save=fieldset.children.find(c=>c.tag==="button");
    await save.listeners.get("click")();
    assert.deepEqual(writes,[{"prototypeToken.flags.fvtt-atlas-navigation.partyExplorer":true}]);
    assert.equal(save.disabled,false);
  }finally{Object.assign(globalThis,previous);}
});

test("Inherited explorer fills deleted-token slot without replacing a live assignment",async()=>{
  const previous=globalThis.game;
  try{
    globalThis.game={user:{id:"gm",isGM:true},users:[{id:"gm",isGM:true,active:true}]};
    const tokens=new Map();let saved=null,writes=0;
    const scene={tokens,canUserModify:()=>true,getFlag:(_module,key)=>key==="partyExploration"?saved:null,
      setFlag:async(_module,key,value)=>{assert.equal(key,"partyExploration");saved=value;writes++;}};
    const token={id:"replacement",parent:scene,flags:{"fvtt-atlas-navigation":{partyExplorer:true}}};
    tokens.set(token.id,token);
    await assignCreatedAtlasExplorer(token);
    assert.equal(saved.tokenId,"replacement");assert.equal(writes,1);
    const other={...token,id:"other"};tokens.set(other.id,other);
    await assignCreatedAtlasExplorer(other);assert.equal(writes,1);
    tokens.delete(token.id);
    await assignCreatedAtlasExplorer(other);assert.equal(writes,2);assert.equal(saved.tokenId,"other");
    game.user.isGM=false;tokens.delete(other.id);
    await assignCreatedAtlasExplorer(token);assert.equal(writes,2);
  }finally{globalThis.game=previous;}
});
