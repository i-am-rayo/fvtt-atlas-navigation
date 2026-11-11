import test from "node:test";
import assert from "node:assert/strict";
import { createSettingsSelect,createSettingsGroupedSelect } from "../scripts/settings-select.js";

class Element {
  constructor(tag){this.tag=tag;this.children=[];this.attributes=new Map();
    this.listeners=new Map();this.value="";}
  appendChild(child){this.children.push(child);return child;}
  setAttribute(name,value){this.attributes.set(name,String(value));}
  set defaultSelected(value){
    if(value)this.setAttribute("selected","");
    else this.attributes.delete("selected");
  }
  addEventListener(name,handler){this.listeners.set(name,handler);}
}
const flatten=element=>[element,...element.children.flatMap(flatten)];
const serializedSelected=element=>flatten(element)
  .filter(child=>child.tag==="option"&&child.attributes.has("selected"));

test("plain settings selects reflect the saved default for DialogV2 cloning",()=>{
  const previous=globalThis.document;
  try{
    globalThis.document={createElement:tag=>new Element(tag)};
    const values=[];
    const select=createSettingsSelect([["","None"],["dirt","Dirt Road"],["stone","Stone Road"]],{
      selectedId:"stone",name:"atlasPreset",ariaLabel:"Travel preset",
      onChange:value=>values.push(value)
    });
    assert.equal(select.value,"stone");
    assert.equal(select.name,"atlasPreset");
    assert.equal(select.attributes.get("aria-label"),"Travel preset");
    assert.deepEqual(serializedSelected(select).map(option=>option.value),["stone"]);
    select.value="dirt";
    select.listeners.get("change")();
    assert.deepEqual(values,["dirt"]);
    assert.deepEqual(serializedSelected(select).map(option=>option.value),["dirt"],
      "a changed selection must remain reflected if Foundry serializes the dialog again");
    const missing=createSettingsSelect([["first","First"],["second","Second"]],{
      selectedId:"removed"});
    assert.deepEqual(serializedSelected(missing).map(option=>option.value),["first"]);
  }finally{globalThis.document=previous;}
});

test("grouped settings selects serialize one selected option without losing groups",()=>{
  const previous=globalThis.document;
  try{
    globalThis.document={createElement:tag=>new Element(tag)};
    const select=createSettingsGroupedSelect([
      {label:null,options:[["","None"]]},
      {label:"Land",options:[["dirt","Dirt Road"]]},
      {label:"Water — River",options:[["river","Calm River"]]},
      {label:"Air",options:[["clear","Clear Skies"]]}
    ],{selectedId:"river"});
    assert.deepEqual(select.children.filter(item=>item.tag==="optgroup")
      .map(item=>item.label),["Land","Water — River","Air"]);
    assert.deepEqual(serializedSelected(select).map(option=>option.value),["river"]);
    assert.equal(select.value,"river");
    select.value="clear";
    select.listeners.get("change")();
    assert.deepEqual(serializedSelected(select).map(option=>option.value),["clear"]);
  }finally{globalThis.document=previous;}
});

test("disabled locations stay visible but cannot be selected through the serialized picker",()=>{
  const previous=globalThis.document;
  try{
    globalThis.document={createElement:tag=>new Element(tag)};
    const select=createSettingsGroupedSelect([
      {label:null,options:[["","No association"]]},
      {label:"Available",options:[["town","Town"]]},
      {label:"Already linked",options:[["used","Used Town",{disabled:true}]]}
    ],{name:"regionId",selectedId:"used"});
    assert.equal(select.value,"","disabled entries cannot be preselected");
    const options=flatten(select).filter(item=>item.tag==="option");
    assert.equal(options.at(-1).attributes.has("disabled"),true,
      "DialogV2 cloning must retain disabled alternatives");
    assert.deepEqual(serializedSelected(select).map(option=>option.value),[""]);
    const available=createSettingsGroupedSelect([
      {label:null,options:[["used","Used",{disabled:true}],["open","Open"]]}
    ],{selectedId:"missing"});
    assert.equal(available.value,"open");
  }finally{globalThis.document=previous;}
});
