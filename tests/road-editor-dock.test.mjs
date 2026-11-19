import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

class Element {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.style = {};
    this.listeners = new Map();
    this.textContent = "";
    this.disabled = false;
    this.attributes=new Map();
  }
  setAttribute(name,value){this.attributes.set(name,String(value));}
  append(...items) { this.children.push(...items); }
  appendChild(item) { this.children.push(item); return item; }
  addEventListener(event, handler) { this.listeners.set(event, handler); }
  replaceChildren(...items) { this.children = [...items]; }
}

const descendants = root => [root, ...root.children.flatMap(descendants)];
const button = (root, title) => descendants(root).find(node =>
  node.tag === "button" && (node.textContent === title || node.ariaLabel === title || node.title === title));

test("floating new-road dock summarizes settings and does not edit the configured draft", async () => {
  const previous = {
    foundry: globalThis.foundry, document: globalThis.document,
    game: globalThis.game, window: globalThis.window
  };
  try {
    globalThis.foundry = { applications: { api: { ApplicationV2: class {} } } };
    globalThis.document = { createElement: tag => new Element(tag) };
    globalThis.window = { innerWidth: 1280, innerHeight: 800 };
    globalThis.game = { user: { isGM: true } };
    const { AtlasRoadEditorDock } = await import("../scripts/road-editor-dock.js");
    const scene = { id: "dock-scene", canUserModify: () => true };
    const configured = { name: "Hidden River", presetId: "gravel-road" };
    let saves = 0, locates=0;
    const controller = {
      getDraft: () => ({ mode: "new", points: 3 }),
      getNewRoadOptions: () => structuredClone(configured),
      setNewRoadOptions: () => { throw new Error("Dock must not change road settings"); }
    };
    const dock = new AtlasRoadEditorDock({
      scene, controller, onFinish: async () => { saves++; return false; },
      onCancel() {}, onClosed() {}, onFocus:()=>{locates++;}
    });
    dock.window={title:{textContent:"Atlas — Road Editor"}};
    const root = await dock._renderHTML();
    assert.equal(dock.window.title.textContent,
      "Atlas — Hidden River — Road Editor",
      "new Road authoring identifies the staged Road without saving");
    assert.ok(descendants(root).some(node => node.tag==="small"&&
      node.attributes.get("role")==="status"),
      "point/draft status is exposed to assistive technology");
    assert.ok(descendants(root).some(node => node.textContent === "Hidden River"));
    assert.equal(descendants(root).filter(node => ["input", "select"].includes(node.tag)).length, 0);
    assert.ok(button(root, "Finish Road"));
    assert.ok(button(root, "Cancel"));
    assert.ok(button(root, "Locate Road"));
    button(root,"Locate Road").listeners.get("click")();
    assert.equal(locates,1);
    assert.equal(saves, 0, "rendering never saves a road");
    await button(root, "Finish Road").listeners.get("click")();
    assert.equal(saves, 1, "the explicit finish control invokes saving");
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});

test("compact checkpoint and junction docks keep persistent map instructions", async () => {
  const previous = {
    foundry: globalThis.foundry, document: globalThis.document,
    game: globalThis.game, window: globalThis.window
  };
  try {
    globalThis.foundry = { applications: { api: { ApplicationV2: class {} } } };
    globalThis.document = { createElement: tag => new Element(tag) };
    globalThis.window = { innerWidth: 1280, innerHeight: 800 };
    globalThis.game = { user: { isGM: true } };
    const { AtlasRoadEditorDock } = await import("../scripts/road-editor-dock.js");
    const scene = { id: "dock-scene", canUserModify: () => true };
    for (const [mode, expected] of [
      ["checkpoint", "Choose a map location for a Map Marker."],
      ["junction", "Choose two Roads to connect."]
    ]) {
      const controller = { getDraft: () => ({ mode, points: 0 }) };
      const dock = new AtlasRoadEditorDock({
        scene, controller, onFinish() {}, onCancel() {}, onClosed() {}, onFocus() {}
      });
      const root = await dock._renderHTML();
      assert.ok(descendants(root).some(node => node.textContent.includes(expected)));
      assert.ok(button(root, "Cancel"));
      assert.equal(button(root, "Finish Road"), undefined);
      assert.equal(button(root, "Save Points"), undefined);
      assert.equal(button(root, "Locate Road"), undefined);
    }
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});

test("floating Save Points remains available after its parent Scene sheet closes", async () => {
  const previous = {
    foundry: globalThis.foundry, document: globalThis.document,
    game: globalThis.game, window: globalThis.window
  };
  try {
    globalThis.foundry = { applications: { api: { ApplicationV2: class {} } } };
    globalThis.document = { createElement: tag => new Element(tag) };
    globalThis.window = { innerWidth: 1280, innerHeight: 800 };
    globalThis.game = { user: { isGM: true } };
    const { AtlasRoadEditorDock, activeRoadDockForSceneConfig } =
      await import("../scripts/road-editor-dock.js");
    const scene = { id: "dock-scene", canUserModify: () => true };
    const sheet = { document: scene, rendered: true };
    let draft = { mode: "points", points: 12, dirty: true, canUndo: false };
    let saved = 0, canceled = 0;
    const controller = { getDraft: s => s.id === scene.id ? draft : null };
    const dock = new AtlasRoadEditorDock({
      scene, sceneSheet: sheet, controller,
      onFinish: async () => { saved++; draft = null; return true; },
      onCancel: () => { canceled++; draft = null; },
      onClosed() {}, onFocus() {}
    });
    let editorEnded = false;
    if (!activeRoadDockForSceneConfig(sheet, dock, controller)) editorEnded = true;
    sheet.rendered = false;
    assert.equal(editorEnded, false, "closing the parent sheet preserves the active point session");
    assert.equal(activeRoadDockForSceneConfig({ document: { id: "other" } },
      dock, controller), false, "other Scene sheets do not own this editor");
    dock.window={title:{textContent:"Atlas — Road Editor"}};
    const root = await dock._renderHTML();
    // The points controller may return a read-only Road identity.
    assert.equal(dock.window.title.textContent,"Atlas — Road Editor",
      "legacy controller without roadName keeps an honest generic title");
    assert.ok(button(root, "Save Points"), "Save Points remains available");
    assert.ok(button(root, "Locate Road"));
    dock.close = async () => { dock._onClose({}); };
    await button(root, "Save Points").listeners.get("click")();
    assert.equal(saved, 1);
    assert.equal(canceled, 0, "a successful dock save is not canceled by sheet closure");
    assert.equal(draft, null);
    assert.equal(dock.finished, true);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});

test("Locate Road requests map focus without minimizing or writing an unsaved road draft", async () => {
  const previous={foundry:globalThis.foundry,document:globalThis.document,
    game:globalThis.game,window:globalThis.window,ui:globalThis.ui};
  try {
    globalThis.foundry={applications:{api:{ApplicationV2:class {}}}};
    globalThis.document={createElement:tag=>new Element(tag)};
    globalThis.window={innerWidth:1280,innerHeight:800};
    globalThis.game={user:{isGM:true}};
    globalThis.ui={notifications:{error:message=>{throw Error(message);}}};
    const {AtlasRoadEditorDock}=await import("../scripts/road-editor-dock.js");
    assert.equal(AtlasRoadEditorDock.DEFAULT_OPTIONS.window.frame,false,
      "canvas editor shares Paint Territory's frameless panel presentation");
    assert.equal(AtlasRoadEditorDock.DEFAULT_OPTIONS.window.positioned,true,
      "Foundry v14 still owns window positioning");
    const scene={id:"map-focus-scene",canUserModify:()=>true};
    const draft={mode:"points",points:8,dirty:true,canUndo:false};
    let saves=0,cancels=0,minimizes=0,reads=0,locates=0;
    const controller={getDraft:()=>{reads++;return draft;}};
    const dock=new AtlasRoadEditorDock({scene,controller,
      onFinish:()=>{saves++;},onCancel:()=>{cancels++;},onClosed() {},
      onFocus:()=>{locates++;}});
    dock.minimize=async()=>{
      if(!dock.constructor.DEFAULT_OPTIONS.window.minimizable)return;
      minimizes++;
    };
    const root=await dock._renderHTML();
    const readsAfterRender=reads;
    const focus=button(root,"Locate Road");
    assert.ok(focus.title.includes("Zoom to and highlight"));
    await focus.listeners.get("click")();
    assert.equal(minimizes,0,"locating never minimizes the editor");
    assert.equal(locates,1);
    assert.equal(reads,readsAfterRender,"locating does not touch the draft");
    assert.equal(dock.finished,false);
    assert.equal(dock.busy,false);
    assert.equal(saves,0);
    assert.equal(cancels,0);
    assert.equal(controller.getDraft(),draft);
    assert.ok(button(root,"Save Points"),"save remains available after locating the road");
  } finally {
    for(const [key,value] of Object.entries(previous)) {
      if(value===undefined)delete globalThis[key];
      else globalThis[key]=value;
    }
  }
});

test("Road Editor exposes only available reversible draft actions with accessible icons",async()=>{
  const previous={foundry:globalThis.foundry,document:globalThis.document,
    game:globalThis.game,window:globalThis.window};
  try{
    globalThis.foundry={applications:{api:{ApplicationV2:class {}}}};
    globalThis.document={createElement:tag=>new Element(tag)};
    globalThis.window={innerWidth:1200,innerHeight:850};
    globalThis.game={user:{isGM:true}};
    const {AtlasRoadEditorDock}=await import("../scripts/road-editor-dock.js");
    const scene={id:"reversible",canUserModify:()=>true};
    const calls=[];
    const controller={getDraft:()=>({mode:"points",points:4,dirty:true,
      canUndo:true,canRedo:true}),undo:()=>calls.push("undo"),redo:()=>calls.push("redo")};
    const dock=new AtlasRoadEditorDock({scene,controller,onFinish:async()=>false,
      onCancel(){},onClosed(){},onFocus(){}});
    dock.render=async()=>{};
    const root=await dock._renderHTML();
    assert.equal(root.children[0].className,"atlas-road-editor-body");
    assert.equal(root.children[1].className,"atlas-road-editor-footer");
    assert.ok(button(root,"Locate Road").className.includes("atlas-ui-icon-button"));
    assert.equal(button(root,"Save Points").textContent,"Save Points",
      "explicit text Save matches the Territory painter footer");
    assert.ok(button(root,"Undo").title==="Undo");
    assert.ok(button(root,"Redo").title==="Redo");
    assert.deepEqual(root.children[1].children.map(control=>control.ariaLabel??control.textContent),
      ["Locate Road","Undo","Redo","Cancel","Save Points"],
      "reversible controls precede Cancel, explicit Save last in keyboard order");
    await button(root,"Undo").listeners.get("click")();
    await button(root,"Redo").listeners.get("click")();
    assert.deepEqual(calls,["undo","redo"]);
  }finally{Object.assign(globalThis,previous);}
});

test("Map Marker relocation dock offers explicit Locate/Cancel, never an unconfirmed Save",async()=>{
  const prev={foundry:globalThis.foundry,document:globalThis.document,
    game:globalThis.game,window:globalThis.window};
  try{
    globalThis.foundry={applications:{api:{ApplicationV2:class {}}}};
    globalThis.document={createElement:tag=>new Element(tag)};
    globalThis.window={innerWidth:900,innerHeight:600};
    globalThis.game={user:{isGM:true}};
    const {AtlasRoadEditorDock}=await import("../scripts/road-editor-dock.js");
    const scene={id:"relocation",canUserModify:()=>true};
    let locates=0,cancels=0;
    const controller={getDraft:()=>({mode:"checkpoint-relocate",
      checkpointId:"marker-1",points:0})};
    const dock=new AtlasRoadEditorDock({scene,controller,onFinish:()=>{throw Error("unsafe");},
      onCancel:()=>cancels++,onClosed(){},onFocus:()=>locates++});
    dock.close=async()=>{dock.finished=true;};
    const root=await dock._renderHTML();
    assert.ok(descendants(root).some(item=>item.textContent==="Atlas · Move Map Marker"));
    assert.equal(root.attributes.get("aria-label"),"Atlas Map Marker canvas editor");
    assert.ok(descendants(root).some(item=>item.tag==="h3"&&
      item.textContent==="Atlas · Move Map Marker"));
    assert.ok(button(root,"Locate Map Marker"));
    assert.equal(button(root,"Save Points"),undefined);
    assert.equal(button(root,"Finish Road"),undefined);
    await button(root,"Locate Map Marker").listeners.get("click")();
    assert.equal(locates,1);
    await button(root,"Cancel").listeners.get("click")();
    assert.equal(cancels,1);
  }finally{Object.assign(globalThis,prev);}
});

test("Road Editor keycaps describe implemented gestures without changing drafts",async()=>{
  const before={foundry:globalThis.foundry,document:globalThis.document,
    game:globalThis.game,window:globalThis.window};
  try{
    globalThis.foundry={applications:{api:{ApplicationV2:class {}}}};
    globalThis.document={createElement:tag=>new Element(tag)};
    globalThis.window={innerWidth:1000,innerHeight:750};
    globalThis.game={user:{isGM:true}};
    const {AtlasRoadEditorDock}=await import("../scripts/road-editor-dock.js");
    const scene={id:"gesture-help",canUserModify:()=>true},calls=[];
    const controller={getDraft:()=>({mode:"points",points:5,dirty:true,
      canUndo:true,canRedo:true})};
    const dock=new AtlasRoadEditorDock({scene,controller,onFinish:()=>calls.push("save"),
      onCancel:()=>calls.push("cancel"),onClosed(){}});
    const root=await dock._renderHTML();
    const gestures=descendants(root).find(node=>node.className==="atlas-road-editor-gestures");
    assert.ok(gestures);
    assert.equal(gestures.children.length,9,
      "Paint Territory's map scroll and movable title shortcuts are available");
    assert.deepEqual(gestures.children.map(row=>row.children[0].tag),
      Array(9).fill("kbd"),"shortcut labels use native key styling");
    assert.ok(gestures.children.some(row=>row.children[0].textContent==="Ctrl/Cmd + Z"));
    assert.ok(gestures.children.some(row=>row.children[0].textContent==="Esc"));
    assert.ok(gestures.children.some(row=>row.children[1].textContent.includes(
      "unconnected Road end")));
    assert.ok(gestures.children.some(row=>row.children[0].textContent==="Scroll"));
    assert.ok(gestures.children.some(row=>row.children[0].textContent==="Arrow keys on title"));
    assert.deepEqual(calls,[],"rendering editor help never saves or cancels");
  }finally{Object.assign(globalThis,before);}
});

test("painter-style Road and isolated Map Marker canvases move by title only",async()=>{
  const original={foundry:globalThis.foundry,document:globalThis.document,
    game:globalThis.game,window:globalThis.window};
  const docHandlers=new Map();
  try{
    class App {
      constructor(options={}){
        this.options=options;
        this.position={left:24,top:90,width:360,...options.position};
        this.element={getBoundingClientRect:()=>({width:360,height:420})};
      }
      setPosition(next){Object.assign(this.position,next);}
    }
    globalThis.foundry={applications:{api:{ApplicationV2:App}}};
    globalThis.document={
      createElement:tag=>new Element(tag),
      addEventListener:(type,callback)=>docHandlers.set(type,callback),
      removeEventListener:(type,callback)=>{
        if(docHandlers.get(type)===callback)docHandlers.delete(type);
      }
    };
    globalThis.window={innerWidth:1100,innerHeight:850};
    globalThis.game={user:{isGM:true}};
    const {AtlasRoadEditorDock}=await import("../scripts/road-editor-dock.js");
    let saves=0,cancels=0;
    const scene={id:"painter",canUserModify:()=>true};
    for(const mode of ["points","checkpoint-relocate"]){
      const controller={getDraft:()=>({mode,points:11,
        roadName:"Coastal Road",checkpointId:"marker"})};
      const dock=new AtlasRoadEditorDock({scene,controller,
        onFinish:()=>{saves++;},onCancel:()=>{cancels++;},onClosed(){}});
      // The editor class was imported earlier by DOM tests with a minimal
      // ApplicationV2 mock; provide the public Foundry positioning API here.
      dock.position={left:24,top:90,width:360};
      dock.setPosition=next=>Object.assign(dock.position,next);
      dock.element={getBoundingClientRect:()=>({width:360,height:420})};
      const root=await dock._renderHTML();
      const heading=descendants(root).find(node=>node.tag==="h3");
      assert.ok(heading?.attributes.get("aria-label").includes("arrow keys"));
      assert.equal(root.tag,"section");
      assert.equal(root.attributes.get("role"),"region");
      assert.equal(root.children[0].className,"atlas-road-editor-body");
      heading.listeners.get("keydown")({key:"ArrowRight",shiftKey:false,
        preventDefault(){},stopPropagation(){}});
      assert.equal(dock.position.left,34);
      heading.listeners.get("pointerdown")({
        button:0,pointerId:8,clientX:100,clientY:100,
        preventDefault(){},stopPropagation(){}
      });
      assert.ok(docHandlers.has("pointermove"));
      docHandlers.get("pointermove")({pointerId:8,clientX:130,clientY:115,
        preventDefault(){},stopPropagation(){}});
      assert.equal(dock.position.left,64);
      assert.equal(dock.position.top,105);
      docHandlers.get("pointerup")({pointerId:8});
      assert.equal(docHandlers.size,0,"dragging listeners release after pointer up");
      assert.equal(dock._dockDrag,null);
      assert.equal(saves,0,"moving the editor cannot save the map");
      assert.equal(cancels,0,"moving the editor cannot cancel a draft");
      assert.equal(dock.finished,false);
      if(mode==="checkpoint-relocate"){
        assert.equal(button(root,"Save Points"),undefined);
        assert.equal(button(root,"Finish Road"),undefined);
      }else{
        assert.ok(button(root,"Save Points"));
        assert.ok(descendants(root).some(node=>node.textContent==="Road: Coastal Road"));
      }
      dock._onClose({});
      assert.equal(cancels,1+Number(mode==="checkpoint-relocate"),
        "native close cancels the active draft exactly once per window");
    }
  }finally{Object.assign(globalThis,original);}
});

test("painter-style canvas dock retains its theme and stable action footer at high scale",()=>{
  const css=readFileSync(new URL("../styles/road-settings-dialog.css",import.meta.url),"utf8");
  assert.match(css,/\.atlas-road-editor-dock\s*\{[\s\S]*?background:#111019;/);
  assert.match(css,/\.atlas-road-editor-shortcuts/);
  assert.match(css,/\.atlas-road-editor-heading:focus-visible/);
  assert.match(css,/max-height:calc\(100vh - 110px\)/);
  assert.match(css,/\.atlas-road-editor-footer/);
});
