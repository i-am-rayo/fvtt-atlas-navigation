import assert from "node:assert/strict";
import test from "node:test";
import { addAtlasRoadsToSceneConfig, registerAtlasSceneTab } from "../scripts/scene-config.js";

class Element {
  constructor(tag) { this.tag = tag; this.attributes = new Map(); this.children = []; this.listeners = new Map(); this.style = {}; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  appendChild(child) { this.children.push(child); }
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
    globalThis.game = { user: { isGM: true }, i18n: { localize: k => k, lang: "en" } };
    globalThis.ui = { notifications: { error: m => { throw Error(m); } } };
    addAtlasRoadsToSceneConfig({ document: scene }, element, actions);
    assert.ok(mounted);
    assert.equal(mounted.attributes.has("data-fvtt-atlas-setup"), true);
    assert.equal(buttons(mounted).length, 2,
      "empty atlas exposes Roads [+] and a disabled Waypoints [+]");
    const plus = buttons(mounted)[0];
    assert.equal(plus.textContent, "+");
    assert.equal(plus.type, "button");
    assert.equal(buttons(mounted)[1].disabled, true,
      "waypoint placement requires an existing v3 road");
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
    getFlag: () => ({
      schemaVersion: 1, revision: 2, enabled: false, calibration: null,
      nodes: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 100, y: 0 }],
      segments: [{ id: "r1", from: "a", to: "b", via: [], name: "North Road", bidirectional: true }]
    })
  };
  let selected;
  try {
    globalThis.document = { createElement: tag => new Element(tag) };
    globalThis.game = { user: { isGM: true }, i18n: { localize: k => k, lang: "en" } };
    addAtlasRoadsToSceneConfig({ document: scene }, element, {
      begin() {}, draft: () => null, finish() {}, cancel() {},
      select: (scene, id) => { selected = id; }, rename() {}, remove() {}
    });
    assert.equal(buttons(mounted).length, 5, "legacy roads plus disabled Waypoints [+]");
    assert.match(buttons(mounted)[0].textContent, /FVTTATLAS.Roads.Anchor/);
    assert.equal(buttons(mounted).filter(b=>b.textContent==="+" && !b.disabled).length,0,
      "legacy v1 cannot add or change roads before anchoring");
    assert.match(textContents(mounted), /North Road/);
    assert.doesNotMatch(textContents(mounted), /Configure Atlas/);
    buttons(mounted)[1].listeners.get("click")({ preventDefault() {} });
    assert.equal(selected, "r1");
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
    globalThis.game = { user: { isGM: true }, i18n: { localize: k => k, lang: "en" } };
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
    getFlag: () => ({
      schemaVersion: 2, coordinateSpace: "image", revision: 3,
      enabled: true, calibration: null,
      nodes: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 100, y: 0 }],
      segments: [{ id: "r", from: "a", to: "b", via: [], name: "South Road", bidirectional: true }]
    })
  };
  let organizeScene;
  try {
    globalThis.document = { createElement: tag => new Element(tag) };
    globalThis.game = { user: { isGM: true }, i18n: { localize: k => k, lang: "en" } };
    addAtlasRoadsToSceneConfig({ document: scene }, element, {
      begin() {}, draft: () => null, finish() {}, cancel() {}, select() {}, rename() {}, remove() {},
      organize: chosen => { organizeScene = chosen; }
    });
    assert.equal(buttons(mounted).length, 5,
      "organize, select, rename, delete, and a disabled Waypoints [+]");
    assert.equal(buttons(mounted)[0].textContent, "FVTTATLAS.Roads.Organize");
    assert.ok(!buttons(mounted).some(b=>b.textContent==="+" && !b.disabled));
    buttons(mounted)[0].listeners.get("click")({ preventDefault() {} });
    assert.equal(organizeScene, scene);
  } finally { Object.assign(globalThis, previous); }
});

test("v3 connected road sections render once with edit and merge actions",async()=>{
 const previous={document:globalThis.document,game:globalThis.game};
 let mounted=null;
 const nativeRoot={querySelector:()=>null,appendChild:n=>{mounted=n;}};
 const element={querySelector:selector=>selector==='[data-fvtt-atlas-scene-root]'?nativeRoot:null};
 const scene={id:"v3",grid:{size:100,distance:5,units:"km"},canUserModify:()=>true,
 getFlag:()=>({
  schemaVersion:3,coordinateSpace:"image",revision:1,enabled:true,calibration:null,
  nodes:[{id:"a",x:0,y:0},{id:"b",x:50,y:0},{id:"c",x:100,y:0},{id:"d",x:50,y:70}],
  roads:[{id:"old",name:"Main Road"},{id:"new",name:"Spur"}],
  segments:[
   {id:"a1",roadId:"old",from:"a",to:"b",via:[],bidirectional:true},
   {id:"a2",roadId:"old",from:"b",to:"c",via:[],bidirectional:true},
   {id:"s1",roadId:"new",from:"b",to:"d",via:[],bidirectional:true}
  ]
 })};
 let editedId,mergedId,waypointId,pickerScene;
 try {
  globalThis.document={createElement:tag=>new Element(tag)};
  globalThis.game={user:{isGM:true},i18n:{localize:k=>k,lang:"en"}};
  addAtlasRoadsToSceneConfig({document:scene},element,{
   begin(){},draft:()=>null,finish(){},cancel(){},select(){},rename(){},remove(){},
   beginPointEdit:(_scene,id)=>{editedId=id;},merge:(_scene,road)=>{mergedId=road.id;},
    beginWaypoint:(s)=>{pickerScene=s;},selectWaypoint:(_scene,id)=>{waypointId=id;}
  });
  assert.equal(buttons(mounted).length,16,
    "Roads [+], road actions, Waypoints [+], and four junction focus actions");
  assert.match(textContents(mounted),/Main Road 2 FVTTATLAS.Roads.Segments/);
  const all = [];
  const collect = value => { all.push(value); for (const child of value.children ?? []) collect(child); };
  collect(mounted);
  assert.ok(all.some(value => value.tag === "span" && value.style.display === "inline-flex" &&
    value.children.some(child => child.tag === "button" && child.textContent === "+")),
    "Roads [+] must stay on the same line");
  assert.ok(all.some(value => value.style.fontStyle === "italic" &&
    value.textContent === "2 FVTTATLAS.Roads.Segments" &&
    value.title === "FVTTATLAS.Roads.SegmentCountHint"),
    "the graph-segment count is explanatory metadata, not part of the road name");
  const rows=[];
  const visit=node=>{if(node.attributes?.has("data-atlas-road-id"))rows.push(node);node.children?.forEach(visit);};
  visit(mounted);
  assert.deepEqual(rows.map(r=>r.attributes.get("data-atlas-road-id")),["old","new"]);
  const oldButtons=buttons(rows[0]);
  await oldButtons[1].listeners.get("click")({preventDefault(){}});
  assert.equal(editedId,"old");
  await oldButtons[2].listeners.get("click")({preventDefault(){}});
  assert.equal(mergedId,"old");
   const wpPlus=buttons(mounted).find(b=>
     b.textContent==="+" && b.title==="FVTTATLAS.Waypoints.Add");
   assert.equal(wpPlus.disabled,false);
   await wpPlus.listeners.get("click")({preventDefault(){}});
   assert.equal(pickerScene,scene);
   const waypointRows=[];
   const visitWaypoint=value=>{
     if(value.attributes?.has("data-atlas-waypoint-id"))waypointRows.push(value);
     value.children?.forEach(visitWaypoint);
   };
   visitWaypoint(mounted);
   assert.equal(waypointRows.length,4);
   await buttons(waypointRows[0])[0].listeners.get("click")({preventDefault(){}});
   assert.equal(waypointId,waypointRows[0].attributes.get("data-atlas-waypoint-id"));
 } finally {Object.assign(globalThis,previous);}
});

test("waypoint picking and point-edit controls stay inside the Waypoints section",async()=>{
 const previous={document:globalThis.document,game:globalThis.game};
 let mounted=null;
 const nativeRoot={querySelector:()=>null,appendChild:n=>{mounted=n;}};
 const element={querySelector:sel=>sel==='[data-fvtt-atlas-scene-root]'?nativeRoot:null};
 const scene={id:"waypoint-controls",grid:{size:100,distance:5,units:"km"},
   canUserModify:()=>true,getFlag:()=>({
     schemaVersion:3,coordinateSpace:"image",revision:1,enabled:true,calibration:null,
     nodes:[{id:"a",x:0,y:0},{id:"b",x:100,y:0}],
     roads:[{id:"main",name:"Main"}],
     segments:[{id:"s1",roadId:"main",from:"a",to:"b",via:[],bidirectional:true}]
   })};
 const sections=()=>mounted.children.filter(child=>child.tag==="fieldset");
 try {
  globalThis.document={createElement:tag=>new Element(tag)};
  globalThis.game={user:{isGM:true},i18n:{localize:k=>k,lang:"en"}};
  let state={mode:"waypoint",points:0};
  let canceled=0,saved=0,undone=0;
  const actions={
   begin(){},draft:()=>state,select(){},rename(){},remove(){},
   cancel:()=>{canceled++;},finish:()=>{saved++;},undo:()=>{undone++;}
  };
  addAtlasRoadsToSceneConfig({document:scene},element,actions);
  const roadSection=sections()[0], waypointSection=sections()[1];
  assert.ok(!buttons(roadSection).some(b=>b.textContent==="FVTTATLAS.Roads.Finish"));
  assert.ok(buttons(waypointSection).some(b=>b.textContent==="FVTTATLAS.Roads.Cancel"));
  assert.equal(buttons(waypointSection)[0].disabled,true,"do not restart picker mid-edit");
  state={mode:"points",source:"waypoint",dirty:true,canUndo:true};
  addAtlasRoadsToSceneConfig({document:scene},element,actions);
  const roadPanel=sections()[0], wpPanel=sections()[1];
  assert.ok(!buttons(roadPanel).some(b=>b.textContent==="FVTTATLAS.Roads.SavePoints"));
  const controls=buttons(wpPanel);
  await controls.find(b=>b.textContent==="FVTTATLAS.Roads.SavePoints").listeners.get("click")({preventDefault(){}});
  await controls.find(b=>b.textContent==="FVTTATLAS.Roads.Undo").listeners.get("click")({preventDefault(){}});
  await controls.find(b=>b.textContent==="FVTTATLAS.Roads.CancelEdits").listeners.get("click")({preventDefault(){}});
  assert.deepEqual([saved,undone,canceled],[1,1,1]);
 } finally {Object.assign(globalThis,previous);}
});

test("Waypoints list is bounded and does not list orphaned historical nodes", () => {
 const previous={document:globalThis.document,game:globalThis.game};
 let mounted=null;
 const nativeRoot={querySelector:()=>null,appendChild:n=>{mounted=n;}};
 const element={querySelector:sel=>sel==='[data-fvtt-atlas-scene-root]'?nativeRoot:null};
 const nodes=Array.from({length:32},(_,i)=>({id:"n"+i,x:i*20,y:0}));
 const segments=Array.from({length:31},(_,i)=>({
   id:"seg"+i,roadId:"road",from:"n"+i,to:"n"+(i+1),
   via:[],bidirectional:true
 }));
 const scene={id:"big",grid:{size:100,distance:5,units:"mi"},
   canUserModify:()=>true,getFlag:()=>({
     schemaVersion:3,coordinateSpace:"image",revision:1,enabled:true,calibration:null,
     roads:[{id:"road",name:"Long Road"}],nodes:[...nodes,{id:"unused",x:1000,y:1000}],
     segments
   })};
 try {
  globalThis.document={createElement:tag=>new Element(tag)};
  globalThis.game={user:{isGM:true},i18n:{localize:k=>k,lang:"en"}};
  addAtlasRoadsToSceneConfig({document:scene},element,{
   begin(){},draft:()=>null,select(){},rename(){},remove(){},selectWaypoint(){}
  });
  const rows=[];
  const scan=v=>{if(v.attributes?.has("data-atlas-waypoint-id"))rows.push(v);
    v.children?.forEach(scan);};
  scan(mounted);
  assert.equal(rows.length,25);
  assert.ok(!rows.some(row=>row.attributes.get("data-atlas-waypoint-id")==="unused"));
  assert.match(textContents(mounted),/32 FVTTATLAS.Waypoints.Count/);
  assert.match(textContents(mounted),/FVTTATLAS.Waypoints.Recent 25 \/ 32/);
 } finally {Object.assign(globalThis,previous);}
});
