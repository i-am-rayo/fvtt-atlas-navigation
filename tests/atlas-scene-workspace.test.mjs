import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

class MockApplicationV2 {
  constructor(options) { this.options = options; this.rendered = false; }
  async render() { this.result = await this._renderHTML(); this.rendered = true; return this; }
  async close() { this.rendered = false; this._onClose(); return this; }
}
globalThis.foundry = { applications: { api: { ApplicationV2: MockApplicationV2 } } };
const { AtlasSceneWorkspace, openAtlasSceneWorkspace, refreshAtlasSceneWorkspace } =
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
    window: globalThis.window };
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
    assert.match(text(first.result), /Scene Overview/);
    assert.match(text(first.result), /Roads/);
    const again = await openAtlasSceneWorkspace(ctx.scene, ctx.actions);
    assert.equal(first, again, "per-Scene instance must be reused");
    const territories = buttons(first.result).find(item => item.textContent === "Territories");
    await territories.listeners.get("click")({ preventDefault() {} });
    assert.match(text(first.result), /Millstone/);
    const row = walk(first.result, item => item.className?.includes?.("atlas-territory-row"))[0];
    assert.ok(row, "native Region has a compact workspace row");
    assert.match(row.children[1].className, /atlas-territory-actions/,
      "actions must be placed underneath the Region details");
    assert.equal(row.children[1].children.length, 4);
    assert.ok(row.children[1].children.every(item =>
      item.className?.includes?.("atlas-ui-icon-button")),
    "all four actions must share the same icon size");
    const smooth = buttons(first.result).find(item =>
      item.title === "Preview smoother native polygon boundary");
    await smooth.listeners.get("click")({ preventDefault() {} });
    const label = buttons(first.result).find(item =>
      item.title === "Edit public Journey territory label");
    await label.listeners.get("click")({ preventDefault() {} });
    assert.deepEqual(ctx.calls, [["smooth", "region-1"], ["label", "region-1"]]);
    await refreshAtlasSceneWorkspace(ctx.scene);
    assert.match(text(first.result), /Millstone/);
    await first.close();
    const reopened = await openAtlasSceneWorkspace(ctx.scene, ctx.actions);
    assert.notEqual(reopened, first,
      "closed instances must be discarded");
    await reopened.close();
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
