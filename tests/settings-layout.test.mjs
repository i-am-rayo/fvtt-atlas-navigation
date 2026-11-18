import test from "node:test";
import assert from "node:assert/strict";
import { createSettingsFieldRow,appendSettingsField } from "../scripts/settings-layout.js";

class Element {
  constructor(tag){this.tagName=tag;this.nodeType=1;this.children=[];
    this.style={};this.className="";this.textContent="";this.value="";}
  append(...children){this.children.push(...children);}
  appendChild(item){this.children.push(item);return item;}
}

test("shared rows preserve the exact original input for all editor variants",()=>{
  const old=globalThis.document;
  try{
    globalThis.document={createElement:tag=>new Element(tag)};
    for(const variant of ["native","native-div","split","grid"]){
      const parent=new Element("div"),input=new Element("input");
      input.value="unsaved input";
      assert.equal(appendSettingsField(parent,"Elevation",input,{variant}),input);
      const row=parent.children[0];
      assert.equal(row.children[1],input);
      assert.equal(row.children[0].textContent,"Elevation");
      assert.equal(input.value,"unsaved input");
      assert.equal(row.tagName,variant==="native-div"?"div":"label");
    }
  }finally{globalThis.document=old;}
});

test("invalid settings rows fail before mutating a parent",()=>{
  const old=globalThis.document;
  try{
    globalThis.document={createElement:tag=>new Element(tag)};
    assert.throws(()=>createSettingsFieldRow("",new Element("input")),/require/);
    assert.throws(()=>createSettingsFieldRow("A",new Element("input"),{variant:"bogus"}),/Unknown/);
  }finally{globalThis.document=old;}
});
