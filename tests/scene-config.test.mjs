import assert from "node:assert/strict";
import test from "node:test";
globalThis.foundry = { applications: { api: { ApplicationV2: class {} } } };
const { addAtlasRoadsToSceneConfig, registerAtlasSceneTab,
  filteredRoadIds, openAtlasRegionGenerator, createAtlasRoadsPanel,
  createAtlasTopologyPanel,createAtlasTerritoryPanel } =
  await import("../scripts/scene-config.js");

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
    const plus = buttons(mounted).find(item => item.title === "FVTTATLAS.Roads.Add");
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

test("Scene Atlas retains existing editors without a duplicate Workspace launcher", () => {
  const prior = { document: globalThis.document, game: globalThis.game, ui: globalThis.ui };
  let mounted;
  const scene = { id: "launcher-scene", grid: { size: 100, distance: 5, units: "km" },
    getFlag: () => null, canUserModify: () => true };
  const root = { querySelector: () => null, appendChild: child => { mounted = child; } };
  const element = { querySelector: selector =>
    selector === "[data-fvtt-atlas-scene-root]" ? root : null };
  try {
    globalThis.document = { createElement: tag => new Element(tag) };
    globalThis.game = { user: { isGM: true }, settings: { get: () => null },
      i18n: { localize: key => key, lang: "en" } };
    globalThis.ui = { notifications: { error: message => { throw Error(message); } } };
    const actions = { begin() {}, draft: () => null,
      openAtlasWorkspace: () => { throw Error("Workspace should launch from Atlas canvas controls"); } };
    addAtlasRoadsToSceneConfig({ document: scene }, element, actions);
    const launch = buttons(mounted).find(item => item.textContent === "Open Atlas Scene Workspace");
    assert.equal(launch, undefined, "Workspace opens only from the GM Atlas canvas toolbar");
    assert.match(textContents(mounted), /FVTTATLAS.Roads.Title/);
    globalThis.game.user.isGM = false;
    mounted = null;
    addAtlasRoadsToSceneConfig({ document: scene }, element, actions);
    assert.equal(mounted, null, "no player authoring launcher");
  } finally { Object.assign(globalThis, prior); }
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
    assert.equal(buttons(mounted).filter(b=>b.title==="FVTTATLAS.Roads.Add" && !b.disabled).length,0,
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
    assert.ok(!buttons(mounted).some(b=>b.title==="FVTTATLAS.Roads.Add" && !b.disabled));
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
    for (const title of ["Road settings", "Edit road", "Add connection",
      "Merge connected roads", "Delete road"])
      assert.ok(controls.some(b => b.title === title), title + " is available when expanded");
    await controls.find(b => b.title === "Edit road").listeners.get("click")({ preventDefault() {} });
    await controls.find(b => b.title === "Merge connected roads").listeners.get("click")({ preventDefault() {} });
    await controls.find(b => b.title === "Add connection").listeners.get("click")({ preventDefault() {} });
    assert.deepEqual([editedId, mergedId], ["old", "old"]);
    assert.equal(connectionScene, scene);
    assert.equal(rows().length, 2, "opening tools does not duplicate road entries");
  } finally { Object.assign(globalThis, previous); }
});

test("focused Workspace Roads panel shares real road commands without building unrelated panels", async () => {
  const previous = { document: globalThis.document, game: globalThis.game, ui: globalThis.ui };
  const scene = { id: "workspace-roads", grid: { size: 100, distance: 5, units: "km" },
    canUserModify: () => true, getFlag: (_scope, key) => key !== "atlas" ? null : ({
      schemaVersion: 3, coordinateSpace: "image", revision: 1, enabled: true,
      calibration: null,
      nodes: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 100, y: 0 }],
      roads: [{ id: "main", name: "River Road" }],
      segments: [{ id: "s", roadId: "main", from: "a", to: "b", via: [], bidirectional: true }]
    }) };
  let began, edited, linked;
  const actions = { draft: () => null, begin: chosen => { began = chosen; },
    beginPointEdit: (_scene, id) => { edited = id; },
    beginJunction: chosen => { linked = chosen; } };
  try {
    globalThis.document = { createElement: tag => new Element(tag) };
    globalThis.game = { user: { isGM: true }, settings: { get: () => null },
      i18n: { localize: key => key, lang: "en" } };
    globalThis.ui = { notifications: { error: message => { throw Error(message); } } };
    const panel = createAtlasRoadsPanel(scene, actions, () => {});
    assert.match(textContents(panel), /River Road/);
    assert.doesNotMatch(textContents(panel), /Manual exploration|Territories & custom native Regions/);
    assert.equal(buttons(panel).filter(item => item.textContent === "+").length, 1);
    const add = buttons(panel).find(item => item.textContent === "+");
    await add.listeners.get("click")({ preventDefault() {} });
    assert.equal(began, scene);
    const road = (function find(root) {
      if (root.attributes?.get("data-atlas-road-id") === "main") return root;
      for (const child of root.children ?? []) { const hit = find(child); if (hit) return hit; }
      return null;
    })(panel);
    assert.ok(road);
    road.open = true;
    road.listeners.get("toggle")();
    const controls = buttons(road);
    for (const title of ["Road settings", "Edit road", "Add connection", "Delete road"])
      assert.ok(controls.some(item => item.title === title));
    await controls.find(item => item.title === "Edit road")
      .listeners.get("click")({ preventDefault() {} });
    await controls.find(item => item.title === "Add connection")
      .listeners.get("click")({ preventDefault() {} });
    assert.equal(edited, "main");
    assert.equal(linked, scene);
    globalThis.game.user.isGM = false;
    assert.throws(() => createAtlasRoadsPanel(scene, actions, () => {}),
      /Only a Scene-authorized GM/);
  } finally { Object.assign(globalThis, previous); }
});

test("standalone Topology panel reads native Levels without writing them", () => {
  const previous = { document: globalThis.document, game: globalThis.game };
  try {
    globalThis.document = { createElement: tag => new Element(tag),
      createTextNode: text => ({ textContent: text, children: [] }) };
    globalThis.game = { user: { isGM: true }, settings: { get: () => true } };
    let writes = 0;
    const scene = { id: "native-topology", levels: { contents: [] },
      canUserModify: () => true, getFlag: () => false,
      setFlag: () => { writes++; } };
    const panel = createAtlasTopologyPanel(scene, () => {});
    assert.match(textContents(panel), /Native Scene Levels/);
    assert.equal(writes, 0, "rendering does not opt in to native Level writes");
    globalThis.game.user.isGM = false;
    assert.throws(() => createAtlasTopologyPanel(scene, () => {}), /Scene-authorized GM/);
  } finally { Object.assign(globalThis, previous); }
});

test("Workspace Roads shows a geographic multi-territory directory, not the flat Road picker", async()=>{
  const previous={document:globalThis.document,game:globalThis.game,canvas:globalThis.canvas};
  try {
    globalThis.document={createElement:tag=>new Element(tag)};
    globalThis.game={user:{isGM:true},settings:{get:()=>null},
      i18n:{localize:key=>key,lang:"en"}};
    const atlas={schemaVersion:3,coordinateSpace:"image",revision:1,enabled:true,
      calibration:null,nodes:[{id:"a",x:0,y:10},{id:"b",x:100,y:10},
        {id:"c",x:0,y:200},{id:"d",x:100,y:200}],
      roads:[{id:"bridge",name:"Millstone-Dirwest Road"},
        {id:"ocean",name:"Nix Ocean Route"}],
      segments:[{id:"bridge-segment",roadId:"bridge",from:"a",to:"b",via:[],bidirectional:true},
        {id:"ocean-segment",roadId:"ocean",from:"c",to:"d",via:[],bidirectional:true}]};
    const geographic=(id,name,kind,parentRegionId,points)=>({id,name,
      shapes:[{type:"polygon",points}],behaviors:[],hidden:false,
      getFlag:(_scope,key)=>key==="atlas"?{schemaVersion:1,linked:true}:
        key==="territoryGeography"?{schemaVersion:1,kind,parentRegionId,roadOverrides:{}}:null});
    const regions=[geographic("valecor","Valecor","continent",null,
      [0,0,150,0,150,100,0,100]),
    geographic("dirwest","Dirwest","city","valecor",[60,0,120,0,120,50,60,50]),
    geographic("millstone","Millstone","city","valecor",[0,0,40,0,40,50,0,50])];
    const scene={id:"geographic-roads",regions,
      canUserModify:()=>true,getFlag:(_scope,key)=>key==="atlas"?atlas:null};
    globalThis.canvas={scene,ready:true,dimensions:{sceneX:0,sceneY:0,size:100}};
    const actions={draft:()=>null,begin() {}};
    let panel;
    const refresh=()=>{panel=createAtlasRoadsPanel(scene,actions,refresh);};
    refresh();
    assert.match(textContents(panel),/Valecor · Continent/);
    assert.match(textContents(panel),/Dirwest · City/);
    assert.doesNotMatch(textContents(panel),/Show road/);
    const rowIds=()=>{
      const found=[];
      const scan=entry=>{if(entry.attributes?.has("data-atlas-road-id"))
        found.push(entry.attributes.get("data-atlas-road-id"));
        for(const child of entry.children??[])scan(child);};
      scan(panel);return found;
    };
    assert.deepEqual(rowIds(),["bridge","ocean"]);
    const choose=caption=>buttons(panel).find(item=>item.textContent?.startsWith(caption));
    await choose("Dirwest · City").listeners.get("click")({preventDefault(){}});
    assert.deepEqual(rowIds(),["bridge"]);
    await choose("Millstone · City").listeners.get("click")({preventDefault(){}});
    assert.deepEqual(rowIds(),["bridge"],"same Road belongs to both City directories");
    await choose("Unclassified").listeners.get("click")({preventDefault(){}});
    assert.deepEqual(rowIds(),["ocean"]);
    await choose("All Roads").listeners.get("click")({preventDefault(){}});
    assert.deepEqual(rowIds(),["bridge","ocean"]);
  } finally {Object.assign(globalThis,previous);}
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

test("the named-road picker filters and restores all roads", () => {
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
 const rows=()=>{const result=[];const scan=n=>{if(n.attributes?.has("data-atlas-road-id"))
   result.push(n.attributes.get("data-atlas-road-id"));n.children?.forEach(scan);};
   scan(mounted);return result;};
 const selects=()=>{const list=[];const scan=n=>{if(n.tag==="select")list.push(n);
   n.children?.forEach(scan);};scan(mounted);return list;};
 try {
   globalThis.document={createElement:tag=>new Element(tag)};
   globalThis.game={user:{isGM:true},i18n:{localize:k=>k,lang:"en"}};
   const actions={begin(){},draft:()=>null,select(){},rename(){},remove(){}};
   addAtlasRoadsToSceneConfig({document:scene,rendered:true},element,actions);
   assert.deepEqual(rows(),["main","spur","other","remote"],
     "all named roads are initially visible");
   let controls=selects();assert.ok(controls.length>=1);
   controls[0].value="remote";controls[0].listeners.get("change")();
   assert.deepEqual(rows(),["remote"],"selection filters named roads");
   controls=selects();controls[0].value="";controls[0].listeners.get("change")();
   assert.deepEqual(rows(),["main","spur","other","remote"],
     "All roads restores the list");
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

test("native Region creation is offered from a road without legacy inline cost controls",()=>{
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
   const road=visit(mounted,e=>e.attributes?.get("data-atlas-road-id")==="bridge");
    assert.ok(road,"the configured road is listed");
    road.open=true;road.listeners.get("toggle")();
   assert.ok(visit(road,e=>e.tag==="button"&&e.title==="Road settings"),
      "current road settings remain available");
   assert.ok(visit(road,e=>e.tag==="button"&&e.title==="Add Terrain Region"),
      "native Region generation is reached from the road, not an embedded Scene form");
    assert.doesNotMatch(textContents(mounted),/perMode is not defined/);
  } finally {
   for(const [key,value] of Object.entries(saved))globalThis[key]=value;
 }
});

test("Region generator submits the displayed corridor half-width without a stale width reference",async()=>{
  const saved={document:globalThis.document,game:globalThis.game,
    CONFIG:globalThis.CONFIG,ui:globalThis.ui,window:globalThis.window};
  const base=globalThis.foundry.applications.api.ApplicationV2.prototype;
  const previousRender=base.render;
  let generator=null;
  const errors=[];
  const submissions=[];
  const atlas={schemaVersion:4,coordinateSpace:"image",revision:1,enabled:true,
    calibration:null,
    roads:[{id:"road",name:"Sea Route"}],
    nodes:[{id:"a",x:0,y:0},{id:"b",x:100,y:0}],
    segments:[{id:"segment",roadId:"road",from:"a",to:"b",via:[],bidirectional:true}],
    checkpoints:[
      {id:"start",roadId:"road",nodeId:"a",name:"Deep Sea",elevationMeters:null},
      {id:"end",roadId:"road",nodeId:"b",name:"Deep sea",elevationMeters:null}
    ]};
  const scene={id:"width-regression",grid:{size:100,distance:5,units:"mi"},
    regions:{contents:[],values:()=>[].values(),[Symbol.iterator]:function*(){}},
    getFlag:(_scope,key)=>key==="atlas"?atlas:null};
  const visit=(root,predicate)=>{
    if(predicate(root))return root;
    for(const child of root.children??[]){const found=visit(child,predicate);if(found)return found;}
    return null;
  };
  try{
    base.render=function(){generator=this;return this;};
    globalThis.document={createElement:tag=>new Element(tag)};
    globalThis.window={innerWidth:1280,innerHeight:900};
    globalThis.game={user:{isGM:true},users:[],
      settings:{get:()=>null},i18n:{localize:key=>key,lang:"en"}};
    globalThis.CONFIG={};
    globalThis.ui={notifications:{error:message=>errors.push(message)}};
    openAtlasRegionGenerator(scene,"road",{draft:()=>null,generateRegion:(_scene,settings)=>{
      submissions.push(settings);
    }},()=>{});
    assert.ok(generator,"native Region generator window opened");
    let body=await generator._renderHTML();
    const shape=visit(body,e=>e.tag==="select"&&e.children?.some(option=>
      option.value==="corridor"));
    assert.ok(shape,"the native Region shape selector is rendered");
    shape.value="corridor";
    shape.listeners.get("change")();
    body=await generator._renderHTML();
    const slider=visit(body,e=>e.tag==="input"&&e.type==="range"&&
      e.attributes?.get("aria-label")?.includes("Distance on either side"));
    assert.ok(slider,"corridor half-width slider is rendered");
    slider.value="0.75";
    slider.listeners.get("input")();
    const preview=visit(body,e=>e.tag==="button"&&e.textContent==="Preview & Confirm");
    assert.ok(preview&&!preview.disabled,"Region preview is available");
    await preview.listeners.get("click")({preventDefault(){}});
    assert.deepEqual(errors,[],"no JavaScript reference error is shown");
    assert.equal(submissions.length,1,"the draft is passed to the existing preview handler");
    assert.equal(submissions[0].widthCells,.75,"the submitted value matches the visible slider");
    assert.equal(submissions[0].kind,"corridor");
    assert.equal(submissions[0].checkpointId,"start");
    assert.equal(submissions[0].endCheckpointId,"end");
    // The same slider controls a single-checkpoint radius and must not
    // regress when the GM switches back from a corridor.
    const areaShape=visit(body,e=>e.tag==="select"&&e.children?.some(option=>
      option.value==="checkpoint"));
    areaShape.value="checkpoint";
    areaShape.listeners.get("change")();
    body=await generator._renderHTML();
    const radius=visit(body,e=>e.tag==="input"&&e.type==="range"&&
      e.attributes?.get("aria-label")?.includes("Radius around checkpoint"));
    assert.ok(radius);
    radius.value="0.5";
    radius.listeners.get("input")();
    await visit(body,e=>e.tag==="button"&&e.textContent==="Preview & Confirm")
      .listeners.get("click")({preventDefault(){}});
    assert.deepEqual(errors,[]);
    assert.equal(submissions.length,2);
    assert.equal(submissions[1].kind,"checkpoint");
    assert.equal(submissions[1].widthCells,.5);
    assert.equal(submissions[1].endCheckpointId,null);
    assert.equal(Object.hasOwn(scene,"setFlag"),false,"the preview does not write Scene data");
  }finally{
    base.render=previousRender;
    for(const [key,value] of Object.entries(saved))globalThis[key]=value;
  }
});


test("native Region generation stays separate from Atlas line styling",async()=>{
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
    const road=visit(mounted,e=>e.attributes?.get("data-atlas-road-id")==="bridge");
    assert.ok(road);
    road.open=true;road.listeners.get("toggle")();
    assert.ok(visit(road,e=>e.tag==="button"&&e.title==="Road settings"),
      "Atlas line appearance is edited through Road Settings");
    assert.ok(visit(road,e=>e.tag==="button"&&e.title==="Add Terrain Region"),
      "native Region generation remains a per-road action");
    assert.ok(visit(road,e=>e.tag==="button"&&e.title==="Public Journey label"),
      "Road-generated Regions retain direct public-name editing after the duplicate panel is removed");
    assert.doesNotMatch(textContents(mounted),/REGION SETTINGS/,
      "the native-cost form is no longer embedded in Scene Atlas");
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

test("GM edits public Region naming inside territory management without a duplicate fieldset",async()=>{
  const previous={document:globalThis.document,game:globalThis.game,
    ui:globalThis.ui};
  let mounted=null,opened=null;
  const nativeRoot={querySelector:()=>null,appendChild:n=>{mounted=n;}};
  const element={querySelector:selector=>
    selector==="[data-fvtt-atlas-scene-root]"?nativeRoot:null};
  const region={id:"territory",name:"Private native Region",hidden:false,
    behaviors:[],shapes:[],elevation:{bottom:0,top:20},
    getFlag:()=>null};
  const scene={id:"territory-scene",grid:{size:100,distance:5,units:"mi"},
    canUserModify:()=>true,getFlag:()=>null,
    regions:{contents:[region],values:function*(){yield region;},
      [Symbol.iterator]:function*(){yield region;}}};
  try{
    globalThis.document={createElement:tag=>new Element(tag)};
    globalThis.game={user:{isGM:true},settings:{get:()=>null},
      i18n:{localize:key=>key,lang:"en"}};
    globalThis.ui={notifications:{error:message=>{throw Error(message);}}};
    addAtlasRoadsToSceneConfig({document:scene},element,{
      draft:()=>null,begin(){},select(){},rename(){},remove(){},
      configurePublicTerritory:(selected,_refresh,id)=>{opened=[selected,id];}});
    assert.match(textContents(mounted),/Territories & custom native Regions/);
    assert.doesNotMatch(textContents(mounted),/Public territory names · Journey banners/);
    const control=buttons(mounted).find(b=>
      b.title==="Edit public Journey territory label");
    assert.ok(control,"public naming belongs to the selected native Region");
    assert.equal(control.disabled,false);
    await control.listeners.get("click")({preventDefault(){}});
    assert.deepEqual(opened,[scene,"territory"]);
    assert.equal(region.name,"Private native Region");
    assert.deepEqual(region.shapes,[]);
    assert.deepEqual(region.behaviors,[]);
  }finally{Object.assign(globalThis,previous);}
});

test("Scene Atlas manages native Regions across roads and exposes safe boundary preview",async()=>{
  const previous={document:globalThis.document,game:globalThis.game,ui:globalThis.ui};
  let mounted=null,preview=null,opened=null,link=null,publicName=null,created=false,
    analyzed=false;
  const nativeRoot={querySelector:()=>null,appendChild:n=>{mounted=n;}};
  const element={querySelector:selector=>
    selector==="[data-fvtt-atlas-scene-root]"?nativeRoot:null};
  const region={id:"r1",name:"Valecor",hidden:false,behaviors:[],shapes:[],
    getFlag:()=>null};
  const scene={id:"world",grid:{size:100,distance:1,units:"km"},
    canUserModify:()=>true,getFlag:()=>null,
    regions:{contents:[region],values:function*(){yield region;},
      [Symbol.iterator]:function*(){yield region;}}};
  try{
    globalThis.document={createElement:tag=>new Element(tag)};
    globalThis.game={user:{isGM:true},settings:{get:()=>null},
      i18n:{localize:key=>key,lang:"en"}};
    globalThis.ui={notifications:{error:message=>{throw Error(message);}}};
    addAtlasRoadsToSceneConfig({document:scene},element,{
      draft:()=>null,begin(){},select(){},rename(){},remove(){},
      configureRegion:(_s,id)=>{opened=id;},
      createNativeTerritory:()=>{created=true;},
      reconcileTerritoryBorders:()=>{analyzed=true;},
      smoothNativeRegion:(_s,id)=>{preview=id;},
      configurePublicTerritory:(_s,_refresh,id)=>{publicName=id;},
      setNativeRegionLink:(_s,id,enabled)=>{link=[id,enabled];}
    });
    assert.match(textContents(mounted),/Territories & custom native Regions/);
    assert.match(textContents(mounted),/Native only/);
    const controls=buttons(mounted);
    const plus=controls.find(b=>b.title===
      "Create a Territory using Atlas nodes, native grid painting, or selected Blank Walls");
    assert.ok(plus,"Territory panel includes the authoring-method [+] control");
    await plus.listeners.get("click")({preventDefault(){}});
    assert.equal(created,true);
    const borders=controls.find(b=>b.title===
      "Analyze peer Territory overlaps and preview a native border correction");
    assert.ok(borders,"Territory panel includes the bounded reconciliation action");
    await borders.listeners.get("click")({preventDefault(){}});
    assert.equal(analyzed,true);
    for(const [title,outcome] of [
      ["Edit native Region in Foundry",()=>opened],
      ["Preview smoother native polygon boundary",()=>preview],
      ["Edit public Journey territory label",()=>publicName]]){
      const control=controls.find(b=>b.title===title);
      assert.ok(control,title);
      await control.listeners.get("click")({preventDefault(){}});
      assert.equal(outcome(),"r1");
    }
    const linked=controls.find(b=>b.title==="Link this native Region to Atlas");
    assert.ok(linked);
    await linked.listeners.get("click")({preventDefault(){}});
    assert.deepEqual(link,["r1",true]);
    assert.deepEqual(region.shapes,[],"rendering and actions cannot rewrite native geometry");
  }finally{Object.assign(globalThis,previous);}
});

test("selected polygon offers staged native grid conversion and saved grid offers restore",async()=>{
  const previous={document:globalThis.document,game:globalThis.game,ui:globalThis.ui};
  const region={id:"Reshara",name:"Reshara",hidden:false,behaviors:[],
    shapes:[{type:"polygon",points:[0,0,20,0,20,20,0,20]}],
    getFlag(_scope,key){return key==="atlas"?{schemaVersion:1,linked:true}:
      key==="territoryGeography"?{schemaVersion:1,kind:"continent",
        parentRegionId:null,roadOverrides:{}}:null;}};
  const regions=[region];regions.get=id=>id===region.id?region:null;
  regions.contents=regions;
  const scene={id:"scene1",regions,getFlag:()=>null};
  let selected=null,restored=null;
  try{
    globalThis.document={createElement:tag=>new Element(tag)};
    globalThis.game={user:{isGM:true},i18n:{localize:key=>key,lang:"en"}};
    globalThis.ui={notifications:{error:message=>{throw Error(message);}}};
    const panel=createAtlasTerritoryPanel(scene,{draft:()=>null,
      previewTerritoryGridConversion:(_scene,id)=>{selected=id;},
      restoreTerritoryPolygon:(_scene,id)=>{restored=id;}},()=>{},
    {generated:[],nativeRegions:[{id:region.id,name:region.name,linked:true,
      invalidLink:false,hidden:false}],publicById:new Map()});
    const control=buttons(panel).find(b=>b.title===
      "Preview then convert this selected native polygon Region to grid/hex");
    assert.ok(control);
    assert.equal(control.disabled,false);
    await control.listeners.get("click")({preventDefault(){},stopPropagation(){}});
    assert.equal(selected,"Reshara");
    assert.equal(region.shapes[0].type,"polygon","opening the preview shortcut cannot alter native Shapes");
    region.shapes=[{type:"grid",offsets:[{i:0,j:0}]}];
    const originalGetFlag=region.getFlag;
    region.getFlag=(scope,key)=>key==="territoryGridConversionBackup"?
      {schemaVersion:1}:originalGetFlag(scope,key);
    const savedPanel=createAtlasTerritoryPanel(scene,{draft:()=>null,
      restoreTerritoryPolygon:(_scene,id)=>{restored=id;}},()=>{},
    {generated:[],nativeRegions:[{id:region.id,name:region.name,linked:true,
      invalidLink:false,hidden:false}],publicById:new Map()});
    const restore=buttons(savedPanel).find(b=>b.title===
      "Restore backed-up native polygon from Atlas grid conversion");
    assert.ok(restore,"the saved grid Region offers explicit restore");
    await restore.listeners.get("click")({preventDefault(){},stopPropagation(){}});
    assert.equal(restored,"Reshara");
    assert.equal(region.shapes[0].type,"grid","rendering restore controls never alters a native Shape");
  }finally{Object.assign(globalThis,previous);}
});

test("Territory Workspace groups children beneath continent rows with all actions retained",()=>{
  const previous={document:globalThis.document,game:globalThis.game,ui:globalThis.ui};
  const mk=(id,kind,parentRegionId=null)=>({id,name:id,hidden:false,
    shapes:[],behaviors:[],getFlag:(_scope,key)=>key==="atlas"?
      {schemaVersion:1,linked:true}:key==="territoryGeography"?
      {schemaVersion:1,kind,parentRegionId,roadOverrides:{}}:null});
  const documents=[mk("Valecor","continent"),mk("Dirwest","town","Valecor"),
    mk("Reshara","continent"),mk("The Eyrie","city","Reshara"),
    mk("Unassigned","village")];
  const byId=new Map(documents.map(doc=>[doc.id,doc]));
  const scene={id:"test-scene",regions:byId,getFlag:()=>null};
  const nativeRegions=documents.map(doc=>({id:doc.id,name:doc.name,hidden:false,
    linked:true,invalidLink:false}));
  const nested=(parent,id)=>{
    const visit=node=>{
      if(node.attributes?.get("data-atlas-native-region-id")===id)return true;
      return node.children.some(visit);
    };
    return visit(parent);
  };
  try{
    globalThis.document={createElement:tag=>new Element(tag)};
    globalThis.game={user:{isGM:true},i18n:{localize:key=>key,lang:"en"}};
    globalThis.ui={notifications:{error:message=>{throw Error(message);}}};
    const panel=createAtlasTerritoryPanel(scene,{draft:()=>null},()=>{},
      {generated:[],nativeRegions,publicById:new Map()});
    const groups=panel.children.filter(n=>n.tag==="details");
    const valecor=groups.find(g=>g.attributes.get("data-atlas-territory-group")==="Valecor");
    const resh=groups.find(g=>g.attributes.get("data-atlas-territory-group")==="Reshara");
    const other=groups.find(g=>g.attributes.get("data-atlas-territory-group")==="uncategorized");
    assert.ok(valecor&&resh&&other);
    assert.ok(valecor.open&&resh.open,"continent groups default expanded");
    assert.ok(nested(valecor,"Valecor")&&nested(valecor,"Dirwest"));
    assert.ok(nested(resh,"Reshara")&&nested(resh,"The Eyrie"));
    assert.ok(nested(other,"Unassigned"));
    assert.equal(buttons(panel).filter(b=>b.title==="Edit native Region in Foundry").length,5);
  }finally{Object.assign(globalThis,previous);}
});

test("pending multi-Region transfer exposes an explicit GM recovery action",async()=>{
  const previous={document:globalThis.document,game:globalThis.game,ui:globalThis.ui};
  const scene={id:"scene1",regions:new Map(),getFlag:(_scope,key)=>
    key==="territoryGridTransferIntent"?{schemaVersion:2,sceneId:"scene1",
      sourceIds:["a","c"],targetId:"b",gridIdentity:"grid",
      records:[{id:"a"},{id:"c"},{id:"b"}]}:null};
  let invoked=false;
  try{
    globalThis.document={createElement:tag=>new Element(tag)};
    globalThis.game={user:{isGM:true},i18n:{localize:key=>key,lang:"en"}};
    globalThis.ui={notifications:{error:message=>{throw Error(message);}}};
    const panel=createAtlasTerritoryPanel(scene,{draft:()=>null,
      resolveTerritoryCellTransfer:()=>{invoked=true;}},()=>{},
      {generated:[],nativeRegions:[],publicById:new Map()});
    const recovery=buttons(panel).find(b=>b.title===
      "Review the persisted native grid transfer recovery plan");
    assert.ok(recovery);
    assert.match(textContents(panel),/interrupted 3-Region cell transfer/);
    await recovery.listeners.get("click")({preventDefault(){}});
    assert.equal(invoked,true);
  }finally{Object.assign(globalThis,previous);}
});

test("Territories Workspace starts batch selection before painting and tracks each target",async()=>{
  const previous={document:globalThis.document,game:globalThis.game,ui:globalThis.ui};
  let reviewed=0,discarded=0,edited=null,started=0;
  try{
    globalThis.document={createElement:tag=>new Element(tag)};
    globalThis.game={user:{isGM:true},i18n:{localize:key=>key,lang:"en"}};
    globalThis.ui={notifications:{error:message=>{throw Error(message);}}};
    const common={draft:()=>null,startTerritoryBatch:()=>{started++;},
      commitTerritoryBatch:()=>{reviewed++;},discardTerritoryBatch:()=>{discarded++;},
      editTerritoryBoundary:(_scene,id)=>{edited=id;}};
    const before=createAtlasTerritoryPanel({id:"scene1",regions:new Map()},
      {...common,territoryBatchState:()=>null},()=>{},
      {generated:[],nativeRegions:[],publicById:new Map()});
    const start=buttons(before).find(button=>button.textContent==="Start Batch Edit");
    assert.ok(start&&!start.disabled);
    await start.listeners.get("click")({preventDefault(){}});
    assert.equal(started,1);
    const panel=createAtlasTerritoryPanel({id:"scene1",regions:new Map()},
      {...common,territoryBatchState:()=>({count:1,total:2,targets:[
        {id:"dirwest",name:"Dirwest",staged:true},
        {id:"valecor",name:"Valecor",staged:false}]})},
      ()=>{}, {generated:[],nativeRegions:[],publicById:new Map()});
    assert.match(textContents(panel),/1 of 2 Territories staged/);
    const review=buttons(panel).find(button=>button.textContent==="Review & Apply Batch");
    const discard=buttons(panel).find(button=>button.textContent==="Discard Staged Batch");
    const edit=buttons(panel).find(button=>button.textContent==="Valecor — Not staged");
    assert.ok(review&&review.disabled&&discard&&!discard.disabled&&edit);
    await edit.listeners.get("click")({preventDefault(){}});
    assert.equal(edited,"valecor");
    await discard.listeners.get("click")({preventDefault(){}});
    assert.equal(reviewed,0);assert.equal(discarded,1);
    const ready=createAtlasTerritoryPanel({id:"scene1",regions:new Map()},
      {...common,territoryBatchState:()=>({count:2,total:2,targets:[
        {id:"dirwest",name:"Dirwest",staged:true},
        {id:"valecor",name:"Valecor",staged:true}]})},
      ()=>{}, {generated:[],nativeRegions:[],publicById:new Map()});
    const readyReview=buttons(ready).find(b=>b.textContent==="Review & Apply Batch");
    assert.ok(readyReview&&!readyReview.disabled);
    await readyReview.listeners.get("click")({preventDefault(){}});
    assert.equal(reviewed,1);
  }finally{Object.assign(globalThis,previous);}
});

test("road-generated native Regions are excluded from the geographic boundary manager",()=>{
  const previous={document:globalThis.document,game:globalThis.game,ui:globalThis.ui};
  let mounted=null;
  const nativeRoot={querySelector:()=>null,appendChild:n=>{mounted=n;}};
  const element={querySelector:key=>key==="[data-fvtt-atlas-scene-root]"?nativeRoot:null};
  const generatedFlag={schemaVersion:1,kind:"checkpoint",roadId:"road-a",
    checkpointIds:["cp-a"],widthCells:.5,gridSize:100,shapeSignature:"00000000"};
  const manual={id:"dirwest",name:"Dirwest",hidden:false,behaviors:[],shapes:[],
    getFlag:()=>null};
  const corridor={id:"road-region",name:"Road corridor",hidden:false,
    behaviors:[],shapes:[],getFlag:(_scope,key)=>
      key==="generatedRegion"?generatedFlag:null};
  const regions=[manual,corridor];
  const scene={id:"test",grid:{size:100,distance:1,units:"km"},
    canUserModify:()=>true,getFlag:()=>null,
    regions:{contents:regions,values:function*(){yield* regions;},
      [Symbol.iterator]:function*(){yield* regions;}}};
  try{
    globalThis.document={createElement:tag=>new Element(tag)};
    globalThis.game={user:{isGM:true},settings:{get:()=>null},
      i18n:{localize:key=>key,lang:"en"}};
    globalThis.ui={notifications:{error:m=>{throw Error(m);}}};
    addAtlasRoadsToSceneConfig({document:scene},element,{
      draft:()=>null,begin(){},select(){},rename(){},remove(){}});
    const regionRows=[];
    const walk=n=>{
      if(n.attributes?.has("data-atlas-native-region-id"))regionRows.push(n);
      for(const child of n.children)walk(child);
    };
    walk(mounted);
    assert.deepEqual(regionRows.map(row=>row.attributes.get("data-atlas-native-region-id")),
      ["dirwest"]);
    assert.doesNotMatch(textContents(regionRows[0]),/Road corridor/);
  }finally{Object.assign(globalThis,previous);}
});
