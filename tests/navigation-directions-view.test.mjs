import assert from "node:assert/strict";
import test from "node:test";
import {renderNavigationDirections} from "../scripts/navigation-directions-view.js";

const mockDOM=()=>{
  const previous=globalThis.document;
  globalThis.document={createElement:tag=>({tag,style:{},children:[],
    attributes:{},textContent:"",
    append(...items){this.children.push(...items);},
    appendChild(item){this.children.push(item);},
    setAttribute(name,value){this.attributes[name]=value;},
    addEventListener(type,callback){this.listeners??={};this.listeners[type]=callback;}
  })};
  return ()=>{globalThis.document=previous;};
};
const flatten=items=>items.flatMap(item=>[item,...flatten(item.children??[])]);
const textOf=items=>flatten(items).map(item=>item.textContent).filter(Boolean);

test("Directions is a standalone tab body, not another collapsed disclosure",()=>{
  const restore=mockDOM();
  try{
    const rows=[{kind:"direction",direction:"north",distanceValue:4.52,
      instruction:"Head north to Hearth's Heart",info:"4.52 mi · 1h 30m",
      surface:"Road · Rain"}];
    const result=renderNavigationDirections({calculation:"Physical distance was used.",rows});
    assert.deepEqual(result.map(item=>item.tag),["section"]);
    assert.equal(result[0].children[0].tag,"h3");
    assert.match(result[0].children[0].textContent,/Directions · 1 step/);
    assert.equal(result[0].children[1].tag,"ol");
    assert.equal(textOf(result).some(t=>t.includes("How Atlas calculated")),false);
    const entries=result[0].children[1].children;
    assert.equal(entries.length,3);
    assert.ok(textOf([entries[0]]).includes("Depart with the party"));
    assert.ok(textOf([entries[1]]).includes("Head north to Hearth's Heart"));
    assert.ok(textOf([entries[1]]).includes("4.52 mi · 1h 30m"));
    assert.equal(entries[1].children[0].textContent,"↑");
    assert.ok(textOf([entries[2]]).includes("Arrive at selected location"));
    assert.deepEqual(rows,[{kind:"direction",direction:"north",distanceValue:4.52,
      instruction:"Head north to Hearth's Heart",info:"4.52 mi · 1h 30m",
      surface:"Road · Rain"}]);
  }finally{restore();}
});

test("checkpoint transfer arrival is named without displaying future legs",()=>{
  const restore=mockDOM();
  try{
    const [view]=renderNavigationDirections({
      transfer:true,arrivalCheckpointName:"Port Barthos",
      rows:[{kind:"direction",direction:"west",distanceValue:24,
        instruction:"Continue west on Shipping Lane",
        info:"23.97 mi · See per-leg time above",surface:"Water"}]
    });
    assert.match(view.children[0].textContent,/Directions to next decision/);
    assert.ok(textOf([view]).includes("Arrive to Port Barthos"));
    assert.equal(textOf([view]).some(x=>x.includes("Later legs")),false);
  }finally{restore();}
});

test("approximate vertical confirmed progress marks the current direction",()=>{
  const restore=mockDOM();
  try{
    const rows=[
      {kind:"direction",direction:"northeast",
        instruction:"Continue northeast on Road to Dirwest",
        info:"1 mi · 20m",surface:"Dirt Road",distanceValue:1,hoursValue:1/3},
      {kind:"direction",direction:"northeast",
        instruction:"Continue northeast on Road to Dirwest",
        info:"2 mi · 40m",surface:"Stone Road",distanceValue:2,hoursValue:2/3},
      {kind:"journey-event",marker:"☕",label:"Long Rest",detail:"8h"},
      {kind:"direction",direction:"north",instruction:"Continue north on Road to Dirwest",
        info:"3 mi · 1h",surface:"Dirt Road",distanceValue:3,hoursValue:1}
    ];
    const markers=[{kind:"checkpoint",atDistance:3,label:"Reach Southern Bridge",
      checkpointId:"bridge"}];
    const [view]=renderNavigationDirections({rows,markers,progressPercent:55,
      formatDistance:d=>d+" mi",formatHours:h=>h+"h"});
    assert.equal(view.children[1].textContent,"Approximate position: 55% of confirmed Journey route");
    const list=view.children[2];
    assert.match(list.style.borderImage,/55%/);
    assert.ok(textOf([view]).includes("Reach Southern Bridge"));
    assert.ok(textOf([view]).includes("Long Rest"));
    assert.equal(list.children.length,6,
      "start, condensed approach, authored marker, saved rest, continuation and arrival");
    assert.equal(list.children.filter(item=>item.attributes?.["aria-current"]==="step").length,1);
    assert.equal(textOf([view]).some(x=>x.includes("How Atlas calculated")),false);
  }finally{restore();}
});
