import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyAtlas, validateAtlas, upgradeAtlasRoadTextAppearance,
  upgradeAtlasCheckpointAppearance } from "../scripts/atlas-model.js";
import { addRoad } from "../scripts/road-model.js";
import { addRoadCheckpoint, editCheckpointAppearance, editRoadCheckpoint }
  from "../scripts/checkpoint-model.js";
import { CHECKPOINT_ICONS, CHECKPOINT_ICON_ROOT,
  CHECKPOINT_FREE_ICONS, checkpointFontIcon, findCheckpointIcons,
  validateCheckpointAppearance, checkpointIconPath, checkpointMarkerPosition,
  checkpointCanvasSize,
  DEFAULT_CHECKPOINT_APPEARANCE } from "../scripts/checkpoint-appearance.js";
import { saveCheckpointAppearance } from "../scripts/road-storage.js";
import { ATLAS_FLAG, MODULE_ID } from "../scripts/atlas-storage.js";

function fixture() {
  let n = 0;
  const road = addRoad(createEmptyAtlas(), {
    name: "Hidden mountain pass",
    points: [{ x: 1, y: 2 }, { x: 130, y: 110 }],
    idFactory: () => "id" + ++n
  });
  const checkpoint = addRoadCheckpoint(road, {
    roadId: road.roads[0].id,
    candidate: { kind: "node", nodeId: road.segments[0].from },
    name: "Ridge Lookout", elevationMeters: 470,
    idFactory: () => "id" + ++n
  });
  return upgradeAtlasRoadTextAppearance(checkpoint);
}

const fancy = { ...DEFAULT_CHECKPOINT_APPEARANCE, type: "fa",
  icon: "mountain", color: "#edcc44", textColor: "#171717",
  labelMode: "hover", showRoadName: true, size: 32 };

test("v0.2.22 RPG icon catalog is curated but existing/advanced brand picks stay valid", () => {
  const recommended = findCheckpointIcons("", "all", "rpg");
  assert.ok(recommended.length > 100 && recommended.length < 300);
  assert.ok(recommended.every(icon => !icon.id.startsWith("brands:")));
  assert.ok(recommended.some(icon => icon.id === "solid:dragon"));
  assert.ok(findCheckpointIcons("bridge", "all", "travel")
    .some(icon => icon.id === "solid:bridge"));
  assert.equal(findCheckpointIcons("github", "all", "rpg").length, 0);
  assert.ok(findCheckpointIcons("github", "all", "all")
    .some(icon => icon.id === "brands:github"));
  assert.doesNotThrow(() => validateCheckpointAppearance({ ...fancy,
    icon: "brands:github" }));
});

test("v0.2.22 checkpoint zoom changes screen size and vertical offset only", () => {
  const point = { x: 300, y: 440 };
  const normal = checkpointMarkerPosition(point, fancy, 1);
  assert.equal(checkpointCanvasSize(32, 1), 32);
  assert.equal(normal.y, 416);
  for (const zoom of [0.25, 0.5, 1, 2, 4]) {
    const pixels = checkpointCanvasSize(32, zoom) * zoom;
    assert.ok(pixels >= 18 && pixels <= 56);
    const raised = checkpointMarkerPosition(point, fancy, zoom);
    assert.equal(raised.x, point.x);
    assert.ok(raised.y < point.y);
    assert.deepEqual(point, { x: 300, y: 440 });
  }
  assert.deepEqual(checkpointMarkerPosition(point, DEFAULT_CHECKPOINT_APPEARANCE, 4), point);
});

test("v8 checkpoint appearance is an explicit lossless GM-authored migration", () => {
  const old = fixture();
  assert.equal(old.schemaVersion, 7);
  const v8 = upgradeAtlasCheckpointAppearance(old);
  assert.equal(v8.schemaVersion, 8);
  assert.equal(v8.checkpoints[0].appearance, null);
  assert.deepEqual(v8.nodes, old.nodes);
  assert.deepEqual(v8.segments, old.segments);
  assert.deepEqual(v8.roads, old.roads);
  assert.equal(v8.revision, old.revision);
  assert.equal(old.checkpoints[0].appearance, undefined,
    "reading or migrating does not mutate the prior object");

  const updated = editCheckpointAppearance(old, {
    checkpointId: old.checkpoints[0].id, appearance: fancy
  });
  assert.equal(updated.schemaVersion, 8);
  assert.deepEqual(updated.checkpoints[0].appearance, fancy);
  assert.equal(updated.checkpoints[0].elevationMeters, 470);
  assert.equal(updated.checkpoints[0].name, "Ridge Lookout");
  assert.deepEqual(updated.segments, old.segments);
  assert.deepEqual(updated.roads, old.roads);
  assert.deepEqual(editRoadCheckpoint(updated, {
    checkpointId: updated.checkpoints[0].id,
    name: "New label", elevationMeters: 990
  }).checkpoints[0].appearance, fancy, "metadata edits preserve icon configuration");
  assert.equal(editCheckpointAppearance(updated, {
    checkpointId: updated.checkpoints[0].id, appearance: null
  }).checkpoints[0].appearance, null);
  assert.equal(editCheckpointAppearance(old, {
    checkpointId: old.checkpoints[0].id, appearance: null
  }).schemaVersion, 7, "reset on an old Scene does not force migration");
});

test("checkpoint icon style whitelist, type and local image paths are strict", () => {
  assert.equal(CHECKPOINT_ICONS.length, 12);
  assert.equal(CHECKPOINT_FREE_ICONS.length, 2163,
    "Font Awesome Free 7.3.1 Solid, Regular and Brands catalog is complete");
  assert.equal(checkpointIconPath(fancy), CHECKPOINT_ICON_ROOT + "mountain.svg");
  assert.equal(checkpointIconPath(DEFAULT_CHECKPOINT_APPEARANCE), null);
  const image = { ...fancy, type: "image", image: "worlds/my-world/map-icon.webp" };
  assert.equal(checkpointIconPath(image), image.image);
  for (const bad of [
    { ...fancy, icon: "user-secret" },
    { ...fancy, size: 101 },
    { ...fancy, color: "red" },
    { ...fancy, labelMode: "sometimes" },
    { ...fancy, showRoadName: "true" },
    { ...fancy, extra: "unexpected" },
    { ...fancy, type: "image", image: "" },
    { ...fancy, type: "image", image: "../secrets.svg" },
    { ...fancy, type: "image", image: "https://example.org/a.svg" },
    { ...fancy, type: "image", image: "worlds/map.html" }
  ]) assert.throws(() => validateCheckpointAppearance(bad));
  const old = fixture();
  const invalidV8 = { ...upgradeAtlasCheckpointAppearance(old) };
  invalidV8.checkpoints = [{ ...invalidV8.checkpoints[0], appearance: { ...fancy, icon: "hacked" } }];
  assert.throws(() => validateAtlas(invalidV8));
  assert.throws(() => validateAtlas({ ...invalidV8,
    checkpoints: [{ ...old.checkpoints[0] }] }),
  "schema v8 must not silently lose or omit appearance");
});

test("v0.2.21.1 offline icon search, style variants and old IDs coexist", () => {
  const solid = { ...fancy, icon: "solid:mountain" };
  const brand = { ...fancy, icon: "brands:github" };
  const regular = { ...fancy, icon: "regular:address-book" };
  for (const appearance of [solid, brand, regular]) {
    assert.deepEqual(validateCheckpointAppearance(appearance), appearance);
    assert.equal(checkpointIconPath(appearance), null,
      "font glyph icons are not mistaken for missing SVG images");
    assert.ok(checkpointFontIcon(appearance.icon)?.glyph);
  }
  assert.equal(checkpointFontIcon("brands:github").family, "Atlas FA 7 Brands");
  assert.equal(checkpointFontIcon("solid:mountain").weight, 900);
  assert.equal(checkpointFontIcon("regular:address-book").weight, 400);
  assert.equal(findCheckpointIcons("mountain", "solid")
    .some(icon => icon.id === "solid:mountain"), true);
  assert.equal(findCheckpointIcons("github", "brands")
    .some(icon => icon.id === "brands:github"), true);
  assert.equal(findCheckpointIcons("github", "regular").length, 0);
  assert.equal(findCheckpointIcons("not a real icon name").length, 0);
  assert.throws(() => validateCheckpointAppearance({ ...fancy, icon: "brands:fake" }));
  assert.throws(() => validateCheckpointAppearance({ ...fancy, icon: "solid:../mountain" }));
  assert.deepEqual(checkpointMarkerPosition({ x: 53, y: 92 }, solid),
    { x: 53, y: 68 }, "decorative marker offsets from the true checkpoint node");
  assert.deepEqual(checkpointMarkerPosition({ x: 53, y: 92 },
    DEFAULT_CHECKPOINT_APPEARANCE), { x: 53, y: 92 },
  "untouched checkpoints remain centered on their original node");
});

test("checkpoint appearance storage requires GM permission and fresh revision", async () => {
  let stored = fixture();
  const scene = {
    getFlag: (module, key) => module === MODULE_ID && key === ATLAS_FLAG ? stored : undefined,
    canUserModify: () => true,
    setFlag: async (_module, _key, value) => { stored = value; }
  };
  const original = globalThis.game;
  try {
    globalThis.game = { user: { isGM: false } };
    await assert.rejects(saveCheckpointAppearance(scene, {
      checkpointId: stored.checkpoints[0].id, appearance: fancy, expectedRevision: 0
    }), /GM/);
    globalThis.game = { user: { isGM: true } };
    await assert.rejects(saveCheckpointAppearance(scene, {
      checkpointId: stored.checkpoints[0].id, appearance: fancy, expectedRevision: 5
    }), /changed/);
    const revision = stored.revision;
    await saveCheckpointAppearance(scene, {
      checkpointId: stored.checkpoints[0].id, appearance: fancy, expectedRevision: revision
    });
    assert.equal(stored.schemaVersion, 8);
    assert.equal(stored.revision, revision + 1);
    assert.deepEqual(stored.checkpoints[0].appearance, fancy);
    await assert.rejects(saveCheckpointAppearance(scene, {
      checkpointId: stored.checkpoints[0].id, appearance: fancy, expectedRevision: revision
    }), /changed/);
  } finally {
    globalThis.game = original;
  }
});

test("v0.2.21.1 checkpoint editor caps icon buttons and updates live slider value", async () => {
  const previous = { foundry: globalThis.foundry, document: globalThis.document,
    game: globalThis.game, ui: globalThis.ui };
  class Element {
    constructor(tag) {
      this.tag = tag;
      this.children = [];
      this.style = {};
      this.listeners = new Map();
      this.value = "";
      this.textContent = "";
    }
    append(...items) { this.children.push(...items); }
    appendChild(item) { this.children.push(item); return item; }
    replaceChildren(...items) { this.children = [...items]; }
    addEventListener(name, listener) { this.listeners.set(name, listener); }
    setAttribute() {}
  }
  const all = root => [root, ...root.children.flatMap(child => all(child))];
  try {
    globalThis.foundry = { applications: { api: { ApplicationV2: class {} } } };
    globalThis.document = { createElement: tag => new Element(tag) };
    globalThis.game = { user: { isGM: true } };
    globalThis.ui = { notifications: {
      info() {}, error(message) { throw new Error(String(message)); }
    } };
    const { AtlasCheckpointAppearanceEditor } = await import(
      "../scripts/checkpoint-appearance-editor.js");
    const data = upgradeAtlasCheckpointAppearance(fixture());
    let stored = data;
    const scene = { canUserModify: () => true,
      getFlag: (_scope, key) => key === ATLAS_FLAG ? stored : undefined,
      setFlag: async (_scope, _key, value) => { stored = value; } };
    const editor = new AtlasCheckpointAppearanceEditor({ scene,
      checkpointId: data.checkpoints[0].id, expectedRevision: data.revision });
    editor.close = async () => {};
    const root = await editor._renderHTML();
    const buttons = all(root).filter(node => node.tag === "button");
    assert.ok(buttons.length < 85,
      "initial icon grid must not render over two thousand buttons");
    const slider = all(root).find(node => node.tag === "input" && node.type === "range");
    const label = all(root).find(node => node.tag === "output");
    assert.ok(slider && label);
    slider.value = "55";
    slider.listeners.get("input")();
    assert.equal(label.textContent, "55 px");
    const search = all(root).find(node => node.tag === "input" && node.type === "search");
    search.value = "github";
    search.listeners.get("input")();
    assert.ok(!all(root).some(node => node.tag === "button" &&
      node.title?.startsWith("brands:github — ")),
    "RPG-first mode omits unrelated brand icons");
    const category = all(root).find(node => node.tag === "select" &&
      node.children.some(child => child.value === "rpg"));
    category.value = "all";
    category.listeners.get("change")();
    assert.ok(all(root).some(node => node.tag === "button" &&
      node.title?.startsWith("brands:github — ")), "search draws relevant brand glyphs");
    assert.ok(all(root).filter(node => node.tag === "button").length < 85);
    const magicTab = all(root).find(node => node.tag === "button" &&
      node.textContent === "Magic");
    assert.ok(magicTab, "redesigned icon browser includes one-click thematic tabs");
    search.value = "";
    magicTab.listeners.get("click")();
    assert.equal(category.value, "magic");
    const magicIcon = all(root).find(node => node.tag === "button" &&
      node.title?.startsWith("solid:wand-magic — "));
    assert.ok(magicIcon);
    magicIcon.listeners.get("click")();
    const preview = all(root).find(node => node.tag === "section" &&
      node.children.some(child => child.tag === "strong"));
    assert.ok(preview?.children[1].textContent.toLowerCase().includes("wand"),
      "selected icon displays its own larger preview and human-readable title");
    const name = all(root).find(node => node.tag === "input" && node.type === "text" &&
      node.value === "Ridge Lookout");
    const elevation = all(root).find(node => node.tag === "input" && node.type === "number");
    const playerVisible = all(root).find(node => node.tag === "input" &&
      node.type === "checkbox"); // Visibility is the first checkbox in the inspector.
    assert.ok(name && elevation && playerVisible,
      "Shift-click editor combines checkpoint name, elevation and player visibility");
    name.value = "Revealed Lookout";
    elevation.value = "640";
    playerVisible.checked = true;
    const save = all(root).find(node => node.tag === "button" &&
      node.textContent === "Save Checkpoint Settings");
    assert.ok(save);
    save.listeners.get("click")();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(stored.schemaVersion, 9);
    assert.equal(stored.revision, data.revision + 1);
    assert.equal(stored.checkpoints[0].name, "Revealed Lookout");
    assert.equal(stored.checkpoints[0].elevationMeters, 640);
    assert.equal(stored.checkpoints[0].playerVisible, true);
  } finally {
    Object.assign(globalThis, previous);
  }
});
