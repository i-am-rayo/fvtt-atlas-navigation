import assert from "node:assert/strict";
import test from "node:test";
import { createAtlasSetupDialogClass } from "../scripts/atlas-setup-dialog.js";

class Element {
  constructor(tag) {
    this.tag = tag;
    this.attributes = new Map();
    this.children = [];
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
  appendChild(child) {
    this.children.push(child);
  }
}

function inputElements(root) {
  const result = [];
  const visit = node => {
    if (node.tag === "input") result.push(node);
    for (const child of node.children) visit(child);
  };
  visit(root);
  return result;
}

test("DialogV2 serializes saved checkbox and numeric/text defaults as HTML attributes", async () => {
  const previous = {
    document: globalThis.document,
    game: globalThis.game,
    ui: globalThis.ui
  };
  let stored = {
    schemaVersion: 1,
    revision: 2,
    enabled: true,
    calibration: { source: "manual", unitsPerPixel: 0.05, unit: "km" },
    nodes: [],
    segments: []
  };
  const confirmations = [];
  const scene = {
    id: "scene-1",
    name: "Paedor",
    getFlag() { return stored; },
    canUserModify() { return true; },
    async setFlag(_namespace, _key, next) { stored = next; }
  };

  try {
    globalThis.document = { createElement: tag => new Element(tag) };
    globalThis.game = {
      user: { isGM: true },
      i18n: { localize: key => key }
    };
    globalThis.ui = {
      notifications: {
        info: (...args) => confirmations.push(args),
        error: error => { throw Error("Unexpected save error: " + error); }
      }
    };

    class MockDialogV2 {
      constructor(options) {
        this.options = options;
      }
    }
    const AtlasDialog = createAtlasSetupDialogClass(MockDialogV2);
    const dialog = new AtlasDialog(scene);
    const inputs = inputElements(dialog.options.content);
    assert.equal(inputs.length, 3);
    assert.equal(inputs[0].attributes.has("checked"), true);
    assert.equal(inputs[1].attributes.get("value"), "0.05");
    assert.equal(inputs[2].attributes.get("value"), "km");

    // The form reads from browser controls; the Scene document stores the data.
    const form = { elements: { namedItem(name) {
      return {
        atlasEnabled: { checked: true },
        unitsPerPixel: { value: "0.05" },
        unit: { value: "km" }
      }[name];
    } } };
    const save = dialog.options.buttons.find(button => button.action === "save");
    assert.equal(await save.callback(null, { form }), true);
    assert.equal(stored.revision, 3);
    assert.deepEqual(stored.calibration, {
      source: "manual", unitsPerPixel: 0.05, unit: "km"
    });
    assert.equal(confirmations.length, 1);
    assert.deepEqual(confirmations[0][1], { permanent: true });

    const reopened = new AtlasDialog(scene);
    const reopenedInputs = inputElements(reopened.options.content);
    assert.equal(reopenedInputs[0].attributes.has("checked"), true);
    assert.equal(reopenedInputs[1].attributes.get("value"), "0.05");
    assert.equal(reopenedInputs[2].attributes.get("value"), "km");
  } finally {
    globalThis.document = previous.document;
    globalThis.game = previous.game;
    globalThis.ui = previous.ui;
  }
});
