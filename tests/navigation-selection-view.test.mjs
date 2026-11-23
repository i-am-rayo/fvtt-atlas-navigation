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

test("selected mixed transportation tiles have an independent accessible editor",async()=>{
  const restore=mockDOM();
  try{
    const {renderNavigationTravelMethodButtons}=await import("../scripts/navigation-selection-view.js");
    const calls=[];
    const section=renderNavigationTravelMethodButtons({
      choices:[{value:"owned|walking",label:"Walking",group:"Party"},
        {value:"hire|carriage",label:"Carriage",group:"Dirwest"},
        {value:"hire|wagon",label:"Wagon",group:"Dirwest"}],
      selectedValues:["owned|walking","hire|carriage"],
      onMethodToggle:(value,checked)=>calls.push("toggle:"+value),
      onEditMethod:value=>calls.push("edit:"+value)
    });
    const all=node=>[node,...node.children.flatMap(all)];
    const edits=all(section).filter(node=>node.tag==="button"&&
      node.ariaLabel?.startsWith("Edit "));
    assert.equal(edits.length,1,"only selected non-walking methods are editable");
    assert.match(edits[0].ariaLabel,/Carriage/);
    edits[0].listeners.click();
    assert.deepEqual(calls,["edit:hire|carriage"],
      "clicking the pencil never toggles its associated checkbox");
    const disabled=renderNavigationTravelMethodButtons({
      choices:[{value:"hire|carriage",label:"Carriage",group:"Dirwest"}],
      selectedValues:["hire|carriage"],disabled:true,
      onEditMethod:value=>calls.push("unexpected:"+value)
    });
    const disabledEdit=all(disabled).find(node=>node.tag==="button"&&
      node.ariaLabel?.includes("Carriage"));
    assert.equal(disabledEdit.disabled,true);
    disabledEdit.listeners.click();
    assert.deepEqual(calls,["edit:hire|carriage"],
      "a disabled control cannot open the transportation editor");
  }finally{restore();}
});

test("multi-method cards use controlled checkboxes and forward deliberate selections",async()=>{
  const restore=mockDOM();
  try{
    const {renderNavigationTravelMethodButtons}=await import("../scripts/navigation-selection-view.js");
    const events=[];
    const section=renderNavigationTravelMethodButtons({
      choices:[
        {value:"owned|walking",label:"Walking",group:"Party"},
        {value:"hire|cart",label:"Cart",group:"Hearth",cargoOnly:true}
      ],
      selectedValue:"owned|walking",
      selectedValues:["owned|walking","hire|cart"],
      onMethodToggle:(value,checked)=>events.push([value,checked])
    });
    const all=node=>[node,...node.children.flatMap(all)];
    const inputs=all(section).filter(node=>node.tag==="input");
    assert.equal(inputs.length,2);
    assert.ok(inputs.every(node=>node.type==="checkbox"&&node.checked),
      "both the walking method and cargo cart are checked");
    assert.deepEqual(events,[],"rendering must not mutate navigation state");
    inputs[1].checked=false;inputs[1].listeners.change();
    assert.deepEqual(events,[["hire|cart",false]]);
  }finally{restore();}
});

test("single method tile keeps its own pencil instead of a separate footer edit",async()=>{
  const restore=mockDOM();
  try{
    const {renderNavigationTravelMethodButtons}=await import("../scripts/navigation-selection-view.js");
    const calls=[];
    const tree=renderNavigationTravelMethodButtons({
      choices:[{value:"hire|cart",label:"Cart",group:"Port Barthos"},
        {value:"owned|walking",label:"Walking",group:"Party"}],
      selectedValues:["hire|cart"],onMethodToggle:(value,checked)=>
        calls.push("toggle:"+value),onEditMethod:value=>calls.push("edit:"+value)
    });
    const all=node=>[node,...node.children.flatMap(all)];
    const buttons=all(tree).filter(node=>node.tag==="button");
    assert.equal(buttons.length,1,"no obsolete 'Edit selected method' footer");
    assert.match(buttons[0].ariaLabel,/Edit Cart/);
    buttons[0].listeners.click();
    assert.deepEqual(calls,["edit:hire|cart"]);
  }finally{restore();}
});
test("water transfer radio tiles expose the same selected pencil",async()=>{
  const restore=mockDOM();
  try{
    const {renderNavigationTravelMethodButtons}=await import("../scripts/navigation-selection-view.js");
    const calls=[];
    const tree=renderNavigationTravelMethodButtons({
      choices:[{value:"hire|ship-passage",label:"Ship passage",group:"Port Barthos"},
        {value:"owned|warship",label:"Warship",group:"Party"}],
      selectedValue:"hire|ship-passage",onMethodChange:value=>calls.push("select:"+value),
      onEditMethod:value=>calls.push("edit:"+value)
    });
    const all=node=>[node,...node.children.flatMap(all)];
    assert.equal(all(tree).filter(node=>node.tag==="input").every(n=>n.type==="radio"),true);
    const edit=all(tree).find(node=>node.tag==="button");
    assert.match(edit.ariaLabel,/Ship passage/);
    edit.listeners.click();
    const other=all(tree).find(n=>n.tag==="input"&&n.value==="owned|warship");
    other.checked=true;other.listeners.change();
    assert.deepEqual(calls,["edit:hire|ship-passage","select:owned|warship"]);
  }finally{restore();}
});
