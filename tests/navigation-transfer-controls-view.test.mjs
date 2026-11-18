import assert from "node:assert/strict";
import test from "node:test";
import {renderRecoveredVoyageOperation,renderCurrentTransferMethodSelector}
  from "../scripts/navigation-transfer-controls-view.js";

const mockDOM=()=>{
  const previous=globalThis.document;
  globalThis.document={createElement:tag=>({tag,style:{},children:[],listeners:{},
    append(...nodes){this.children.push(...nodes);},
    appendChild(node){this.children.push(node);},
    setAttribute(name,value){if(name==="aria-label")this.ariaLabel=value;},
    addEventListener(name,handler){this.listeners[name]=handler;}})};
  return ()=>{globalThis.document=previous;};
};
const find=(node,match)=>match(node)?node:
  node.children?.map(child=>find(child,match)).find(Boolean);

test("legacy recovered voyage schedule stays an explicit GM choice",()=>{
  const restore=mockDOM();
  try{
    const calls=[];
    const [hint,label]=renderRecoveredVoyageOperation({operation:"continuous",
      disabled:false,onChange:value=>calls.push(value)});
    assert.match(hint.textContent,/older Journey Journal did not retain its operating schedule/);
    assert.equal(label.textContent,"Operating schedule for recovered voyage");
    const select=find(label,node=>node.tag==="select");
    assert.equal(select.value,"continuous");
    assert.deepEqual(select.children.map(child=>[child.value,child.textContent]),[
      ["normal","Standard — 8h/day"],
      ["continuous","Continuous — crewed 24h operation"]]);
    assert.deepEqual(calls,[],"render cannot authorize a continuous voyage");
    select.value="normal";select.listeners.change();
    assert.deepEqual(calls,["normal"]);
    const busy=renderRecoveredVoyageOperation({operation:"normal",disabled:true,
      onChange:()=>calls.push("unexpected")});
    assert.equal(find(busy[1],node=>node.tag==="select").disabled,true);
  }finally{restore();}
});

test("checkpoint method picker retains grouping, disabled recovery and edit actions",()=>{
  const restore=mockDOM();
  try{
    const calls=[];
    const options=[{value:"owned|warship",label:"Warship",group:"Party"},
      {value:"hire|ship-passage",label:"Ship passage",group:"Port Barthos"}];
    const label=renderCurrentTransferMethodSelector({options,
      selectedValue:"hire|ship-passage",editable:true,
      onChange:value=>calls.push("select:"+value),onEdit:()=>calls.push("edit")});
    assert.equal(label.textContent,"Transportation for this leg");
    const select=find(label,node=>node.tag==="select");
    const edit=find(label,node=>node.tag==="button");
    assert.equal(select.ariaLabel,"Transportation method for current leg");
    assert.equal(select.value,"hire|ship-passage");
    assert.equal(select.children[0].value,"");
    assert.deepEqual(select.children.slice(1).map(node=>node.label),["Party","Port Barthos"]);
    assert.equal(edit.ariaLabel,"Edit current leg transportation");
    assert.deepEqual(calls,[],"the picker is inert until deliberate selection");
    select.value="owned|warship";select.listeners.change();
    edit.listeners.click();
    assert.deepEqual(calls,["select:owned|warship","edit"]);
    const recovered=renderCurrentTransferMethodSelector({options,
      selectedValue:"hire|ship-passage",disabled:true,editable:false,
      onChange:()=>calls.push("unexpected"),onEdit:()=>calls.push("unexpected")});
    assert.equal(find(recovered,node=>node.tag==="select").disabled,true);
    assert.equal(find(recovered,node=>node.tag==="button"),undefined);
  }finally{restore();}
});
