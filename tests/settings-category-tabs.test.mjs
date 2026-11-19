import test from "node:test";
import assert from "node:assert/strict";
import {createSettingsCategoryTabs} from "../scripts/settings-category-tabs.js";

test("World catalog tabs are keyboard navigable, keep all draft panels mounted and never save",()=>{
  const old=globalThis.document;
  class Element {
    constructor(tag){this.tag=tag;this.children=[];this.style={};
      this.attrs=new Map();this.listeners=new Map();this.hidden=false;}
    appendChild(child){this.children.push(child);}
    setAttribute(key,value){this.attrs.set(key,String(value));}
    addEventListener(key,fn){this.listeners.set(key,fn);}
    focus(){this.focused=true;}
  }
  let writes=0,selected=[];
  try{
    globalThis.document={createElement:tag=>new Element(tag)};
    const tabs=createSettingsCategoryTabs({id:"test-catalog",
      modes:[["land","Land"],["water","Water"],["air","Air"]],
      active:"land",onChange:id=>selected.push(id)});
    const drafts=new Map(["land","water","air"].map(id=>{
      const el=new Element("fieldset");el.value=id+" unsaved";tabs.addPanel(id,el);
      return [id,el];
    }));
    assert.equal(tabs.nav.attrs.get("role"),"tablist");
    assert.deepEqual(tabs.nav.children.map(tab=>tab.attrs.get("aria-selected")),
      ["true","false","false"],"initial tab must be accessible and visibly selected");
    assert.deepEqual([...drafts].map(([,el])=>el.hidden),[false,true,true]);
    const next=tabs.nav.children[1];
    next.listeners.get("click")();
    assert.equal(tabs.selected,"water");
    assert.equal(drafts.get("land").value,"land unsaved");
    assert.deepEqual([...drafts].map(([,el])=>el.hidden),[true,false,true]);
    let prevented=false;
    tabs.nav.listeners.get("keydown")({target:next,key:"End",
      preventDefault(){prevented=true;}});
    assert.equal(prevented,true);
    assert.equal(tabs.selected,"air");
    assert.equal(tabs.nav.children[2].focused,true);
    tabs.nav.listeners.get("keydown")({target:tabs.nav.children[2],key:"Home",
      preventDefault(){}});
    assert.equal(tabs.selected,"land");
    assert.deepEqual(selected,["water","air","land"]);
    assert.equal(tabs.nav.children[0].attrs.get("aria-selected"),"true");
    assert.equal(tabs.nav.children[1].tabIndex,-1);
    assert.equal(writes,0);
  }finally{globalThis.document=old;}
});
