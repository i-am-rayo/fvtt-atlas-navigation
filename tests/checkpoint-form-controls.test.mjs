import test from "node:test";
import assert from "node:assert/strict";
import { createCheckpointChoice,createCheckpointRange,createCheckpointRegionRadius,
  createCheckpointMarkerSize,createCheckpointColor,createCheckpointCheckbox,
  createCheckpointElevation,createCheckpointRegionWidth }
  from "../scripts/checkpoint-form-controls.js";

class FakeElement {
  constructor(tag){this.tag=tag;this.children=[];this.value="";this.style={};
    this.listeners=new Map();this.attributes=new Map();}
  append(...items){this.children.push(...items);}
  appendChild(item){this.children.push(item);return item;}
  addEventListener(name,handler){this.listeners.set(name,handler);}
  setAttribute(name,value){this.attributes.set(name,value);}
}

test("canonical checkpoint choice keeps selected ID",()=>{
  const old=globalThis.document;
  try{
    globalThis.document={createElement:tag=>new FakeElement(tag)};
    const select=createCheckpointChoice([["automatic","Automatic"],["gm","GM"]],"gm");
    assert.equal(select.value,"gm");
    assert.deepEqual(select.children.map(item=>item.value),["automatic","gm"]);
  }finally{globalThis.document=old;}
});

test("shared checkpoint range keeps slider and number synchronized",()=>{
  const old=globalThis.document;
  try{
    globalThis.document={createElement:tag=>new FakeElement(tag)};
    const {slider,number}=createCheckpointRange(3,{min:0,max:100,step:.25});
    slider.value="5.25";slider.listeners.get("input")();
    assert.equal(number.value,"5.25");
    number.value="2.5";number.listeners.get("input")();
    assert.equal(slider.value,"2.5");
    number.value="";number.listeners.get("input")();
    assert.equal(slider.value,"2.5","empty input must not force slider to minimum");
  }finally{globalThis.document=old;}
});

test("Region radius uses one canonical set of bounds",()=>{
  const old=globalThis.document;
  try{
    globalThis.document={createElement:tag=>new FakeElement(tag)};
    const control=createCheckpointRegionRadius(.5);
    assert.equal(control.min,"0.25");
    assert.equal(control.max,"3");
    assert.equal(control.step,"0.25");
  }finally{globalThis.document=old;}
});

test("marker control uses one bounded slider and pixel readout",()=>{
  const old=globalThis.document;
  try{
    globalThis.document={createElement:tag=>new FakeElement(tag)};
    const control=createCheckpointMarkerSize(24);
    assert.equal(control.input.type,"range");
    assert.equal(control.input.min,"12");
    assert.equal(control.input.max,"64");
    control.input.value="32";control.input.listeners.get("input")();
    assert.equal(control.output.textContent,"32 px");
    assert.equal(createCheckpointColor("#abcdef").value,"#abcdef");
    assert.equal(createCheckpointCheckbox(true).checked,true);
  }finally{globalThis.document=old;}
});

test("Region width/radius shares geometry slider and signals staged changes",()=>{
  const old=globalThis.document;
  try{
    globalThis.document={createElement:tag=>new FakeElement(tag)};
    const changes=[];
    const control=createCheckpointRegionWidth(.5,{onChange:value=>changes.push(value)});
    assert.equal(control.input.min,"0.25");
    assert.equal(control.input.max,"3");
    assert.equal(control.input.step,"0.25");
    control.input.value="1.25";control.input.listeners.get("input")();
    assert.equal(control.output.textContent,"1.25 cells");
    assert.deepEqual(changes,[1.25]);
  }finally{globalThis.document=old;}
});

test("optional elevation uses the same number/slider pair and preserves empty",()=>{
  const old=globalThis.document;
  try{
    globalThis.document={createElement:tag=>new FakeElement(tag)};
    const unspecified=createCheckpointElevation(null);
    assert.equal(unspecified.number.value,"");
    assert.equal(unspecified.getMeters(),null);
    const imperial=createCheckpointElevation(20,{imperial:true});
    assert.equal(imperial.number.value,"65.62");
    assert.ok(Math.abs(imperial.getMeters()-20)<.01);
    imperial.slider.value="30";imperial.slider.listeners.get("input")();
    assert.equal(imperial.number.value,"30");
  }finally{globalThis.document=old;}
});
