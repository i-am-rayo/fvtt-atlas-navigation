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
  }
  append(...items) { this.children.push(...items); }
  appendChild(item) { this.children.push(item); return item; }
  addEventListener(event, handler) { this.listeners.set(event, handler); }
  replaceChildren(...items) { this.children = [...items]; }
}

const descendants = root => [root, ...root.children.flatMap(descendants)];
const button = (root, title) => descendants(root).find(node =>
  node.tag === "button" && node.textContent === title);

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
    let saves = 0;
    const controller = {
      getDraft: () => ({ mode: "new", points: 3 }),
      getNewRoadOptions: () => structuredClone(configured),
      setNewRoadOptions: () => { throw new Error("Dock must not change road settings"); }
    };
    const dock = new AtlasRoadEditorDock({
      scene, controller, onFinish: async () => { saves++; return false; },
      onCancel() {}, onClosed() {}
    });
    const root = await dock._renderHTML();
    assert.ok(descendants(root).some(node => node.textContent === "Hidden River"));
    assert.equal(descendants(root).filter(node => ["input", "select"].includes(node.tag)).length, 0);
    assert.ok(button(root, "Finish Road"));
    assert.ok(button(root, "Cancel"));
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
      ["checkpoint", "Click the road where you want the checkpoint."],
      ["junction", "Click the first road, then click a second road"]
    ]) {
      const controller = { getDraft: () => ({ mode, points: 0 }) };
      const dock = new AtlasRoadEditorDock({
        scene, controller, onFinish() {}, onCancel() {}, onClosed() {}
      });
      const root = await dock._renderHTML();
      assert.ok(descendants(root).some(node => node.textContent.includes(expected)));
      assert.ok(button(root, "Cancel"));
      assert.equal(button(root, "Finish Road"), undefined);
      assert.equal(button(root, "Save Points"), undefined);
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
      onClosed() {}
    });
    let editorEnded = false;
    if (!activeRoadDockForSceneConfig(sheet, dock, controller)) editorEnded = true;
    sheet.rendered = false;
    assert.equal(editorEnded, false, "closing the parent sheet preserves the active point session");
    assert.equal(activeRoadDockForSceneConfig({ document: { id: "other" } },
      dock, controller), false, "other Scene sheets do not own this editor");
    const root = await dock._renderHTML();
    assert.ok(button(root, "Save Points"), "Save Points remains available");
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
