import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {openRoadSettingsWindow} from "../scripts/road-settings-window.js";
import {createSettingsCategoryTabs} from "../scripts/settings-category-tabs.js";

class Element {
  constructor(tag) {
    this.tag=tag;this.children=[];this.dataset={};this.listeners=new Map();
    this.className="";this.textContent="";this.valid=true;
    this.style={};this.attrs=new Map();
  }
  append(...items){this.children.push(...items);}
  appendChild(item){this.append(item);}
  replaceChildren(...items){this.children=[...items];}
  addEventListener(type,listener){this.listeners.set(type,listener);}
  setAttribute(key,value){this.attrs.set(key,String(value));}
  focus(){this.focused=true;}
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
  let app,submissions=0;
  try{
    globalThis.document={createElement:tag=>new Element(tag)};
    globalThis.foundry={applications:{api:{ApplicationV2:MockApplicationV2},
      ux:{FormDataExtended:class {
        constructor(form){
          assert.equal(form.tag,"form");
          this.object={atlasRoadName:"Edited Road",atlasRoadVisible:"on"};
        }
      }}}};
    const content=new Element("div");
    const resultPromise=openRoadSettingsWindow({
      id:"road-a",title:"Atlas — Old Road — Road Settings",position:{width:560,height:700},content,
      onRender:(_event,window)=>{app=window;},onSubmitted:()=>submissions++
    });
    await new Promise(resolve=>setImmediate(resolve));
    assert.ok(app);
    assert.equal(app.options.id,"fvtt-atlas-road-settings-road-a");
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
    assert.equal(submissions,1,"valid submission authorizes closing");
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
      id:"road-b",title:"Road",position:{width:560},content:new Element("div"),
      onRender:(_event,window)=>{app=window;}
    });
    await new Promise(resolve=>setImmediate(resolve));
    app.form.valid=false;
    app.form.listeners.get("submit")({preventDefault(){}});
    assert.equal(serializations,0,"invalid drafts never reach the save workflow");
    app.setCloseGuard(()=>false);
    await app.close();
    assert.equal(app.closed,undefined,"dirty-close refusal keeps editor open");
    app.setCloseGuard(()=>true);
    await app.close();
    assert.equal(await resultPromise,null);
  }finally{Object.assign(globalThis,old);}
});

test("Road Settings uses the existing keyboard tab helper without touching drafts",()=>{
  const old=globalThis.document;
  try{
    globalThis.document={createElement:tag=>new Element(tag)};
    const helper=createSettingsCategoryTabs({
      id:"atlas-road-settings-test",active:"general",
      modes:[["general","General"],["style","Customization"],
        ["checkpoints","Map Markers"],["regions","Terrain Regions"]]
    });
    const panels=new Map(["general","style","checkpoints","regions"].map(key=>{
      const panel=new Element("div");
      panel.draft="unsaved "+key;
      helper.addPanel(key,panel);
      return [key,panel];
    }));
    assert.equal(helper.nav.attrs.get("role"),"tablist");
    assert.deepEqual(helper.nav.children.map(tab=>tab.attrs.get("aria-selected")),
      ["true","false","false","false"]);
    helper.nav.listeners.get("keydown")({
      target:helper.nav.children[0],key:"ArrowLeft",preventDefault(){}
    });
    assert.equal(helper.selected,"regions","keyboard navigation wraps");
    assert.equal(helper.nav.children[3].focused,true);
    assert.equal(panels.get("regions").hidden,false);
    helper.nav.listeners.get("keydown")({
      target:helper.nav.children[3],key:"Home",preventDefault(){}
    });
    assert.equal(helper.selected,"general");
    assert.equal(panels.get("regions").draft,"unsaved regions",
      "switching never removes linked Regions draft controls");
    const main=readFileSync(new URL("../scripts/main.js",import.meta.url),"utf8");
    assert.match(main,/const roadTabs=createSettingsCategoryTabs\(/);
    assert.match(main,/roadTabs\.addPanel\(key,panels\[key\]\)/);
  }finally{globalThis.document=old;}
});

test("Road linked Map Markers/Regions keep count legends inside bordered sections",()=>{
  const main=readFileSync(new URL("../scripts/main.js",import.meta.url),"utf8");
  const css=readFileSync(new URL("../styles/road-settings-dialog.css",import.meta.url),"utf8");
  assert.match(main,/checkpointSection\.append\(checkpointLegend,checkpointList\)/);
  assert.match(main,/regionSection\.append\(regionLegend,priorityHelp,regionList\)/);
  assert.match(main,/checkpointTarget\.replaceChildren\(\)/);
  assert.match(main,/regionTarget\.replaceChildren\(\)/);
  assert.match(css,/\.atlas-road-settings-form\s*\{[^}]*flex-direction:column/s);
  assert.match(css,/\.atlas-road-settings-scroll\s*\{[^}]*overflow-y:auto/s);
  assert.match(css,/\.form-footer\s*\{[^}]*flex:0 0 auto/s);
});

test("Road Settings presentation uses one native form and a scroll-contained editor layout",()=>{
  const source=readFileSync(new URL("../scripts/main.js",import.meta.url),"utf8");
  const css=readFileSync(new URL("../styles/road-settings-dialog.css",import.meta.url),"utf8");
  assert.match(source,/content\.className="atlas-road-settings-content"/);
  assert.match(source,/scrollBody\.className="atlas-road-settings-scroll"/);
  assert.match(source,/heading\.append\(headingTitle,explanation\)/);
  assert.match(css,/\.atlas-road-settings-content\s*\{[^}]*flex-direction:column/s);
  assert.match(css,/\.atlas-road-settings-scroll\s*\{[^}]*overflow-y:auto/s);
  assert.match(css,/\.form-footer\s*\{[^}]*flex:0 0 auto/s);
});
