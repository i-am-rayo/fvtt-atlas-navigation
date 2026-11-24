import test from "node:test";
import assert from "node:assert/strict";
import {defaultCheckpointPresets,validateCheckpointPresets,
  presetForCheckpointType} from "../scripts/checkpoint-preset-model.js";
import {createEmptyAtlas,upgradeAtlasPlayerVisibility} from "../scripts/atlas-model.js";
import {addRoadCheckpoint} from "../scripts/checkpoint-model.js";
import {CHECKPOINT_BULK_FIELDS,buildCheckpointBulkUpdate,
  applyCheckpointPresetBulk} from "../scripts/checkpoint-bulk-apply.js";
import {defaultCheckpointTransportOffers,validateCheckpointTransportOffers,
  validateCheckpointTransportStore,checkpointOfferMethod,offersAtOrigin,
  checkpointOffers,saveCheckpointOffers} from "../scripts/checkpoint-transportation.js";
import {listTransportationPresets} from "../scripts/navigation-transport-catalog.js";

const settings={get:()=>undefined};
const methods=listTransportationPresets(settings,"dnd5e");
const world=id=>methods.find(m=>m.id===id);
test("beta.4c seeds lore-friendly city, stables, inland and ocean offers",()=>{
  const all=defaultCheckpointPresets();
  const types=new Set(all.presets.map(p=>p.category));
  for(const type of ["stables","mines","lighthouse","sea-storm","reef",
    "whirlpool","pirates","sea-monster","air-dock"])assert.ok(types.has(type),type);
  assert.equal(presetForCheckpointType(all,"mines").appearance.icon,"pickaxe");
  assert.equal(presetForCheckpointType(all,"stables").appearance.size,12);
  assert.equal(presetForCheckpointType(all,"city").appearance.size,24);
  assert.deepEqual(presetForCheckpointType(all,"lighthouse").transportation,[]);
  assert.ok(defaultCheckpointTransportOffers("stables").some(x=>x.methodId==="riding-horse"));
  assert.ok(defaultCheckpointTransportOffers("port").some(x=>x.mode==="sea"));
  assert.ok(defaultCheckpointTransportOffers("dock").some(x=>x.mode==="water"));
  assert.ok(defaultCheckpointTransportOffers("air-dock").some(x=>x.mode==="air"));
  assert.equal(presetForCheckpointType(all,"air-dock").appearance.size,12);
  assert.deepEqual(validateCheckpointPresets(all),all);
});
test("legacy v1 World checkpoint catalog is projected without overwriting custom values",()=>{
  const original=defaultCheckpointPresets();
  const legacy={schemaVersion:1,presets:original.presets.filter(p=>p.category!=="mines")
    .map(({transportation,...rest})=>rest)};
  const snapshot=structuredClone(legacy);
  const upgraded=validateCheckpointPresets(legacy);
  assert.equal(upgraded.schemaVersion,4);
  assert.deepEqual(legacy,snapshot);
  assert.ok(upgraded.presets.some(p=>p.category==="mines"));
  assert.ok(upgraded.presets.find(p=>p.category==="stables").transportation.length);
  assert.deepEqual(validateCheckpointPresets(upgraded),upgraded);
  const previous={schemaVersion:2,presets:original.presets.filter(p=>p.category!=="air-dock")};
  assert.ok(validateCheckpointPresets(previous).presets.some(p=>p.category==="air-dock"));
  assert.deepEqual(previous.presets,original.presets.filter(p=>p.category!=="air-dock"));
});
test("land Map Marker can enable continuous travel only for vehicle methods",()=>{
  const offer={methodId:"carriage",mode:"land",
    overrides:{hireEnabled:true,continuousEnabled:true}};
  const stored=validateCheckpointTransportOffers([offer]);
  assert.deepEqual(stored,[offer],
    "Map Marker validation must accept GM-configured rotating carriage crews");
  const carriage=checkpointOfferMethod(offer,world("carriage"));
  assert.equal(carriage.continuousEnabled,true);
  assert.equal(world("carriage").continuousEnabled,false,
    "Map Marker never edits the World preset");
  assert.throws(()=>checkpointOfferMethod({
    methodId:"riding-horse",mode:"land",overrides:{continuousEnabled:true}
  },world("riding-horse")) ,/vehicle/,
  "the editor cannot grant continuous operation to ordinary mounts");
});

test("authorized Map Marker save retains a continuous carriage and denies non-GMs",async()=>{
  const previous=globalThis.game;
  let stored={schemaVersion:1,entries:{}},writes=0;
  const scene={canUserModify:()=>true,
    getFlag:(_module,key)=>key==="checkpointTransportOffers"?stored:undefined,
    async setFlag(_module,key,value){
      assert.equal(key,"checkpointTransportOffers");
      writes++;stored=value;
    }};
  const offer={methodId:"carriage",mode:"land",
    overrides:{hireEnabled:true,continuousEnabled:true}};
  try{
    globalThis.game={user:{isGM:true}};
    await saveCheckpointOffers(scene,"dirwest",[offer]);
    assert.equal(writes,1);
    assert.deepEqual(checkpointOffers(scene,"dirwest"),[offer]);
    assert.equal(checkpointOfferMethod(checkpointOffers(scene,"dirwest")[0],
      world("carriage")).continuousEnabled,true);
    globalThis.game.user.isGM=false;
    await assert.rejects(saveCheckpointOffers(scene,"dirwest",[]),/GM/);
    assert.equal(writes,1,"players cannot overwrite a GM-enabled Map Marker");
  }finally{globalThis.game=previous;}
});

test("checkpoint offers reject duplicates, invalid fares, and surface mismatches",()=>{
  const offers=defaultCheckpointTransportOffers("dock");
  assert.deepEqual(validateCheckpointTransportOffers(offers),offers);
  assert.throws(()=>validateCheckpointTransportOffers([...offers,offers[0]]),/duplicated/);
  assert.throws(()=>validateCheckpointTransportOffers([{
    methodId:"cart",mode:"land",overrides:{hireCostCp:-1}
  }]),/hireCostCp/);
  assert.throws(()=>checkpointOfferMethod({
    methodId:"rowboat",mode:"land",overrides:{}},world("rowboat")) ,/surface/);
  const carriage=checkpointOfferMethod({
    methodId:"carriage",mode:"land",
    overrides:{hireEnabled:true,hireCostCp:900,capacity:3}
  },world("carriage"));
  const airship=checkpointOfferMethod({methodId:"airship",mode:"air",
    overrides:{hireCostCp:2500,hireEnabled:true}},world("airship"));
  assert.equal(airship.hireCostCp,2500);
  assert.throws(()=>checkpointOfferMethod({methodId:"airship",mode:"sea",
    overrides:{}},world("airship")) ,/surface/);
  assert.equal(carriage.hireCostCp,900);
  assert.equal(carriage.capacity,3);
  assert.equal(carriage.hireUnlimited,true,"old checkpoint offers default to unlimited");
  const finite=checkpointOfferMethod({methodId:"cart",mode:"land",
    overrides:{hireUnlimited:false,hireQuantity:1}},world("cart"));
  assert.equal(finite.hireQuantity,1);
  assert.equal(finite.hireUnlimited,false);
  assert.throws(()=>validateCheckpointTransportOffers([{methodId:"cart",mode:"land",
    overrides:{hireQuantity:101}}]),/hireQuantity/);
  assert.throws(()=>validateCheckpointTransportOffers([{methodId:"cart",mode:"land",
    overrides:{hireQuantity:1.5}}]),/hireQuantity/);
  assert.throws(()=>validateCheckpointTransportOffers([{methodId:"cart",mode:"land",
    overrides:{hireUnlimited:"false"}}]),/hireUnlimited/);
  assert.equal(world("carriage").hireCostCp,400,"World rate is unmodified");
  assert.throws(()=>validateCheckpointTransportStore({schemaVersion:19,entries:{}}),/Unsupported/);
});
const fixture=()=>{
  const base={...createEmptyAtlas(),enabled:true,
    nodes:[{id:"a",x:0,y:0},{id:"b",x:100,y:0}],
    roads:[{id:"road",name:"Road"}],
    segments:[{id:"seg",roadId:"road",from:"a",to:"b",via:[],bidirectional:true}]};
  const withCheckpoint=addRoadCheckpoint(base,{roadId:"road",
    candidate:{kind:"node",nodeId:"a"},name:"Harbor",idFactory:()=> "cpA"});
  const atlas=upgradeAtlasPlayerVisibility(withCheckpoint);
  const data={
    atlas,checkpointCategories:{cpA:"port"},
    checkpointTransportOffers:{schemaVersion:1,entries:{cpA:[]}},
    checkpointDiscoveryMethods:{},
    checkpointPresetAssignments:{schemaVersion:1,assignments:{cpA:"checkpoint-port"}}
  };
  const scene={name:"Test",grid:{size:40},getFlag:(_module,key)=>data[key]??null,
    canUserModify:()=>true,
    async update(patch){for(const [key,value] of Object.entries(patch)){
      data[key.split(".").at(-1)]=value;
    }}};
  return {scene,atlas,data};
};
test("checkpoint offers are only visible near authored checkpoint positions",()=>{
  const {scene,atlas,data}=fixture();
  data.checkpointTransportOffers.entries.cpA=defaultCheckpointTransportOffers("port");
  assert.ok(offersAtOrigin(atlas,scene,{x:0,y:0}).length>0);
  assert.deepEqual(offersAtOrigin(atlas,scene,{x:500,y:500}),[]);
  assert.ok(checkpointOffers(scene,"cpA").length>0);
});
test("bulk apply is opt-in, field selective and leaves graph/discovery untouched",async()=>{
  const {scene,atlas,data}=fixture();
  const preset=defaultCheckpointPresets().presets.find(p=>p.category==="port");
  assert.equal(CHECKPOINT_BULK_FIELDS.length,10,
    "new Border enabled is an opt-in, independently selectable bulk field");
  assert.ok(CHECKPOINT_BULK_FIELDS.some(([id])=>id==="borderEnabled"));
  assert.throws(()=>buildCheckpointBulkUpdate(scene,preset,{fields:[]}),/Choose/);
  assert.throws(()=>buildCheckpointBulkUpdate(scene,preset,{scope:"assigned",
    fields:["size"],expectedRevision:atlas.revision+1}),/changed/);
  const plan=buildCheckpointBulkUpdate(scene,preset,{scope:"category",
    fields:["size","discoveryMethod","transportation"],expectedRevision:atlas.revision});
  assert.deepEqual(plan.targets.map(x=>x.id),["cpA"]);
  assert.deepEqual(data.atlas,atlas,"dry run never writes");
  assert.ok(!Object.keys(plan.updates).some(k=>/partyExploration/.test(k)));
  const previousNodes=structuredClone(atlas.nodes);
  const previousSegments=structuredClone(atlas.segments);
  const previousName=atlas.checkpoints[0].name;
  const prior=globalThis.game;
  globalThis.game={user:{isGM:true}};
  try{
    assert.equal(await applyCheckpointPresetBulk(scene,preset,{scope:"category",
      fields:["size","discoveryMethod","transportation"],expectedRevision:atlas.revision}),1);
  }finally{globalThis.game=prior;}
  assert.deepEqual(data.atlas.nodes,previousNodes);
  assert.deepEqual(data.atlas.segments,previousSegments);
  assert.equal(data.atlas.checkpoints[0].name,previousName);
  assert.equal(data.atlas.checkpoints[0].appearance.size,24);
  assert.ok(data.checkpointTransportOffers.entries.cpA.length>0);
});

test("checkpoint pencil opens the same World preset dialog and keeps drafts isolated",async()=>{
  const before={game:globalThis.game,document:globalThis.document,
    foundry:globalThis.foundry};
  class Element{
    constructor(tag){this.tag=tag;this.children=[];this.style={};this.listeners=new Map();
      this.textContent="";this.value="";this.checked=false;}
    append(...elements){this.children.push(...elements);}
    appendChild(element){this.children.push(element);return element;}
    replaceChildren(...elements){this.children=[...elements];}
    setAttribute(){}
    addEventListener(event,fn){this.listeners.set(event,fn);}
  }
  const flatten=node=>[node,...node.children.flatMap(flatten)];
  let modal=null;
  try{
    globalThis.document={createElement:tag=>new Element(tag)};
    globalThis.game={system:{id:"dnd5e"},user:{isGM:true},
      settings:{get:()=>undefined,set:async()=>{throw Error("checkpoint must not write World settings");}}};
    globalThis.foundry={applications:{api:{ApplicationV2:class {},
      DialogV2:{input:async data=>{modal=data;return null;}}}}};
    const {createCheckpointTransportationEditor}=await import("../scripts/checkpoint-transportation-editor.js");
    const editor=createCheckpointTransportationEditor({offers:defaultCheckpointTransportOffers("port")});
    const beforeOffers=editor.getOffers();
    const edits=flatten(editor.element).filter(el=>el.title?.startsWith("Edit "));
    const removes=flatten(editor.element).filter(el=>el.title?.startsWith("Remove "));
    assert.ok(edits.length>=2);
    assert.equal(removes.length,edits.length);
    edits.find(el=>el.title.includes("Sailing Ship")).listeners.get("click")();
    await new Promise(resolve=>setImmediate(resolve));
    assert.ok(modal?.content,"checkpoint pencil opens a separate shared preset dialog");
    assert.equal(modal.ok.label,"Apply Map Marker overrides");
    const fields=flatten(modal.content);
    const names=fields.map(el=>el.name);
    for(const field of ["name","kind","speedDisplay","capacity","crewCount",
      "hireEnabled","hireUnlimited","hireQuantity","hireBasis","hireApplies","purchaseEnabled","costBasis"])
      assert.ok(names.includes(field),"shared editor is missing "+field);
    for(const prefix of ["hire","purchase","crewWage","cost"])
      for(const denomination of ["pp","gp","ep","sp","cp"]){
        const coin=fields.find(el=>el.name===prefix+"_"+denomination);
        assert.ok(coin,"shared five-coin editor is missing "+prefix+"_"+denomination);
        assert.equal(coin.type,"text");
        assert.match(coin.className,/uninput always-interactive/);
      }
    assert.ok(!fields.some(el=>el.tag==="details"),"upkeep is not collapsed");
    assert.ok(fields.some(el=>el.className==="atlas-transport-upkeep-section"));
    assert.ok(fields.some(el=>el.textContent==="Clear Map Marker overrides (inherit World)"),
      "local overrides can be explicitly restored to World defaults");
    assert.deepEqual(editor.getOffers(),beforeOffers,"cancel does not change checkpoint draft");
  }finally{Object.assign(globalThis,before);}
});

test("stables list purchasable mounts without silently enabling hired mount travel",()=>{
  const mounts=defaultCheckpointTransportOffers("stables");
  assert.ok(mounts.length>=3);
  assert.ok(mounts.every(offer=>offer.overrides.hireEnabled===false));
});

test("Map Marker can add an inherited Cart without automatically opening local overrides",async()=>{
  const before={game:globalThis.game,document:globalThis.document,foundry:globalThis.foundry};
  class Element{
    constructor(tag){this.tag=tag;this.children=[];this.style={};this.listeners=new Map();
      this.textContent="";this.value="";this.checked=false;}
    append(...children){this.children.push(...children);}
    appendChild(child){this.children.push(child);return child;}
    replaceChildren(...children){this.children=[...children];}
    setAttribute(){}
    addEventListener(type,callback){this.listeners.set(type,callback);}
  }
  const flatten=node=>[node,...node.children.flatMap(flatten)];
  let dialogs=0,writes=0;
  try{
    globalThis.document={createElement:tag=>new Element(tag)};
    globalThis.game={system:{id:"dnd5e"},user:{isGM:true},
      settings:{get:()=>undefined,set:async()=>{writes++;}}};
    globalThis.foundry={applications:{api:{ApplicationV2:class {},
      DialogV2:{input:async()=>{dialogs++;return null;}}}}};
    const {createCheckpointTransportationEditor}=await import("../scripts/checkpoint-transportation-editor.js");
    const editor=createCheckpointTransportationEditor({offers:[]});
    const add=flatten(editor.element).find(item=>item.title==="Add Land Travel method");
    assert.ok(add,"Land group exposes an add action");
    await add.listeners.get("click")();
    const selector=flatten(editor.element).find(item=>item.tag==="select");
    assert.ok(selector,"GM chooses a World method");
    const names=selector.children.map(item=>item.textContent);
    assert.deepEqual(names,[...names].sort((a,b)=>a.localeCompare(b,undefined,
      {sensitivity:"base",numeric:true})),
      "Map Marker World transportation choices are alphabetized in the land picker");
    selector.value="cart";
    const confirm=flatten(editor.element).find(item=>item.textContent==="Add selected method");
    assert.ok(confirm);
    await confirm.listeners.get("click")();
    await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(editor.getOffers(),[{methodId:"cart",mode:"land",overrides:{}}]);
    assert.equal(dialogs,0,"adding inherited method must not force local customization");
    assert.equal(writes,0,"draft does not persist until Map Marker Save");
    assert.ok(flatten(editor.element).some(item=>item.title?.includes("Edit Cart")),
      "optional local Edit remains available");
  }finally{Object.assign(globalThis,before);}
});
