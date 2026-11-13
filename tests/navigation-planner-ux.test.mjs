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
const flat=node=>[node,...(node.children??[]).flatMap(flat)];
const find=(node,predicate)=>flat(node).find(predicate);

test("GM transport radio tiles show known quantity/seats without rendering side effects",()=>{
  const restore=dom();
  try{
    const calls=[];
    const root=renderNavigationTravelMethodButtons({
      choices:[
        {value:"owned|walking",label:"Walking",group:"Party"},
        {value:"owned|riding-horse",label:"Riding Horse",group:"Party",
          secondary:"2 available · 2 seats"},
        {value:"hire|warship",label:"Warship",group:"Port Barthos",
          secondary:"Offered · 60 seats/unit"}],
      selectedValue:"owned|walking",showEditor:true,
      onMethodChange:value=>calls.push(value),onEdit:()=>calls.push("edit")
    });
    assert.equal(root.tag,"fieldset");
    assert.ok(flat(root).some(n=>n.textContent==="Party Owned"));
    assert.ok(flat(root).some(n=>n.textContent==="Available at Port Barthos"));
    assert.ok(flat(root).some(n=>n.textContent==="2 available · 2 seats"));
    assert.ok(flat(root).some(n=>n.textContent==="Offered · 60 seats/unit"));
    const radios=flat(root).filter(n=>n.tag==="input"&&n.type==="radio");
    assert.deepEqual(radios.map(n=>n.value),
      ["owned|walking","owned|riding-horse","hire|warship"]);
    assert.equal(radios.filter(n=>n.checked).length,1);
    assert.deepEqual(calls,[],"rendering does not approve or purchase transport");
    radios[2].checked=true;radios[2].listeners.change();
    assert.deepEqual(calls,["hire|warship"]);
    find(root,n=>n.tag==="button").listeners.click();
    assert.deepEqual(calls,["hire|warship","edit"]);
  }finally{restore();}
});

test("two sliders control seconds/hour and real-trip target with 8h Long Rests",()=>{
  const restore=dom();
  try{
    const changed=[],errors=[];
    const model={travelHours:35,dailyHours:8,overnightHours:16,longRestHours:8};
    const root=renderNavigationPlaybackControls({model,secondsPerHour:2,
      onChange:value=>changed.push(value),onError:value=>errors.push(value)});
    const sliders=flat(root).filter(n=>n.type==="range");
    assert.equal(sliders.length,2);
    assert.equal(sliders[0].min,"0.5");
    assert.equal(sliders[0].max,"30");
    assert.equal(sliders[0].value,"2");
    assert.equal(sliders[1].disabled,false);
    assert.ok(flat(root).some(n=>n.textContent?.startsWith?.("Moving animation:")));
    assert.ok(flat(root).some(n=>n.textContent?.startsWith?.("Trip with 4 planned 8h Long Rest")));
    assert.deepEqual(changed,[]);
    sliders[0].value="3";sliders[0].listeners.change();
    assert.deepEqual(changed,[3]);
    sliders[1].value="5";sliders[1].listeners.change();
    assert.ok(changed[1]>.5&&changed[1]<30);
    assert.deepEqual(errors,[]);
  }finally{restore();}
});

test("real-duration slider handles unreachable trips without unauthorized writes",()=>{
  const restore=dom();
  try{
    const changes=[],errors=[];
    const root=renderNavigationPlaybackControls({
      model:{travelHours:2000,dailyHours:8,overnightHours:16,longRestHours:8},
      secondsPerHour:2,onChange:v=>changes.push(v),onError:e=>errors.push(e)});
    const target=flat(root).filter(n=>n.type==="range")[1];
    assert.equal(target.disabled,true);
    assert.ok(flat(root).some(n=>n.textContent?.includes?.("fastest supported playback")));
    assert.deepEqual(changes,[]);
    assert.deepEqual(errors,[]);
  }finally{restore();}
});
