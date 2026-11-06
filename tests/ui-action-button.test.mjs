import test from "node:test";
import assert from "node:assert/strict";
import { createAtlasIconButton } from "../scripts/ui-action-button.js";

class FakeElement {
  constructor(tag){
    this.tag=tag;
    this.children=[];
    this.style={};
    this.attributes=new Map();
    this.listeners=new Map();
  }
  appendChild(child){this.children.push(child);return child;}
  setAttribute(key,value){this.attributes.set(key,value);}
  addEventListener(type,handler){this.listeners.set(type,handler);}
}

const withDocument=callback=>{
  const previous=globalThis.document;
  globalThis.document={createElement:tag=>new FakeElement(tag)};
  try{return callback();}finally{globalThis.document=previous;}
};

test("compact and footer controls share accessible naming with distinct sizes",()=>withDocument(()=>{
  const settings=createAtlasIconButton({icon:"floppy-disk",label:"Save settings"});
  const navigation=createAtlasIconButton({icon:"route",label:"New Route",size:"footer"});
  for(const button of [settings,navigation]){
    assert.equal(button.tag,"button");
    assert.equal(button.type,"button","actions must not submit an enclosing edit form");
    assert.equal(button.ariaLabel,button.title);
    assert.equal(button.attributes.get("aria-label"),button.title);
    assert.equal(button.children[0].attributes.get("aria-hidden"),"true");
    assert.equal(button.listeners.size,0,"delegated handlers may own the action");
  }
  assert.match(settings.className,/atlas-ui-icon-button--compact/);
  assert.match(navigation.className,/atlas-ui-icon-button--footer/);
  assert.equal(settings.children[0].className,"fa-solid fa-floppy-disk");
  assert.equal(navigation.children[0].className,"fa-solid fa-route");
}));

test("danger remains explicit and the callback is not invoked while constructing",()=>withDocument(()=>{
  let clicks=0;
  const button=createAtlasIconButton({icon:"trash",label:"Delete road",danger:true,
    onClick:()=>{clicks++;}});
  assert.match(button.className,/atlas-ui-icon-button--danger/);
  assert.match(button.style.color,/color-level-error/);
  assert.equal(clicks,0);
  button.listeners.get("click")();
  assert.equal(clicks,1);
}));

test("rejects unsafe icons, missing labels, and invalid action contracts",()=>withDocument(()=>{
  for(const options of [
    {},{icon:"<script>",label:"Unsafe"},{icon:"route",label:" "},
    {icon:"route",label:"Route",size:"unknown"},
    {icon:"route",label:"Route",onClick:"not a callback"},
    {icon:"route",label:"Route",danger:"yes"}
  ])assert.throws(()=>createAtlasIconButton(options),/Invalid Atlas icon action/);
}));
