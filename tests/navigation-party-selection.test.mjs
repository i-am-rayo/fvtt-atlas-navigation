import assert from "node:assert/strict";
import test from "node:test";
import {partyCharacterRoster,partyTravelerRoster,projectPartyTravelSelection,
  describeTravelMethodCapacity} from "../scripts/navigation-party-selection.js";
import {renderNavigationPartySelection}
  from "../scripts/navigation-party-selection-view.js";

const original={travelers:4,members:[
  {actorId:"c1",actorName:"Alba",role:"passenger",actorType:"character"},
  {actorId:"c2",actorName:"Brent",role:"passenger",actorType:"character"},
  {actorId:"c3",actorName:"Kori",role:"passenger",actorType:"character"},
  {actorId:"npc",actorName:"Guide",role:"passenger",actorType:"npc"},
  {actorId:"horse",actorName:"Horse",role:"mount",actorType:"npc",
    quantity:2,capacity:1}
]};
const dom=()=>{
  const old=globalThis.document;
  globalThis.document={createElement:tag=>({
    tag,style:{},children:[],listeners:{},textContent:"",
    append(...items){this.children.push(...items);},
    appendChild(node){this.children.push(node);},
    addEventListener(type,fn){this.listeners[type]=fn;}
  })};
  return ()=>{globalThis.document=old;};
};
const flat=node=>[node,...(node.children??[]).flatMap(flat)];

test("all-party and partial PC preview use stable Actor IDs without mutating Group",()=>{
  const before=structuredClone(original);
  assert.equal(partyCharacterRoster(original).length,3);
  const all=projectPartyTravelSelection(original);
  assert.equal(all.travelerCount,4);
  assert.equal(all.partial,false);
  const subset=projectPartyTravelSelection(original,{mode:"selected",ids:["c1"]});
  assert.equal(subset.travelerCount,1,"only explicitly selected travelers need seats");
  assert.equal(subset.partial,true);
  assert.equal(subset.previewRoster.travelers,1);
  assert.deepEqual(subset.previewRoster.selectedTravelerIds,["c1"]);
  assert.deepEqual(original,before);
  assert.throws(()=>projectPartyTravelSelection(original,{mode:"selected",ids:["missing"]}),/roster changed/);
  assert.throws(()=>projectPartyTravelSelection(original,
    {mode:"selected",ids:["c1","c1"]}),/Invalid/);
});

test("selection UI lists actual PCs without requiring native Group splitting",()=>{
  const restore=dom();
  try{
    const changes=[];
    const root=renderNavigationPartySelection({roster:original,mode:"selected",
      ids:["c1"],onChange:next=>changes.push(next)});
    const text=flat(root).map(x=>x.textContent);
    assert.ok(text.includes("Traveling party"));
    assert.ok(text.includes("Alba"));
    assert.ok(text.includes("Brent"));
    assert.ok(text.some(x=>x.includes("native Group membership")));
    const checks=flat(root).filter(x=>x.type==="checkbox");
    assert.equal(checks.length,4,"NPCs are individually selectable alongside PCs");
    checks[1].checked=true;checks[1].listeners.change();
    assert.equal(changes.length,1);
    assert.deepEqual(changes[0].ids.sort(),["c1","c2"]);
    assert.equal(original.travelers,4);
  }finally{restore();}
});

test("capacity labels distinguish quantity, known seats and unverified hire stock",()=>{
  assert.equal(describeTravelMethodCapacity({choice:{value:"owned|walking"}}),"");
  assert.equal(describeTravelMethodCapacity({choice:{value:"owned|horse"},
    capacity:{quantity:2,seats:2,unknown:0}}),"2 available · 2 seats");
  assert.equal(describeTravelMethodCapacity({choice:{value:"hire|warship",
    methodCapacity:60}}),"Offered · 60 seats/unit · Unlimited");
  assert.equal(describeTravelMethodCapacity({choice:{value:"hire|ship"}}),
    "Service offered · seats unverified");
});

test("Nyx shares a seat, VIP needs one, and selection controls both NPCs",()=>{
  const roster={travelers:4,members:[
    ...original.members.filter(m=>m.actorType==="character"),
    {actorId:"nyx",actorName:"Nyx",actorType:"npc",role:"passenger",
      quantity:1,needsSeat:false},
    {actorId:"vip",actorName:"Jonathan",actorType:"npc",role:"passenger",
      quantity:1,needsSeat:true},
    {actorId:"horse",actorName:"Horse",actorType:"npc",role:"mount",quantity:3,capacity:1}
  ]};
  const entries=partyTravelerRoster(roster);
  assert.equal(entries.length,5);
  assert.deepEqual(entries.map(e=>e.name),["Alba","Brent","Kori","Jonathan","Nyx"]);
  const all=projectPartyTravelSelection(roster);
  assert.deepEqual([all.pcCount,all.npcCount,all.travelerCount],[3,2,4]);
  assert.equal(all.partial,false);
  const withoutVip=projectPartyTravelSelection(roster,{mode:"selected",
    ids:["c1","c2","c3","nyx"]});
  assert.deepEqual([withoutVip.travelerCount,withoutVip.partial],[3,true]);
  assert.deepEqual(withoutVip.previewRoster.selectedTravelerIds,["c1","c2","c3","nyx"]);
  const withoutNyx=projectPartyTravelSelection(roster,{mode:"selected",
    ids:["c1","c2","c3","vip"]});
  assert.deepEqual([withoutNyx.travelerCount,withoutNyx.selectedNpcCount],[4,1]);
  const restore=dom();
  try{
    const view=renderNavigationPartySelection({roster,mode:"selected",
      ids:all.selectedIds,onChange:()=>{}});
    const text=flat(view).map(x=>x.textContent??"").join(" | ");
    assert.match(text,/All party · 3 PCs \| 2 NPCs/);
    assert.match(text,/Nyx · shares seat/);
    assert.match(text,/Jonathan · needs seat/);
    assert.match(text,/4 seats needed/);
    assert.equal(flat(view).filter(x=>x.type==="checkbox").length,5);
  }finally{restore();}
});

test("hired transport labels show local finite inventory and required seats",()=>{
  const choice={value:"hire|cart",methodCapacity:2,
    methodUnlimited:false,methodQuantity:1};
  assert.equal(describeTravelMethodCapacity({choice,roster:{travelers:4}}),
    "Offered · 2 seats/unit · 1 available · 4 seats needed (2 unit(s) required)");
});
