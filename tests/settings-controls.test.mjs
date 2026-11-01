import test from "node:test";
import assert from "node:assert/strict";
import { defaultTravelPresets } from "../scripts/travel-preset-model.js";
import { defaultCheckpointPresets } from "../scripts/checkpoint-preset-model.js";

class FakeElement {
  constructor(tag){this.tag=tag;this.children=[];this.style={};this.value="";
    this.attributes=new Map();this.listeners=new Map();this.textContent="";}
  append(...items){for(const item of items)this.appendChild(item);}
  appendChild(item){item.parentNode=this;this.children.push(item);return item;}
  replaceChildren(...items){this.children=[];this.append(...items);}
  setAttribute(key,value){this.attributes.set(key,value);}
  addEventListener(name,callback){this.listeners.set(name,callback);}
  closest(tag){for(let item=this;item;item=item.parentNode)if(item.tag===tag)return item;return null;}
}
const descendants=parent=>[parent,...parent.children.flatMap(descendants)];

test("shared travel selector preserves IDs and groups Water, Land and Air",async()=>{
  const previous={document:globalThis.document,game:globalThis.game,
    foundry:globalThis.foundry};
  try{
    globalThis.document={createElement:tag=>new FakeElement(tag)};
    globalThis.foundry={applications:{api:{ApplicationV2:class{}}}};
    globalThis.game={settings:{get:()=>defaultTravelPresets()}};
    const {createTravelPresetSelect}=await import("../scripts/settings-controls.js");
    const select=createTravelPresetSelect({selectedId:"land-dirt",name:"roadPreset",
      includeCosts:true});
    assert.equal(select.name,"roadPreset");
    assert.equal(select.value,"land-dirt");
    const groups=select.children.filter(item=>item.tag==="optgroup");
    assert.ok(groups.some(group=>group.label==="Land"));
    assert.ok(groups.some(group=>group.label==="Air"));
    assert.ok(groups.some(group=>group.label==="Water — River"));
    assert.ok(descendants(select).some(item=>item.value==="land-dirt"));
    assert.equal(select.children[0].value,"");
  }finally{Object.assign(globalThis,previous);}
});

test("shared icon picker reports chosen IDs, reuses the same browser and makes no writes",async()=>{
  const previous=globalThis.document;
  try{
    globalThis.document={createElement:tag=>new FakeElement(tag)};
    const {createCheckpointIconPicker}=await import("../scripts/checkpoint-icon-control.js");
    const changes=[];
    const picker=createCheckpointIconPicker({selectedId:"location-dot",
      onChange:id=>changes.push(id)});
    assert.equal(picker.value,"location-dot");
    const icons=descendants(picker.element);
    assert.ok(icons.some(item=>item.textContent==="RPG picks"));
    assert.ok(icons.some(item=>item.textContent==="All / Advanced"));
    const flag=icons.find(item=>item.attributes.get("aria-label")==="Use flag checkpoint icon");
    assert.ok(flag);
    flag.listeners.get("click")();
    assert.equal(picker.value,"flag");
    assert.deepEqual(changes,["flag"]);
    picker.value="house";
    assert.equal(picker.value,"house");
    assert.deepEqual(changes,["flag"],"programmatic preset application is not a user change");
  }finally{globalThis.document=previous;}
});

test("checkpoint preset selector offers all World types instead of filtering to Bridge",async()=>{
  const previous=globalThis.document;
  try{
    globalThis.document={createElement:tag=>new FakeElement(tag)};
    const {createCheckpointPresetSelect}=await import("../scripts/settings-controls.js");
    const select=createCheckpointPresetSelect(defaultCheckpointPresets().presets);
    assert.ok(descendants(select).some(item=>item.value==="checkpoint-bridge"));
    assert.ok(descendants(select).some(item=>item.value==="checkpoint-port"));
    assert.ok(descendants(select).some(item=>item.value==="checkpoint-temple"));
    assert.ok(descendants(select).some(item=>item.value==="checkpoint-monster"));
  }finally{globalThis.document=previous;}
});

test("preset list glyph uses the same bundled font configuration as the icon browser",async()=>{
  const previous=globalThis.document;
  try{
    globalThis.document={createElement:tag=>new FakeElement(tag)};
    const {createCheckpointIconGlyph}=await import("../scripts/checkpoint-icon-control.js");
    const anchor=createCheckpointIconGlyph("solid:anchor");
    assert.equal(anchor.tag,"span");
    assert.match(anchor.style.cssText,/Atlas FA 7 Solid/);
    assert.equal(anchor.attributes.get("aria-hidden"),"true");
  }finally{globalThis.document=previous;}
});
