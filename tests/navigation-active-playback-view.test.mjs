import assert from "node:assert/strict";
import test from "node:test";
import {renderNavigationActivePlayback}
  from "../scripts/navigation-active-playback-view.js";
import {verifiedJourneyDestinationName}
  from "../scripts/navigation-journey-title.js";

const dom=()=>{
  const original=globalThis.document;
  globalThis.document={createElement:tag=>({
    tag,style:{},children:[],listeners:{},textContent:"",
    append(...items){this.children.push(...items);},
    appendChild(node){this.children.push(node);},
    addEventListener(name,fn){this.listeners[name]=fn;},
    setAttribute(key,value){this[key]=value;}
  })};
  return ()=>{globalThis.document=original;};
};
const flat=node=>[node,...(node.children??[]).flatMap(flat)];

test("active Journey Speed offers per-trip 30s slider and safe skip toggle",()=>{
  const restore=dom();
  try{
    const changed=[],actions=[];
    const view=renderNavigationActivePlayback({
      model:{travelHours:18,dailyHours:8,overnightHours:16,longRestHours:8},
      secondsPerHour:12,locked:false,skip:false,
      onChange:value=>changed.push(value),onSkip:()=>actions.push("skip")
    });
    const sliders=flat(view).filter(node=>node.tag==="input"&&node.type==="range");
    assert.equal(sliders.length,2);
    assert.equal(sliders[0].max,"30");
    sliders[0].value="20";
    sliders[0].listeners.change();
    assert.deepEqual(changed,[20]);
    const button=flat(view).find(n=>n.tag==="button"&&
      n.textContent==="Skip remaining visual playback");
    assert.ok(button);
    button.listeners.click();
    assert.deepEqual(actions,["skip"]);
    assert.ok(flat(view).some(n=>n.textContent?.includes?.(
      "Native Wall/Region restrictions")));
  }finally{restore();}
});

test("continuous native voyage shows locked visual speed and no skip action",()=>{
  const restore=dom();
  try{
    const actions=[];
    const view=renderNavigationActivePlayback({
      model:{travelHours:18,dailyHours:null,overnightHours:0,longRestHours:8},
      secondsPerHour:12,locked:true,skip:false,
      onSkip:()=>actions.push("skip")
    });
    const button=flat(view).find(n=>n.tag==="button"&&
      n.textContent==="Skip remaining visual playback");
    assert.equal(button.disabled,true);
    button.listeners.click();
    assert.deepEqual(actions,[]);
    assert.ok(flat(view).some(n=>n.textContent?.includes?.(
      "active continuous native movement")));
  }finally{restore();}
});

test("Journey heading names only an authored checkpoint at exact original Point B",()=>{
  const atlas={nodes:[{id:"a",x:15,y:20},{id:"b",x:120,y:220}],
    checkpoints:[{id:"city",nodeId:"a",name:"Dirwest"},
      {id:"bridge",nodeId:"b",name:"Dirwest Southern Bridge"}]};
  assert.equal(verifiedJourneyDestinationName(atlas,{x:15,y:20}),"Dirwest");
  assert.equal(verifiedJourneyDestinationName(atlas,{x:100,y:100}),null,
    "do not guess a destination from a nearby Checkpoint");
  assert.equal(verifiedJourneyDestinationName(atlas,{x:120,y:220}),"Dirwest Southern Bridge");
  assert.equal(verifiedJourneyDestinationName(atlas,null),null);
});
