import assert from "node:assert/strict";
import test from "node:test";
import {renderNavigationDirections} from "../scripts/navigation-directions-view.js";

const mockDOM=()=>{
  const previous=globalThis.document;
  let handlers=0;
  globalThis.document={createElement:tag=>({tag,style:{},children:[],
    textContent:"",append(...items){this.children.push(...items);},
    appendChild(item){this.children.push(item);},
    addEventListener(){handlers++;}})};
  return {restore:()=>{globalThis.document=previous;},
    get handlers(){return handlers;}};
};
const flatten=items=>items.flatMap(item=>[item,...flatten(item.children??[])]);
const textOf=(items)=>flatten(items).map(item=>item.textContent).filter(Boolean);

test("ordinary GM directions remain presentation-only and retain endpoint order",()=>{
  const dom=mockDOM();
  try{
    const rows=[{kind:"direction",direction:"north",instruction:"Head north to Hearth's Heart",
      info:"4.52 mi · 1h 30m",surface:"Road · Rain"}];
    const result=renderNavigationDirections({calculation:"Physical distance was used.",
      rows});
    assert.deepEqual(result.map(item=>item.tag),["details","h3","div"]);
    assert.equal(result[0].children[0].textContent,
      "How Atlas calculated this journey");
    assert.equal(result[0].children[1].textContent,"Physical distance was used.");
    assert.equal(result[1].textContent,"Directions");
    const path=result[2].children;
    assert.equal(path.length,3);
    assert.ok(textOf([path[0]]).includes("Depart from starting point"));
    assert.ok(textOf([path[1]]).includes("Head north to Hearth's Heart"));
    assert.ok(textOf([path[1]]).includes("4.52 mi · 1h 30m"));
    assert.ok(textOf([path[1]]).includes("Road · Rain"));
    assert.equal(path[1].children[0].textContent,"↑");
    assert.ok(textOf([path[2]]).includes("Arrive at destination"));
    assert.deepEqual(rows,[{kind:"direction",direction:"north",
      instruction:"Head north to Hearth's Heart",
      info:"4.52 mi · 1h 30m",surface:"Road · Rain"}],
    "building a view must not mutate route steps");
    assert.equal(dom.handlers,0,"reading directions cannot commit a GM action");
  }finally{dom.restore();}
});

test("transfer directions show the checkpoint without leaking future legs",()=>{
  const dom=mockDOM();
  try{
    const view=renderNavigationDirections({
      calculation:"Only the approved ship leg is estimated.",
      transfer:true,arrivalCheckpointName:"Port Barthos",
      rows:[{kind:"direction",direction:"west",instruction:"Continue west on Shipping Lane",
        info:"23.97 mi · See per-leg time above",surface:"Water"}]});
    assert.equal(view[1].textContent,"Directions to next decision point");
    const entries=view[2].children;
    assert.ok(textOf([entries[2]]).includes("Reach Port Barthos"));
    assert.ok(textOf([entries[2]]).includes("Decide whether to stop, replan or continue"));
    assert.equal(entries[1].children[0].textContent,"←");
    assert.equal(textOf(view).some(value=>value.includes("Later legs")),false);
    assert.equal(dom.handlers,0);
  }finally{dom.restore();}
});

test("Journey rest and Continue March annotations keep sequence and styling",()=>{
  const dom=mockDOM();
  try{
    const rows=[
      {kind:"direction",direction:"southeast",instruction:"Head southeast to Road",
        info:"12.00 mi · 4h 0m",surface:""},
      {kind:"journey-event",marker:"☕",label:"Long Rest Aboard",
        detail:"8h 0m rest aboard while underway · After 8h 0m on this leg · 8h 0m traveled today"},
      {kind:"journey-event",marker:"➜",label:"Continue March",
        detail:"One extra travel hour approved · After 9h 0m on this leg · 9h 0m traveled today"}
    ];
    const view=renderNavigationDirections({calculation:"Region rules explained.",
      rows});
    const entries=view[2].children;
    assert.equal(entries.length,5);
    assert.equal(entries[2].children[0].textContent,"☕");
    assert.equal(entries[3].children[0].textContent,"➜");
    assert.ok(textOf([entries[2]]).includes("Long Rest Aboard"));
    assert.ok(textOf([entries[3]]).includes("Continue March"));
    assert.equal(dom.handlers,0);
  }finally{dom.restore();}
});
