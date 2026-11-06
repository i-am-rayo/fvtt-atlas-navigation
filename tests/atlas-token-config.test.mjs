import test from "node:test";
import assert from "node:assert/strict";
import { addAtlasExplorerToTokenConfig } from "../scripts/atlas-token-config.js";

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

test("Token Atlas settings group assignment, discovery and read-only movement without mutation",()=>{
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
      "1. Party token assignment","2. Discovery radius",
      "3. Navigation movement (read-only)"
    ]);
    assert.match(sections[1].children.at(-1).textContent??"",/Survey distance/);
    assert.equal(scene.flags,undefined);
  }finally{
    globalThis.game=before.game;globalThis.document=before.document;
    globalThis.HTMLElement=before.HTMLElement;
  }
});
