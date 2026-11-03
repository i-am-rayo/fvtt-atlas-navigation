import assert from "node:assert/strict";
import test from "node:test";
import { addAtlasGroupTransportationControl,openAtlasGroupTransportation,
  AtlasGroupTransportationSettings } from "../scripts/navigation-group-transport-settings.js";
import { projectGroupTransportation,groupMethodCapacityStatus }
  from "../scripts/navigation-group-transport.js";

class FakeElement {
  constructor(tag){
    this.tagName=tag.toUpperCase();this.children=[];this.attributes=new Map();
    this.style={cssText:""};this.events={};
    this.textContent="";this.value="";this.defaultValue="";
  }
  appendChild(child){this.children.push(child);return child;}
  append(...children){for(const c of children)this.appendChild(c);}
  setAttribute(key,value){this.attributes.set(key,String(value));}
  addEventListener(name,handler){(this.events[name]??=[]).push(handler);}
  insertAdjacentElement(position,child){
    if(position!=="afterend"||!this.parent)throw Error("Unsupported fake DOM insertion");
    const i=this.parent.children.indexOf(this);
    this.parent.children.splice(i+1,0,child);child.parent=this;
  }
  replaceChildren(...children){this.children=[...children];}
  querySelector(selector){
    if(selector==="h3")return this.children.find(c=>c.tagName==="H3")??null;
    if(selector===".atlas-transport-button")
      return this.children.find(c=>c.className?.includes("atlas-transport-button"))??null;
    if(selector===".header.travel-pace")
      return this.children.find(c=>c.className==="header travel-pace")??null;
    return null;
  }
}
const flatten=e=>[e,...e.children.flatMap(flatten)];
const setup=(isGM=true)=>{
  const old={document:globalThis.document,game:globalThis.game,ui:globalThis.ui};
  const changes=[];
  const pc={id:"pc1",name:"Cassian",type:"character",system:{}};
  const camel={id:"camel1",name:"Camel",type:"npc",system:{}};
  const ship={id:"ship1",name:"Warship",type:"vehicle",
    system:{passengers:{max:60},details:{type:"water"}}};
  const group={id:"group1",name:"The Party",type:"group",
    system:{members:[{actor:pc},{actor:camel},{actor:ship}],primaryVehicle:ship}};
  let saved={version:1,groups:{group1:{members:{
    camel1:{role:"mount",quantity:3,capacity:1,surface:"land"}
  }}}};
  globalThis.document={createElement:tag=>new FakeElement(tag)};
  globalThis.game={user:{isGM},system:{id:"dnd5e"},
    actors:{contents:[group],get:id=>id===group.id?group:null},
    settings:{get(_m,key){
      if(key==="guidedGroupTransportation")return saved;
      if(key==="guidedTravelRulesProfile")return "dnd5e2024";
      return undefined;
    },async set(_m,key,value){changes.push([key,value]);
      if(key==="guidedGroupTransportation")saved=value;return value;}}};
  globalThis.ui={notifications:{info(){},error(){}}};
  return {pc,camel,ship,group,changes,get saved(){return saved;},
    restore(){globalThis.document=old.document;globalThis.game=old.game;globalThis.ui=old.ui;}};
};

test("GM Group header button is inserted at the specified spot once",()=>{
  const ctx=setup();
  try{
    const header=new FakeElement("div");header.className="header travel-pace";
    const h3=new FakeElement("h3");h3.textContent="Travel Pace";h3.parent=header;
    const left=new FakeElement("button");left.className="config-button";
    header.children.push(h3,left);
    const root=new FakeElement("section");root.children.push(header);
    assert.equal(addAtlasGroupTransportationControl({document:ctx.group},root),true);
    assert.equal(header.children[0],h3);
    assert.equal(header.children[1].className.includes("atlas-transport-button"),true);
    assert.equal(header.children[2],left,"native pace arrows retain their order");
    assert.equal(header.children[1].attributes.get("aria-label"),"Manage Party Transportation");
    assert.equal(addAtlasGroupTransportationControl({document:ctx.group},root),false);
    assert.equal(header.children.length,3,"rerender does not duplicate control");
    assert.equal(ctx.changes.length,0);
  }finally{ctx.restore();}
});
test("non-GMs never see header control or open transportation editor",()=>{
  const ctx=setup(false);
  try{
    const header=new FakeElement("div");header.className="header travel-pace";
    const h3=new FakeElement("h3");h3.parent=header;header.children.push(h3);
    const root=new FakeElement("section");root.children.push(header);
    assert.equal(addAtlasGroupTransportationControl({document:ctx.group},root),false);
    assert.equal(header.children.length,1);
    assert.throws(()=>openAtlasGroupTransportation(ctx.group.id),/Only a GM/);
    assert.rejects(()=>new AtlasGroupTransportationSettings(ctx.group.id)._renderHTML(),/Only a GM/);
  }finally{ctx.restore();}
});
test("Group editor separates PCs, NPCs and Vehicles without a Group dropdown",async()=>{
  const ctx=setup();
  try{
    const root=await new AtlasGroupTransportationSettings(ctx.group.id)._renderHTML();
    const elements=flatten(root),labels=elements.map(e=>e.textContent??"").join(" ");
    for(const name of ["Player Characters","Non-player Characters","Vehicles",
      "Camel","Warship","Transportation profile","Save Party Transportation Assignments"])
      assert.match(labels,new RegExp(name));
    assert.equal(elements.some(e=>e.name==="atlasGroupSelection"),false);
    assert.deepEqual(ctx.changes,[],"opening Group editor never changes World or native Group");
  }finally{ctx.restore();}
});
test("saving matching profile ID preserves mount capacity across Actor rename",async()=>{
  const ctx=setup();
  try{
    const app=new AtlasGroupTransportationSettings(ctx.group.id);
    app.render=async()=>{};
    const elements=flatten(await app._renderHTML());
    const field=name=>elements.find(e=>e.name===name);
    assert.equal(field("profile-camel1").value,"camel","current Camel gets a suggested profile");
    field("quantity-camel1").value="3";
    const save=elements.find(e=>e.textContent==="Save Party Transportation Assignments");
    assert.ok(save.events.click?.length);
    await save.events.click[0]();
    assert.equal(ctx.saved.version,2);
    assert.equal(ctx.saved.groups.group1.members.camel1.profileId,"camel");
    assert.equal(ctx.changes.length,1);
    ctx.camel.name="Biscuit";
    const projection=projectGroupTransportation(ctx.group,ctx.saved);
    assert.equal(groupMethodCapacityStatus(projection,
      {id:"camel",name:"Camel",surface:"land"}).seats,3);
  }finally{ctx.restore();}
});
