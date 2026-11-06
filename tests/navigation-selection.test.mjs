import assert from "node:assert/strict";
import test from "node:test";
import { navigationPointIntent } from "../scripts/navigation-selection.js";

const click=(overrides={})=>({button:0,shiftKey:false,altKey:false,
  ctrlKey:false,metaKey:false,...overrides});
const A={x:10,y:20},B={x:50,y:60};

test("ordinary map clicks fill A then B, and cannot replace a completed route",()=>{
  assert.equal(navigationPointIntent(click(),{}),"start");
  assert.equal(navigationPointIntent(click(),{start:A}),"end");
  assert.equal(navigationPointIntent(click(),{start:A,end:B}),null);
});

test("Shift and Alt/Option deliberately change only their assigned endpoints",()=>{
  assert.equal(navigationPointIntent(click({shiftKey:true}),{start:A,end:B}),"start");
  assert.equal(navigationPointIntent(click({altKey:true}),{start:A,end:B}),"end");
  assert.equal(navigationPointIntent(click({shiftKey:true}),{}),"start");
  assert.equal(navigationPointIntent(click({altKey:true}),{}),null,
    "do not select a destination without a departure");
  assert.equal(navigationPointIntent(click({altKey:true}),{start:A}),"end");
});

test("ambiguous or editing modifiers and non-primary buttons are never captured",()=>{
  for(const change of [{button:1},{button:2},{ctrlKey:true},{metaKey:true},
    {shiftKey:true,altKey:true},{shiftKey:true,ctrlKey:true},
    {altKey:true,metaKey:true}]){
    assert.equal(navigationPointIntent(click(change),{start:A,end:B}),null);
  }
});

test("party departure comes from token, so map clicks only set destination B",()=>{
  const current={sourceMode:"party",start:A};
  assert.equal(navigationPointIntent(click(),current),"end");
  assert.equal(navigationPointIntent(click({altKey:true}),current),"end");
  assert.equal(navigationPointIntent(click({shiftKey:true}),current),null);
  assert.equal(navigationPointIntent(click(),{...current,end:B}),null);
  assert.equal(navigationPointIntent(click({altKey:true}),{...current,end:B}),"end");
  assert.equal(navigationPointIntent(click(),{sourceMode:"party"}),null);
});
