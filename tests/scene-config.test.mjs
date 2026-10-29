import assert from "node:assert/strict";
import test from "node:test";
globalThis.foundry = { applications: { api: { ApplicationV2: class {} } } };
const { addAtlasRoadsToSceneConfig, registerAtlasSceneTab,
  filteredRoadIds } = await import("../scripts/scene-config.js");

class Element {
  constructor(tag) { this.tag = tag; this.attributes = new Map(); this.children = []; this.listeners = new Map(); this.style = {}; this.dataset = {}; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  append(...children) { for (const child of children) this.appendChild(child); }
  prepend(...children) {
    for (const child of children) child.parentNode = this;
    this.children.unshift(...children);
  }
  insertBefore(child, reference) {
    const index = this.children.indexOf(reference);
    child.parentNode = this;
    if (index < 0) this.children.push(child);
    else this.children.splice(index, 0, child);
    return child;
  }
  remove() {
    if (!this.parentNode) return;
    const siblings = this.parentNode.children;
    const index = siblings.indexOf(this);
    if (index >= 0) siblings.splice(index, 1);
    this.parentNode = null;
  }
  get lastElementChild() { return this.children.at(-1); }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
}

function buttons(root) {
  const result = [];
  const visit = n => { if (n.tag === "button") result.push(n); for (const child of n.children) visit(child); };
  visit(root);
  return result;
}

function textContents(root) {
  return [root.textContent ?? "", ...root.children.map(textContents)].join(" ");
}

test("registers one Atlas tab/part via v14 SceneConfig TABS/PARTS", () => {
  class SceneConfig {}
  SceneConfig.TABS = { sheet: { initial: "basics", tabs: [
    { id: "basics" }, { id: "grid" }, { id: "levels" }, { id: "misc" }
  ] } };
  SceneConfig.PARTS = {
    tabs: { template: "tabs" }, basics: { template: "basics" },
    grid: { template: "grid" }, levels: { template: "levels" },
    misc: { template: "misc" }, footer: { template: "footer" }
  };
  assert.equal(registerAtlasSceneTab(SceneConfig), true);
  assert.deepEqual(SceneConfig.TABS.sheet.tabs.map(t => t.id),
    ["basics", "grid", "levels", "atlas", "misc"]);
  assert.ok(SceneConfig.PARTS.atlas.template.endsWith("templates/scene-atlas-tab.hbs"));
  assert.equal(Object.keys(SceneConfig.PARTS).at(-1), "footer");
  assert.equal(registerAtlasSceneTab(SceneConfig), true);
  assert.equal(SceneConfig.TABS.sheet.tabs.filter(t => t.id === "atlas").length, 1);
  assert.equal(registerAtlasSceneTab(null), false);
});

test("Roads plus opens drawing against the configured Scene; no Configure dialog", async () => {
  const previous = { document: globalThis.document, game: globalThis.game, ui: globalThis.ui };
  let mounted = null;
  const nativeRoot = {
    querySelector: selector => selector === "[data-fvtt-atlas-setup]" ? mounted : null,
    appendChild(n) { mounted = n; n.remove = () => { mounted = null; }; }
  };
  const element = { matches: () => false, querySelector: selector =>
    selector === "[data-fvtt-atlas-scene-root]" ? nativeRoot : null };
  const scene = {
    id: "configured", grid: { size: 49, distance: 8, units: "km" },
    getFlag: () => null, canUserModify: () => true
  };
  let begun;
  const actions = {
    begin: (chosen, refresh) => { begun = { chosen, refresh }; },
    draft: () => null, finish() {}, cancel() {}, select() {}, rename() {}, remove() {}
  };
  try {
    globalThis.document = { createElement: tag => new Element(tag) };
    globalThis.game = { user: { isGM: true }, settings: { get: () => null }, i18n: { localize: k => k, lang: "en" } };
    globalThis.ui = { notifications: { error: m => { throw Error(m); } } };
    addAtlasRoadsToSceneConfig({ document: scene }, element, actions);
    assert.ok(mounted);
    assert.equal(mounted.attributes.has("data-fvtt-atlas-setup"), true);
    assert.ok(buttons(mounted).length >= 2,
      "empty Atlas controls were not rendered: " + textContents(mounted));
    const plus = buttons(mounted).find(item => item.textContent === "+");
    assert.ok(plus, "Roads has a creation control");
    assert.equal(plus.type, "button");
    await plus.listeners.get("click")({ preventDefault() {} });
    assert.equal(begun.chosen, scene);
    const old = mounted;
    begun.refresh();
    assert.notEqual(mounted, old, "refresh replaces the road panel");
    assert.doesNotMatch(textContents(mounted), /Configure Atlas|Use this Scene as an atlas/);

    globalThis.game.user.isGM = false;
    mounted = null;
    addAtlasRoadsToSceneConfig({ document: scene }, element, actions);
    assert.equal(mounted, null, "players cannot see authoring controls");
  } finally { Object.assign(globalThis, previous); }
});

test("a Scene with roads shows select, rename, delete without activation toggles", () => {
  const previous = { document: globalThis.document, game: globalThis.game };
  let mounted = null;
  const nativeRoot = {
    querySelector: () => null, appendChild: n => { mounted = n; }
  };
  const element = { querySelector: selector =>
    selector === "[data-fvtt-atlas-scene-root]" ? nativeRoot : null };
  const scene = {
    id: "filled", grid: { size: 100, distance: 5, units: "mi" },
    canUserModify: () => true,
    getFlag: (_scope, key) => key !== "atlas" ? null : ({
      schemaVersion: 1, revision: 2, enabled: false, calibration: null,
      nodes: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 100, y: 0 }],
      segments: [{ id: "r1", from: "a", to: "b", via: [], name: "North Road", bidirectional: true }]
    })
  };
  let selected;
  try {
    globalThis.document = { createElement: tag => new Element(tag) };
    globalThis.game = { user: { isGM: true }, settings: { get: () => null }, i18n: { localize: k => k, lang: "en" } };
    addAtlasRoadsToSceneConfig({ document: scene }, element, {
      begin() {}, draft: () => null, finish() {}, cancel() {},
      select: (scene, id) => { selected = id; }, rename() {}, remove() {}
    });
    assert.ok(buttons(mounted).some(b => b.textContent === "FVTTATLAS.Roads.Anchor"),
      "legacy v1 remains locked behind explicit anchoring");
    assert.match(buttons(mounted).find(b => b.textContent === "FVTTATLAS.Roads.Anchor").textContent,
      /FVTTATLAS.Roads.Anchor/);
    assert.equal(buttons(mounted).filter(b=>b.textContent==="+" && !b.disabled).length,0,
      "legacy v1 cannot add or change roads before anchoring");
    assert.match(textContents(mounted), /North Road/);
    assert.doesNotMatch(textContents(mounted), /Configure Atlas/);
    assert.equal(selected, undefined, "locked legacy roads do not expose edit shortcuts");
  } finally { Object.assign(globalThis, previous); }
});

test("custom Scene sheet gets an in-sheet Misc fallback", () => {
  const previous = { document: globalThis.document, game: globalThis.game };
  let mounted = null;
  const misc = { querySelector: () => null, appendChild: n => { mounted = n; } };
  const element = { matches: () => false, querySelector: selector =>
    selector === '[data-tab="misc"]' ? misc : null };
  const scene = { id: "fallback", grid: { size: 100, distance: 5, units: "ft" },
    getFlag: () => null, canUserModify: () => true };
  try {
    globalThis.document = { createElement: tag => new Element(tag) };
    globalThis.game = { user: { isGM: true }, settings: { get: () => null }, i18n: { localize: k => k, lang: "en" } };
    addAtlasRoadsToSceneConfig({ document: scene }, element, {
      begin() {}, draft: () => null, finish() {}, cancel() {}, select() {}, rename() {}, remove() {}
    });
    assert.ok(mounted);
  } finally { Object.assign(globalThis, previous); }
});

test("anchored v2 road list explicitly offers organization before new editing", () => {
  const previous = { document: globalThis.document, game: globalThis.game };
  let mounted = null;
  const nativeRoot = { querySelector: () => null, appendChild: n => { mounted = n; } };
  const element = { querySelector: selector =>
    selector === "[data-fvtt-atlas-scene-root]" ? nativeRoot : null };
  const scene = {
    id: "v2", grid: { size: 100, distance: 5, units: "km" },
    canUserModify: () => true,
    getFlag: (_scope, key) => key !== "atlas" ? null : ({
      schemaVersion: 2, coordinateSpace: "image", revision: 3,
      enabled: true, calibration: null,
      nodes: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 100, y: 0 }],
      segments: [{ id: "r", from: "a", to: "b", via: [], name: "South Road", bidirectional: true }]
    })
  };
  let organizeScene;
  try {
    globalThis.document = { createElement: tag => new Element(tag) };
    globalThis.game = { user: { isGM: true }, settings: { get: () => null }, i18n: { localize: k => k, lang: "en" } };
    addAtlasRoadsToSceneConfig({ document: scene }, element, {
      begin() {}, draft: () => null, finish() {}, cancel() {}, select() {}, rename() {}, remove() {},
      organize: chosen => { organizeScene = chosen; }
    });
    assert.ok(buttons(mounted).some(b => b.textContent === "FVTTATLAS.Roads.Organize"),
      "legacy v2 offers explicit organization before editing");
    assert.equal(buttons(mounted)[0].textContent, "FVTTATLAS.Roads.Organize");
    assert.ok(!buttons(mounted).some(b=>b.textContent==="+" && !b.disabled));
    buttons(mounted)[0].listeners.get("click")({ preventDefault() {} });
    assert.equal(organizeScene, scene);
  } finally { Object.assign(globalThis, previous); }
});

test("v3 named roads render once and expanded road tools target the selected road", async () => {
  const previous = { document: globalThis.document, game: globalThis.game };
  let mounted = null;
  const nativeRoot = { querySelector: () => null, appendChild: n => { mounted = n; } };
  const element = { querySelector: sel => sel === "[data-fvtt-atlas-scene-root]" ? nativeRoot : null };
  const scene = { id: "v3", grid: { size: 100, distance: 5, units: "km" },
    canUserModify: () => true, getFlag: (_scope, key) => key !== "atlas" ? null : ({
      schemaVersion: 3, coordinateSpace: "image", revision: 1, enabled: true,
      calibration: null,
      nodes: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 50, y: 0 },
        { id: "c", x: 100, y: 0 }, { id: "d", x: 50, y: 70 }],
      roads: [{ id: "old", name: "Main Road" }, { id: "new", name: "Spur" }],
      segments: [
        { id: "a1", roadId: "old", from: "a", to: "b", via: [], bidirectional: true },
        { id: "a2", roadId: "old", from: "b", to: "c", via: [], bidirectional: true },
        { id: "s1", roadId: "new", from: "b", to: "d", via: [], bidirectional: true }
      ]
    }) };
  const rows = () => {
    const result = [];
    const visit = n => { if (n.attributes?.has("data-atlas-road-id")) result.push(n);
      for (const child of n.children ?? []) visit(child); };
    visit(mounted); return result;
  };
  let editedId, mergedId, connectionScene;
  try {
    globalThis.document = { createElement: tag => new Element(tag) };
    globalThis.game = { user: { isGM: true }, settings: { get: () => null },
      i18n: { localize: k => k, lang: "en" } };
    addAtlasRoadsToSceneConfig({ document: scene }, element, {
      begin() {}, draft: () => null, select() {}, rename() {}, remove() {},
      beginPointEdit: (_scene, id) => { editedId = id; },
      merge: (_scene, road) => { mergedId = road.id; },
      beginJunction: selected => { connectionScene = selected; }
    });
    assert.deepEqual(rows().map(row => row.attributes.get("data-atlas-road-id")), ["old", "new"]);
    const primary = rows()[0];
    primary.open = true;
    primary.listeners.get("toggle")();
    const controls = buttons(primary);
    for (const label of ["Settings", "Edit path", "Add connection", "Merge", "Delete road"])
      assert.ok(controls.some(b => b.textContent === label), label + " is available when expanded");
    await controls.find(b => b.textContent === "Edit path").listeners.get("click")({ preventDefault() {} });
    await controls.find(b => b.textContent === "Merge").listeners.get("click")({ preventDefault() {} });
    await controls.find(b => b.textContent === "Add connection").listeners.get("click")({ preventDefault() {} });
    assert.deepEqual([editedId, mergedId], ["old", "old"]);
    assert.equal(connectionScene, scene);
    assert.equal(rows().length, 2, "opening tools does not duplicate road entries");
  } finally { Object.assign(globalThis, previous); }
});

test("connection picking and point edits stay in the road authoring controls", async () => {
  const previous = { document: globalThis.document, game: globalThis.game };
  let mounted = null;
  const nativeRoot = { querySelector: () => null, appendChild: n => { mounted = n; } };
  const element = { querySelector: sel => sel === "[data-fvtt-atlas-scene-root]" ? nativeRoot : null };
  const scene = { id: "connection-controls", grid: { size: 100, distance: 5, units: "km" },
    canUserModify: () => true, getFlag: (_scope, key) => key !== "atlas" ? null : ({
      schemaVersion: 3, coordinateSpace: "image", revision: 1, enabled: true,
      calibration: null, nodes: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 100, y: 0 }],
      roads: [{ id: "main", name: "Main" }],
      segments: [{ id: "s1", roadId: "main", from: "a", to: "b", via: [], bidirectional: true }]
    }) };
  const roadControls = () => mounted.children.find(child => child.tag === "fieldset" &&
    textContents(child).includes("FVTTATLAS.Roads.Title"));
  try {
    globalThis.document = { createElement: tag => new Element(tag) };
    globalThis.game = { user: { isGM: true }, i18n: { localize: k => k, lang: "en" } };
    let state = { mode: "junction", points: 0 };
    let canceled = 0, saved = 0, undone = 0;
    const actions = { begin() {}, draft: () => state, select() {}, rename() {}, remove() {},
      cancel: () => { canceled++; }, finish: () => { saved++; },
      undo: () => { undone++; } };
    addAtlasRoadsToSceneConfig({ document: scene }, element, actions);
    assert.ok(buttons(roadControls()).some(b => b.textContent === "Cancel"),
      "connection cancellation belongs in the Roads panel");
    state = { mode: "points", source: "junction", dirty: true, canUndo: true };
    addAtlasRoadsToSceneConfig({ document: scene }, element, actions);
    const controls = buttons(roadControls());
    for (const name of ["Save", "Undo", "Cancel"]) {
      const action = controls.find(b => b.textContent === name);
      assert.ok(action, name + " is available during connection-point editing");
      await action.listeners.get("click")({ preventDefault() {} });
    }
    assert.deepEqual([saved, undone, canceled], [1, 1, 1]);
  } finally { Object.assign(globalThis, previous); }
});

test("Junctions list excludes plain subdivisions, supports one-hop filters and caps long results", () => {
 const previous={document:globalThis.document,game:globalThis.game};
 let mounted=null;
 const nativeRoot={querySelector:()=>null,appendChild:n=>{mounted=n;}};
 const element={querySelector:sel=>sel==='[data-fvtt-atlas-scene-root]'?nativeRoot:null};
 const nodes=Array.from({length:32},(_,i)=>({id:"n"+i,x:i*20,y:0}));
 const branches=Array.from({length:30},(_,i)=>({id:"b"+i,x:(i+1)*20,y:40}));
 const segments=Array.from({length:31},(_,i)=>({
   id:"seg"+i,roadId:"road",from:"n"+i,to:"n"+(i+1),
   via:[],bidirectional:true
 }));
 segments.push(...branches.map((node,i)=>({
   id:"spur"+i,roadId:"road",from:"n"+(i+1),to:node.id,
   via:[],bidirectional:true
 })));
 const scene={id:"big-junctions",grid:{size:100,distance:5,units:"mi"},
   canUserModify:()=>true,getFlag:(_scope,key)=>key!=="atlas"?null:({
     schemaVersion:3,coordinateSpace:"image",revision:1,enabled:true,calibration:null,
     roads:[{id:"road",name:"Long Road"}],
     nodes:[...nodes,...branches,{id:"unused",x:1000,y:1000}],segments
   })};
 try {
  globalThis.document={createElement:tag=>new Element(tag)};
  globalThis.game={user:{isGM:true},i18n:{localize:k=>k,lang:"en"}};
  addAtlasRoadsToSceneConfig({document:scene},element,{
   begin(){},draft:()=>null,select(){},rename(){},remove(){},selectJunction(){}
  });
  const rows=[];
  const scan=v=>{if(v.attributes?.has("data-atlas-junction-id"))rows.push(v);
    v.children?.forEach(scan);};
  scan(mounted);
  assert.equal(rows.length,0,"old internal junction ID list is no longer exposed");
  assert.match(textContents(mounted),/Long Road/);
  assert.doesNotMatch(textContents(mounted),/FVTTATLAS.Junctions.Recent/);
 } finally {Object.assign(globalThis,previous);}
});

test("junction filters default to one road, include direct neighbors and can show Scene-wide", () => {
 const previous={document:globalThis.document,game:globalThis.game};
 let mounted=null;
 const nativeRoot={querySelector:()=>null,appendChild:n=>{
   mounted=n;n.remove=()=>{mounted=null;};}};
 const element={querySelector:sel=>sel==='[data-fvtt-atlas-scene-root]'?nativeRoot:null};
 const graph={
  schemaVersion:3,coordinateSpace:"image",revision:1,enabled:true,calibration:null,
  roads:[{id:"main",name:"Main"},{id:"spur",name:"Spur"},{id:"other",name:"Other"},
    {id:"remote",name:"Remote"}],
  nodes:[{id:"a",x:0,y:0},{id:"b",x:50,y:0},{id:"c",x:100,y:0},
    {id:"d",x:50,y:60},{id:"e",x:100,y:60},
    {id:"r1",x:200,y:0},{id:"r2",x:230,y:0},
    {id:"r3",x:260,y:0},{id:"r4",x:230,y:40}],
  segments:[
    ["m1","main","a","b"],["m2","main","b","c"],
    ["s","spur","b","d"],["o","other","d","e"],
    ["r1s","remote","r1","r2"],["r2s","remote","r2","r3"],
    ["r3s","remote","r2","r4"]
  ].map(([id,roadId,from,to])=>({id,roadId,from,to,via:[],bidirectional:true}))
 };
 const scene={id:"filter-scene",grid:{size:100,distance:5,units:"mi"},
   canUserModify:()=>true,getFlag:(_scope,key)=>key!=="atlas"?null:graph};
 const rows=()=>{const result=[];const scan=n=>{if(n.attributes?.has("data-atlas-junction-id"))
   result.push(n.attributes.get("data-atlas-junction-id"));n.children?.forEach(scan);};
   scan(mounted);return result;};
 const selects=()=>{const list=[];const scan=n=>{if(n.tag==="select")list.push(n);
   n.children?.forEach(scan);};scan(mounted);return list;};
 try {
   globalThis.document={createElement:tag=>new Element(tag)};
   globalThis.game={user:{isGM:true},i18n:{localize:k=>k,lang:"en"}};
   const actions={begin(){},draft:()=>null,select(){},rename(){},remove(){}};
   addAtlasRoadsToSceneConfig({document:scene,rendered:true},element,actions);
   assert.deepEqual(rows(),["b"],"by default only the selected first road");
   let controls=selects();assert.ok(controls.length>=2);
   controls[1].value="connected";controls[1].listeners.get("change")();
   assert.deepEqual(rows(),["d","b"],"one-hop branches included, remote omitted");
   controls=selects();controls[1].value="scene";controls[1].listeners.get("change")();
   assert.deepEqual(rows(),["r2","d","b"]);
   controls=selects();controls[0].value="remote";controls[0].listeners.get("change")();
   controls=selects();controls[1].value="selected";controls[1].listeners.get("change")();
   assert.deepEqual(rows(),["r2"],"road selection persists across refreshes");
 } finally {Object.assign(globalThis,previous);}
});

test("v0.2.18 downstream filters share selected, direct-neighbor and scene-wide road scope",()=>{
 const atlas={
   roads:[{id:"main"},{id:"spur"},{id:"other"},{id:"remote"}],
   segments:[
     {roadId:"main",from:"a",to:"b"},
     {roadId:"spur",from:"b",to:"c"},
     {roadId:"other",from:"c",to:"d"},
     {roadId:"remote",from:"x",to:"y"}
   ]
 };
 assert.deepEqual([...filteredRoadIds(atlas,{roadId:"main",scope:"selected"})],["main"]);
 assert.deepEqual([...filteredRoadIds(atlas,{roadId:"main",scope:"connected"})],
   ["main","spur"]);
 assert.deepEqual([...filteredRoadIds(atlas,{roadId:"main",scope:"scene"})],
   ["main","spur","other","remote"]);
 assert.deepEqual([...filteredRoadIds(atlas,{roadId:"deleted",scope:"selected"})],[]);
});

test("v0.2.18.1 corridor native-cost checkbox re-renders Atlas without perMode scope error",()=>{
 const saved={document:globalThis.document,game:globalThis.game,
   CONFIG:globalThis.CONFIG,ui:globalThis.ui};
 class NativeModel {
   static schema={fields:{difficulties:{}}};
   constructor(data){this.data=data;}
   validate(){return true;}
   toObject(){return structuredClone(this.data);}
 }
 const preset={
   id:"land-stone",mode:"land",name:"Stone Road",color:"#9CA3AF",
   movementCostMultiplier:1,movementCosts:{walk:1.5}
 };
 const world={schemaVersion:3,presets:[preset]};
 const atlas={
   schemaVersion:5,coordinateSpace:"image",revision:1,enabled:true,calibration:null,
   roads:[{id:"bridge",name:"Stone Bridge",travelPresetId:"land-stone"}],
   nodes:[{id:"n1",x:0,y:0},{id:"n2",x:100,y:0}],
   segments:[{id:"edge",roadId:"bridge",from:"n1",to:"n2",
     via:[],bidirectional:true}],
   checkpoints:[
     {id:"c1",roadId:"bridge",nodeId:"n1",name:"East",elevationMeters:0},
     {id:"c2",roadId:"bridge",nodeId:"n2",name:"West",elevationMeters:5}
   ]
 };
 const scene={id:"opt-in-scene",grid:{size:100,distance:5,units:"ft"},
   regions:new Map(),canUserModify:()=>true,getFlag:(_scope,key)=>key!=="atlas"?null:atlas};
 let mounted=null;
 const nativeRoot={querySelector:()=>null,appendChild:element=>{
   mounted=element;element.remove=()=>{mounted=null;};
 }};
 const element={querySelector:selector=>
   selector==="[data-fvtt-atlas-scene-root]"?nativeRoot:null};
 const visit=(root,predicate)=>{
   if(predicate(root))return root;
   for(const child of root.children??[]){
     const match=visit(child,predicate);
     if(match)return match;
   }
   return null;
 };
 try {
   globalThis.document={createElement:tag=>new Element(tag)};
   globalThis.game={user:{isGM:true},
     settings:{get:(_scope,key)=>key==="corridorTravelPresets"?world:undefined},
     i18n:{localize:k=>k,lang:"en"}};
   globalThis.CONFIG={
     RegionBehavior:{dataModels:{modifyMovementCost:NativeModel}},
     Token:{movement:{actions:{walk:{label:"Walk"}}}}
   };
   globalThis.ui={notifications:{error:message=>{throw Error(message);}}};
   const actions={draft:()=>null,begin(){},select(){},rename(){},remove(){},
     generateRegion(){}};
   addAtlasRoadsToSceneConfig({document:scene,rendered:true},element,actions);
   assert.ok(mounted);
   const kind=visit(mounted,entry=>entry.tag==="select"&&entry.value==="checkpoint");
   assert.ok(kind,"generated Regions begin as checkpoints");
   kind.value="corridor";
   kind.listeners.get("change")();
   const checkbox=visit(mounted,entry=>entry.tag==="input"&&entry.type==="checkbox"&&entry.listeners.has("change"));
   assert.ok(checkbox&&!checkbox.disabled);
   checkbox.checked=true;
   checkbox.listeners.get("change")();
   assert.ok(mounted,"the Atlas settings panel should survive opt-in");
   assert.doesNotMatch(textContents(mounted),/perMode is not defined/);
   assert.match(textContents(mounted),/One native Behavior with selected movement modes/);
   const preview=visit(mounted,entry=>entry.tag==="button"&&
     entry.textContent==="FVTTATLAS.Generated.Preview");
   assert.ok(preview);
   assert.equal(preview.disabled,false);
 } finally {
   for(const [key,value] of Object.entries(saved))globalThis[key]=value;
 }
});


test("v0.2.19 duplicate corridor points to existing surface controls and enables native refresh",async()=>{
  const saved={document:globalThis.document,game:globalThis.game,
    CONFIG:globalThis.CONFIG,ui:globalThis.ui};
  class NativeModel {
    static schema={fields:{difficulties:{}}};
    constructor(source){this.data=source;}
    validate(){return true;}
    toObject(){return structuredClone(this.data);}
  }
  const preset={id:"land-stone",mode:"land",name:"Stone Road",color:"#9CA3AF",
    movementCostMultiplier:1,movementCosts:{walk:0.75}};
  const atlas={
    schemaVersion:5,coordinateSpace:"image",revision:1,enabled:true,calibration:null,
    roads:[{id:"bridge",name:"Bridge",travelPresetId:"land-stone"}],
    nodes:[{id:"n1",x:0,y:0},{id:"n2",x:100,y:0}],
    segments:[{id:"edge",roadId:"bridge",from:"n1",to:"n2",
      via:[],bidirectional:true}],
    checkpoints:[{id:"c1",roadId:"bridge",nodeId:"n1",name:"East",elevationMeters:0},
      {id:"c2",roadId:"bridge",nodeId:"n2",name:"West",elevationMeters:5}]
  };
  const cost={id:"cost1",type:"modifyMovementCost",name:"Atlas · Stone",
    system:{difficulties:{walk:0.75}},disabled:false,
    flags:{"fvtt-atlas-navigation":{nativeMovementCost:{schemaVersion:2,
      presetId:"land-stone",movementCosts:{walk:0.75}}}}};
  const region={id:"native",name:"Bridge corridor",color:"#9CA3AF",
    shapes:[],behaviors:[cost],
    flags:{"fvtt-atlas-navigation":{atlas:{schemaVersion:1,linked:true},
      travelPreset:{schemaVersion:1,presetId:"land-stone"},
      generatedRegion:{schemaVersion:1,kind:"corridor",roadId:"bridge",
        checkpointIds:["c1","c2"],widthCells:0.5,gridSize:100,
        shapeSignature:"00000000"}}},
    getFlag(scope,key){return this.flags[scope]?.[key];}};
  const scene={id:"update-surface-scene",grid:{size:100,distance:5,units:"ft"},
    regions:new Map([[region.id,region]]),canUserModify:()=>true,getFlag:(_scope,key)=>key!=="atlas"?null:atlas};
  let mounted=null, updatedId=null;
  const nativeRoot={querySelector:()=>null,appendChild:element=>{
    mounted=element;element.remove=()=>{mounted=null;};
  }};
  const element={querySelector:selector=>
    selector==="[data-fvtt-atlas-scene-root]"?nativeRoot:null};
  const visit=(root,predicate)=>{
    if(predicate(root))return root;
    for(const child of root.children??[]){
      const result=visit(child,predicate);
      if(result)return result;
    }
    return null;
  };
  try {
    globalThis.document={createElement:tag=>new Element(tag)};
    globalThis.game={user:{isGM:true},
      settings:{get:(_scope,key)=>key==="corridorTravelPresets"
        ? {schemaVersion:3,presets:[preset]} : undefined},
      i18n:{localize:key=>key,lang:"en"}};
    globalThis.CONFIG={
      RegionBehavior:{dataModels:{modifyMovementCost:NativeModel}},
      Token:{movement:{actions:{walk:{label:"Walk"}}}}
    };
    globalThis.ui={notifications:{error:message=>{throw Error(message);}}};
    const actions={draft:()=>null,begin(){},select(){},rename(){},remove(){},
      generateRegion(){},updateGeneratedRegionCost(_scene,entry){updatedId=entry.id;}};
    addAtlasRoadsToSceneConfig({document:scene,rendered:true},element,actions);
    assert.match(textContents(mounted),/Atlas road overlay/);
    assert.match(textContents(mounted),/REGION SETTINGS/);
    assert.ok(visit(mounted,e=>e.tag==="button"&&
      e.title?.startsWith("ROAD OVERLAY")),
    "Road style button clearly describes display-only styling");
    assert.ok(visit(mounted,e=>e.tag==="button"&&
      e.title?.startsWith("NATIVE REGION COLOR")),
    "generated native Region coloring has an explicitly distinct action");
    const kind=visit(mounted,e=>e.tag==="select"&&e.value==="checkpoint");
    kind.value="corridor";kind.listeners.get("change")();
    assert.match(textContents(mounted),/Already generated.*Keep this native Region/);
    const preview=visit(mounted,e=>e.tag==="button"&&
      e.textContent==="FVTTATLAS.Generated.Preview");
    assert.equal(preview.disabled,true,"duplicate creation is blocked before preview");
    const refresh=visit(mounted,e=>e.tag==="button"&&
      e.title==="Refresh this corridor's Atlas-managed native movement costs (confirmation)");
    assert.ok(refresh,"existing corridor has in-place refresh control");
    assert.equal(refresh.disabled,false);
    await refresh.listeners.get("click")({preventDefault(){}});
    assert.equal(updatedId,"native");
  } finally {
    for(const [key,value] of Object.entries(saved))globalThis[key]=value;
  }
});

test("Atlas exploration panel exposes persistent manual painting controls", async () => {
  const previous = { document: globalThis.document, game: globalThis.game,
    ui: globalThis.ui };
  let mounted = null;
  const nativeRoot = { querySelector: () => null, appendChild: n => { mounted = n; } };
  const element = { querySelector: selector =>
    selector === "[data-fvtt-atlas-scene-root]" ? nativeRoot : null };
  const scene = {
    id: "manual-exploration", grid: { size: 100, distance: 7.5, units: "km" },
    canUserModify: () => true, getFlag: () => null
  };
  let opened = 0;
  try {
    globalThis.document = { createElement: tag => new Element(tag) };
    globalThis.game = { user: { isGM: true },
      settings: { get: () => null }, i18n: { localize: k => k, lang: "en" } };
    globalThis.ui = { notifications: { error: message => { throw Error(message); } } };
    addAtlasRoadsToSceneConfig({ document: scene }, element, {
      draft: () => null, begin() {}, select() {}, rename() {}, remove() {},
      openManualBrushPalette() { opened++; }
    });
    assert.match(textContents(mounted), /Manual exploration/);
    const paint = buttons(mounted).find(b => b.textContent === "Paint map");
    assert.ok(paint, "brush controls are reachable from Scene Atlas");
    await paint.listeners.get("click")({ preventDefault() {} });
    assert.equal(opened, 1);
  } finally { Object.assign(globalThis, previous); }
});
