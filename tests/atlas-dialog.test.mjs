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

function formFor({ enabled = true, source = "manual", scale = "0.05", unit = "km" } = {}) {
  const values = {
    atlasEnabled: { checked: enabled },
    measurementSource: { value: source },
    unitsPerPixel: { value: scale },
    unit: { value: unit }
  };
  return { elements: { namedItem: name => values[name] } };
}

test("DialogV2 serializes legacy v1 manual defaults and switches to Grid only by explicit selection", async () => {
  const previous = { document: globalThis.document, game: globalThis.game, ui: globalThis.ui };
  let stored = {
    schemaVersion: 1,
    revision: 2,
    enabled: true,
    calibration: { source: "manual", unitsPerPixel: 0.05, unit: "km" },
    nodes: [],
    segments: []
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
    globalThis.document = { createElement: tag => new Element(tag) };
    globalThis.game = { user: { isGM: true }, i18n: { localize: key => key } };
    globalThis.ui = {
      notifications: {
        info: (...args) => confirmations.push(args),
        error: error => { throw Error("Unexpected save error: " + error); }
      }
    };
    class MockDialogV2 { constructor(options) { this.options = options; } }
    const AtlasDialog = createAtlasSetupDialogClass(MockDialogV2);
    const dialog = new AtlasDialog(scene, () => { refreshed++; });
    const inputs = elements(dialog.options.content, "input");
    assert.equal(inputs.length, 3);
    assert.equal(inputs[0].attributes.has("checked"), true);
    assert.equal(inputs[1].attributes.get("value"), "0.05");
    assert.equal(inputs[2].attributes.get("value"), "km");
    const sourceSelect = elements(dialog.options.content, "select")[0];
    assert.equal(sourceSelect.children[1].attributes.has("selected"), true, "saved manual must be selected");

    const save = dialog.options.buttons.find(button => button.action === "save");
    assert.equal(await save.callback(null, { form: formFor() }), true);
    assert.equal(stored.revision, 3);
    assert.deepEqual(stored.calibration, { source: "manual", unitsPerPixel: 0.05, unit: "km" });
    assert.equal(refreshed, 1);

    const reopened = new AtlasDialog(scene, () => { refreshed++; });
    const select = elements(reopened.options.content, "select")[0];
    assert.equal(select.children[1].attributes.has("selected"), true);
    const saveGrid = reopened.options.buttons.find(button => button.action === "save");
    assert.equal(await saveGrid.callback(null, { form: formFor({ source: "scene-grid" }) }), true);
    assert.equal(stored.calibration, null, "an explicit switch opts into native Grid in v1");
    assert.equal(stored.revision, 4);
    assert.equal(refreshed, 2);

    const afterGrid = new AtlasDialog(scene);
    const selectedGrid = elements(afterGrid.options.content, "select")[0];
    assert.equal(selectedGrid.children[0].attributes.has("selected"), true);
    assert.equal(confirmations.length, 2);
    assert.deepEqual(confirmations[0][1], { permanent: true });
  } finally {
    globalThis.document = previous.document;
    globalThis.game = previous.game;
    globalThis.ui = previous.ui;
  }
});

test("a new Scene defaults to native Grid; unusable Grid cannot be selected", async () => {
  const previous = { document: globalThis.document, game: globalThis.game, ui: globalThis.ui };
  let stored;
  const errors = [];
  const scene = {
    id: "scene-2", name: "New Scene",
    grid: { size: 100, distance: 2, units: "mi" },
    getFlag() { return stored; },
    canUserModify() { return true; },
    async setFlag(_namespace, _key, next) { stored = next; }
  };
  try {
    globalThis.document = { createElement: tag => new Element(tag) };
    globalThis.game = { user: { isGM: true }, i18n: { localize: key => key } };
    globalThis.ui = { notifications: {
      info() {},
      error(message) { errors.push(message); }
    } };
    class MockDialogV2 { constructor(options) { this.options = options; } }
    const AtlasDialog = createAtlasSetupDialogClass(MockDialogV2);
    const dialog = new AtlasDialog(scene);
    assert.equal(elements(dialog.options.content, "select")[0].children[0].attributes.has("selected"), true);
    const save = dialog.options.buttons.find(button => button.action === "save");

    assert.equal(await save.callback(null, { form: formFor({ source: "manual", scale: "" }) }), false,
      "an empty Manual override must not silently switch to Grid");
    assert.equal(stored, undefined);

    scene.grid.distance = 0; // Grid was modified while the dialog was open
    assert.equal(await save.callback(null, { form: formFor({ source: "scene-grid" }) }), false);
    assert.equal(stored, undefined);
    assert.equal(errors.length, 2);
  } finally {
    globalThis.document = previous.document;
    globalThis.game = previous.game;
    globalThis.ui = previous.ui;
  }
});
