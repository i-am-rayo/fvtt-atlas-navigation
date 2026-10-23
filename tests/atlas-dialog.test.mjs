import assert from "node:assert/strict";
import test from "node:test";
import { createAtlasSetupDialogClass } from "../scripts/atlas-setup-dialog.js";

class Element {
  constructor(tag) {
    this.tag = tag;
    this.attributes = new Map();
    this.children = [];
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  appendChild(child) { this.children.push(child); }
}

function elements(root, tag) {
  const result = [];
  const visit = node => {
    if (node.tag === tag) result.push(node);
    for (const child of node.children) visit(child);
  };
  visit(root);
  return result;
}

function formFor(enabled = true) {
  return { elements: { namedItem: name => name === "atlasEnabled" ?
    { checked: enabled } : undefined } };
}

function globals() {
  const previous = { document: globalThis.document, game: globalThis.game, ui: globalThis.ui };
  globalThis.document = { createElement: tag => new Element(tag) };
  globalThis.game = { user: { isGM: true }, i18n: { localize: key => key } };
  return () => {
    globalThis.document = previous.document;
    globalThis.game = previous.game;
    globalThis.ui = previous.ui;
  };
}

test("old manual calibration is dormant but retained intact when changing Atlas enabled", async () => {
  const restore = globals();
  let stored = {
    schemaVersion: 1, revision: 2, enabled: true,
    calibration: { source: "manual", unitsPerPixel: 0.05, unit: "km" },
    nodes: [], segments: []
  };
  const confirmations = [];
  let refreshed = 0;
  const scene = {
    id: "scene-1", name: "Paedor",
    grid: { size: 49, distance: 7.5, units: "km", type: 3 },
    getFlag() { return stored; },
    canUserModify() { return true; },
    async setFlag(_namespace, _key, next) { stored = next; }
  };
  try {
    globalThis.ui = { notifications: {
      info: (...args) => confirmations.push(args),
      error: error => { throw Error("Unexpected save error: " + error); }
    } };
    class MockDialogV2 { constructor(options) { this.options = options; } }
    const AtlasDialog = createAtlasSetupDialogClass(MockDialogV2);
    const dialog = new AtlasDialog(scene, () => { refreshed++; });
    const inputs = elements(dialog.options.content, "input");
    assert.equal(inputs.length, 1, "only the enabled checkbox is editable");
    assert.equal(inputs[0].attributes.has("checked"), true);
    assert.equal(elements(dialog.options.content, "select").length, 0, "no measurement source override");
    assert.equal(elements(dialog.options.content, "input").some(i => i.name === "unitsPerPixel"), false);

    const save = dialog.options.buttons.find(button => button.action === "save");
    assert.equal(await save.callback(null, { form: formFor(false) }), true);
    assert.equal(stored.enabled, false);
    assert.equal(stored.revision, 3);
    assert.deepEqual(stored.calibration, { source: "manual", unitsPerPixel: 0.05, unit: "km" });
    assert.equal(refreshed, 1);

    const reopened = new AtlasDialog(scene);
    assert.equal(elements(reopened.options.content, "input")[0].attributes.has("checked"), false);
    assert.equal(elements(reopened.options.content, "select").length, 0);
    assert.equal(confirmations.length, 1);
    assert.deepEqual(confirmations[0][1], { permanent: true });
  } finally {
    restore();
  }
});

test("new Scenes persist only enabled state; Grid changes require no Atlas migration", async () => {
  const restore = globals();
  let stored;
  const scene = {
    id: "scene-2", name: "New Scene",
    grid: { size: 100, distance: 2, units: "mi" },
    getFlag() { return stored; },
    canUserModify() { return true; },
    async setFlag(_namespace, _key, next) { stored = next; }
  };
  try {
    globalThis.ui = { notifications: { info() {}, error(message) { throw Error(message); } } };
    class MockDialogV2 { constructor(options) { this.options = options; } }
    const AtlasDialog = createAtlasSetupDialogClass(MockDialogV2);
    const dialog = new AtlasDialog(scene);
    assert.equal(stored, undefined, "opening configuration is read-only");
    assert.equal(elements(dialog.options.content, "input").length, 1);
    const save = dialog.options.buttons.find(button => button.action === "save");
    assert.equal(await save.callback(null, { form: formFor(true) }), true);
    assert.equal(stored.calibration, null, "new flags never store a duplicate scale");
    assert.equal(stored.enabled, true);
    scene.grid.distance = 0;
    const reopened = new AtlasDialog(scene);
    assert.equal(elements(reopened.options.content, "input").length, 1,
      "a missing/invalid grid does not switch on manual scale editing");
  } finally {
    restore();
  }
});
