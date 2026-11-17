import test from "node:test";
import assert from "node:assert/strict";
import {renderNavigationPlaybackControls}
  from "../scripts/navigation-playback-controls-view.js";

class Element{
  constructor(tag){this.tag=tag;this.children=[];this.listeners=new Map();
    this.style={};this.attrs={};this.textContent="";}
  append(...items){this.children.push(...items);}
  appendChild(item){this.children.push(item);}
  addEventListener(name,fn){this.listeners.set(name,fn);}
  setAttribute(k,v){this.attrs[k]=v;}
  removeAttribute(k){delete this.attrs[k];}
  setCustomValidity(message){this.invalid=message;}
}
const descendants=node=>[node,...node.children.flatMap(descendants)];

test("Navigation per-trip speed and real target minutes support numeric keyboard input",()=>{
  const previous=globalThis.document;
  globalThis.document={createElement:tag=>new Element(tag)};
  try{
    const choices=[],errors=[];
    const root=renderNavigationPlaybackControls({
      model:{travelHours:35,dailyHours:8,overnightHours:16,longRestHours:8},
      secondsPerHour:8,onChange:s=>choices.push(s),onError:m=>errors.push(m)});
    const numbers=descendants(root).filter(el=>el.type==="number");
    const sliders=descendants(root).filter(el=>el.type==="range");
    assert.equal(numbers.length,2);
    assert.equal(sliders.length,2);
    numbers[0].value="20";numbers[0].listeners.get("input")();
    assert.equal(sliders[0].value,"20");
    numbers[0].listeners.get("change")();
    assert.equal(choices.at(-1),20);
    numbers[0].value="31";numbers[0].listeners.get("input")();
    numbers[0].listeners.get("change")();
    assert.equal(choices.at(-1),20,"invalid speed is never committed");
    assert.match(errors.at(-1),/between/);
    numbers[1].value="5";numbers[1].listeners.get("input")();
    numbers[1].listeners.get("change")();
    assert.ok(choices.at(-1)>0.5&&choices.at(-1)<30);
    assert.equal(sliders[1].value,"5");
  }finally{globalThis.document=previous;}
});
