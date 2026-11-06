import assert from "node:assert/strict";
import test from "node:test";
import { createSettingsInput, settingsFormValues } from "../scripts/settings-input.js";

test("shared numeric, color and checkbox inputs reflect defaults for dialog recreation",()=>{
  const previous=globalThis.document;
  try {
    globalThis.document={createElement:type=>({tagName:type,listeners:new Map(),
      attributes:{},setAttribute(name,value){this.attributes[name]=value;},
      addEventListener(name,handler){this.listeners.set(name,handler);}})};
    const number=createSettingsInput("number",2.5,{name:"radius",min:0,max:20,step:0.25,
      ariaLabel:"Reveal radius"});
    assert.equal(number.defaultValue,"2.5");
    assert.equal(number.min,"0");
    assert.equal(number.step,"0.25");
    assert.equal(number.attributes["aria-label"],"Reveal radius");
    const color=createSettingsInput("color","#ff00aa",{name:"tint"});
    assert.equal(color.defaultValue,"#ff00aa");
    const checked=createSettingsInput("checkbox",true,{name:"enabled"});
    assert.equal(checked.defaultChecked,true);
    checked.checked=false;
    checked.listeners.get("change")();
    assert.equal(checked.defaultChecked,false);
    number.value="3.25";
    number.listeners.get("input")();
    assert.equal(number.defaultValue,"3.25");
    assert.deepEqual(settingsFormValues([number,color,checked]),
      {radius:"3.25",tint:"#ff00aa",enabled:false});
  } finally { globalThis.document=previous; }
});
