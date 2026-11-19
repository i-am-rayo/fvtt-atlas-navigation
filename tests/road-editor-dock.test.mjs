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
    const root = await dock._renderHTML();
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
    assert.equal(AtlasRoadEditorDock.DEFAULT_OPTIONS.window.minimizable,true,
      "Foundry only offers native minimize/restore on minimizable windows");
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
    assert.ok(button(root,"Save Points").className.includes("atlas-ui-icon-button"));
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
    assert.ok(descendants(root).some(item=>item.textContent==="Move Map Marker"));
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
    assert.equal(gestures.children.length,7);
    assert.deepEqual(gestures.children.map(row=>row.children[0].tag),
      Array(7).fill("kbd"),"shortcut labels use native key styling");
    assert.ok(gestures.children.some(row=>row.children[0].textContent==="Ctrl/Cmd + Z"));
    assert.ok(gestures.children.some(row=>row.children[0].textContent==="Esc"));
    assert.ok(gestures.children.some(row=>row.children[1].textContent.includes(
      "unconnected Road end")));
    assert.deepEqual(calls,[],"rendering editor help never saves or cancels");
  }finally{Object.assign(globalThis,before);}
});
