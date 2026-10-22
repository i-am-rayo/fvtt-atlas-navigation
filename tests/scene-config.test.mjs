import assert from "node:assert/strict";
import test from "node:test";
import { addAtlasSetupToSceneConfig } from "../scripts/scene-config.js";

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

test("Scene Configuration opens an editor for the configured Scene, not the viewed one", async () => {
  const oldDocument = globalThis.document;
  const oldGame = globalThis.game;
  const oldUi = globalThis.ui;
  let appended = null;
  const form = {
    querySelector: () => appended,
    prepend: node => { appended = node; }
  };
  const element = { matches: () => false, querySelector: selector => {
    assert.equal(selector, "form");
    return form;
  } };
  const scene = {
    id: "configured-not-viewed",
    canUserModify: () => true
  };
  let opened;

  try {
    globalThis.document = { createElement: tag => new Element(tag) };
    globalThis.game = {
      user: { isGM: true },
      i18n: { localize: key => key }
    };
    globalThis.ui = { notifications: { error: message => { throw Error(message); } } };

    addAtlasSetupToSceneConfig({ document: scene }, element, async chosen => {
      opened = chosen;
    });
    assert.ok(appended);
    assert.equal(appended.attributes.has("data-fvtt-atlas-setup"), true);
    const controls = appended.children[1];
    const button = controls.children[0];
    assert.equal(button.type, "button");
    let prevented = false;
    await button.listeners.get("click")({
      preventDefault: () => { prevented = true; }
    });
    assert.equal(prevented, true);
    assert.equal(opened, scene);

    addAtlasSetupToSceneConfig({ document: scene }, element, () => {});
    assert.equal(appended.children.length, 3, "rerender must not append duplicates");

    globalThis.game.user.isGM = false;
    appended = null;
    addAtlasSetupToSceneConfig({ document: scene }, element, () => {});
    assert.equal(appended, null, "players must not see the Scene editor");
  } finally {
    globalThis.document = oldDocument;
    globalThis.game = oldGame;
    globalThis.ui = oldUi;
  }
});
