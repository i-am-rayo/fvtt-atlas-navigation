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
    assert.ok(all(partial).some(n=>String(n.textContent).includes("native Group")),
      "the native Group remains unchanged while the Journey tracks a subset");
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
    assert.equal(columns.length,4,"selected methods plus a permanent Not traveling column");
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

test("metric pace labels round to kph but emit exact unrounded transport speed",()=>{
  const restore=dom();
  try{
    let picked=null;
    const value=4*1.609344;
    const view=renderNavigationPaceChoice({unit:"kph",
      methods:[{speed:3*1.609344},{speed:value}],
      maxSpeed:value,onPace:next=>{picked=next;}});
    const radio=all(view).filter(n=>n.type==="radio")[1];
    radio.checked=true;radio.listeners.change();
    assert.equal(picked,value,
      "6.44 kph label selects exactly 4 mph rather than exceeding cart speed");
    assert.ok(all(view).some(n=>String(n.textContent??"").includes("6.44 kph")));
  }finally{restore();}
});

test("Not traveling is always shown, accepts drags, and allows a return to travel",()=>{
  const restore=dom();
  try{
    const changes=[];
    const assignments=Object.fromEntries(travelers.map(t=>[t.id,"owned|walking"]));
    const view=renderNavigationTravelRoster({
      travelers,selectedIds:travelers.map(t=>t.id).filter(id=>id!=="nyx"),
      methods,assignments,onInclude:(id,active)=>changes.push([id,active])
    });
    const waiting=all(view).find(n=>String(n.className??"")
      .includes("atlas-navigation-not-traveling"));
    assert.ok(waiting,"dedicated column stays rendered even with no selected travelers");
    const cards=all(waiting).filter(n=>n.draggable===true);
    assert.equal(cards.length,1);
    assert.equal(all(waiting).filter(n=>n.title==="Move Nyx").length,1,
      "a non-traveler can be added to a selected method via keyboard Move");
    waiting.listeners.drop({preventDefault(){},
      dataTransfer:{getData:()=>"cass"}});
    assert.deepEqual(changes,[["cass",false]]);
    const empty=renderNavigationTravelRoster({travelers,
      selectedIds:travelers.map(t=>t.id),methods,assignments});
    const emptyColumn=all(empty).find(n=>String(n.className??"")
      .includes("atlas-navigation-not-traveling"));
    assert.ok(emptyColumn);
    assert.ok(all(emptyColumn).some(n=>n.textContent==="0 staying"));
  }finally{restore();}
});

test("deck shares Font Awesome icons and omits walking fare",()=>{
  const restore=dom();
  try{
    const choices=methods.map(m=>({...m,costLabel:"1 SP",costDetail:"1 unit"}));
    const nodes=all(renderNavigationTravelRoster({travelers,selectedIds:travelers.map(t=>t.id),
      methods:choices,assignments:suggestedTravelAssignments(travelers,choices)}));
    assert.deepEqual(nodes.filter(n=>n.tag==="i").map(n=>n.className),
      ["fa-solid fa-person-walking","fa-solid fa-horse","fa-solid fa-wagon-covered"]);
    assert.equal(nodes.filter(n=>n.textContent==="1 SP").length,2);
    assert.ok(nodes.some(n=>n.children?.some(c=>c.textContent==="3 · Who goes where?")&&
      n.children?.some(c=>c.textContent==="5/5 travelers · 4 seats · Unapproved draft")));
  }finally{restore();}
});

test("onward ship with one method offers Traveling and Not traveling drop columns",()=>{
  const restore=dom();
  try{
    const changes=[];
    const ship={key:"hire|ship-passage",name:"Ship passage",speed:2,
      speedLabel:"2 mph",capacity:8,arrangement:"hire",available:1,minimumUnits:1};
    const selected=travelers.map(t=>t.id);
    const view=renderNavigationTravelRoster({travelers,selectedIds:selected,
      methods:[ship],transferColumns:true,
      assignments:Object.fromEntries(selected.map(id=>[id,ship.key])),
      onInclude:(id,include)=>changes.push([id,include]),
      onAssign:(id,key)=>changes.push([id,key])});
    const columns=all(view).filter(n=>String(n.className??"")
      .includes("atlas-navigation-travel-column"));
    assert.equal(columns.length,2,
      "a single hired ship still has a distinct Not traveling column");
    const waiting=columns[1];
    assert.match(waiting.className,/atlas-navigation-not-traveling/);
    waiting.listeners.drop({preventDefault(){},
      dataTransfer:{getData:()=>"luc"}});
    assert.deepEqual(changes,[["luc",false]]);
    const move=all(view).find(n=>n.title==="Move Nyx");
    move.listeners.click();
    const chooser=all(view).find(n=>n["aria-label"]===
      "Destination method for Nyx");
    chooser.value="";chooser.listeners.change();
    assert.deepEqual(changes,[["luc",false],["nyx",false]],
      "keyboard Move supports choosing Not traveling");
  }finally{restore();}
});
