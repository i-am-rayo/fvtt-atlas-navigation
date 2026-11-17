import test from "node:test";
import assert from "node:assert/strict";
import {openRoadSettingsWindow} from "../scripts/road-settings-window.js";

class Element {
  constructor(tag) {
    this.tag=tag;this.children=[];this.dataset={};this.listeners=new Map();
    this.className="";this.textContent="";this.valid=true;
  }
  append(...items){this.children.push(...items);}
  appendChild(item){this.append(item);}
  replaceChildren(...items){this.children=[...items];}
  addEventListener(type,listener){this.listeners.set(type,listener);}
  querySelector(selector){
    if(selector==="form[data-atlas-road-form]")
      return this.children.find(item=>item.tag==="form"&&"atlasRoadForm" in item.dataset)??null;
    return null;
  }
  reportValidity(){return this.valid;}
}

class MockApplicationV2 {
  constructor(options){this.options=options;}
  async render(){
    this.element=new Element("application");
    this._replaceHTML(await this._renderHTML(),this.element);
    this._onRender();
    return this;
  }
  async close(){this.closed=true;this._onClose();}
}

test("Road ApplicationV2 keeps a named native form and returns staged values only on submit",async()=>{
  const old={foundry:globalThis.foundry,document:globalThis.document};
  let app;
  try{
    globalThis.document={createElement:tag=>new Element(tag)};
    globalThis.foundry={applications:{api:{ApplicationV2:MockApplicationV2},
      ux:{FormDataExtended:class {
        constructor(form){
          assert.equal(form.tag,"form");
          this.object={atlasRoadName:"Edited Road",atlasRoadVisible:"on"};
        }
      }}};
    const content=new Element("div");
    const resultPromise=openRoadSettingsWindow({
      title:"Atlas — Old Road — Road Settings",position:{width:560,height:700},content,
      onRender:(_event,window)=>{app=window;}
    });
    await new Promise(resolve=>setImmediate(resolve));
    assert.ok(app);
    assert.equal(app.options.window.resizable,true);
    assert.equal(app.options.window.minimizable,true);
    assert.equal(app.form.children[0],content,"original form controls are reused");
    const footer=app.form.children[1];
    assert.equal(footer.className,"form-footer");
    const save=footer.children[0];
    assert.equal(save.type,"submit");
    assert.ok("atlasRoadSubmit" in save.dataset,"no DialogV2 action interception");
    let prevented=false;
    app.form.listeners.get("submit")({preventDefault(){prevented=true;}});
    const result=await resultPromise;
    assert.equal(prevented,true);
    assert.deepEqual(result,{atlasRoadName:"Edited Road",atlasRoadVisible:"on"});
    assert.equal(app.closed,true);
  }finally{Object.assign(globalThis,old);}
});

test("invalid Road form cannot submit, and closing returns a null cancellation",async()=>{
  const old={foundry:globalThis.foundry,document:globalThis.document};
  let app,serializations=0;
  try{
    globalThis.document={createElement:tag=>new Element(tag)};
    globalThis.foundry={applications:{api:{ApplicationV2:MockApplicationV2},
      ux:{FormDataExtended:class {constructor(){serializations++;this.object={};}}}}};
    const resultPromise=openRoadSettingsWindow({
      title:"Road",position:{width:560},content:new Element("div"),
      onRender:(_event,window)=>{app=window;}
    });
    await new Promise(resolve=>setImmediate(resolve));
    app.form.valid=false;
    app.form.listeners.get("submit")({preventDefault(){}});
    assert.equal(serializations,0,"invalid drafts never reach the save workflow");
    await app.close();
    assert.equal(await resultPromise,null);
  }finally{Object.assign(globalThis,old);}
});
