import test from "node:test";
import assert from "node:assert/strict";
import {renderJourneyLivestockBoarding} from "../scripts/navigation-livestock-view.js";

const dom=()=>{
  const old=globalThis.document;
  globalThis.document={createElement:tag=>({
    tag,style:{},children:[],listeners:{},textContent:"",hidden:false,
    append(...nodes){this.children.push(...nodes);},
    setAttribute(key,value){this[key]=value;},
    addEventListener(key,fn){this.listeners[key]=fn;},
    focus(){}
  })};
  return ()=>{globalThis.document=old;};
};
const all=node=>[node,...(node.children??[]).flatMap(all)];
const resources=[{actorId:"warhorse",name:"Warhorse",quantity:1},
  {actorId:"riding",name:"Riding Horse",quantity:3}];

test("mount boarding is drag/drop and keyboard accessible within one Journey draft",()=>{
  const restore=dom();
  try{
    const changes=[];
    const before=structuredClone(resources);
    const board=renderJourneyLivestockBoarding({
      resources,method:{livestockCapacity:4},
      decisions:{warhorse:1,riding:2},
      onChange:(id,n)=>changes.push([id,n])
    });
    const nodes=all(board);
    assert.equal(board.className,"atlas-journey-livestock");
    assert.equal(nodes.filter(n=>n.tag==="select").length,0,
      "remove the previous per-animal boarding dropdown");
    assert.ok(nodes.some(n=>n.textContent==="3/4 embarking · all decided"));
    assert.ok(nodes.some(n=>n.textContent==="Riding Horse ×3"));
    const quantity=nodes.find(n=>n["aria-label"]?.startsWith("Number of Riding Horse"));
    assert.equal(quantity.value,"2","prior leg's exact 2/3 mount decision remains editable");
    quantity.value="1";quantity.listeners.change();
    const columns=nodes.filter(n=>String(n.className??"")
      .includes("atlas-journey-mount-column"));
    assert.equal(columns.length,2);
    assert.equal(columns[0]["aria-label"],"Embarking mounts");
    assert.equal(columns[1]["aria-label"],"Staying behind / undecided mounts");
    columns[1].listeners.drop({preventDefault(){},
      dataTransfer:{getData:()=>"atlas-mount:riding"}});
    const move=nodes.find(n=>n.title==="Move Riding Horse to stay behind");
    move.listeners.click();
    assert.deepEqual(changes,[["riding",1],["riding",0],["riding",0]]);
    assert.deepEqual(resources,before,"rendering and decisions never mutate native Group resources");
    assert.ok(nodes.some(n=>String(n.textContent).includes("verified animal stalls")));
  }finally{restore();}
});

test("unassigned mounts remain unapproved until explicit drag or quantity input",()=>{
  const restore=dom();
  try{
    const changes=[];
    const board=renderJourneyLivestockBoarding({
      resources,decisions:{},method:{livestockCapacity:null},
      onChange:(id,n)=>changes.push([id,n])
    });
    const nodes=all(board);
    assert.ok(nodes.some(n=>n.textContent==="0/4 embarking · 2 undecided"));
    assert.ok(nodes.some(n=>String(n.textContent).includes("Play remains disabled")));
    assert.deepEqual(changes,[],"render never interprets undecided as staying");
    const column=nodes.find(n=>n["aria-label"]==="Embarking mounts");
    column.listeners.drop({preventDefault(){},
      dataTransfer:{getData:()=>"atlas-mount:riding"}});
    assert.deepEqual(changes,[["riding",3]],
      "dragging all to the vessel records exactly three mounts");
    const riderInput=nodes.find(n=>n["aria-label"]?.startsWith("Number of Riding Horse"));
    riderInput.value="2";riderInput.listeners.change();
    assert.deepEqual(changes,[["riding",3],["riding",2]],
      "the quantity control supports partial boarding");
    riderInput.value="99";riderInput.listeners.change();
    assert.equal(riderInput.value,"","invalid quantities are rejected");
    assert.equal(changes.length,2);
    const notGoing=nodes.find(n=>n["aria-label"]==="Staying behind / undecided mounts");
    notGoing.listeners.drop({preventDefault(){},
      dataTransfer:{getData:()=>"atlas-mount:warhorse"}});
    assert.deepEqual(changes.at(-1),["warhorse",0]);
    notGoing.listeners.drop({preventDefault(){},
      dataTransfer:{getData:()=>"cass"}});
    assert.equal(changes.length,3,"traveler drops cannot be mistaken for animal IDs");
  }finally{restore();}
});

test("a locked boarding preview cannot modify the draft",()=>{
  const restore=dom();
  try{
    const changes=[];
    const board=renderJourneyLivestockBoarding({
      resources,decisions:{warhorse:1,riding:2},disabled:true,
      onChange:(id,n)=>changes.push([id,n])});
    const nodes=all(board);
    const embarking=nodes.find(n=>n["aria-label"]==="Embarking mounts");
    embarking.listeners.drop({preventDefault(){},
      dataTransfer:{getData:()=>"atlas-mount:warhorse"}});
    const quantity=nodes.find(n=>n["aria-label"]?.startsWith("Number of Riding Horse"));
    assert.equal(quantity.disabled,true);
    const card=nodes.find(n=>n.className==="atlas-journey-mount-card");
    assert.equal(card.draggable,false);
    assert.deepEqual(changes,[]);
  }finally{restore();}
});
