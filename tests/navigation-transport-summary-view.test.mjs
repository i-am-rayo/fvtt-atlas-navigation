import assert from "node:assert/strict";
import test from "node:test";
import {renderTransportAdvisory,renderTransportCapacity,renderTransportQuote}
  from "../scripts/navigation-transport-summary-view.js";

const mockDOM=()=>{
  const previous=globalThis.document;
  globalThis.document={createElement:tag=>({tag,style:{},children:[],listeners:{},
    append(...nodes){this.children.push(...nodes);},
    appendChild(node){this.children.push(node);},
    addEventListener(name,handler){this.listeners[name]=handler;}})};
  return ()=>{globalThis.document=previous;};
};
const find=(node,match)=>match(node)?node:
  node.children?.map(child=>find(child,match)).find(Boolean);

test("transport warning and Group capacity are read-only until review or refresh",()=>{
  const restore=mockDOM();
  try{
    const calls=[];
    const warning=renderTransportAdvisory("Transport planning only.");
    assert.equal(warning.textContent,"Transport planning only.");
    const capacity=renderTransportCapacity({
      description:"3 traveler(s); 2 available land seat(s). 1 additional seat(s) needed.",
      warning:true,needsReview:true,
      onReview:()=>calls.push("review"),onRefresh:()=>calls.push("refresh")});
    assert.match(capacity.children[0].style.cssText,/#b18b54/);
    assert.equal(capacity.children[0].textContent,
      "3 traveler(s); 2 available land seat(s). 1 additional seat(s) needed.");
    assert.deepEqual(calls,[],"rendering cannot mutate a Group Actor");
    const buttons=capacity.children[1].children;
    assert.deepEqual(buttons.map(node=>node.textContent),
      ["Review mounts & NPC roles","Refresh seats"]);
    buttons[0].listeners.click();buttons[1].listeners.click();
    assert.deepEqual(calls,["review","refresh"]);
    const adequate=renderTransportCapacity({description:"Capacity meets party size.",
      onReview:()=>{},onRefresh:()=>{}});
    assert.equal(find(adequate,node=>node.tag==="button"),undefined);
  }finally{restore();}
});

test("fare breakdown never charges, and reset requires an enabled click",()=>{
  const restore=mockDOM();
  try{
    const calls=[];
    const model={worldEstimate:"World preset estimate: 10 GP",
      currentEstimate:"Current hired service estimate: 8 GP",
      breakdown:"Base: 8 GP · Paid crew: 0 CP",
      operatingSummary:"1 operating day(s) at 8h/day. No currency is deducted.",
      overrides:true,onReset:()=>calls.push("reset")};
    const block=renderTransportQuote(model);
    assert.equal(block.children[0].textContent,"World preset estimate: 10 GP");
    assert.equal(block.children[1].textContent,"Current hired service estimate: 8 GP");
    assert.equal(block.children[2].textContent,"Base: 8 GP · Paid crew: 0 CP");
    assert.match(block.children[3].textContent,/No currency is deducted/);
    assert.deepEqual(calls,[],"display cannot commit a fare");
    const reset=find(block,node=>node.tag==="button");
    assert.equal(reset.textContent,"Reset journey overrides");
    reset.listeners.click();
    assert.deepEqual(calls,["reset"]);
    const locked=renderTransportQuote({...model,disabled:true});
    const lockedReset=find(locked,node=>node.tag==="button");
    assert.equal(lockedReset.disabled,true);
    lockedReset.listeners.click();
    assert.deepEqual(calls,["reset"],"disabled reset cannot clear overrides");
    const noOverrides=renderTransportQuote({...model,worldEstimate:null,
      overrides:false});
    assert.equal(find(noOverrides,node=>node.tag==="button"),undefined);
    assert.equal(noOverrides.children[0].textContent,
      "Current hired service estimate: 8 GP");
  }finally{restore();}
});
