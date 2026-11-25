import assert from "node:assert/strict";
import test from "node:test";
import { AtlasTransportationSettings,openTransportationMethodEditor,
  renderTravelRules,renderJourneyPlayback } from "../scripts/navigation-transport-settings.js";

class FakeElement {
  constructor(tag){
    this.tagName=tag.toUpperCase();this.children=[];this.attributes=new Map();
    this.style={cssText:""};this.value="";this.defaultValue="";this.checked=false;
    this.listeners=new Map();
  }
  appendChild(child){this.children.push(child);return child;}
  append(...children){for(const child of children)this.appendChild(child);}
  setAttribute(name,value){this.attributes.set(name,String(value));}
  addEventListener(name,fn){this.listeners.set(name,fn);}
  focus(){this.focused=true;}
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

test("Transport catalog and Workspace travel forms render without writing settings",async()=>{
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
    const tabs=flatten(defaults).find(node=>node.className==="atlas-world-category-tabs");
    const scroll=flatten(defaults).find(node=>node.className==="atlas-world-category-scroll");
    assert.deepEqual(tabs.children.map(node=>node.textContent),["Land","Water","Air"]);
    assert.deepEqual(scroll.children.filter(node=>node.tagName==="FIELDSET")
      .map(node=>node.hidden),[false,true,true]);
    tabs.children[1].listeners.get("click")();
    assert.equal(app.activeCategory,"water");
    assert.deepEqual(scroll.children.filter(node=>node.tagName==="FIELDSET")
      .map(node=>node.hidden),[true,false,true],
      "Water shows its original independent services, no storage changes");
    const revisited=await app._renderHTML();
    const active=flatten(revisited).find(node=>node.className==="atlas-world-category-tabs");
    assert.equal(active.children[1].attributes.get("aria-selected"),"true",
      "add/edit/reset rerenders return to the chosen World category");
    assert.deepEqual(ctx.changes,[],"category navigation does not save");
    assert.equal(flatten(defaults).some(e=>e.textContent==="Travel rules"),false);
    const rulePanel=new FakeElement("section");renderTravelRules(rulePanel);
    const rules=flatten(rulePanel).map(e=>e.textContent??"").join(" ");
    assert.match(rules,/Rules Profile/);
    assert.match(rules,/Overnight downtime/);
    const journeyPanel=new FakeElement("section");renderJourneyPlayback(journeyPanel);
    const journey=flatten(journeyPanel).map(e=>e.textContent??"").join(" ");
    assert.match(journey,/Advance World time/);
    assert.match(journey,/Animation speed/);
    assert.deepEqual(ctx.changes,[],"opening tabs never writes or migrates settings");
  }finally{ctx.restore();}
});

test("rehydrated Transportation dialog tabs support Arrow/Home/End without saving",async()=>{
  const ctx=setup(),prior=globalThis.foundry;
  try{
    const tabs=["general","services","cost"].map((id,i)=>{
      const node=new FakeElement("button");
      node.dataset={atlasPresetTab:id};
      node.setAttribute("aria-selected",String(i===0));
      return node;
    });
    const panels=["general","services","cost"].map(id=>{
      const node=new FakeElement("section");
      node.dataset={atlasPresetPanel:id};
      return node;
    });
    const rendered=new FakeElement("div");
    rendered.dataset={};
    rendered.querySelectorAll=selector=>
      selector==="[data-atlas-preset-tab]"?tabs:
      selector==="[data-atlas-preset-panel]"?panels:[];
    rendered.querySelector=()=>null;
    globalThis.foundry={applications:{api:{DialogV2:{
      input:async({render})=>{
        render({element:rendered},rendered);
        return null;
      }
    }}}};
    await new AtlasTransportationSettings()._edit(null,"water");
    assert.deepEqual(tabs.map(t=>t.tabIndex),[0,-1,-1]);
    assert.deepEqual(panels.map(p=>p.hidden),[false,true,true]);
    let prevented=false;
    tabs[0].listeners.get("keydown")({key:"ArrowRight",
      preventDefault(){prevented=true;}});
    assert.equal(prevented,true);
    assert.deepEqual(tabs.map(t=>t.attributes.get("aria-selected")),
      ["false","true","false"]);
    assert.deepEqual(panels.map(p=>p.hidden),[true,false,true]);
    assert.equal(tabs[1].focused,true);
    tabs[1].listeners.get("keydown")({key:"End",preventDefault(){}});
    assert.deepEqual(tabs.map(t=>t.tabIndex),[-1,-1,0]);
    tabs[2].listeners.get("keydown")({key:"Home",preventDefault(){}});
    assert.deepEqual(panels.map(p=>p.hidden),[false,true,true]);
    assert.equal(tabs[0].focused,true);
    assert.deepEqual(ctx.changes,[],"tab switches are draft-only");
  }finally{globalThis.foundry=prior;ctx.restore();}
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
    const rulePanel=new FakeElement("section");renderTravelRules(rulePanel);
    const rules=flatten(rulePanel);
    assert.equal(rules.filter(node=>node.type==="range").length,4);
    assert.equal(rules.filter(node=>node.type==="number").length,4);
    const journeyPanel=new FakeElement("section");renderJourneyPlayback(journeyPanel);
    const journey=flatten(journeyPanel);
    assert.equal(journey.filter(node=>node.type==="range").length,1);
    assert.equal(journey.filter(node=>node.type==="number").length,1);
  }finally{ctx.restore();}
});

test("Journey controls put World-clock checkbox first and show three live speed examples",async()=>{
  const ctx=setup();
  try{
    const app=new AtlasTransportationSettings();const journeyPanel=new FakeElement("section");renderJourneyPlayback(journeyPanel);
    const nodes=flatten(journeyPanel);
    assert.ok(nodes.findIndex(n=>n.type==="checkbox")<
      nodes.findIndex(n=>n.type==="range"),"clock checkbox is before the speed slider");
    assert.equal(nodes.filter(n=>n.tagName==="TBODY").length,1);
    assert.equal(nodes.filter(n=>n.tagName==="TR").length,4,"one header and three sample trips");
    assert.ok(nodes.some(n=>(n.textContent??"").includes("Preview: three sample trips")));
    assert.ok(nodes.some(n=>n.textContent==="4s"),"6mi/3mph at 2sec/hour is four seconds");
  }finally{ctx.restore();}
});

test("all transport methods show consistent capacity and native currency editor fields",async()=>{
  const ctx=setup();
  const oldFoundry=globalThis.foundry;
  globalThis.foundry={applications:{api:{DialogV2:{
    input:async ({content})=>{
      const nodes=flatten(content);
      const names=nodes.filter(n=>n.name).map(n=>n.name);
      for(const name of ["name","kind","capacity","crewCount",
        "costBasis","costApplies","purchaseEnabled","crewWageBasis",
        "includeCrewWages","note","hireEnabled","hireBasis","hireApplies",
        "hireCrewIncluded","overtimeEnabled","overtimeExtraHours","overtimeMultiplier"])
        assert.ok(names.includes(name),"missing field "+name);
      assert.ok(!names.includes("surface"),"the surface comes from the creation category");
      for(const prefix of ["hire","purchase","crewWage","cost"])
        for(const coin of ["pp","gp","ep","sp","cp"]){
          const input=nodes.find(n=>n.name===prefix+"_"+coin);
          assert.ok(input,"missing five-coin field "+prefix+"_"+coin);
          assert.equal(input.type,"text","currency uses a native-style uninput, not a number spinner");
          assert.match(input.className,/uninput always-interactive/);
        }
      assert.ok(!nodes.some(n=>n.tagName==="DETAILS"),
        "ownership upkeep is a permanently visible section");
      assert.ok(nodes.some(n=>n.className==="atlas-transport-upkeep-section"),
        "ownership upkeep has a consistent section layout");
      if(names.includes("continuousEnabled"))
        assert.ok(names.includes("hireEnabled"),"water vehicles may offer hire");
      if(names.includes("livestockCapacity")){
        assert.ok(names.includes("livestockFareMode"),"every vehicle has a fare policy");
        assert.ok(names.includes("livestockFarePercent"),"every vehicle has a 0–200% slider");
      }
      const tabs=nodes.filter(n=>n.attributes?.get("role")==="tab");
      assert.deepEqual(tabs.map(n=>n.textContent),["General","Services","Ownership"]);
      assert.equal(nodes.filter(n=>n.attributes?.get("role")==="tabpanel").length,3);
      assert.equal(nodes.filter(n=>n.tagName==="TBODY").length,3,
        "services and ownership have dynamic quote and wage/upkeep preview tables");
      return null;
    }
  }}}};
  try{
    const app=new AtlasTransportationSettings();
    await app._edit({id:"camel",name:"Camel",kind:"mount",surface:"land",
      speedMph:3,capacity:1,costCp:5,costBasis:"day",costApplies:"unit",
      purchaseGp:50,note:"Reference.",builtIn:true});
    await app._edit(null,"water");
    assert.deepEqual(ctx.changes,[]);
  }finally{globalThis.foundry=oldFoundry;ctx.restore();}
});

test("World Transportation Presets no longer embeds Group-specific assignments",async()=>{
  const ctx=setup();
  try{
    const root=await new AtlasTransportationSettings()._renderHTML();
    const content=flatten(root).map(node=>node.textContent??"").join(" ");
    assert.doesNotMatch(content,/Group transportation resources|Save Group transportation|atlasGroupSelection/);
    assert.match(content,/Land travel/);
  }finally{ctx.restore();}
});

test("World transportation edits for different method IDs merge, stale same-method Save blocks",async()=>{
  const ctx=setup(),oldFoundry=globalThis.foundry,oldUI=globalThis.ui;
  try{
    const {defaultTransportationCatalog,readTransportationCatalog,
      listTransportationPresets,TRANSPORT_CATALOG_SETTING}=
      await import("../scripts/navigation-transport-catalog.js");
    let catalog=defaultTransportationCatalog(),writes=0;
    const settings=globalThis.game.settings;
    settings.get=(_m,key)=>key===TRANSPORT_CATALOG_SETTING?catalog:
      key==="guidedTravelRulesProfile"?"dnd5e2024":undefined;
    settings.set=async(_m,key,value)=>{
      if(key===TRANSPORT_CATALOG_SETTING){catalog=value;writes++;}
      return value;
    };
    const methods=listTransportationPresets(settings,"dnd5e");
    const a=methods.find(m=>m.id==="mounted"),b=methods.find(m=>m.id==="sailing");
    assert.ok(a&&b,"two independent built-in methods must exist");
    let active=a;
    const input=async()=>({
      name:active.name,kind:active.kind,surface:active.surface,
      speedDisplay:active.speedMph,capacity:active.capacity??"",
      crewCount:active.crewCount??0,costBasis:active.costBasis??"none",
      costApplies:active.costApplies??"unit",crewWageBasis:"day",
      hireBasis:"day",hireApplies:"unit",overtimeExtraHours:8,
      overtimeMultiplier:1.5
    });
    globalThis.foundry={applications:{api:{DialogV2:{input}}}};
    globalThis.ui={notifications:{info(){},error(message){throw Error(message);}}};
    const app=new AtlasTransportationSettings();app.render=async()=>{};
    active=a;await app._edit(a);
    active=b;await app._edit(b);
    assert.equal(writes,2);
    const updated=readTransportationCatalog(settings);
    assert.ok(updated.overrides.dnd5e2024?.mounted);
    assert.ok(updated.overrides.dnd5e2024?.sailing,
      "saving a second method keeps the first method's override");
    active=a;
    await assert.rejects(()=>app._edit(a),/transportation method changed elsewhere/);
    assert.equal(writes,2,"same-method stale edit never writes World catalog");
  }finally{globalThis.foundry=oldFoundry;globalThis.ui=oldUI;ctx.restore();}
});

test("Journey editor exposes explicit Save for this trip and Save to checkpoint controls",async()=>{
  const ctx=setup();
  const old=globalThis.foundry;
  const seen=[];
  globalThis.foundry={applications:{api:{DialogV2:{
    input:async config=>{
      seen.push(config);
      assert.equal(config.ok.label,"Save for this trip");
      assert.ok(config.position.height<=680,"dialog stays within the viewport");
      assert.ok(config.content.children[0].style.cssText.includes("overflow-y:auto"),
        "edit contents scroll instead of hiding the save buttons");
      assert.equal(config.buttons.length,1);
      assert.equal(config.buttons[0].label,"Save to Port Barthos");
      return null;
    }
  }},ux:{FormDataExtended:class {
    constructor(form){assert.equal(form,"mock-form");this.object={hireBasis:"mile"};}
  }}}};
  try{
    const app=new AtlasTransportationSettings();
    const method={id:"ship-passage",name:"Ship passage",kind:"vehicle",surface:"water",
      speedMph:2,capacity:8,costCp:0,costBasis:"none",costApplies:"unit",purchaseGp:null,
      crewCount:1,hireEnabled:true,hireCostCp:10,hireBasis:"mile",hireApplies:"passenger"};
    await app._edit(method,"water",{scope:"journey",onSave:async()=>{},
      onSaveCheckpoint:async()=>{},checkpointName:"Port Barthos"});
    assert.equal(seen.length,1);
    const result=seen[0].buttons[0].callback(null,{form:"mock-form"});
    assert.deepEqual(result,{hireBasis:"mile",__atlasSaveScope:"checkpoint"});
    assert.deepEqual(ctx.changes,[],"opening scoped editor makes no settings writes");
  }finally{globalThis.foundry=old;ctx.restore();}
});


test("Group scope uses the actual General/Services/Ownership editor, with hired Services disabled",async()=>{
  const ctx=setup(),prior=globalThis.foundry;
  const applied=[],seen=[];
  const method={id:"camel",name:"Camel",kind:"mount",surface:"land",
    speedMph:3,capacity:1,costCp:5,costBasis:"day",costApplies:"unit",
    purchaseGp:50,note:"World note"};
  try{
    globalThis.foundry={applications:{api:{DialogV2:{
      input:async({content,ok,window})=>{
        assert.equal(content.tagName,"DIV");
        assert.equal(content.attributes.size,0,"DialogV2 requires plain outer shell");
        const elements=flatten(content);
        const tabs=elements.filter(e=>e.attributes.get("role")==="tab");
        assert.deepEqual(tabs.map(t=>t.textContent),["General","Services","Ownership"]);
        assert.equal(tabs[1].disabled,true,"owned Group cannot offer a hired service");
        assert.equal(tabs[1].attributes.get("aria-disabled"),"true");
        assert.equal(elements.find(e=>e.attributes.get("data-atlas-preset-panel")==="services")
          .attributes.has("inert"),true);
        seen.push(elements.map(el=>el.textContent??"").join(" "));
        const general=elements.find(el=>el.attributes.get("data-atlas-preset-panel")==="general");
        const ownership=elements.find(el=>el.attributes.get("data-atlas-preset-panel")==="cost");
        const generalText=flatten(general).map(e=>e.textContent??"").join(" ");
        const ownershipText=flatten(ownership).map(e=>e.textContent??"").join(" ");
        assert.match(generalText,/Passenger seats per unit/);
        assert.match(generalText,/Required crew per unit/,"Crew requirement is read-only but visible");
        assert.match(generalText,/World profile/);
        const crew=elements.find(e=>e.attributes.has("data-atlas-group-crew"));
        assert.ok(crew,"inherited staffing is presented without editable World fields");
        assert.match(crew.textContent,/0 required/);
        assert.doesNotMatch(ownershipText,/Available for purchase|Crew wage per person/,
          "already-owned resources cannot change sale offers or crew wages");
        assert.ok(elements.find(el=>el.name==="groupSpeedCustom")?.hidden);
        assert.ok(elements.find(el=>el.name==="groupCostCustom")?.hidden);
        assert.equal(elements.find(el=>el.name==="name")?.value,"Hamilton",
          "Group native Actor name remains authoritative");
        assert.match(window.title,/Edit Hamilton Transportation/);
        assert.equal(ok.label,"Apply to Party draft");
        return {groupProfileId:"camel",groupQuantity:"3",capacity:"",
          groupCostCustom:"on",cost_pp:"0",cost_gp:"0",cost_ep:"0",
          cost_sp:"0",cost_cp:"0",
          groupBasisCustom:"on",costBasis:"none",
          groupPurchaseCustom:"on",purchaseEnabled:false,
          groupNoteCustom:"on",note:"Group-only"};
      }
    }}}};
    const result=await openTransportationMethodEditor({scope:"group",method,
      groupKind:"mount",groupActorName:"Hamilton",
      profiles:[method],groupAssignment:{profileId:"camel",quantity:2,
        capacity:null,speedMphOverride:null,costCpOverride:null},
      onSave:value=>applied.push(value)});
    assert.match(seen[0],/Quantity Available/);
    assert.doesNotMatch(seen[0],/Customize Party travel speed/,
      "reuse Map Marker fields without extra visible customization rows");
    assert.match(seen[0],/Recurring upkeep/);
    assert.equal(result.quantity,3);
    assert.equal(result.capacity,null);
    assert.equal(result.speedMphOverride,null,"inherit World speed");
    assert.equal(result.costCpOverride,0,"explicit zero is not inherited");
    assert.equal(result.costBasisOverride,"none");
    assert.equal(result.purchaseGpOverride,null,
      "purchase policy for already-owned resources remains World-owned");
    assert.equal(result.noteOverride,"Group-only");
    assert.deepEqual(applied,[result]);
    assert.deepEqual(ctx.changes,[],"child Apply never writes World settings");
    globalThis.foundry.applications.api.DialogV2.input=async()=>({
      groupProfileId:"camel",groupQuantity:"0",capacity:""});
    await assert.rejects(()=>openTransportationMethodEditor({scope:"group",
      method,groupKind:"mount",profiles:[method],
      groupAssignment:{quantity:1},onSave:()=>{}}),/Quantity Available/);
    globalThis.foundry.applications.api.DialogV2.input=async()=>null;
    assert.equal(await openTransportationMethodEditor({scope:"group",
      method,groupKind:"mount",profiles:[method],
      groupAssignment:{quantity:1},onSave:()=>{}}),undefined);
    assert.deepEqual(ctx.changes,[]);
  }finally{globalThis.foundry=prior;ctx.restore();}
});

test("Group editor records touched Map Marker fields as overrides without new visible controls",async()=>{
  const ctx=setup(),previous=globalThis.foundry;
  try{
    const method={id:"camel",name:"Camel",kind:"mount",surface:"land",
      speedMph:3,capacity:1,costCp:5,costBasis:"day",
      costApplies:"unit",purchaseGp:50,note:"World note"};
    globalThis.foundry={applications:{api:{DialogV2:{
      input:async({content,render})=>{
        const root=content.children[0];
        const elements=flatten(root);
        root.querySelectorAll=()=>[];
        root.querySelector=selector=>{
          const match=selector.match(/^\[name="([^"]+)"\]$/);
          if(match)return elements.find(el=>el.name===match[1])??null;
          if(selector==="[data-atlas-scope-reset]")
            return elements.find(el=>el.attributes.get("data-atlas-scope-reset")!==undefined)??null;
          if(selector==="[data-atlas-group-crew]")
            return elements.find(el=>el.attributes.has("data-atlas-group-crew"))??null;
          return null;
        };
        render(null,root);
        const staffing=root.querySelector("[data-atlas-group-crew]");
        const profile=elements.find(e=>e.name==="groupProfileId");
        assert.match(staffing.textContent,/0 required across 3 units/);
        profile.value="";profile.listeners.get("change")();
        assert.match(staffing.textContent,/Not configured/);
        profile.value="camel";profile.listeners.get("change")();
        assert.match(staffing.textContent,/0 required across 3 units/);
        const quantity=elements.find(e=>e.name==="groupQuantity");
        quantity.value="4";root.listeners.get("input")({target:quantity});
        assert.match(staffing.textContent,/0 required across 4 units/);
        const speedFlag=elements.find(e=>e.name==="groupSpeedCustom");
        const upkeepFlag=elements.find(e=>e.name==="groupCostCustom");
        assert.equal(speedFlag.checked,false,"speed starts World-inherited");
        root.listeners.get("input")({target:{name:"speedDisplay"}});
        assert.equal(speedFlag.checked,true,"typing a speed makes a Party override");
        root.listeners.get("input")({target:{
          getAttribute:key=>key==="data-atlas-range-for"?"speedDisplay":null
        }});
        assert.equal(speedFlag.checked,true,"slider edits count, too");
        root.listeners.get("input")({target:{name:"cost_gp"}});
        assert.equal(upkeepFlag.checked,true,"native currency controls create a Group-only override");
        const reset=root.querySelector("[data-atlas-scope-reset]");
        reset.listeners.get("click")();
        assert.equal(speedFlag.checked,false,"Reset restores World inheritance");
        assert.equal(upkeepFlag.checked,false);
        return null;
      }
    }}}};
    await openTransportationMethodEditor({scope:"group",method,groupKind:"mount",
      groupActorName:"Hamilton",profiles:[method],groupAssignment:{
        profileId:"camel",quantity:3},onSave:()=>{throw Error("No save after cancel");}});
    assert.deepEqual(ctx.changes,[]);
  }finally{globalThis.foundry=previous;ctx.restore();}
});


test("Party World profiles group Land/Water/Air alphabetically and quantity uses the shared slider",async()=>{
  const ctx=setup(),prior=globalThis.foundry;
  const profiles=[
    {id:"zebra",name:"Zebra",kind:"mount",surface:"land"},
    {id:"eagle",name:"Eagle",kind:"mount",surface:"air"},
    {id:"horse",name:"Riding Horse",kind:"mount",surface:"land"},
    {id:"otter",name:"Otter",kind:"mount",surface:"water"},
    {id:"alpaca",name:"Alpaca",kind:"mount",surface:"land"},
    {id:"falcon",name:"Falcon",kind:"mount",surface:"air"},
    {id:"seal",name:"Seal",kind:"mount",surface:"water"}
  ];
  const fullProfiles=profiles.map(profile=>({
    speedMph:3,capacity:1,costCp:0,costBasis:"none",costApplies:"unit",
    purchaseGp:null,note:"",...profile
  }));
  const saved=[];
  try{
    globalThis.foundry={applications:{api:{DialogV2:{input:async({content})=>{
      const elements=flatten(content);
      const select=elements.find(e=>e.tagName==="SELECT"&&e.name==="groupProfileId");
      assert.ok(select);
      assert.equal(select.children[0].textContent,"No linked World profile");
      const groups=select.children.filter(e=>e.tagName==="OPTGROUP");
      assert.deepEqual(groups.map(g=>g.label),["Land","Water","Air"]);
      assert.deepEqual(groups.map(g=>g.children.map(option=>option.textContent)),[
        ["Alpaca","Riding Horse","Zebra"],["Otter","Seal"],["Eagle","Falcon"]]);
      assert.equal(groups.flatMap(g=>g.children).some(o=>/\\((Land|Water|Air)\\)/.test(o.textContent)),false,
        "group heading supplies surface, not a name suffix");
      assert.equal(groups[0].children.find(o=>o.value==="horse")?.defaultSelected,true,
        "saved World profile ID remains selected regardless of alphabetical position");
      const range=elements.find(e=>e.attributes.get("data-atlas-range-for")==="groupQuantity");
      const numeric=elements.find(e=>e.name==="groupQuantity");
      assert.ok(range&&numeric,"Quantity Available is a linked range and numeric input");
      assert.equal(range.type,"range");assert.equal(numeric.type,"number");
      assert.equal(range.min,"1");assert.equal(range.max,"100");assert.equal(range.step,"1");
      assert.equal(numeric.step,"1");assert.equal(numeric.value,"3");
      range.value="7";range.listeners.get("input")();
      assert.equal(numeric.value,"7","slider synchronizes its numeric field");
      return {groupProfileId:"otter",groupQuantity:numeric.value};
    }}}}};
    const result=await openTransportationMethodEditor({scope:"group",
      method:fullProfiles[2],profiles:fullProfiles,groupKind:"mount",groupActorName:"Riding Horse",
      groupAssignment:{profileId:"horse",quantity:3},onSave:next=>saved.push(next)});
    assert.equal(result.profileId,"otter","selection persists stable World ID, not display label");
    assert.equal(result.quantity,7);
    assert.deepEqual(saved,[result]);
    assert.deepEqual(ctx.changes,[],"child Apply makes no World or Group writes");
  }finally{globalThis.foundry=prior;ctx.restore();}
});

test("shared Party Transportation General tab lists eligible Assigned To rider IDs",async()=>{
  const ctx=setup(),previous=globalThis.foundry;
  const profile={id:"riding-horse",name:"Riding Horse",kind:"mount",surface:"land",
    speedMph:3,capacity:1,costCp:0,costBasis:"none",costApplies:"unit",
    purchaseGp:null,note:""};
  const groupRiders=[{id:"pc1",name:"Cassian"},{id:"pc2",name:"Cassian"}];
  const saved=[];
  try{
    globalThis.foundry={applications:{api:{DialogV2:{input:async({content})=>{
      const elements=flatten(content);
      const field=elements.find(e=>e.name==="groupAssignedTo");
      assert.ok(field,"Assigned To belongs inside the shared General tab");
      assert.deepEqual(field.children.map(child=>child.value),["","pc1","pc2"]);
      assert.notEqual(field.children[1].textContent,field.children[2].textContent,
        "identical display names require distinct Actor-ID labels");
      assert.equal(field.value,"pc1");
      return {groupProfileId:"riding-horse",groupQuantity:"1",groupAssignedTo:"pc2"};
    }}}}};
    const result=await openTransportationMethodEditor({scope:"group",method:profile,
      groupKind:"mount",groupActorName:"Horse",profiles:[profile],groupRiders,
      groupAssignment:{profileId:profile.id,quantity:1,assignedTo:"pc1"},
      onSave:value=>saved.push(value)});
    assert.equal(result.assignedTo,"pc2");
    assert.equal(result.quantity,1);
    assert.deepEqual(saved,[result]);
    assert.deepEqual(ctx.changes,[],"child Apply makes no authoritative writes");
    globalThis.foundry.applications.api.DialogV2.input=async()=>({
      groupProfileId:profile.id,groupQuantity:"2",groupAssignedTo:"pc1"
    });
    await assert.rejects(()=>openTransportationMethodEditor({scope:"group",
      method:profile,groupKind:"mount",profiles:[profile],groupRiders,
      groupAssignment:{quantity:1},onSave:()=>{}}),/Choose None before increasing/);
    globalThis.foundry.applications.api.DialogV2.input=async()=>({
      groupProfileId:profile.id,groupQuantity:"1",groupAssignedTo:"deletedId"
    });
    await assert.rejects(()=>openTransportationMethodEditor({scope:"group",
      method:profile,groupKind:"mount",profiles:[profile],groupRiders,
      groupAssignment:{quantity:1},onSave:()=>{}}),/current eligible Party member/);
  }finally{globalThis.foundry=previous;ctx.restore();}
});

test("trip-only transportation edits cannot bypass a checkpoint's finite hire inventory",async()=>{
  const ctx=setup(),old=globalThis.foundry;
  const method={id:"cart",name:"Cart",kind:"vehicle",surface:"land",
    speedMph:4,capacity:2,costCp:0,costBasis:"none",costApplies:"unit",
    purchaseGp:15,note:"",hireEnabled:true,hireCostCp:100,
    hireBasis:"day",hireApplies:"unit",hireCrewIncluded:true,
    hireUnlimited:false,hireQuantity:1};
  let calls=0;
  try{
    globalThis.foundry={applications:{api:{DialogV2:{input:async()=>({
      hireUnlimited:true,hireQuantity:99,hireEnabled:true,
      speedDisplay:4,capacity:2,hireBasis:"day",hireApplies:"unit",
      overtimeExtraHours:8,overtimeMultiplier:1.5
    })}}}};
    await assert.rejects(()=>openTransportationMethodEditor({method,scope:"journey",
      checkpointName:"Hearth's Heart",onSave:()=>{calls++;},
      onSaveCheckpoint:()=>{calls++;}}),/Checkpoint inventory must be saved/);
    assert.equal(calls,0);
    assert.deepEqual(ctx.changes,[]);
  }finally{globalThis.foundry=old;ctx.restore();}
});

test("Journey Carriage continuous toggle determines operation without a second selector",async()=>{
  const ctx=setup(),old=globalThis.foundry;
  const base={id:"cart",name:"Cart",kind:"vehicle",surface:"land",
    speedMph:3,capacity:6,costCp:0,costBasis:"none",costApplies:"unit",
    purchaseGp:15,hireEnabled:true,hireCostCp:400,hireBasis:"day",
    hireApplies:"unit",hireCrewIncluded:true,continuousEnabled:false};
  let enabled=true;const saves=[];
  try{
    globalThis.foundry={applications:{api:{DialogV2:{input:async()=>({
      name:"Cart",kind:"vehicle",speedDisplay:3,capacity:6,
      hireEnabled:true,hireBasis:"day",hireApplies:"unit",
      hireCrewIncluded:true,costBasis:"none",costApplies:"unit",
      crewWageBasis:"day",overtimeExtraHours:8,overtimeMultiplier:1.5,
      continuousEnabled:enabled,atlasJourneyOperation:enabled?"normal":"continuous"
    })}}}};
    await openTransportationMethodEditor({method:base,scope:"journey",
      journeyOperation:"normal",onSave:(_edited,details)=>saves.push(details.operation)});
    enabled=false;
    await openTransportationMethodEditor({method:{...base,continuousEnabled:true},
      scope:"journey",journeyOperation:"continuous",
      onSave:(_edited,details)=>saves.push(details.operation)});
    assert.deepEqual(saves,["continuous","normal"],
      "turning continuous on or off is the effective Journey schedule");
    assert.deepEqual(ctx.changes,[],"trip editing does not persist World changes");
  }finally{globalThis.foundry=old;ctx.restore();}
});


test("owned water vessel animal stalls remain editable even when hire is disabled",async()=>{
  const ctx=setup(),previous=globalThis.foundry;
  try{
    globalThis.foundry={applications:{api:{DialogV2:{
      input:async({content})=>{
        const nodes=flatten(content);
        const stalls=nodes.find(node=>node.name==="livestockCapacity");
        const animalRate=nodes.find(node=>node.name==="livestockFareBasis");
        const hire=nodes.find(node=>node.name==="hireEnabled");
        const hireOnly=nodes.find(node=>node.attributes?.has("data-atlas-hire-controls"));
        assert.ok(stalls,"vessel animal capacity is configurable independently");
        assert.ok(animalRate);
        assert.equal(hire.checked,false,"owned ship is not automatically hired");
        assert.ok(hireOnly);
        assert.equal(flatten(hireOnly).includes(stalls),false,
          "animal accommodation must not inherit the disabled hire-only controls");
        return null;
      }
    }}}};
    await new AtlasTransportationSettings()._edit({
      id:"sailing",name:"Sailing Ship",kind:"vehicle",surface:"water",
      speedMph:2,capacity:20,costCp:0,costBasis:"none",costApplies:"unit",
      purchaseGp:10000,hireEnabled:false,hireCostCp:0,hireBasis:"day",
      hireApplies:"unit",livestockCapacity:null,livestockFareCp:null,
      livestockFareBasis:"trip"
    },"water");
    assert.deepEqual(ctx.changes,[],"opening accommodation editor never writes");
  }finally{globalThis.foundry=previous;ctx.restore();}
});

test("World-inherited mount fare is visible in preset and Map Marker editors without saving",async()=>{
  const ctx=setup(),previous=globalThis.foundry;
  try{
    const get=globalThis.game.settings.get;
    globalThis.game.settings.get=(module,key)=>key==="guidedLivestockFarePercent"?50:
      get(module,key);
    let dialogs=0;
    globalThis.foundry={applications:{api:{DialogV2:{input:async({content})=>{
      dialogs++;
      const label=flatten(content).map(node=>node.textContent??"").join(" ");
      assert.match(label,/Inherit World default \(50%\)/);
      assert.match(label,/without copying it to this preset or Map Marker/);
      return null;
    }}}}};
    const editor=new AtlasTransportationSettings();
    await editor._edit(null,"water");
    await editor._edit(null,"air");
    assert.equal(dialogs,2);
    assert.deepEqual(ctx.changes,[],"preview and Cancel do not change World catalogs");
  }finally{globalThis.foundry=previous;ctx.restore();}
});

test("World crew thresholds expose editable inherited defaults, save explicit values and reject invalid drafts",async()=>{
  const ctx=setup(),oldFoundry=globalThis.foundry,oldUI=globalThis.ui;
  try{
    const {findTransportationPreset,TRANSPORT_CATALOG_SETTING}=await import("../scripts/navigation-transport-catalog.js");
    const ship=findTransportationPreset("warship",game.settings,"dnd5e");
    const app=new AtlasTransportationSettings();app.render=async()=>{};
    globalThis.ui={notifications:{info(){}}};
    let response=null;
    globalThis.foundry={applications:{api:{DialogV2:{input:async({content})=>{
      const nodes=flatten(content);
      for(const [name,expected] of [["crewMinimum","15"],["crewOptimal","30"],["crewExcellent","45"]]){
        const input=nodes.find(e=>e.name===name);
        assert.ok(input,name);assert.equal(input.type,"number");
        assert.equal(input.placeholder,expected);
        assert.equal(input.value,"","blank inherits the reference threshold");
      }
      return response;
    }}}}};
    await app._edit(ship,"water");
    assert.deepEqual(ctx.changes,[]);
    const base={name:ship.name,kind:ship.kind,speedDisplay:ship.speedMph,
      capacity:ship.capacity,crewCount:60,costBasis:"none",costApplies:"unit",
      crewWageBasis:"day",hireBasis:"day",hireApplies:"unit",overtimeExtraHours:8,overtimeMultiplier:1.5};
    response={...base,crewMinimum:"10",crewOptimal:"25",crewExcellent:"50"};
    await app._edit(ship,"water");
    assert.deepEqual(ctx.changes.at(-1)[1].overrides.dnd5e2024.warship.crewThresholds,
      {minimum:10,optimal:25,excellent:50});
    const writes=ctx.changes.length;
    response={...base,crewMinimum:"10",crewOptimal:"",crewExcellent:"50"};
    await assert.rejects(()=>app._edit(ship,"water"),/crew threshold/i);
    assert.equal(ctx.changes.length,writes);
    response={...base,crewMinimum:"10",crewOptimal:"55",crewExcellent:"50"};
    await assert.rejects(()=>app._edit(ship,"water"),/invalid/i);
    assert.equal(ctx.changes.length,writes);
    response={...base,crewMinimum:"",crewOptimal:"",crewExcellent:""};
    await app._edit(ship,"water");
    assert.equal(ctx.changes.at(-1)[0],TRANSPORT_CATALOG_SETTING);
    assert.equal(ctx.changes.at(-1)[1].overrides.dnd5e2024.warship.crewThresholds,undefined);
  }finally{globalThis.foundry=oldFoundry;globalThis.ui=oldUI;ctx.restore();}
});

test("hired service tier editor saves explicit World rates and Map Marker inheritance, without enabling hire",async()=>{
  const ctx=setup(),oldFoundry=globalThis.foundry,oldUI=globalThis.ui;
  try{
    const {findTransportationPreset}=await import("../scripts/navigation-transport-catalog.js");
    const {checkpointOfferMethod,transportationMethodOverrideDelta}=await import("../scripts/checkpoint-transportation.js");
    const ship=findTransportationPreset("warship",game.settings,"dnd5e");
    const app=new AtlasTransportationSettings();app.render=async()=>{};
    globalThis.ui={notifications:{info(){}}};
    let response=null,expectedRate="",expectedSchedule="",expectedPlaceholder="250";
    globalThis.foundry={applications:{api:{DialogV2:{input:async({content})=>{
      const nodes=flatten(content);
      const rate=nodes.find(e=>e.name==="hireLevelRate-optimal");
      const schedule=nodes.find(e=>e.name==="hireLevelOperation-optimal");
      assert.ok(rate&&schedule,"shared Services tab shows a tier editor");
      assert.equal(rate.value,expectedRate);
      assert.equal(rate.placeholder,expectedPlaceholder);
      assert.equal(schedule.value,expectedSchedule);
      return response;
    }}}}};
    await app._edit(ship,"water");
    assert.deepEqual(ctx.changes,[]);
    const base={name:ship.name,kind:ship.kind,speedDisplay:ship.speedMph,
      capacity:ship.capacity,crewCount:60,costBasis:"none",costApplies:"unit",
      crewWageBasis:"day",hireBasis:"day",hireApplies:"unit",hire_gp:"250",
      overtimeEnabled:true,overtimeExtraHours:8,overtimeMultiplier:1.5,continuousEnabled:true};
    response={...base,"hireLevelRate-optimal":"275","hireLevelOperation-optimal":"overtime"};
    await app._edit(ship,"water");
    const stored=ctx.changes.at(-1)[1].overrides.dnd5e2024.warship;
    assert.deepEqual(stored.hireServiceLevels,{optimal:{hireCostCp:27500,operation:"overtime"}});
    assert.equal(stored.hireEnabled,false);
    const writes=ctx.changes.length;
    response={...base,continuousEnabled:false,"hireLevelOperation-full":"continuous"};
    await assert.rejects(()=>app._edit(ship,"water"),/continuous/i);
    assert.equal(ctx.changes.length,writes);
    const world={...ship,hireServiceLevels:stored.hireServiceLevels,overtimeEnabled:true,continuousEnabled:true};
    const offer={methodId:ship.id,mode:"sea",overrides:{hireServiceLevels:{optimal:{hireCostCp:0}}}};
    const local=checkpointOfferMethod(offer,world);
    let result;
    expectedRate="0";expectedPlaceholder="275";
    response={...base,"hireLevelRate-optimal":"","hireLevelOperation-optimal":""};
    await openTransportationMethodEditor({method:local,scope:"checkpoint",inheritedMethod:world,onSave:next=>{result=next;}});
    assert.deepEqual(result.hireServiceLevels,world.hireServiceLevels);
    assert.equal(transportationMethodOverrideDelta(world,result).hireServiceLevels,undefined);
    assert.equal(ctx.changes.length,writes,"Map Marker apply never writes World settings");
  }finally{globalThis.foundry=oldFoundry;globalThis.ui=oldUI;ctx.restore();}
});

test("Journey service terms use local inheritance and apply only to the trip draft",async()=>{
  const ctx=setup(),oldFoundry=globalThis.foundry;
  try{
    const {findTransportationPreset}=await import("../scripts/navigation-transport-catalog.js");
    const {transportationMethodOverrideDelta}=await import("../scripts/checkpoint-transportation.js");
    const base={...findTransportationPreset("warship",game.settings,"dnd5e"),
      hireEnabled:true,overtimeEnabled:true,continuousEnabled:true,
      hireServiceLevels:{optimal:{hireCostCp:27500,operation:"overtime"},full:{hireCostCp:40000}}};
    const effective={...base,hireServiceLevels:{...base.hireServiceLevels,optimal:{hireCostCp:0,operation:"overtime"}}};
    let result=null,response=null;
    globalThis.foundry={applications:{api:{DialogV2:{input:async({content,ok})=>{
      const nodes=flatten(content);
      assert.equal(ok.label,"Save for this trip");
      const rate=nodes.find(e=>e.name==="hireLevelRate-optimal");
      assert.ok(rate,"Journey hire terms must be editable");
      assert.equal(rate.value,"0");
      assert.equal(rate.placeholder,"275");
      return response;
    }}}}};
    const open=()=>openTransportationMethodEditor({method:effective,scope:"journey",checkpointName:"Port",
      inheritedMethod:base,onSave:next=>{result=next;}});
    await open();
    assert.equal(result,null);assert.deepEqual(ctx.changes,[]);
    response={name:base.name,kind:base.kind,speedDisplay:base.speedMph,
      capacity:base.capacity,crewCount:60,costBasis:"none",costApplies:"unit",
      crewWageBasis:"day",hireBasis:"day",hireApplies:"unit",hire_gp:"250",
      hireEnabled:true,overtimeEnabled:true,overtimeExtraHours:8,overtimeMultiplier:1.5,continuousEnabled:true,
      hireUnlimited:true,hireQuantity:1,
      "hireLevelRate-optimal":"","hireLevelOperation-optimal":"",
      "hireLevelRate-full":"0"};
    await open();
    assert.deepEqual(result.hireServiceLevels,{optimal:{hireCostCp:27500,operation:"overtime"},full:{hireCostCp:0}});
    assert.deepEqual(transportationMethodOverrideDelta(base,result).hireServiceLevels,{full:{hireCostCp:0}});
    assert.deepEqual(ctx.changes,[]);
  }finally{globalThis.foundry=oldFoundry;ctx.restore();}
});

test("checkpoint Journey tier selector chooses the advertised schedule without persisting selection",async()=>{
  const ctx=setup(),oldFoundry=globalThis.foundry;
  try{
    const {findTransportationPreset}=await import("../scripts/navigation-transport-catalog.js");
    const method={...findTransportationPreset("warship",game.settings,"dnd5e"),
      hireEnabled:true,overtimeEnabled:true,continuousEnabled:true};
    let result=null,selection=null;
    globalThis.foundry={applications:{api:{DialogV2:{input:async({content})=>{
      const select=flatten(content).find(e=>e.name==="atlasJourneyServiceLevel");
      assert.ok(select);assert.deepEqual(select.children.map(o=>o.value),["","minimum","optimal","excellent","full"]);
      return {name:method.name,kind:method.kind,speedDisplay:method.speedMph,
        capacity:method.capacity,crewCount:60,costBasis:"none",costApplies:"unit",
        crewWageBasis:"day",hireBasis:"day",hireApplies:"unit",hire_gp:"250",
        hireEnabled:true,hireUnlimited:true,hireQuantity:1,overtimeEnabled:true,
        overtimeExtraHours:8,overtimeMultiplier:1.5,continuousEnabled:true,
        atlasJourneyOperation:"continuous",atlasJourneyServiceLevel:"minimum"};
    }}}}};
    await openTransportationMethodEditor({method,scope:"journey",checkpointName:"Port",
      inheritedMethod:method,journeyOperation:"continuous",journeyServiceLevel:"",
      onSave:(next,draft)=>{result=next;selection=draft;}});
    assert.deepEqual(selection,{operation:"normal",serviceLevel:"minimum"});
    assert.equal(result.serviceLevel,undefined);
    assert.equal(result.atlasJourneyServiceLevel,undefined);
    assert.deepEqual(ctx.changes,[]);
  }finally{globalThis.foundry=oldFoundry;ctx.restore();}
});
