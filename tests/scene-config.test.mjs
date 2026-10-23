import assert from "node:assert/strict";
import test from "node:test";
import { addAtlasSetupToSceneConfig, registerAtlasSceneTab } from "../scripts/scene-config.js";

class Element {
  constructor(tag) {
    this.tag = tag;
    this.attributes = new Map();
    this.children = [];
    this.listeners = new Map();
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  appendChild(child) { this.children.push(child); }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
}

function buttons(root) {
  const result = [];
  const visit = n => {
    if (n.tag === "button") result.push(n);
    for (const child of n.children) visit(child);
  };
  visit(root);
  return result;
}

test("registers one Atlas tab/part via v14 public SceneConfig TABS/PARTS without touching private methods", () => {
  class SceneConfig {}
  SceneConfig.TABS = { sheet: { initial: "basics", tabs: [
    { id: "basics" }, { id: "grid" }, { id: "levels" }, { id: "misc" }
  ] } };
  SceneConfig.PARTS = {
    tabs: { template: "tabs" },
    basics: { template: "basics" },
    grid: { template: "grid" },
    levels: { template: "levels" },
    misc: { template: "misc" },
    footer: { template: "footer" }
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

test("renders inside Atlas tab and edits configured Scene, never the currently viewed Scene", async () => {
  const previous = { document: globalThis.document, game: globalThis.game, ui: globalThis.ui };
  let mounted = null;
  const nativeRoot = {
    querySelector: selector => selector === "[data-fvtt-atlas-setup]" ? mounted : null,
    appendChild(node) {
      mounted = node;
      node.remove = () => { mounted = null; };
    }
  };
  const element = { matches: () => false, querySelector: selector =>
    selector === "[data-fvtt-atlas-scene-root]" ? nativeRoot : null };
  const scene = {
    id: "configured-not-viewed", name: "Configured Scene",
    grid: { size: 49, distance: 7.5, units: "km" },
    getFlag: () => null,
    canUserModify: () => true
  };
  let opened;
  let refresh;

  try {
    globalThis.document = { createElement: tag => new Element(tag) };
    globalThis.game = { user: { isGM: true }, i18n: { localize: key => key, lang: "en" } };
    globalThis.ui = { notifications: { error: message => { throw Error(message); } } };

    const opener = async (chosen, callback) => { opened = chosen; refresh = callback; };
    addAtlasSetupToSceneConfig({ document: scene }, element, opener);
    assert.ok(mounted, "the native Atlas root must contain the panel");
    assert.equal(mounted.attributes.has("data-fvtt-atlas-setup"), true);
    const button = buttons(mounted)[0];
    assert.equal(button.type, "button");
    let prevented = false;
    await button.listeners.get("click")({ preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(opened, scene);
    assert.equal(typeof refresh, "function");

    const old = mounted;
    refresh();
    assert.notEqual(mounted, old, "after saving, refresh the native tab summary");

    globalThis.game.user.isGM = false;
    mounted = null;
    addAtlasSetupToSceneConfig({ document: scene }, element, opener);
    assert.equal(mounted, null, "players must not see Atlas authoring controls");
  } finally {
    globalThis.document = previous.document;
    globalThis.game = previous.game;
    globalThis.ui = previous.ui;
  }
});

test("a customized Scene sheet gets an in-sheet Misc fallback, not a banner above its tabs", () => {
  const previous = { document: globalThis.document, game: globalThis.game };
  let mounted = null;
  const misc = {
    querySelector: () => null,
    appendChild: node => { mounted = node; }
  };
  const element = { matches: () => false, querySelector: selector => {
    if (selector === '[data-tab="misc"]') return misc;
    return null;
  } };
  const scene = {
    id: "fallback", name: "Fallback Scene",
    grid: { size: 100, distance: 5, units: "ft" },
    getFlag: () => null,
    canUserModify: () => true
  };
  try {
    globalThis.document = { createElement: tag => new Element(tag) };
    globalThis.game = { user: { isGM: true }, i18n: { localize: key => key, lang: "en" } };
    addAtlasSetupToSceneConfig({ document: scene }, element, async () => {});
    assert.ok(mounted, "append to Misc when custom tab part is unavailable");
  } finally {
    globalThis.document = previous.document;
    globalThis.game = previous.game;
  }
});
