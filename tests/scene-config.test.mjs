import assert from "node:assert/strict";
import test from "node:test";
import { addAtlasRoadsToSceneConfig, registerAtlasSceneTab } from "../scripts/scene-config.js";

class Element {
  constructor(tag) { this.tag = tag; this.attributes = new Map(); this.children = []; this.listeners = new Map(); }
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
    assert.equal(buttons(mounted).length, 1, "empty atlas has only the Roads add button");
    const plus = buttons(mounted)[0];
    assert.equal(plus.textContent, "+");
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
    assert.equal(buttons(mounted).length, 4);
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
