import assert from "node:assert/strict";
import test from "node:test";

globalThis.foundry = { applications: { api: { ApplicationV2: class {
  close() { this.closed = true; }
} } } };
const { AtlasRoadAppearanceSettings, roadAppearanceForm, roadAppearanceFromForm,
  registerWorldRoadAppearance } = await import("../scripts/road-appearance-settings.js");
const { DEFAULT_ROAD_APPEARANCE, ROAD_CURVE_SETTING }
  = await import("../scripts/road-appearance.js");

class Element {
  constructor(tag) {
    this.tag = tag; this.children = []; this.listeners = new Map();
    this.style = {}; this.dataset = {}; this.value = "";
  }
  appendChild(child) { this.children.push(child); }
  append(...children) { this.children.push(...children); }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  querySelectorAll(selector) {
    if (selector !== "[name]") return [];
    const found = [];
    const visit = entry => {
      if (entry.name) found.push(entry);
      for (const child of entry.children) visit(child);
    };
    visit(this);
    return found;
  }
}

test("World Road Appearance settings show Land/Air/Water separately and only save on explicit click", async () => {
  const previous = { document: globalThis.document, game: globalThis.game,
    ui: globalThis.ui };
  let writes = 0, stored, menu;
  const legacy = Object.fromEntries(Object.entries(DEFAULT_ROAD_APPEARANCE)
    .filter(([key]) => key !== "textColor"));
  try {
    globalThis.document = { createElement: tag => new Element(tag) };
    globalThis.game = {
      user: { isGM: true },
      settings: {
        get: () => legacy,
        register() {}, registerMenu(_module, _name, value) { menu = value; },
        async set(_module, _name, value) { stored = value; writes++; }
      }
    };
    globalThis.ui = { notifications: { info() {}, error(m) { throw Error(m); } } };
    registerWorldRoadAppearance();
    assert.match(menu.name, /Road Overlay/);
    const app = new AtlasRoadAppearanceSettings();
    const root = await app._renderHTML();
    const groups = root.children.filter(child => child.tag === "fieldset");
    assert.equal(groups.length, 3);
    assert.equal(writes, 0, "opening legacy flat World settings must not migrate");
    const airForm = groups[1].children[1];
    const fields = airForm.querySelectorAll("[name]");
    assert.ok(fields.some(field => field.name === "atlasRoadTextColor"));
    fields.find(field => field.name === "atlasRoadColor").value = "#f0a041";
    fields.find(field => field.name === "atlasRoadTextColor").value = "#121212";
    const button = root.children.at(-1);
    await button.listeners.get("click")();
    assert.equal(writes, 1);
    assert.equal(app.closed, true);
    assert.equal(stored.schemaVersion, 2);
    assert.equal(stored.profiles.air.color, "#f0a041");
    assert.equal(stored.profiles.air.textColor, "#121212");
    assert.equal(stored.profiles.land.color, legacy.color);
    assert.equal(stored.profiles.water.color, legacy.color);
  } finally { Object.assign(globalThis, previous); }
});

test("road DialogV2 form serializes label color through explicit input defaults", () => {
  const oldDocument = globalThis.document;
  try {
    globalThis.document = { createElement: tag => new Element(tag) };
    const style = { ...DEFAULT_ROAD_APPEARANCE, textColor: "#fefefe" };
    const values = roadAppearanceForm(style).querySelectorAll("[name]");
    const serialized = Object.fromEntries(values.map(field => [field.name, field.defaultValue ?? field.value]));
    assert.equal(roadAppearanceFromForm(serialized).textColor, "#fefefe");
  } finally { globalThis.document = oldDocument; }
});

test("v0.2.25 global curvature offers restricted World presets and live refresh", () => {
  const previous = globalThis.game;
  const registered = new Map();
  let repaints = 0;
  try {
    globalThis.game = { settings: {
      register(_module, key, options) { registered.set(key, options); },
      registerMenu() {}
    } };
    registerWorldRoadAppearance(() => repaints++);
    const curve = registered.get(ROAD_CURVE_SETTING);
    assert.equal(curve.scope, "world");
    assert.equal(curve.config, true);
    assert.equal(curve.type, String);
    assert.equal(curve.default, "gentle");
    assert.deepEqual(Object.keys(curve.choices), ["off", "gentle", "moderate", "strong"]);
    curve.onChange("moderate");
    assert.equal(repaints, 1, "changing only curvature repaints existing roads");
  } finally { globalThis.game = previous; }
});
