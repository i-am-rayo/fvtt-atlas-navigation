import test from "node:test";
import assert from "node:assert/strict";
import {parseBoundedRangeDraft,createSettingsNumberRange}
  from "../scripts/settings-number-range.js";
import {createCheckpointMarkerSize,createCheckpointRegionWidth}
  from "../scripts/checkpoint-form-controls.js";

class Mock{
  constructor(tag){this.tag=tag;this.children=[];this.listeners=new Map();
    this.style={};this.attrs=new Map();this.value="";this.textContent="";}
  setAttribute(k,v){this.attrs.set(k,v);}
  removeAttribute(k){this.attrs.delete(k);}
  addEventListener(k,v){this.listeners.set(k,v);}
  append(...items){this.children.push(...items);}
  appendChild(item){this.children.push(item);}
  setCustomValidity(message){this.invalid=message;}
}
const withDOM=callback=>{
  const previous=globalThis.document;
  globalThis.document={createElement:tag=>new Mock(tag)};
  try{return callback();}finally{globalThis.document=previous;}
};

test("numeric range parser refuses empty, nonfinite, out-of-range and bad steps",()=>{
  const spec={min:12,max:64,step:1};
  for(const bad of ["", " ", "NaN","Infinity","11","65","12.5","-1"]){
    assert.throws(()=>parseBoundedRangeDraft(bad,spec),/Enter/);
  }
  assert.equal(parseBoundedRangeDraft("24",spec),24);
  assert.equal(parseBoundedRangeDraft(".5",{min:0,max:1,step:.25}),.5);
  assert.equal(parseBoundedRangeDraft("12.55",{min:0,max:100,step:"any"}),12.55);
});

test("slider and number stay synchronized, invalid draft cannot save stale slider",()=>withDOM(()=>{
  const changes=[];
  const pair=createSettingsNumberRange(24,{min:12,max:64,step:1,
    label:"Marker pixels",onInput:n=>changes.push(n)});
  pair.slider.value="55";pair.slider.listeners.get("input")();
  assert.equal(pair.number.style.width,undefined,"shared CSS owns numeric width");
  assert.equal(pair.number.value,"55");
  assert.equal(pair.getValue(),55);
  pair.number.value="32";pair.number.listeners.get("input")();
  assert.equal(pair.slider.value,"32");
  assert.equal(pair.getValue(),32);
  assert.deepEqual(changes,[55,32],"one callback per direct input, no recursive events");
  pair.number.value="65";pair.number.listeners.get("input")();
  assert.equal(pair.slider.value,"32","invalid text never moves the slider");
  assert.throws(()=>pair.getValue(),/between/);
  assert.equal(pair.number.attrs.get("aria-invalid"),"true");
  pair.setValue(12);assert.equal(pair.number.value,"12");
  assert.equal(pair.getValue(),12);
  assert.equal(pair.number.attrs.has("aria-invalid"),false);
}));

test("Checkpoint marker and native Region width require valid numeric drafts",()=>withDOM(()=>{
  const marker=createCheckpointMarkerSize(24);
  marker.number.value="31";marker.number.listeners.get("input")();
  assert.equal(marker.getValue(),31);
  assert.equal(marker.input.value,"31");
  marker.number.value="31.5";marker.number.listeners.get("input")();
  assert.throws(()=>marker.getValue(),/increments/);
  const widths=[];
  const width=createCheckpointRegionWidth(.5,{onChange:n=>widths.push(n)});
  width.number.value="1.25";width.number.listeners.get("input")();
  assert.equal(width.input.value,"1.25");
  assert.equal(width.getValue(),1.25);
  width.number.value="1.3";width.number.listeners.get("input")();
  assert.throws(()=>width.getValue(),/increments/);
  assert.deepEqual(widths,[1.25]);
}));
