import assert from "node:assert/strict";
import test from "node:test";
import {renderNavigationDirections} from "../scripts/navigation-directions-view.js";

const mockDOM=()=>{
  const previous=globalThis.document;
  let handlers=0;
  globalThis.document={createElement:tag=>({tag,style:{},children:[],
    listeners:{},textContent:"",
    append(...items){this.children.push(...items);},
    appendChild(item){this.children.push(item);},
    addEventListener(type,callback){handlers++;this.listeners[type]=callback;}})};
  return {restore:()=>{globalThis.document=previous;},
    get handlers(){return handlers;}};
};
const flatten=items=>items.flatMap(item=>[item,...flatten(item.children??[])]);
const textOf=items=>flatten(items).map(item=>item.textContent).filter(Boolean);

test("directions are collapsed by default and retain endpoint order without writes",()=>{
  const dom=mockDOM();
  try{
    const rows=[{kind:"direction",direction:"north",
      instruction:"Head north to Hearth's Heart",info:"4.52 mi · 1h 30m",
      surface:"Road · Rain"}];
    const result=renderNavigationDirections({calculation:"Physical distance was used.",rows});
    assert.deepEqual(result.map(item=>item.tag),["details"]);
    assert.equal(result[0].open,false);
    assert.match(result[0].children[0].textContent,/Directions · 1 step/);
    assert.equal(result[0].children[1].tag,"details");
    const entries=result[0].children[2].children;
    assert.equal(entries.length,3);
    assert.ok(textOf([entries[0]]).includes("Depart with the party"));
    assert.ok(textOf([entries[1]]).includes("Head north to Hearth's Heart"));
    assert.ok(textOf([entries[1]]).includes("4.52 mi · 1h 30m"));
    assert.ok(textOf([entries[1]]).includes("Road · Rain"));
    assert.equal(entries[1].children[0].textContent,"↑");
    assert.ok(textOf([entries[2]]).includes("Arrive at destination"));
    assert.deepEqual(rows,[{kind:"direction",direction:"north",
      instruction:"Head north to Hearth's Heart",info:"4.52 mi · 1h 30m",
      surface:"Road · Rain"}]);
    assert.equal(dom.handlers,1,"only an accessible details toggle is registered");
  }finally{dom.restore();}
});

test("transfer directions do not disclose future legs and toggle preserves state",()=>{
  const dom=mockDOM();
  try{
    const calls=[];
    const [view]=renderNavigationDirections({
      calculation:"Only the approved ship leg is estimated.",
      transfer:true,arrivalCheckpointName:"Port Barthos",expanded:true,
      onExpandedChange:state=>calls.push(state),
      rows:[{kind:"direction",direction:"west",
        instruction:"Continue west on Shipping Lane",
        info:"23.97 mi · See per-leg time above",surface:"Water"}]
    });
    assert.equal(view.open,true);
    assert.match(view.children[0].textContent,/Directions to next decision/);
    assert.ok(textOf([view.children[2]]).includes("Reach Port Barthos"));
    assert.equal(textOf([view]).some(x=>x.includes("Later legs")),false);
    view.open=false;view.listeners.toggle();
    assert.deepEqual(calls,[false]);
  }finally{dom.restore();}
});

test("rest events and authored checkpoint/turn markers keep chronological order",()=>{
  const dom=mockDOM();
  try{
    const rows=[
      {kind:"direction",direction:"northeast",instruction:"Continue northeast on Road to Dirwest",
        info:"1 mi · 20m",surface:"Dirt Road",distanceValue:1,hoursValue:1/3},
      {kind:"direction",direction:"northeast",instruction:"Continue northeast on Road to Dirwest",
        info:"2 mi · 40m",surface:"Stone Road",distanceValue:2,hoursValue:2/3},
      {kind:"journey-event",marker:"☕",label:"Long Rest",detail:"8h"},
      {kind:"direction",direction:"north",instruction:"Continue north on Road to Dirwest",
        info:"3 mi · 1h",surface:"Dirt Road",distanceValue:3,hoursValue:1}
    ];
    const markers=[{kind:"checkpoint",atDistance:3,label:"Reach Southern Bridge",
      checkpointId:"bridge"}];
    const [view]=renderNavigationDirections({calculation:"Region rules explained.",
      rows,markers,formatDistance:d=>d+" mi",formatHours:h=>h+"h"});
    const items=view.children[2].children;
    assert.equal(items.length,6,
      "start, condensed approach, checkpoint, rest, continuation and arrival");
    const content=textOf([view]);
    assert.ok(content.includes("Reach Southern Bridge"));
    assert.ok(content.includes("Long Rest"));
    assert.ok(content.includes("3 mi · 1h"));
    assert.ok(content.includes("Continue north on Road to Dirwest"));
    assert.equal(dom.handlers,1);
  }finally{dom.restore();}
});
