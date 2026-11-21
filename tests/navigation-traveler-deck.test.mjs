import assert from "node:assert/strict";
import test from "node:test";
import {suggestedTravelAssignments,remainingTravelSeats}
  from "../scripts/navigation-travel-allocation.js";
import {renderNavigationTravelRoster,renderNavigationPaceChoice}
  from "../scripts/navigation-traveler-deck-view.js";

const travelers=[
  {id:"cass",name:"Cassian",seats:1},
  {id:"luc",name:"Lucious",seats:1},
  {id:"torrus",name:"Torrus",seats:1},
  {id:"nyx",name:"Nyx",seats:0},
  {id:"jon",name:"Jonathan",seats:1}
];
const methods=[
  {key:"owned|walking",name:"Walking",speed:3,speedLabel:"3 mph"},
  {key:"owned|horse",name:"Warhorse",speed:4,speedLabel:"4 mph",capacity:1},
  {key:"hire|cart",name:"Cart",speed:4,speedLabel:"4 mph",
    arrangement:"hire",available:2,capacity:2,minimumUnits:1}
];
const dom=()=>{
  const old=globalThis.document;
  globalThis.document={createElement:tag=>({
    tag,style:{},children:[],listeners:{},hidden:false,textContent:"",
    append(...nodes){this.children.push(...nodes);},
    addEventListener(name,callback){this.listeners[name]=callback;},
    setAttribute(name,value){this[name]=value;},
    focus(){}
  })};
  return ()=>{globalThis.document=old;};
};
const all=node=>[node,...(node.children??[]).flatMap(all)];

test("personal mount is a suggestion; reassignment is an explicit Journey draft",()=>{
  const before=structuredClone(travelers);
  const resources={"owned|horse":[{actorId:"horseActor",assignedTo:"luc"}]};
  const defaults=suggestedTravelAssignments(travelers,methods,{},resources);
  assert.deepEqual(defaults,{cass:"owned|walking",luc:"owned|horse",
    torrus:"owned|walking",nyx:"owned|walking",jon:"owned|walking"});
  const moved=suggestedTravelAssignments(travelers,methods,{
    luc:"hire|cart",jon:"owned|horse"},resources);
  assert.equal(moved.luc,"hire|cart");
  assert.equal(moved.jon,"owned|horse");
  assert.equal(defaults.luc,"owned|horse","Group's saved personal assignment is unchanged");
  assert.deepEqual(travelers,before);
  const totals=remainingTravelSeats(travelers,methods,moved);
  assert.equal(totals.find(m=>m.key==="hire|cart").seatsUsed,1);
});

test("one method lists everyone checked; a left-behind traveler triggers subset only",()=>{
  const restore=dom();
  try{
    const changes=[];
    const view=renderNavigationTravelRoster({travelers,
      selectedIds:travelers.map(t=>t.id),methods:methods.slice(0,1),
      onInclude:(id,included)=>changes.push([id,included])});
    const radios=all(view).filter(n=>n.type==="radio");
    assert.equal(radios.length,0,"All Party / Selected Members radios are removed");
    const checks=all(view).filter(n=>n.type==="checkbox");
    assert.equal(checks.length,5);
    assert.ok(checks.every(n=>n.checked));
    checks[3].checked=false;checks[3].listeners.change();
    assert.deepEqual(changes,[["nyx",false]]);
    const partial=renderNavigationTravelRoster({travelers,
      selectedIds:["cass","luc","torrus","jon"],
      methods:methods.slice(0,1),previewOnly:true});
    assert.ok(all(partial).some(n=>String(n.textContent).includes("Preview only")),
      "the shared Group token must never move for a subset");
  }finally{restore();}
});

test("multiple methods are real drop columns with an accessible Move alternative",()=>{
  const restore=dom();
  try{
    const moved=[];
    const assignments=suggestedTravelAssignments(travelers,methods,{},{
      "owned|horse":[{actorId:"horseActor",assignedTo:"luc"}]});
    const view=renderNavigationTravelRoster({travelers,
      selectedIds:travelers.map(t=>t.id),methods,assignments,
      onAssign:(id,key)=>moved.push([id,key])});
    const columns=all(view).filter(n=>
      String(n.className??"").includes("atlas-navigation-travel-column"));
    assert.equal(columns.length,3,"only selected methods get columns");
    const cards=all(view).filter(n=>n.draggable===true);
    assert.equal(cards.length,5,"each traveler is present exactly once");
    const cart=columns[2];
    const event={preventDefault(){},dataTransfer:{getData:()=>"cass"}};
    cart.listeners.drop(event);
    assert.deepEqual(moved,[["cass","hire|cart"]]);
    const move=all(view).find(n=>n.title==="Move Lucious");
    move.listeners.click();
    const chooser=all(view).find(n=>n["aria-label"]===
      "Destination method for Lucious");
    assert.equal(chooser.hidden,false);
    chooser.value="hire|cart";chooser.listeners.change();
    assert.deepEqual(moved,[["cass","hire|cart"],["luc","hire|cart"]]);
    assert.equal(chooser.hidden,true);
  }finally{restore();}
});

test("shared pace appears only if speeds differ; faster vehicle pace needs GM selection",()=>{
  const restore=dom();
  try{
    const changes=[];
    assert.equal(renderNavigationPaceChoice({
      methods:methods.map(m=>({...m,speed:3})),unit:"mph"}),null);
    const view=renderNavigationPaceChoice({methods,selected:null,
      maxSpeed:4,unit:"mph",onPace:v=>changes.push(v)});
    const choices=all(view).filter(n=>n.type==="radio");
    assert.equal(choices.length,3);
    assert.equal(choices[0].checked,true);
    choices[1].checked=true;choices[1].listeners.change();
    assert.deepEqual(changes,[4]);
    assert.ok(all(view).some(n=>String(n.textContent).includes("4 · How fast?")));
  }finally{restore();}
});
