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
  appendChild(child){
    const previous=child.parentElement;
    if(previous){const index=previous.children.indexOf(child);
      if(index>=0)previous.children.splice(index,1);}
    child.parentElement=this;this.children.push(child);return child;
  }
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
    for(const name of ["Land Travel","Water Travel","Air Travel","Needs Setup",
      "Camel","Warship","Transportation Presets"])
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
    assert.equal(horseControls?.children.length,3,
      "mount has role, hidden Needs seat and Edit; no Delete");
    const shipRow=actorRows.find(e=>e.children[0]?.children[0]?.textContent==="Warship ★ Primary vehicle");
    assert.equal(shipRow?.children[0]?.children[1]?.children.length,1,
      "native Group membership owns vehicle removal; Atlas offers Edit only");
    assert.equal(elements.some(e=>e.attributes.get("aria-label")===
      "Remove Warship from Party transportation"),false);
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
    const save=elements.find(e=>e.attributes.get("aria-label")==="Save Party Transportation Assignments");
    assert.ok(save.events.click?.length);
    await save.events.click[0]();
    assert.equal(ctx.saved.version,7);
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
    const button=root.find(e=>e.attributes.get("aria-label")==="Save Party Transportation Assignments");
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
    await draft.find(e=>e.attributes.get("aria-label")==="Save Party Transportation Assignments")
      .events.click[0]();
    assert.equal(ctx.changes.length,count,"same Group stale write is rejected");
    assert.equal(ctx.saved.groups.group1.members.camel1.quantity,9);
  }finally{ctx.restore();}
});

test("Land/Water/Air/NPC/Need Setup tabs preserve drafts and accessible panels",async()=>{
  const ctx=setup();
  try{
    const nodes=flatten(await new AtlasGroupTransportationSettings(ctx.group.id)._renderHTML());
    const labels=nodes.filter(n=>n.className==="atlas-group-transport-surface")
      .map(section=>section.children[0].textContent);
    assert.deepEqual(labels,["Land Travel","Water Travel","Air Travel"]);
    const tabNodes=nodes.filter(n=>n.attributes.get("role")==="tab");
    assert.deepEqual(tabNodes.map(n=>n.textContent),["Land","Water","Air","NPC","Need Setup"]);
    assert.equal(nodes.filter(n=>n.attributes.get("role")==="tabpanel").length,5);
    const camel=nodes.find(n=>n.name==="quantity-camel1");
    camel.value="5";
    tabNodes[1].events.click[0]();
    assert.equal(tabNodes[1].attributes.get("aria-selected"),"true");
    tabNodes[0].events.click[0]();
    assert.equal(camel.value,"5","all drafted rows stay mounted between tabs");
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
    const save=elements.find(e=>e.attributes.get("aria-label")==="Save Party Transportation Assignments");
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
    const save=elements.find(e=>e.attributes.get("aria-label")==="Save Party Transportation Assignments");
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
    const save=elements.find(e=>e.attributes.get("aria-label")==="Save Party Transportation Assignments");
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
      input:async options=>{
        assert.match(options.ok.label,/Apply to Party draft/);
        return {
        groupProfileId:"camel",groupQuantity:"4",capacity:"",
        groupSpeedCustom:"on",speedDisplay:"3.75",
        groupCostCustom:"on",cost_pp:"0",cost_gp:"0",cost_ep:"0",cost_sp:"0",
        cost_cp:"0",groupBasisCustom:"on",costBasis:"none",costApplies:"unit",
        purchaseEnabled:false,note:""
      };}
    }}}};
    await edit.events.click[0]();
    assert.equal(ctx.changes.length,0,"child edit does not save World/Group");
    assert.ok(elements.some(e=>/Unsaved changes/.test(e.textContent??"")),
      "child Apply visibly marks the parent draft unsaved");
    assert.equal(elements.find(e=>e.name==="quantity-camel1").value,"4");
    assert.equal(elements.find(e=>e.name==="speed-camel1").value,"3.75");
    const save=elements.find(e=>e.attributes.get("aria-label")==="Save Party Transportation Assignments");
    await save.events.click[0]();
    assert.equal(ctx.saved.groups.group1.members.camel1.quantity,4);
    assert.equal(ctx.saved.groups.group1.members.camel1.speedMphOverride,3.75);
    assert.equal(ctx.saved.groups.group1.members.camel1.capacity,null);
    assert.equal(ctx.saved.groups.group1.members.camel1.costCpOverride,0);
    assert.equal(ctx.changes.length,1,"only Group metadata World setting is persisted");
    assert.equal(ctx.group.system.members.length,3,"native roster untouched");
  }finally{globalThis.foundry=oldFoundry;ctx.restore();}
});

test("native Group owns removal; legacy excluded resources can be explicitly restored",async()=>{
  const ctx=setup();
  try{
    const app=new AtlasGroupTransportationSettings(ctx.group.id);app.render=async()=>{};
    const initial=flatten(await app._renderHTML());
    assert.equal(initial.some(n=>n.attributes.get("aria-label")==="Remove Warship from Party transportation"),false);
    assert.equal(initial.some(n=>n.attributes.get("aria-label")==="Restore Warship to Party travel"),false);
    const before=ctx.saved;
    ctx.setSaved({version:6,groups:{group1:{members:{
      ...before.groups.group1.members,
      ship1:{role:"unassigned",quantity:1,capacity:60,surface:"water",enabled:false}
    }}}});
    const root=flatten(await app._renderHTML());
    const restore=root.find(n=>n.attributes.get("aria-label")==="Restore Warship to Party travel");
    assert.ok(restore?.events.click?.length);
    assert.equal(ctx.changes.length,0,"rendering legacy exclusion is read-only");
    await restore.events.click[0]();
    assert.equal(root.find(n=>n.name==="enabled-ship1").value,"true");
    assert.equal(ctx.changes.length,0,"restore is staged only");
    await root.find(n=>n.attributes.get("aria-label")==="Save Party Transportation Assignments")
      .events.click[0]();
    assert.equal(ctx.saved.groups.group1.members.ship1.enabled,true);
    assert.equal(ctx.group.system.members.length,3,"native Group membership intact");
    const reopened=flatten(await app._renderHTML());
    assert.equal(reopened.some(n=>n.attributes.get("aria-label")==="Restore Warship to Party travel"),false);
    assert.equal(reopened.some(n=>n.attributes.get("aria-label")==="Remove Warship from Party transportation"),false);
  }finally{ctx.restore();}
});

test("unique mount Assigned To uses current native Group IDs and stages until Group Save",async()=>{
  const ctx=setup(),oldFoundry=globalThis.foundry;
  try{
    const sameName={id:"pc2",name:"Cassian",type:"character",system:{}};
    ctx.group.system.members.push({actor:sameName});
    ctx.setSaved({version:5,groups:{group1:{members:{
      camel1:{role:"mount",quantity:1,capacity:1,surface:"land",profileId:"camel"}
    }}}});
    const app=new AtlasGroupTransportationSettings(ctx.group.id);app.render=async()=>{};
    const elements=flatten(await app._renderHTML());
    const rider=elements.find(e=>e.name==="assigned-to-camel1");
    assert.ok(rider,"staged Group-only Actor-ID field exists");
    assert.equal(rider.value,"");
    assert.deepEqual(rider.children.map(x=>x.value),["","pc1","pc2"]);
    assert.notEqual(rider.children[1].textContent,rider.children[2].textContent,
      "identically named characters are distinguishable without changing stable IDs");
    assert.ok(rider.children.slice(1).every(e=>!e.textContent.includes(e.value)),
      "raw Actor IDs are not displayed as rider labels");
    const edit=elements.find(e=>e.attributes.get("aria-label")==="Edit Camel transportation");
    globalThis.foundry={applications:{api:{DialogV2:{input:async()=>({
      groupProfileId:"camel",groupQuantity:"1",groupAssignedTo:"pc2",
      capacity:"",purchaseEnabled:false
    })}}}};
    await edit.events.click[0]();
    assert.equal(rider.value,"pc2");
    assert.equal(ctx.changes.length,0,"child Apply is a draft only");
    await elements.find(e=>e.attributes.get("aria-label")==="Save Party Transportation Assignments")
      .events.click[0]();
    assert.equal(ctx.saved.groups.group1.members.camel1.assignedTo,"pc2");
    assert.equal(ctx.changes.length,1);
    assert.equal(ctx.group.system.members.length,4,"native Group membership is unchanged");
    sameName.name="Renamed passenger";
    const reopened=flatten(await app._renderHTML());
    assert.equal(reopened.find(e=>e.name==="assigned-to-camel1").value,"pc2");
    assert.ok(reopened.some(e=>(e.textContent??"")==="Assigned To: Renamed passenger (exclusive personal mount; no boarding)"),
      "live display name updates but persisted ID never changes");
  }finally{globalThis.foundry=oldFoundry;ctx.restore();}
});

test("invalid, orphan and duplicate mount rider assignments are rejected before settings write",async()=>{
  const ctx=setup();
  try{
    ctx.group.system.members.push({actor:{id:"camel2",name:"Camel 2",type:"npc",system:{}}});
    let saved={version:6,groups:{group1:{members:{
      camel1:{role:"mount",quantity:1,capacity:1,surface:"land",assignedTo:"pc1"},
      camel2:{role:"mount",quantity:1,capacity:1,surface:"land"}
    }}}};
    ctx.setSaved(saved);
    const app=new AtlasGroupTransportationSettings(ctx.group.id);app.render=async()=>{};
    const nodes=flatten(await app._renderHTML());
    const input=name=>nodes.find(x=>x.name===name);
    const save=nodes.find(e=>e.attributes.get("aria-label")==="Save Party Transportation Assignments");
    input("assigned-to-camel2").value="pc1";
    await save.events.click[0]();
    assert.equal(ctx.changes.length,0,"duplicate rider may not be saved");
    input("assigned-to-camel2").value="";
    input("quantity-camel1").value="2";
    await save.events.click[0]();
    assert.equal(ctx.changes.length,0,"assigned mount cannot silently become a pool");
    input("quantity-camel1").value="1";
    input("role-camel1").value="pack";
    await save.events.click[0]();
    assert.equal(ctx.changes.length,0,"role change requires explicit rider clearing");
    input("role-camel1").value="mount";
    input("assigned-to-camel1").value="";
    await save.events.click[0]();
    assert.equal(ctx.changes.length,1,"clearing assignment allows explicit transition");

    const stale=new AtlasGroupTransportationSettings(ctx.group.id);stale.render=async()=>{};
    const controls=flatten(await stale._renderHTML());
    const next=controls.find(x=>x.name==="assigned-to-camel1");
    next.value="pc1";
    ctx.group.system.members.splice(0,1);
    await controls.find(x=>x.attributes.get("aria-label")==="Save Party Transportation Assignments")
      .events.click[0]();
    assert.equal(ctx.changes.length,1,"changed native Group roster blocks stale rider save");
  }finally{ctx.restore();}
});

test("Need Setup role edits keep the active row until explicit tab change; seat choice stays staged",async()=>{
  const ctx=setup();try{
    const nyx={id:"nyx",name:"Nyx",type:"npc",system:{}};
    const jon={id:"jon",name:"Jonathan",type:"npc",system:{}};
    ctx.group.system.members.push({actor:nyx},{actor:jon});
    ctx.setSaved({version:6,groups:{group1:{members:{
      camel1:{role:"mount",quantity:3,capacity:1,surface:"land"},
      nyx:{role:"passenger",quantity:1,capacity:null,surface:"land"}
    }}}});
    const app=new AtlasGroupTransportationSettings(ctx.group.id);app.render=async()=>{};
    const root=await app._renderHTML(),elements=flatten(root);
    const input=name=>elements.find(e=>e.name===name);
    const tabs=elements.filter(e=>e.attributes.get("role")==="tab");
    assert.equal(tabs.length,5);
    assert.equal(tabs[4].textContent,"Need Setup ! (1)");
    const nyxSeat=input("needs-seat-nyx");
    assert.equal(nyxSeat.checked,true,"legacy NPC passenger conservatively needs a seat");
    const jonSeat=input("needs-seat-jon");
    const jonRole=input("role-jon");
    assert.equal(jonSeat.parentElement.hidden,true,"toggle hidden before Companion / passenger");
    tabs[4].events.click[0]();
    const initialParent=jonRole.parentElement.parentElement.parentElement.parentElement;
    const before=ctx.changes.length;
    nyxSeat.checked=false;nyxSeat.events.change[0]();
    jonRole.value="passenger";jonRole.events.change.forEach(fn=>fn());
    assert.equal(tabs[4].textContent,"Need Setup");
    assert.equal(jonSeat.parentElement.hidden,false);
    assert.equal(jonSeat.checked,true);
    assert.equal(jonRole.parentElement.parentElement.parentElement.parentElement,initialParent,
      "role changes keep the edited row visible in its current tab");
    assert.equal(tabs[4].attributes.get("aria-selected"),"true");
    assert.ok(elements.some(e=>/Unsaved changes/.test(e.textContent??"")));
    tabs[3].events.click[0]();
    const npcCategory=elements.find(e=>e.className==="atlas-group-transport-npc-category"&&
      e.children[0]?.textContent==="Companions / Passengers");
    assert.ok(npcCategory.children.some(e=>e.className==="atlas-group-transport-resource"&&
      e.children[0]?.children[0]?.textContent==="Jonathan"));
    assert.equal(before,ctx.changes.length,"role edits and seat toggles remain staged");
    const save=elements.find(e=>e.attributes.get("aria-label")==="Save Party Transportation Assignments");
    await save.events.click[0]();
    assert.equal(ctx.saved.version,7);
    assert.equal(ctx.saved.groups.group1.members.nyx.needsSeat,false);
    assert.equal(ctx.saved.groups.group1.members.jon.needsSeat,true);
    const projected=projectGroupTransportation(ctx.group,ctx.saved);
    assert.deepEqual([projected.pcCount,projected.npcCount,projected.travelers],[1,2,2]);
    assert.equal(ctx.group.system.members.length,5,"native Group untouched");
    assert.equal(ctx.changes.length,1,"one Atlas Group World-setting write");
  }finally{ctx.restore();}
});

test("Cancel Party transportation preserves the draft when declined and never persists",async()=>{
  const ctx=setup(),oldFoundry=globalThis.foundry;
  try{
    const app=new AtlasGroupTransportationSettings(ctx.group.id);
    let closed=0,allow=false;
    app.close=async()=>{closed++;};
    globalThis.foundry={applications:{api:{DialogV2:{
      confirm:async()=>allow
    }}}};
    const nodes=flatten(await app._renderHTML());
    const role=nodes.find(e=>e.name==="role-camel1");
    role.value="passenger";role.events.change.forEach(fn=>fn());
    const cancel=nodes.find(e=>e.tagName==="BUTTON"&&e.textContent==="Cancel");
    assert.ok(cancel,"explicit Cancel is discoverable");
    await cancel.events.click[0]();
    assert.equal(closed,0);
    assert.equal(app.dirty,true);
    assert.equal(role.value,"passenger");
    allow=true;
    await cancel.events.click[0]();
    assert.equal(closed,1);
    assert.equal(ctx.changes.length,0);
    assert.equal(ctx.saved.groups.group1.members.camel1.role,"mount");
  }finally{globalThis.foundry=oldFoundry;ctx.restore();}
});

test("NPC roles and tab switches never write; Save, Refresh and Settings use standard footer actions",async()=>{
  const ctx=setup();try{
    const app=new AtlasGroupTransportationSettings(ctx.group.id);
    const root=await app._renderHTML(),nodes=flatten(root);
    const footer=nodes.find(n=>n.className==="atlas-group-transport-footer");
    assert.ok(footer);
    const left=footer.children[0],right=footer.children[1];
    assert.ok(flatten(left).some(n=>n.textContent==="Transportation Presets"));
    assert.ok(flatten(left).some(n=>n.attributes.get("aria-label")==="Refresh Party Transportation"));
    const save=right.children[0];
    assert.equal(save.attributes.get("aria-label"),"Save Party Transportation Assignments");
    assert.match(save.className,/atlas-ui-icon-button--footer/);
    assert.equal(save.children[0].className,"fa-solid fa-floppy-disk");
    assert.equal(nodes.some(n=>/fa-trash/.test(n.className??"")),false,
      "no duplicate Actor removal action on any active travel method");
    const tabs=nodes.filter(n=>n.attributes.get("role")==="tab");
    tabs[3].events.click[0]();
    tabs[4].events.click[0]();
    tabs[0].events.click[0]();
    assert.deepEqual(ctx.changes,[],"render and navigation are read-only");
  }finally{ctx.restore();}
});
