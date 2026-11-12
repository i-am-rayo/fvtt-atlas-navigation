import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

class MockApplicationV2 {
  constructor(options) { this.options = options; this.rendered = false;
    this.minimized=false;this.minCalls=0;this.maxCalls=0; }
  async render() { this.result = await this._renderHTML(); this.rendered = true; return this; }
  async minimize(){this.minimized=true;this.minCalls++;}
  async maximize(){this.minimized=false;this.maxCalls++;}
  async close() { this.rendered = false; this._onClose(); return this; }
}
globalThis.foundry = { applications: { api: { ApplicationV2: MockApplicationV2 } } };
const { AtlasSceneWorkspace, openAtlasSceneWorkspace, refreshAtlasSceneWorkspace,
  restoreAtlasSceneWorkspace, minimizeAtlasSceneWorkspace } =
  await import("../scripts/atlas-scene-workspace.js");

class Element {
  constructor(tag) {
    this.tag = tag; this.children = []; this.attributes = new Map();
    this.listeners = new Map(); this.style = {}; this.dataset = {};
  }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  appendChild(child) { this.children.push(child); child.parentNode = this; return child; }
  append(...children) { for (const child of children) this.appendChild(child); }
  prepend(...children) { this.children.unshift(...children); }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
}
function walk(root, predicate) {
  return [root, ...root.children.flatMap(child => walk(child, predicate))].filter(predicate);
}
const text = root => [root.textContent ?? "", ...root.children.map(text)].join(" ");
const buttons = root => walk(root, item => item.tag === "button");

function context() {
  const before = { game: globalThis.game, document: globalThis.document, ui: globalThis.ui,
    window: globalThis.window, Hooks:globalThis.Hooks, canvas:globalThis.canvas,
    PIXI:globalThis.PIXI };
  globalThis.document = { createElement: tag => new Element(tag),
    createTextNode: value => ({ textContent: value, children: [] }) };
  globalThis.window = { innerWidth: 1280, innerHeight: 900 };
  globalThis.ui = { notifications: { error(message) { throw Error(message); } } };
  globalThis.game = { user: { id: "gm", isGM: true },
    settings: { get: () => null }, i18n: { localize: key => key, lang: "en" } };
  const region = { id: "region-1", name: "Millstone", hidden: false, behaviors: [],
    getFlag: () => null, shapes: [], color: "#ff0000" };
  const regions = [region];
  regions.get = id => regions.find(item => item.id === id);
  regions.contents = regions;
  const scene = { id: "scene-1", name: "Valecor", regions,
    getFlag: () => null, canUserModify: () => true };
  const calls = [];
  const actions = { draft: () => null,
    createNativeTerritory: () => calls.push(["create-native"]),
    configureRegion: (_scene, id) => calls.push(["native", id]),
    smoothNativeRegion: (_scene, id) => calls.push(["smooth", id]),
    setNativeRegionLink: (_scene, id, linked) => calls.push(["link", id, linked]),
    configurePublicTerritory: (_scene, _refresh, id) => calls.push(["label", id]) };
  return { scene, calls, actions, restore: () => Object.assign(globalThis, before) };
}

test("GM-only standalone workspace reuses territory actions without writing on render", async () => {
  const ctx = context();
  try {
    const first = await openAtlasSceneWorkspace(ctx.scene, ctx.actions);
    assert.ok(first instanceof AtlasSceneWorkspace);
    assert.equal(first.options.id, "atlas-scene-workspace-scene-1");
    assert.equal(first.options.position.left,24,"Atlas Workspace opens against the left edge");
    assert.match(text(first.result), /Scene Overview/);
    assert.match(text(first.result), /Roads/);
    const again = await openAtlasSceneWorkspace(ctx.scene, ctx.actions);
    assert.equal(first, again, "per-Scene instance must be reused");
    const territories = buttons(first.result).find(item => item.textContent === "Territories");
    await territories.listeners.get("click")({ preventDefault() {} });
    assert.match(text(first.result), /Millstone/);
    const add=buttons(first.result).find(item=>
      item.title==="Create a Territory using Atlas nodes, native grid painting, or selected Blank Walls");
    assert.ok(add,"the Territory legend offers the authoring-method [+] button");
    await add.listeners.get("click")({preventDefault(){}});
    const row = walk(first.result, item => item.className?.includes?.("atlas-territory-row"))[0];
    assert.ok(row, "native Region has a compact workspace row");
    assert.match(row.children[1].className, /atlas-territory-actions/,
      "actions must be placed underneath the Region details");
    assert.equal(row.children[1].children.length, 2,
      "Territory Settings consolidates actions while Locate remains immediately accessible");
    assert.ok(row.children[1].children.every(item =>
      item.className?.includes?.("atlas-ui-icon-button")),
    "all Territory actions must share the same icon size");
    assert.ok(buttons(row).some(item=>item.title==="Open Millstone Territory Settings"));
    assert.ok(buttons(row).some(item =>
      item.title === "Locate this native Region on the map"));
    assert.deepEqual(ctx.calls, [["create-native"]],
      "Opening the Workspace never silently runs Territory actions");
    await refreshAtlasSceneWorkspace(ctx.scene);
    assert.match(text(first.result), /Millstone/);
    await first.close();
    const reopened = await openAtlasSceneWorkspace(ctx.scene, ctx.actions);
    assert.notEqual(reopened, first,
      "closed instances must be discarded");
    await reopened.close();
  } finally { ctx.restore(); }
});

test("Checkpoint authoring minimizes existing Workspace; side tool restores without recreating or writing",async()=>{
  const ctx=context();
  try{
    const workspace=await openAtlasSceneWorkspace(ctx.scene,ctx.actions);
    workspace.activeSection="checkpoints";
    await workspace.render(true);
    assert.equal(workspace.minimized,false);
    await minimizeAtlasSceneWorkspace(ctx.scene);
    assert.equal(workspace.minimized,true);
    assert.equal(workspace.minCalls,1);
    const again=await openAtlasSceneWorkspace(ctx.scene,ctx.actions);
    assert.equal(again,workspace);
    assert.equal(again.minimized,false);
    assert.equal(again.maxCalls,1);
    assert.equal(again.activeSection,"checkpoints","native maximize retains tab and draft context");
    await again.close();
    await minimizeAtlasSceneWorkspace(ctx.scene);
    assert.equal(again.minCalls,1,"closed Workspace is not revived by minimize");
  }finally{ctx.restore();}
});

test("Checkpoint Workspace has one [+] placement action and compact searchable rows", async () => {
  const ctx = context();
  try {
    ctx.actions.beginCheckpoint = () => ctx.calls.push(["checkpoint"]);
    ctx.actions.beginIndependentCheckpoint = () => ctx.calls.push(["unexpected-legacy"]);
    ctx.scene.getFlag = (_scope, flag) => flag === "atlas" ? {
      schemaVersion: 10, coordinateSpace: "image", revision: 3,
      enabled: false, calibration: null, roads: [], segments: [],
      nodes: [{ id: "node", x: 10, y: 20 }],
      checkpoints: [{ id: "cp", roadId: null, nodeId: "node",
        name: "Free Village", elevationMeters: null,
        appearance: null, playerVisible: false }]
    } : null;
    ctx.actions.selectCheckpoint = (_scene, id) => ctx.calls.push(["locate", id]);
    ctx.actions.editCheckpoint = () => ctx.calls.push(["edit"]);
    ctx.actions.editCheckpointAppearance = () => ctx.calls.push(["settings"]);
    ctx.actions.manageCheckpointRoad = () => ctx.calls.push(["link"]);
    ctx.actions.removeCheckpoint = () => ctx.calls.push(["remove"]);
    const workspace = await openAtlasSceneWorkspace(ctx.scene, ctx.actions);
    const tab = buttons(workspace.result).find(item => item.textContent === "Checkpoints");
    assert.ok(tab);
    await tab.listeners.get("click")({ preventDefault() {} });
    const panel = walk(workspace.result, item =>
      item.attributes?.get("data-atlas-checkpoint-manager") === "")[0];
    assert.ok(panel, "Checkpoint Workspace is a dedicated manager");
    const add = buttons(panel).filter(item => item.textContent === "+");
    assert.equal(add.length, 1, "there is one Checkpoints [+] authoring entrypoint");
    assert.equal(buttons(panel).filter(item => item.textContent === "+ Independent Checkpoint" ||
      item.textContent === "+ Road Checkpoint").length, 0);
    await add[0].listeners.get("click")({ preventDefault() {} });
    assert.deepEqual(ctx.calls, [["checkpoint"]]);
    const row = walk(panel, item => item.className === "atlas-checkpoint-row")[0];
    assert.ok(row);
    assert.equal(row.children[0].className, "atlas-checkpoint-info");
    assert.equal(row.children[1].className, "atlas-checkpoint-actions");
    assert.equal(row.children[2].className, "atlas-checkpoint-details");
    assert.equal(row.children[1].children.every(item =>
      item.className?.includes?.("atlas-ui-icon-button")), true);
    const search = walk(panel, item => item.tag === "input" &&
      item.type === "search")[0];
    assert.ok(search);
    search.value = "not present";
    search.listeners.get("input")();
    assert.equal(row.hidden, true);
    search.value = "Free Village";
    search.listeners.get("input")();
    assert.equal(row.hidden, false);
    await workspace.close();
  } finally { ctx.restore(); }
});

test("isolated Checkpoint in Workspace offers explicit Road connection action", async () => {
  const ctx = context();
  try {
    ctx.scene.getFlag = (_scope, flag) => flag === "atlas" ? {
      schemaVersion: 10, coordinateSpace: "image", revision: 3,
      enabled: false, calibration: null, roads: [], segments: [],
      nodes: [{ id: "node", x: 10, y: 20 }],
      checkpoints: [{ id: "cp", roadId: null, nodeId: "node",
        name: "Free Village", elevationMeters: null,
        appearance: null, playerVisible: false }]
    } : null;
    ctx.actions.manageCheckpointRoad = (_scene, id) => ctx.calls.push(["connect", id]);
    const workspace = await openAtlasSceneWorkspace(ctx.scene, ctx.actions);
    const tab = buttons(workspace.result).find(item => item.textContent === "Checkpoints");
    await tab.listeners.get("click")({ preventDefault() {} });
    assert.match(text(workspace.result), /Free Village/);
    const connect = buttons(workspace.result).find(item =>
      item.title === "Connect this isolated Checkpoint to a Road endpoint");
    assert.ok(connect);
    await connect.listeners.get("click")({ preventDefault() {} });
    assert.deepEqual(ctx.calls, [["connect", "cp"]]);
    await workspace.close();
  } finally { ctx.restore(); }
});

test("workspace refuses non-GM and unauthorized Scenes, including after open", async () => {
  const ctx = context();
  try {
    globalThis.game.user.isGM = false;
    assert.throws(() => openAtlasSceneWorkspace(ctx.scene, ctx.actions), /Only a GM/);
    globalThis.game.user.isGM = true;
    ctx.scene.canUserModify = () => false;
    assert.throws(() => openAtlasSceneWorkspace(ctx.scene, ctx.actions), /Only a GM/);
    ctx.scene.canUserModify = () => true;
    const workspace = await openAtlasSceneWorkspace(ctx.scene, ctx.actions);
    globalThis.game.user.isGM = false;
    await assert.rejects(() => workspace.render(true), /Only a GM/);
    await workspace.close();
  } finally { ctx.restore(); }
});

test("returning from batch painting fully restores the existing minimized Workspace",async()=>{
  const ctx=context();
  try{
    const workspace=await openAtlasSceneWorkspace(ctx.scene,ctx.actions);
    workspace.activeSection="territories";
    await workspace.minimize();
    await restoreAtlasSceneWorkspace(ctx.scene);
    assert.equal(workspace.minimized,false);
    assert.equal(workspace.maxCalls,1);
    assert.equal(workspace.activeSection,"territories");
    assert.match(text(workspace.result),/Territories/);
    await workspace.minimize();
    const reopened=await openAtlasSceneWorkspace(ctx.scene,ctx.actions);
    assert.equal(reopened,workspace);
    assert.equal(workspace.minimized,false);
    assert.equal(workspace.maxCalls,2);
    await workspace.close();
    await restoreAtlasSceneWorkspace(ctx.scene);
    assert.equal(workspace.rendered,false,
      "closing a Workspace deliberately must not reopen it");
  }finally{ctx.restore();}
});

test("Roads tab is a working Workspace view with legacy Scene settings unaffected", async () => {
  const ctx = context();
  try {
    const workspace = await openAtlasSceneWorkspace(ctx.scene, ctx.actions);
    const roads = buttons(workspace.result).find(item => item.textContent === "Roads");
    assert.ok(roads, "Roads has its own Workspace navigation entry");
    await roads.listeners.get("click")({ preventDefault() {} });
    assert.equal(workspace.activeSection, "roads");
    assert.match(text(workspace.result), /Roads/);
    assert.match(text(workspace.result), /Add a road to begin/);
    assert.doesNotMatch(text(workspace.result), /Territories & custom native Regions/,
      "Roads view does not construct the Territory manager");
    await workspace.close();
  } finally { ctx.restore(); }
});

test("native Levels are isolated in Topology and never constructed inside Roads", async () => {
  const ctx = context();
  try {
    globalThis.game.settings.get = (_scope, key) =>
      key === "nativeLevelPlannerEnabled" ? true : null;
    const workspace = await openAtlasSceneWorkspace(ctx.scene, ctx.actions);
    const topology = buttons(workspace.result).find(item => item.textContent === "Topology & Levels");
    assert.ok(topology);
    await topology.listeners.get("click")({ preventDefault() {} });
    assert.equal(workspace.activeSection, "topology");
    assert.match(text(workspace.result), /Native Scene Levels/);
    assert.doesNotMatch(text(workspace.result), /Territories & custom native Regions/);
    const roads = buttons(workspace.result).find(item => item.textContent === "Roads");
    await roads.listeners.get("click")({ preventDefault() {} });
    assert.doesNotMatch(text(workspace.result), /Native Scene Levels/);
    await workspace.close();
  } finally { ctx.restore(); }
});

test("Territory action row stays right-aligned alongside the Region label", () => {
  const css = readFileSync(new URL("../styles/atlas-scene-workspace.css", import.meta.url), "utf8");
  assert.match(css, /\.atlas-territory-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/s);
  assert.match(css, /\.atlas-territory-actions\s*\{[^}]*justify-self:\s*end/s);
});

test("GM Territory directory remains accessible; Atlas Layers owns persistent map visibility", async () => {
  const ctx = context();
  try {
    const flag = (kind,parentRegionId=null) => (_scope, key) => key === "atlas" ?
      {schemaVersion:1,linked:true} : key === "territoryGeography" ?
        {schemaVersion:1,kind,parentRegionId,roadOverrides:{}} : null;
    ctx.scene.regions[0].name = "Unclassified native Region";
    ctx.scene.regions.push({id:"continent-1",name:"Valecor",parent:{id:ctx.scene.id},
      hidden:false,shapes:[],behaviors:[],getFlag:flag("continent")});
    ctx.scene.regions.push({id:"settlement-1",name:"Dirwest",parent:{id:ctx.scene.id},
      hidden:false,shapes:[],behaviors:[],getFlag:flag("city","continent-1")});
    const workspace = await openAtlasSceneWorkspace(ctx.scene, ctx.actions);
    const territories = buttons(workspace.result).find(item=>item.textContent==="Territories");
    await territories.listeners.get("click")({preventDefault(){}});
    const rows = () => walk(workspace.result,item=>item.attributes?.has("data-atlas-native-region-id"));
    assert.deepEqual(rows().map(item=>item.attributes.get("data-atlas-native-region-id")),
      ["continent-1","settlement-1","region-1"],
      "Combined directory groups Continent rows ahead of their children and uncategorized Regions");
    assert.equal(walk(workspace.result,item=>item.attributes?.has("data-atlas-territory-view")).length,0,
      "Workspace must not own competing map-view settings");
    assert.equal(rows().length,3,"native-only Regions remain available in Combined");
    assert.match(text(workspace.result),/Atlas Layers toolbar button/);
    assert.deepEqual(ctx.calls,[],"read-only views must never commit native or Atlas data");
    await workspace.close();
  } finally { ctx.restore(); }
});

test("Locate uses public canvas bounds and workspace does not own canvas preview Hooks", async () => {
  const ctx=context();
  try {
    const subscriptions=new Map(),removed=[];
    let next=1;
    globalThis.Hooks={
      on(event,handler){const id=next++;subscriptions.set(id,{event,handler});return id;},
      off(event,id){removed.push([event,id]);subscriptions.delete(id);}
    };
    const moves=[];
    ctx.scene.regions[0].parent={id:ctx.scene.id};
    ctx.scene.regions[0].bounds={x:100,y:240,width:300,height:100};
    ctx.scene.regions[0].polygons=[{points:[100,240,400,240,400,340,100,340]}];
    class Container {
      constructor(){this.children=[];this.parent=null;this.alpha=1;}
      addChild(item){this.children.push(item);item.parent=this;return item;}
      removeChild(item){this.children=this.children.filter(child=>child!==item);item.parent=null;}
      destroy(){this.destroyed=true;}
    }
    class Graphics {
      poly(){return this;}
      stroke(){return this;}
      destroy(){}
    }
    globalThis.PIXI={Container,Graphics};
    globalThis.canvas={ready:true,scene:ctx.scene,
      app:{renderer:{screen:{width:1000,height:800}}},
      stage:{scale:{x:1}},interface:new Container(),
      animatePan:async options=>{moves.push(options);}};
    const workspace=await openAtlasSceneWorkspace(ctx.scene,ctx.actions);
    assert.equal(subscriptions.size,0,"persistent Atlas Layers controller owns canvas hooks");
    await buttons(workspace.result).find(item=>item.textContent==="Territories")
      .listeners.get("click")({preventDefault(){}});
    const locate=buttons(workspace.result).find(item=>
      item.title==="Locate this native Region on the map");
    await locate.listeners.get("click")({preventDefault(){}});
    assert.deepEqual(moves,[{x:250,y:290,scale:2.25,duration:750}]);
    assert.equal(globalThis.canvas.interface.children.length,1,
      "Locate draws only the selected Region even when persistent Layers are off");
    assert.equal(workspace.minimized,true,"map Locate gets the Workspace out of the way");
    assert.deepEqual(ctx.calls,[],"Locate never writes a Scene or native Region");
    await workspace.close();
    assert.equal(subscriptions.size,0);
    assert.equal(removed.length,0);
  } finally {ctx.restore();}
});
