import assert from "node:assert/strict";
import test from "node:test";
import { AtlasTransportationSettings } from "../scripts/navigation-transport-settings.js";

class FakeElement {
  constructor(tag){
    this.tagName=tag.toUpperCase();this.children=[];this.attributes=new Map();
    this.style={cssText:""};this.value="";this.defaultValue="";this.checked=false;
  }
  appendChild(child){this.children.push(child);return child;}
  append(...children){for(const child of children)this.appendChild(child);}
  setAttribute(name,value){this.attributes.set(name,String(value));}
  addEventListener(){}
  replaceChildren(...children){this.children=[...children];}
}
const flatten=(root)=>[root,...root.children.flatMap(flatten)];
const setup=({isGM=true}={})=>{
  const old={document:globalThis.document,game:globalThis.game};
  const changes=[];
  globalThis.document={createElement:tag=>new FakeElement(tag)};
  globalThis.game={user:{isGM},system:{id:"dnd5e"},settings:{
    get(_module,key){return key==="guidedTravelRulesProfile"?"dnd5e2024":undefined;},
    set(_module,key,value){changes.push([key,value]);return Promise.resolve(value);}
  }};
  return {changes,restore(){globalThis.document=old.document;globalThis.game=old.game;}};
};

test("Transportation World window renders three discoverable tabs without writing settings",async()=>{
  const ctx=setup();
  try{
    const app=new AtlasTransportationSettings();
    const defaults=await app._renderHTML();
    const text=flatten(defaults).map(e=>e.textContent??"").join(" ");
    assert.match(text,/Transportation Presets/);
    assert.match(text,/Walking/);
    assert.match(text,/Mounted/);
    assert.match(text,/Sailing Ship/);
    assert.match(text,/Airship/);
    assert.match(text,/Land travel/);
    assert.match(text,/Water travel/);
    assert.match(text,/Air travel/);
    assert.match(text,/Import optional workbook examples/);
    assert.ok(flatten(defaults).some(e=>e.attributes?.get("role")==="tab"),
      "tabs use accessible tab roles");
    app.activeTab="rules";
    const rules=flatten(await app._renderHTML()).map(e=>e.textContent??"").join(" ");
    assert.match(rules,/Rules Profile/);
    assert.match(rules,/Overnight downtime/);
    app.activeTab="journey";
    const journey=flatten(await app._renderHTML()).map(e=>e.textContent??"").join(" ");
    assert.match(journey,/Advance World time/);
    assert.match(journey,/Animation speed/);
    assert.deepEqual(ctx.changes,[],"opening tabs never writes or migrates settings");
  }finally{ctx.restore();}
});

test("Transportation editing refuses non-GMs at the action boundary",async()=>{
  const ctx=setup({isGM:false});
  try{
    const app=new AtlasTransportationSettings();
    await assert.rejects(()=>app._edit(null),/Only a GM/);
    await assert.rejects(()=>app._importExamples(),/Only a GM/);
  }finally{ctx.restore();}
});


test("Add/Edit dialog gives Foundry v14 a plain outer content element",async()=>{
  const ctx=setup();
  const original=globalThis.foundry;
  let seen=0;
  globalThis.foundry={applications:{api:{DialogV2:{
    input:async ({content})=>{
      seen++;
      assert.equal(content.tagName,"DIV");
      assert.equal(content.attributes.size,0,"DialogV2 rejects any root attributes");
      assert.ok(content.children.length,"styles belong on a child");
      return null;
    }
  }}}};
  try{
    const app=new AtlasTransportationSettings();
    await app._edit(null,"water");
    await app._edit(null,"air");
    assert.equal(seen,2,"add surface buttons share the repaired dialog");
    assert.equal(ctx.changes.length,0,"cancel leaves World settings untouched");
  }finally{globalThis.foundry=original;ctx.restore();}
});

test("Travel rules and Journey playback expose synchronized range + numeric inputs",async()=>{
  const ctx=setup();
  try{
    const app=new AtlasTransportationSettings();
    app.activeTab="rules";
    const rules=flatten(await app._renderHTML());
    assert.equal(rules.filter(node=>node.type==="range").length,4);
    assert.equal(rules.filter(node=>node.type==="number").length,4);
    app.activeTab="journey";
    const journey=flatten(await app._renderHTML());
    assert.equal(journey.filter(node=>node.type==="range").length,1);
    assert.equal(journey.filter(node=>node.type==="number").length,1);
  }finally{ctx.restore();}
});
