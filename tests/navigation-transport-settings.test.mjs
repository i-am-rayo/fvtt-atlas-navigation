import assert from "node:assert/strict";
import test from "node:test";
import { AtlasTransportationSettings, renderTravelRules, renderJourneyPlayback } from "../scripts/navigation-transport-settings.js";

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
