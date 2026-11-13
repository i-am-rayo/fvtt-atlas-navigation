import assert from "node:assert/strict";
import test from "node:test";
import {renderNavigationTravelMethodButtons}
  from "../scripts/navigation-selection-view.js";
import {renderNavigationPlaybackControls}
  from "../scripts/navigation-playback-controls-view.js";

const dom=()=>{
  const original=globalThis.document;
  globalThis.document={createElement:tag=>({
    tag,style:{},children:[],listeners:{},textContent:"",
    append(...items){this.children.push(...items);},
    appendChild(x){this.children.push(x);},
    addEventListener(type,fn){this.listeners[type]=fn;},
    setAttribute(key,value){this[key]=value;}
  })};
  return ()=>{globalThis.document=original;};
};
const flat=(node)=>[node,...(node.children??[]).flatMap(flat)];
const find=(node,predicate)=>flat(node).find(predicate);

test("GM transportation controls are native single-select radio tiles",()=>{
  const restore=dom();
  try{
    const calls=[];
    const root=renderNavigationTravelMethodButtons({
      choices:[
        {value:"owned|walking",label:"Walking",group:"Party"},
        {value:"owned|riding-horse",label:"Riding Horse",group:"Party"},
        {value:"hire|caravan",label:"Caravan",group:"Dirwest"}],
      selectedValue:"owned|walking",showEditor:true,
      onMethodChange:value=>calls.push(value),onEdit:()=>calls.push("edit")
    });
    assert.equal(root.tag,"fieldset");
    assert.ok(flat(root).some(n=>n.textContent==="Party Owned"));
    assert.ok(flat(root).some(n=>n.textContent==="Available at Dirwest"));
    const radios=flat(root).filter(n=>n.tag==="input"&&n.type==="radio");
    assert.deepEqual(radios.map(n=>n.value),
      ["owned|walking","owned|riding-horse","hire|caravan"]);
    assert.equal(radios.filter(n=>n.checked).length,1);
    assert.deepEqual(calls,[],"rendering does not approve or purchase a method");
    radios[2].checked=true;radios[2].listeners.change();
    assert.deepEqual(calls,["hire|caravan"]);
    find(root,n=>n.tag==="button").listeners.click();
    assert.deepEqual(calls,["hire|caravan","edit"]);
  }finally{restore();}
});

test("per-trip playback view contains slider and explicit target converter without mutating World settings",()=>{
  const restore=dom();
  try{
    const changed=[],errors=[];
    const model={travelHours:35,dailyHours:8,overnightHours:16,longRestHours:8};
    const root=renderNavigationPlaybackControls({model,secondsPerHour:2,
      onChange:value=>changed.push(value),onError:value=>errors.push(value)});
    const slider=find(root,n=>n.type==="range");
    assert.equal(slider.min,"0.5");assert.equal(slider.max,"8");
    assert.equal(slider.value,"2");
    const target=find(root,n=>n.type==="number");
    assert.ok(target.value);
    assert.ok(flat(root).some(n=>n.textContent?.startsWith?.("Moving animation:")));
    assert.ok(flat(root).some(n=>n.textContent?.startsWith?.("If the GM chooses 8h Long Rests")));
    assert.deepEqual(changed,[]);
    slider.value="3";slider.listeners.change();
    assert.deepEqual(changed,[3]);
    target.value="5";
    find(root,n=>n.textContent==="Set duration").listeners.click();
    assert.ok(changed[1]>.5&&changed[1]<8);
    assert.deepEqual(errors,[]);
  }finally{restore();}
});

test("impossible real-time targets report a bounded error instead of changing speed",()=>{
  const restore=dom();
  try{
    const changes=[],errors=[];
    const root=renderNavigationPlaybackControls({
      model:{travelHours:1,dailyHours:8,overnightHours:16,longRestHours:8},
      secondsPerHour:2,onChange:v=>changes.push(v),onError:e=>errors.push(e)});
    const target=find(root,n=>n.type==="number");
    target.value="5";find(root,n=>n.textContent==="Set duration").listeners.click();
    assert.equal(changes.length,0);
    assert.match(errors[0],/cannot match/);
  }finally{restore();}
});
