import assert from "node:assert/strict";
import test from "node:test";
import {partyCharacterRoster,projectPartyTravelSelection,
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
  assert.equal(subset.travelerCount,2,"one PC plus one assigned NPC");
  assert.equal(subset.partial,true);
  assert.equal(subset.previewRoster.travelers,2);
  assert.deepEqual(original,before);
  assert.throws(()=>projectPartyTravelSelection(original,
    {mode:"selected",ids:["c1","c1"]}),/Invalid/);
});

test("selection UI lists actual PCs with checkboxes and warns when party is split",()=>{
  const restore=dom();
  try{
    const changes=[];
    const root=renderNavigationPartySelection({roster:original,mode:"selected",
      ids:["c1"],onChange:next=>changes.push(next)});
    const text=flat(root).map(x=>x.textContent);
    assert.ok(text.includes("Traveling party"));
    assert.ok(text.includes("Alba"));
    assert.ok(text.includes("Brent"));
    assert.ok(text.some(x=>x.includes("Subset capacity is preview-only")));
    const checks=flat(root).filter(x=>x.type==="checkbox");
    assert.equal(checks.length,3);
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
    methodCapacity:60}}),"Offered · 60 seats/unit");
  assert.equal(describeTravelMethodCapacity({choice:{value:"hire|ship"}}),
    "Service offered · seats unverified");
});
