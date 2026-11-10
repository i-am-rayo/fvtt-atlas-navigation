import test from "node:test";
import assert from "node:assert/strict";
import {createTerritoryRecoveryConfirmationContent}
  from "../scripts/territory-recovery-dialog.js";

function elements(){
  const made=[];
  return {made,createElement(tag){
    const node={tagName:tag.toUpperCase(),children:[],textContent:"",
      appendChild(child){this.children.push(child);}};
    made.push(node);
    return node;
  }};
}

for(const [mode,text] of [
  ["resume","Complete the interrupted transfer using the saved recovery record?"],
  ["rollback","Restore all 3 Regions to their pre-transfer Shapes and Atlas controls?"]
])test(`v14 native ${mode} confirmation uses a DIV root accepted by DialogV2`,async()=>{
  const dom=elements();
  const content=createTerritoryRecoveryConfirmationContent(mode,3,dom);
  const nativeDialog={confirm:async config=>{
    if(config.content.tagName!=="DIV")throw Error("config.content must be <div> element");
    assert.equal(config.content.children[0].tagName,"P");
    assert.equal(config.content.children[0].textContent,text);
    return false;
  }};
  assert.equal(await nativeDialog.confirm({content}),false);
});

test("recovery confirmation refuses unsupported modes and empty snapshots",()=>{
  const dom=elements();
  assert.throws(()=>createTerritoryRecoveryConfirmationContent("discard",3,dom),
    /supported native Territory recovery/);
  assert.throws(()=>createTerritoryRecoveryConfirmationContent("resume",0,dom),
    /at least one native Region/);
  assert.equal(dom.made.length,0,"invalid calls must not build a dialog");
});
