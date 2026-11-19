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
  focus(){this.focused=true;}
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
    setSaved(value){saved=value;},
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
    assert.match(header.children[1].className,/atlas-ui-icon-button/,
      "Group shortcut uses the shared 2rem accessible action target");
    assert.equal(header.children[1].children[0].className,"fa-solid fa-horse");
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
test("Group editor shows compact native-Actor transportation by travel surface",async()=>{
  const ctx=setup();
  try{
    const root=await new AtlasGroupTransportationSettings(ctx.group.id)._renderHTML();
    const elements=flatten(root),labels=elements.map(e=>e.textContent??"").join(" ");
    for(const name of ["Land Travel","Water Travel","Air Travel","Other NPCs / Needs Setup",
      "Camel","Warship","Save Party Transportation Assignments"])
      assert.match(labels,new RegExp(name));
    assert.doesNotMatch(labels,/Player Characters/,"PCs count as travelers without a tab");
    assert.equal(elements.some(e=>e.name==="atlasGroupSelection"),false);
    const actorRows=elements.filter(e=>e.className==="atlas-group-transport-resource");
    assert.equal(actorRows.length,2,"only native transport resources get compact rows");
    assert.equal(elements.filter(e=>e.className==="atlas-group-transport-surface").length,3);
    assert.ok(elements.some(e=>e.attributes.get("aria-label")==="Edit Camel transportation"));
    assert.equal(elements.some(e=>e.attributes.get("aria-label")===
      "Remove Camel from Party transportation"),false,
      "NPC membership and role govern removal; do not duplicate native removal");
    const camelRow=actorRows.find(e=>e.children[0]?.children[0]?.textContent==="Camel");
    const horseControls=camelRow?.children[0]?.children[1];
    assert.equal(horseControls?.children[0]?.tagName,"SELECT",
      "NPC role selection follows the name on the same row");
    assert.match(horseControls?.style.cssText??"",/margin-left:auto/);
    assert.equal(horseControls?.children.length,2,
      "NPC has only Role and Edit, no Delete");
    const shipRow=actorRows.find(e=>e.children[0]?.children[0]?.textContent==="Warship ★ Primary vehicle");
    assert.equal(shipRow?.children[0]?.children[1]?.children.length,2,
      "Vehicles retain Edit and confirmed Atlas opt-out");
    assert.equal(camelRow?.children[1]?.hidden,true,"hidden draft fields do not break the single-row layout");
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
    assert.equal(field("profile-camel1").value,"","World method must be explicitly selected");
    field("profile-camel1").value="camel";
    field("quantity-camel1").value="3";
    const save=elements.find(e=>e.textContent==="Save Party Transportation Assignments");
    assert.ok(save.events.click?.length);
    await save.events.click[0]();
    assert.equal(ctx.saved.version,5);
    assert.equal(ctx.saved.groups.group1.members.camel1.profileId,"camel");
    assert.equal(ctx.changes.length,1);
    ctx.camel.name="Biscuit";
    const projection=projectGroupTransportation(ctx.group,ctx.saved);
    assert.equal(groupMethodCapacityStatus(projection,
      {id:"camel",name:"Camel",surface:"land"}).seats,3);
  }finally{ctx.restore();}
});

test("two open Group assignment menus save different Groups without overwriting, same Group remains guarded",async()=>{
  const ctx=setup();
  try{
    const first=new AtlasGroupTransportationSettings(ctx.group.id);
    first.render=async()=>{};
    const root=flatten(await first._renderHTML());
    ctx.setSaved({...ctx.saved,groups:{...ctx.saved.groups,otherGroup:{members:{}}}});
    const button=root.find(e=>e.textContent==="Save Party Transportation Assignments");
    await button.events.click[0]();
    assert.equal(ctx.changes.length,1,"unrelated Group change must not block saving this Group");
    assert.deepEqual(ctx.saved.groups.otherGroup,{members:{}},
      "saving this Group preserves other Group assignments");

    const stale=new AtlasGroupTransportationSettings(ctx.group.id);
    stale.render=async()=>{};
    const draft=flatten(await stale._renderHTML());
    const prior=ctx.saved.groups.group1;
    ctx.setSaved({...ctx.saved,groups:{...ctx.saved.groups,
      group1:{members:{...prior.members,
        camel1:{...prior.members.camel1,quantity:9}}}}});
    const count=ctx.changes.length;
    await draft.find(e=>e.textContent==="Save Party Transportation Assignments")
      .events.click[0]();
    assert.equal(ctx.changes.length,count,"same Group stale write is rejected");
    assert.equal(ctx.saved.groups.group1.members.camel1.quantity,9);
  }finally{ctx.restore();}
});

test("compact Land/Water/Air sections retain staged drafts without switching tabs",async()=>{
  const ctx=setup();
  try{
    const nodes=flatten(await new AtlasGroupTransportationSettings(ctx.group.id)._renderHTML());
    const labels=nodes.filter(n=>n.className==="atlas-group-transport-surface")
      .map(section=>section.children[0].textContent);
    assert.deepEqual(labels,["Land Travel","Water Travel","Air Travel"]);
    assert.equal(nodes.some(n=>n.attributes.get("role")==="tab"),false);
    assert.equal(nodes.filter(n=>n.attributes.get("role")==="tabpanel").length,0);
    const camel=nodes.find(n=>n.name==="quantity-camel1");
    camel.value="5";
    assert.equal(camel.value,"5","all surfaces remain mounted and preserve the same draft");
    assert.deepEqual(ctx.changes,[]);
  }finally{ctx.restore();}
});

test("saving a custom mount speed overrides only Group metadata and derives surface",async()=>{
  const ctx=setup();
  try{
    const app=new AtlasGroupTransportationSettings(ctx.group.id);
    app.render=async()=>{};
    const elements=flatten(await app._renderHTML());
    const field=name=>elements.find(e=>e.name===name);
    const speed=field("speed-camel1");
    const profile=field("profile-camel1");
    assert.equal(speed.disabled,true,"no implied World profile from Actor name");
    profile.value="camel";
    profile.events.change?.forEach(callback=>callback());
    assert.equal(speed.disabled,false,"explicit World profile permits a speed override");
    speed.value="3.75";
    assert.equal(profile.value,"camel");
    const save=elements.find(e=>e.textContent==="Save Party Transportation Assignments");
    await save.events.click[0]();
    const entry=ctx.saved.groups.group1.members.camel1;
    assert.equal(entry.speedMphOverride,3.75);
    assert.equal(entry.surface,"land");
    assert.equal(entry.profileId,"camel");
    assert.equal(ctx.changes.length,1);
  }finally{ctx.restore();}
});

test("Group editor saves all resource-specific economy and note overrides",async()=>{
  const ctx=setup();
  try{
    const app=new AtlasGroupTransportationSettings(ctx.group.id);
    app.render=async()=>{};
    const elements=flatten(await app._renderHTML());
    const input=name=>elements.find(e=>e.name===name);
    input("profile-camel1").value="camel";
    input("cost-camel1").value="12.5";
    input("cost-basis-camel1").value="day";
    input("cost-applies-camel1").value="unit";
    input("purchase-mode-camel1").value="custom";
    input("purchase-camel1").value="67";
    input("note-camel1").value="Special pack-trained breed";
    const save=elements.find(e=>e.textContent==="Save Party Transportation Assignments");
    await save.events.click[0]();
    const actual=ctx.saved.groups.group1.members.camel1;
    assert.equal(actual.costCpOverride,12.5);
    assert.equal(actual.costBasisOverride,"day");
    assert.equal(actual.costAppliesOverride,"unit");
    assert.equal(actual.purchaseGpOverride,67);
    assert.equal(actual.noteOverride,"Special pack-trained breed");
    assert.equal(ctx.changes.length,1,"only Atlas Group settings are updated");
  }finally{ctx.restore();}
});
test("Group editor can explicitly clear a vehicle's purchase price",async()=>{
  const ctx=setup();
  try{
    const app=new AtlasGroupTransportationSettings(ctx.group.id);
    app.render=async()=>{};
    const elements=flatten(await app._renderHTML());
    const input=name=>elements.find(e=>e.name===name);
    input("purchase-mode-ship1").value="none";
    const save=elements.find(e=>e.textContent==="Save Party Transportation Assignments");
    await save.events.click[0]();
    assert.equal(ctx.saved.groups.group1.members.ship1.purchaseGpOverride,"none");
  }finally{ctx.restore();}
});


test("individual recurring-cost and frequency overrides share the same top alignment",async()=>{
  const ctx=setup();
  try{
    const root=await new AtlasGroupTransportationSettings(ctx.group.id)._renderHTML();
    const elements=flatten(root);
    const recurring=elements.find(e=>e.tagName==="LABEL"&&
      e.children[0]?.textContent==="Recurring cost override (CP)");
    const frequency=elements.find(e=>e.tagName==="LABEL"&&
      e.children[0]?.textContent==="Cost frequency override");
    assert.ok(recurring&&frequency);
    assert.match(recurring.style.cssText,/align-content:start/);
    assert.match(frequency.style.cssText,/align-content:start/);
    const grid=elements.find(e=>e.children.includes(recurring)&&e.children.includes(frequency));
    assert.match(grid.style.cssText,/align-items:start/);
    assert.deepEqual(ctx.changes,[]);
  }finally{ctx.restore();}
});


test("Party transportation child editor stages existing Group data without writing",async()=>{
  const ctx=setup(),oldFoundry=globalThis.foundry;
  try{
    const app=new AtlasGroupTransportationSettings(ctx.group.id);
    app.render=async()=>{};
    const root=await app._renderHTML(),elements=flatten(root);
    const labels=elements.map(e=>e.textContent??"").join(" ");
    assert.match(labels,/Quantity Available/);
    const hidden=elements.find(e=>e.name==="cost-camel1");
    assert.ok(hidden,"existing validated parent fields preserve their storage contract");
    assert.ok(elements.some(e=>e.hidden&&flatten(e).includes(hidden)),
      "inline override controls are hidden from the Group overview");
    const edit=elements.find(e=>e.attributes.get("aria-label")==="Edit Camel transportation");
    assert.ok(edit?.events.click?.length);
    globalThis.foundry={applications:{api:{DialogV2:{
      input:async()=>({
        groupProfileId:"camel",groupQuantity:"4",capacity:"",
        groupSpeedCustom:"on",speedDisplay:"3.75",
        groupCostCustom:"on",cost_pp:"0",cost_gp:"0",cost_ep:"0",cost_sp:"0",
        cost_cp:"0",groupBasisCustom:"on",costBasis:"none",costApplies:"unit",
        purchaseEnabled:false,note:""
      })
    }}}};
    await edit.events.click[0]();
    assert.equal(ctx.changes.length,0,"child edit does not save World/Group");
    assert.equal(elements.find(e=>e.name==="quantity-camel1").value,"4");
    assert.equal(elements.find(e=>e.name==="speed-camel1").value,"3.75");
    const save=elements.find(e=>e.textContent==="Save Party Transportation Assignments");
    await save.events.click[0]();
    assert.equal(ctx.saved.groups.group1.members.camel1.quantity,4);
    assert.equal(ctx.saved.groups.group1.members.camel1.speedMphOverride,3.75);
    assert.equal(ctx.saved.groups.group1.members.camel1.capacity,null);
    assert.equal(ctx.saved.groups.group1.members.camel1.costCpOverride,0);
    assert.equal(ctx.changes.length,1,"only Group metadata World setting is persisted");
    assert.equal(ctx.group.system.members.length,3,"native roster untouched");
  }finally{globalThis.foundry=oldFoundry;ctx.restore();}
});

test("remove/re-enable is staged, versioned and never deletes the native Group Actor",async()=>{
  const ctx=setup(),prev=globalThis.foundry;
  try{
    const app=new AtlasGroupTransportationSettings(ctx.group.id);app.render=async()=>{};
    const root=flatten(await app._renderHTML());
    const remove=root.find(n=>n.attributes.get("aria-label")==="Remove Warship from Party transportation");
    assert.ok(remove?.events.click?.length);
    globalThis.foundry={applications:{api:{DialogV2:{confirm:async()=>true}}}};
    await remove.events.click[0]();
    assert.equal(root.find(n=>n.name==="enabled-ship1").value,"false");
    assert.equal(ctx.changes.length,0,"removal is draft-only");
    await root.find(n=>n.textContent==="Save Party Transportation Assignments").events.click[0]();
    assert.equal(ctx.saved.groups.group1.members.ship1.enabled,false);
    assert.equal(ctx.group.system.members.length,3);
    const projected=projectGroupTransportation(ctx.group,ctx.saved);
    assert.equal(projected.capacityBySurface.water,0,"excluded resource stays excluded on reload");
    const second=flatten(await app._renderHTML());
    const enable=second.find(n=>n.attributes.get("aria-label")===
      "Re-enable Warship for Party transportation");
    assert.ok(enable);
    await enable.events.click[0]();
    assert.equal(second.find(n=>n.name==="enabled-ship1").value,"true");
    await second.find(n=>n.textContent==="Save Party Transportation Assignments")
      .events.click[0]();
    assert.equal(ctx.saved.groups.group1.members.ship1.enabled,true);
  }finally{globalThis.foundry=prev;ctx.restore();}
});
