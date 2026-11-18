import assert from "node:assert/strict";
import test from "node:test";
import {renderNavigationDepartureSelector,renderNavigationTravelMethodSelector}
  from "../scripts/navigation-selection-view.js";

const mockDOM=()=>{
  const previous=globalThis.document;
  globalThis.document={createElement:tag=>({tag,style:{},children:[],listeners:{},
    append(...items){this.children.push(...items);},
    appendChild(item){this.children.push(item);},
    setAttribute(name,value){if(name==="aria-label")this.ariaLabel=value;},
    addEventListener(type,callback){this.listeners[type]=callback;}})};
  return ()=>{globalThis.document=previous;};
};
const child=(parent,match)=>parent.children.find(match);

test("departure selector preserves labels and forwards only explicit GM input",()=>{
  const restore=mockDOM();
  try{
    const calls=[];
    const row=renderNavigationDepartureSelector({sourceMode:"party",partyMode:true,
      disabled:false,onSourceChange:value=>calls.push("source:"+value),
      onRefresh:()=>calls.push("refresh")});
    const label=child(row,node=>node.tag==="label");
    const select=child(row,node=>node.tag==="select");
    const refresh=child(row,node=>node.tag==="button");
    assert.equal(label.textContent,"Start from");
    assert.equal(label.htmlFor,"atlas-navigation-departure");
    assert.equal(select.value,"party");
    assert.equal(select.id,"atlas-navigation-departure");
    assert.deepEqual(select.children.map(node=>[node.value,node.textContent]),[
      ["map","Map Point A"],["party","Party token location"]]);
    assert.equal(refresh.textContent,"Refresh location");
    assert.deepEqual(calls,[],"rendering does not refresh token coordinates");
    select.value="map";select.listeners.change();
    refresh.listeners.click();
    assert.deepEqual(calls,["source:map","refresh"]);

    const map=renderNavigationDepartureSelector({sourceMode:"map",partyMode:false,
      disabled:true,onSourceChange:()=>calls.push("unexpected"),onRefresh:()=>{}});
    assert.equal(child(map,node=>node.tag==="select").disabled,true);
    assert.equal(child(map,node=>node.tag==="button"),undefined);
  }finally{restore();}
});

test("travel method selector displays grouped choices without approving transport",()=>{
  const restore=mockDOM();
  try{
    const calls=[];
    const row=renderNavigationTravelMethodSelector({
      choices:[
        {value:"owned|walking",label:"Walking (party pace)",group:"Party"},
        {value:"owned|horse",label:"Riding Horse",group:"Party"},
        {value:"hire|ship",label:"Ship passage",group:"Port Barthos"}
      ],selectedValue:"hire|ship",showEditor:true,
      onMethodChange:value=>calls.push("method:"+value),onEdit:()=>calls.push("edit")
    });
    const select=child(row,node=>node.tag==="select");
    const edit=child(row,node=>node.tag==="button");
    assert.equal(child(row,node=>node.tag==="label").htmlFor,
      "atlas-navigation-travel-method");
    assert.equal(select.id,"atlas-navigation-travel-method");
    assert.equal(select.value,"hire|ship");
    assert.deepEqual(select.children.map(node=>node.label),["Party","Port Barthos"]);
    assert.deepEqual(select.children[1].children.map(node=>node.value),["hire|ship"]);
    assert.equal(edit.ariaLabel,"Edit selected travel method for this journey");
    assert.equal(edit.disabled,false);
    assert.deepEqual(calls,[],"rendering never approves or edits transportation");
    select.value="owned|horse";select.listeners.change();
    edit.listeners.click();
    assert.deepEqual(calls,["method:owned|horse","edit"]);

    const busy=renderNavigationTravelMethodSelector({choices:[],
      selectedValue:"owned|walking",disabled:true,showEditor:false,
      onMethodChange:()=>{},onEdit:()=>{}});
    assert.equal(child(busy,node=>node.tag==="select").disabled,true);
    assert.equal(child(busy,node=>node.tag==="button"),undefined);
  }finally{restore();}
});
