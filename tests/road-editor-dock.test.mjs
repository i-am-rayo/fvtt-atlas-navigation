import assert from "node:assert/strict";
import test from "node:test";
import { defaultTravelPresets } from "../scripts/travel-preset-model.js";

test("v0.2.22 floating road controls stage type, name and line style without saving", async () => {
  const previous = { foundry: globalThis.foundry, document: globalThis.document,
    game: globalThis.game };
  class Element {
    constructor(tag) {
      this.tag = tag; this.children = []; this.style = {}; this.listeners = new Map();
      this.value = ""; this.textContent = ""; this.checked = false;
    }
    append(...items) { this.children.push(...items); }
    appendChild(item) { this.children.push(item); return item; }
    addEventListener(event, handler) { this.listeners.set(event, handler); }
    setAttribute() {}
    replaceChildren(...items) { this.children = [...items]; }
  }
  const all = root => [root, ...root.children.flatMap(child => all(child))];
  try {
    globalThis.foundry = { applications: { api: { ApplicationV2: class {} } } };
    globalThis.document = { createElement: tag => new Element(tag) };
    const presets = defaultTravelPresets();
    globalThis.game = { user: { isGM: true }, settings: { get(_id, name) {
      return name === "travelPresets" ? presets : undefined;
    } } };
    const { AtlasRoadEditorDock } = await import("../scripts/road-editor-dock.js");
    const scene = { id: "dock-scene", canUserModify: () => true };
    let staged = { name: "New Road", presetId: null, appearance: null };
    let saved = 0;
    const controller = {
      getDraft: () => ({ mode: "new", points: 3 }),
      getNewRoadOptions: () => structuredClone(staged),
      setNewRoadOptions: (_scene, patch) => { staged = { ...staged, ...patch }; }
    };
    const dock = new AtlasRoadEditorDock({ scene, controller,
      onFinish: async () => { saved++; return false; }, onCancel() {}, onClosed() {} });
    let root = await dock._renderHTML();
    const name = all(root).find(n => n.tag === "input" && n.type === "text");
    name.value = "Hidden River";
    name.listeners.get("input")();
    assert.equal(staged.name, "Hidden River");
    const select = all(root).find(n => n.tag === "select" &&
      n.children.some(option => option.value === "water"));
    select.value = "water";
    dock.render = () => {};
    select.listeners.get("change")();
    assert.ok(presets.presets.some(p => p.mode === "water" && p.id === staged.presetId));
    const override = all(root).find(n => n.tag === "input" && n.type === "checkbox");
    override.checked = true;
    override.listeners.get("change")();
    assert.ok(staged.appearance);
    root = await dock._renderHTML();
    const color = all(root).find(n => n.tag === "input" && n.type === "color");
    color.value = "#bb5533";
    color.listeners.get("input")();
    assert.equal(staged.appearance.color, "#bb5533");
    const slider = all(root).find(n => n.tag === "input" && n.type === "range");
    slider.value = "7";
    slider.listeners.get("input")();
    assert.equal(staged.appearance.width, 7);
    assert.equal(saved, 0, "draft changes never save until Finish Road");
  } finally { Object.assign(globalThis, previous); }
});
