import { nativeFogCells } from "../scripts/atlas-manual-fog-geometry.js";
import assert from "node:assert/strict";
import test from "node:test";
import { RoadCanvasController } from "../scripts/road-canvas.js";
import { readAtlas } from "../scripts/atlas-storage.js";
import { createEmptyAtlas, upgradeAtlasRoadAppearance } from "../scripts/atlas-model.js";
import { addRoad } from "../scripts/road-model.js";
import { addRoadCheckpoint, editCheckpointAppearance } from "../scripts/checkpoint-model.js";
import { DEFAULT_CHECKPOINT_APPEARANCE } from "../scripts/checkpoint-appearance.js";
import { setRoadPlayerVisibility, setCheckpointPlayerVisibility }
  from "../scripts/player-visibility.js";
import { defaultPartyExploration, setCheckpointKnowledge }
  from "../scripts/party-exploration-model.js";
import { DEFAULT_WORLD_ROAD_APPEARANCE, ROAD_CURVE_SETTING,
  ROAD_APPEARANCE_SETTING } from "../scripts/road-appearance.js";

function setup() {
  const listeners = new Map();
  const docListeners = new Map();
  const element = {
    addEventListener: (key, handler) => listeners.set(key, handler),
    removeEventListener: (key, handler) => { if (listeners.get(key) === handler) listeners.delete(key); }
  };
  const doc = {
    addEventListener: (key, handler) => docListeners.set(key, handler),
    removeEventListener: (key, handler) => {
      if (docListeners.get(key) === handler) docListeners.delete(key);
    }
  };
  let saved;
  const scene = {
    id: "canvas-scene",
    canUserModify: () => true,
    getFlag: (_scope, key) => key === "atlas" ? saved : null,
    async setFlag(_module, _flag, value) { saved = value; }
  };
  class Graphics {
    destroyed = false;
    strokes = 0;
    drawn = [];
    clear() { this.strokes = 0; this.drawn = []; }
    moveTo(x, y) { this.drawn.push({ x, y }); return this; }
    lineTo(x, y) { this.drawn.push({ x, y }); return this; }
    stroke() { this.strokes++; return this; }
    circle() { return this; }
    fill() { return this; }
    destroy() { this.destroyed = true; }
  }
  const canvas = {
    ready: true,
    scene,
    dimensions: { sceneX: 10, sceneY: 30, sceneRect: { contains: () => true } },
    app: { canvas: element },
    canvasCoordinatesFromClient: ({ x, y }) => ({ x: x * 2, y: y * 2 }),
    interface: {
      addChild(g) { g.parent = this; },
      removeChild(g) { g.parent = null; }
    },
    primary: {
      addChild(g) { g.parent = this; },
      removeChild(g) { g.parent = null; }
    }
  };
  const notifications = { info: [], error: [], warn: [] };
  const notify = {};
  for (const name of Object.keys(notifications)) {
    notify[name] = message => notifications[name].push(message);
  }
  let n = 0;
  const prompts = [];
  const detachPrompts = [];
  let approve = true;
  let detachApproved = true;
  const controller = new RoadCanvasController({
    canvasProvider: () => canvas, doc: () => doc,
    idFactory: () => "node" + ++n, notify: () => notify,
    confirmAttach: async details => { prompts.push(details); return approve; },
    confirmDetach: async details => { detachPrompts.push(details); return detachApproved; }
  });
  return { controller, scene, canvas, listeners, docListeners, notifications, Graphics,
    prompts, approve: value => { approve = value; },
    detachPrompts, approveDetach: value => { detachApproved = value; } };
}

function pointEvent(x, y) {
  let prevented = false;
  return {
    button: 0, clientX: x, clientY: y,
    preventDefault() { prevented = true; },
    stopImmediatePropagation() {},
    get prevented() { return prevented; }
  };
}

test("v0.2.22 idle GM Shift-click opens a road without requiring label visibility", async () => {
  const previous = { game: globalThis.game, PIXI: globalThis.PIXI };
  const m = setup();
  try {
    globalThis.game = { user: { isGM: true } };
    globalThis.PIXI = { Graphics: m.Graphics };
    m.canvas.stage = { scale: { x: 1 } };
    let id = 0;
    const saved = addRoad(createEmptyAtlas(), {
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      name: "Quiet road", idFactory: () => "shift" + ++id
    });
    await m.scene.setFlag("fvtt-atlas-navigation", "atlas", saved);
    const hits = [];
    m.controller.setShortcutHandler((scene, target) => hits.push({ scene, target }));
    assert.ok(m.listeners.has("pointerdown"));
    const ordinary = { ...pointEvent(25, 15), shiftKey: false };
    m.listeners.get("pointerdown")(ordinary);
    await Promise.resolve();
    assert.equal(hits.length, 0);
    const selected = { ...pointEvent(25, 15), shiftKey: true };
    m.listeners.get("pointerdown")(selected);
    await Promise.resolve();
    assert.deepEqual(hits.map(hit => hit.target),
      [{ kind: "road", id: saved.roads[0].id }]);
    m.controller.tearDown();
    assert.equal(m.listeners.has("pointerdown"), false);
  } finally { Object.assign(globalThis, previous); }
});

test("v0.2.22 canvas zoom redraws checkpoint overlay after a short debounce", async () => {
  const previous = { game: globalThis.game, PIXI: globalThis.PIXI };
  const m = setup();
  try {
    globalThis.game = { user: { isGM: true } };
    globalThis.PIXI = { Graphics: m.Graphics };
    m.canvas.stage = { scale: { x: 1 } };
    m.controller.refresh();
    assert.equal(m.controller.lastZoom, 1);
    m.canvas.stage.scale.x = 3;
    m.controller.onCanvasPan(m.canvas);
    await new Promise(resolve => setTimeout(resolve, 85));
    assert.equal(m.controller.lastZoom, 3);
    m.controller.tearDown();
  } finally { Object.assign(globalThis, previous); }
});

test("v0.2.23 GM canvas clusters nearby checkpoints, previews names, and expands on zoom", async () => {
  const previous = { game: globalThis.game, PIXI: globalThis.PIXI };
  const m = setup();
  class Text {
    constructor(text, style) {
      this.text = String(text); this.style = style;
      this.anchor = { set() {} }; this.position = { set() {} };
    }
    destroy() {}
  }
  m.Graphics.prototype.addChild = function(node) { node.parent = this; };
  try {
    globalThis.game = { user: { isGM: true } };
    globalThis.PIXI = { Graphics: m.Graphics, Text };
    m.canvas.stage = { scale: { x: 0.5 } };
    let id = 0;
    const idFactory = () => "near" + ++id;
    let atlas = addRoad(createEmptyAtlas(), {
      points: [{ x: 10, y: 10 }, { x: 50, y: 10 }],
      name: "Stone Road", idFactory
    });
    atlas = addRoadCheckpoint(atlas, {
      candidate: { kind: "node", nodeId: atlas.segments[0].from },
      roadId: atlas.roads[0].id, name: "Bridge", elevationMeters: 10, idFactory
    });
    atlas = addRoadCheckpoint(atlas, {
      candidate: { kind: "node", nodeId: atlas.segments[0].to },
      roadId: atlas.roads[0].id, name: "Ford", elevationMeters: 20, idFactory
    });
    await m.scene.setFlag("fvtt-atlas-navigation", "atlas", atlas);
    m.controller.refresh();
    assert.equal(m.controller.clusterHoverGeometry.length, 1);
    assert.equal(m.controller.checkpointHoverGeometry.length, 0);
    const group = m.controller.clusterHoverGeometry[0];
    m.listeners.get("pointermove")({ clientX: group.x / 2, clientY: group.y / 2 });
    assert.ok(m.controller.labels.some(label => String(label.text ?? "").includes("2 checkpoints")));
    assert.ok(m.controller.labels.some(label => String(label.text ?? "").includes("Bridge")));
    let shortcuts = 0;
    m.controller.setShortcutHandler(() => { shortcuts++; });
    const event = { ...pointEvent(group.x / 2, group.y / 2), shiftKey: true };
    m.listeners.get("pointerdown")(event);
    await Promise.resolve();
    assert.equal(shortcuts, 0, "collapsed cluster must not open the wrong checkpoint");
    assert.match(m.notifications.info.at(-1), /Zoom in/);
    m.canvas.stage.scale.x = 2;
    m.controller.refresh();
    assert.equal(m.controller.clusterHoverGeometry.length, 0);
    assert.ok(m.controller.checkpointHoverGeometry.length >= 2);
    m.controller.tearDown();
  } finally { Object.assign(globalThis, previous); }
});

test("v0.2.23 checkpoint quick info works with labels Off without changing Scene flags", async () => {
  const previous = { game: globalThis.game, PIXI: globalThis.PIXI };
  const m = setup();
  class Text {
    constructor(text, style) {
      this.text = String(text); this.style = style;
      this.anchor = { set() {} }; this.position = { set() {} };
    }
    destroy() {}
  }
  m.Graphics.prototype.addChild = function(node) { node.parent = this; };
  try {
    globalThis.game = { user: { isGM: true } };
    globalThis.PIXI = { Graphics: m.Graphics, Text };
    m.canvas.stage = { scale: { x: 2 } };
    let n = 0;
    const idFactory = () => "quick" + ++n;
    let atlas = addRoad(createEmptyAtlas(), {
      points: [{ x: 20, y: 30 }, { x: 170, y: 30 }],
      name: "Quiet Trail", idFactory
    });
    atlas = addRoadCheckpoint(atlas, {
      candidate: { kind: "node", nodeId: atlas.segments[0].from },
      roadId: atlas.roads[0].id, name: "Old Watchtower",
      elevationMeters: 125, idFactory
    });
    await m.scene.setFlag("fvtt-atlas-navigation", "atlas", atlas);
    m.controller.refresh();
    const persisted = readAtlas(m.scene);
    assert.equal(m.controller.labels.filter(label => label instanceof Text &&
      label.text === "Old Watchtower").length, 0, "no checkpoint title before hover");
    const checkpoint = m.controller.checkpointHoverGeometry[0];
    m.listeners.get("pointermove")(pointEvent(checkpoint.x / 2, checkpoint.y / 2));
    const preview = m.controller.labels.find(label => label instanceof Text &&
      label.text.includes("Old Watchtower"));
    assert.ok(preview);
    assert.match(preview.text, /Road: Quiet Trail/);
    assert.match(preview.text, /Elevation: 125 m/);
    assert.deepEqual(readAtlas(m.scene), persisted, "hover presentation is read-only");
    m.listeners.get("pointerleave")();
    assert.equal(m.controller.labels.filter(label => label instanceof Text &&
      label.text.includes("Old Watchtower")).length, 0, "hover title cleared");
  } finally {
    m.controller.tearDown();
    Object.assign(globalThis, previous);
  }
});

test("v0.2.24 GM elevation preview sits below the checkpoint and road labels", async () => {
  const previous = { game: globalThis.game, PIXI: globalThis.PIXI };
  const m = setup();
  class Text {
    constructor(text, style) {
      this.text = String(text); this.style = style;
      this.anchor = { set() {} };
      this.position = { set(x, y) { this.x = x; this.y = y; } };
    }
    destroy() {}
  }
  m.Graphics.prototype.addChild = function(node) { node.parent = this; };
  try {
    globalThis.game = { user: { isGM: true } };
    globalThis.PIXI = { Graphics: m.Graphics, Text };
    m.canvas.stage = { scale: { x: 1 } };
    let i = 0;
    const idFactory = () => "elev" + ++i;
    let atlas = addRoad(createEmptyAtlas(), {
      points: [{ x: 20, y: 30 }, { x: 150, y: 30 }], name: "The Eyrie", idFactory
    });
    atlas = addRoadCheckpoint(atlas, {
      candidate: { kind: "node", nodeId: atlas.segments[0].from },
      roadId: atlas.roads[0].id, name: "Bridge West", elevationMeters: 120, idFactory
    });
    atlas = editCheckpointAppearance(atlas, {
      checkpointId: atlas.checkpoints[0].id,
      appearance: { ...DEFAULT_CHECKPOINT_APPEARANCE,
        labelMode: "hover", showRoadName: true }
    });
    await m.scene.setFlag("fvtt-atlas-navigation", "atlas", atlas);
    m.controller.refresh();
    m.listeners.get("pointermove")(pointEvent(15, 30));
    const labels = m.controller.labels;
    const name = labels.find(item => item.text === "Bridge West");
    const road = labels.find(item => item.text === "The Eyrie");
    const elevation = labels.find(item => item.text === "Elevation: 120 m");
    assert.ok(name && road && elevation);
    assert.ok(name.position.y < road.position.y);
    assert.ok(elevation.position.y > road.position.y + 10,
      "elevation starts below the road subtitle, not across it");
    assert.equal(elevation.position.x, name.position.x);
  } finally { m.controller.tearDown(); Object.assign(globalThis, previous); }
});

test("v0.2.24.2 ordinary player sees only revealed geometry, with no hidden metadata or editing", async () => {
  const previous = { game: globalThis.game, PIXI: globalThis.PIXI };
  const m = setup();
  const text = [];
  class Text {
    constructor(value) { this.text = String(value); text.push(this.text); }
    destroy() {}
  }
  m.Graphics.prototype.addChild = function(node) { node.parent = this; };
  try {
    globalThis.game = { user: { isGM: false } };
    globalThis.PIXI = { Graphics: m.Graphics, Text };
    m.canvas.stage = { scale: { x: 1 } };
    let i = 0;
    const idFactory = () => "public" + ++i;
    let atlas = addRoad(createEmptyAtlas(), {
      points: [{ x: 20, y: 30 }, { x: 150, y: 30 }], name: "Secret Route", idFactory
    });
    atlas = addRoadCheckpoint(atlas, {
      candidate: { kind: "node", nodeId: atlas.segments[0].from },
      roadId: atlas.roads[0].id, name: "Hidden Shrine", elevationMeters: 999,
      idFactory
    });
    const roadId = atlas.roads[0].id;
    const checkpointId = atlas.checkpoints[0].id;
    await m.scene.setFlag("fvtt-atlas-navigation", "atlas", atlas);
    m.controller.refresh();
    assert.equal(m.controller.graphics, null, "legacy atlas is player-hidden");
    atlas = setCheckpointPlayerVisibility(atlas, { checkpointId, visible: true });
    await m.scene.setFlag("fvtt-atlas-navigation", "atlas", atlas);
    m.controller.refresh();
    assert.ok(m.controller.graphics, "visible checkpoint creates overlay");
    assert.equal(m.controller.graphics.drawn.length, 0, "hidden road contributes no path geometry; checkpoint borders may stroke");
    assert.equal(m.listeners.has("pointermove"), true,
      "an expressly revealed checkpoint can offer its name on hover");
    assert.equal(m.listeners.has("pointerdown"), false, "no GM shortcut capture");
    assert.deepEqual(text, [], "player receives neither hidden road nor checkpoint labels");
    atlas = setRoadPlayerVisibility(atlas, { roadId, visible: true });
    await m.scene.setFlag("fvtt-atlas-navigation", "atlas", atlas);
    m.controller.refresh();
    assert.ok(m.controller.graphics.drawn.length > 0, "explicitly revealed road contributes path geometry");
    atlas = setRoadPlayerVisibility(atlas, { roadId, visible: false });
    atlas = setCheckpointPlayerVisibility(atlas, { checkpointId, visible: false });
    await m.scene.setFlag("fvtt-atlas-navigation", "atlas", atlas);
    m.controller.refresh();
    assert.equal(m.controller.graphics, null, "last hide removes player graphics entirely");
  } finally { m.controller.tearDown(); Object.assign(globalThis, previous); }
});

test("v0.2.20 named road styles draw dashed overlay and show one hover label", async () => {
  const previous = { game: globalThis.game, PIXI: globalThis.PIXI };
  const m = setup();
  const strokes = [];
  const oldStroke = m.Graphics.prototype.stroke;
  m.Graphics.prototype.stroke = function(options) {
    strokes.push({ options, points: this.drawn.slice() });
    return oldStroke.call(this, options);
  };
  m.Graphics.prototype.addChild = function(label) { label.parent = this; };
  class Text {
    constructor(text, style) { this.text = String(text); this.style = style;
      this.anchor = { set() {} };
      this.position = { set() {} }; this.destroyed = false; }
    destroy() { this.destroyed = true; }
  }
  try {
    globalThis.game = { user: { isGM: true } };
    globalThis.PIXI = { Graphics: m.Graphics, Text };
    let n = 0;
    const atlas = addRoad(createEmptyAtlas(), {
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }],
      name: "King's Road", idFactory: () => "test" + ++n
    });
    const modern = upgradeAtlasRoadAppearance(atlas);
    modern.roads[0].appearance = { color: "#c28436", width: 5, opacity: 0.8,
      pattern: "dashed", labelVisibility: "hover" };
    await m.scene.setFlag("fvtt-atlas-navigation", "atlas", modern);
    m.controller.refresh();
    assert.equal(m.controller.labels.length, 0, "hover label initially hidden");
    assert.ok(m.listeners.has("pointermove"));
    assert.ok(strokes.some(s => s.options?.color === 0xc28436 &&
      s.options?.width === 5 && s.options?.alpha === 0.8));
    const segments = strokes.flatMap(s => s.points);
    assert.ok(segments.length > 8, "dashes break one road into multiple drawn spans");
    m.listeners.get("pointermove")(pointEvent(25, 15));
    assert.equal(m.controller.labels.length, 1, "one label for one named road");
    assert.equal(m.controller.labels[0].text, "King's Road");
    assert.equal(m.controller.labels[0].style.fill, 0xffffff,
      "legacy v6 labels inherit the white text default");
    m.listeners.get("pointerleave")();
    assert.equal(m.controller.labels.length, 0, "label cleared after hover");
    m.controller.tearDown();
    assert.ok(!m.listeners.has("pointermove"), "hover listener cleaned up");
  } finally {
    m.controller.tearDown();
    m.Graphics.prototype.stroke = oldStroke;
    Object.assign(globalThis, previous);
  }
});

test("v0.2.21 checkpoint icons load locally and labels include owning road on hover", async () => {
  const previous = { game: globalThis.game, PIXI: globalThis.PIXI,
    foundry: globalThis.foundry };
  const m = setup();
  const loadedPaths = [];
  const sprites = [];
  class Sprite {
    constructor(texture) {
      this.texture = texture; this.anchor = { set() {} };
      this.position = { set(x, y) { this.x = x; this.y = y; } };
      this.destroyed = false; sprites.push(this);
    }
    destroy() { this.destroyed = true; }
  }
  class Text {
    constructor(content, style) {
      this.text = String(content); this.style = style;
      this.anchor = { set() {} }; this.position = { set(x, y) { this.x = x; this.y = y; } };
    }
    destroy() {}
  }
  m.Graphics.prototype.addChild = function(obj) { obj.parent = this; };
  try {
    globalThis.game = { user: { isGM: true } };
    globalThis.foundry = { canvas: { loadTexture: async src => {
      loadedPaths.push(src); return { src };
    } } };
    globalThis.PIXI = { Graphics: m.Graphics, Sprite, Text };
    let n = 0;
    const road = addRoad(createEmptyAtlas(), {
      points: [{ x: 20, y: 30 }, { x: 120, y: 30 }],
      name: "Mountain Track", idFactory: () => "appearance" + ++n
    });
    const cp = addRoadCheckpoint(road, {
      roadId: road.roads[0].id,
      candidate: { kind: "node", nodeId: road.segments[0].from },
      name: "Pass", elevationMeters: 300, idFactory: () => "appearance" + ++n
    });
    const styled = editCheckpointAppearance(cp, {
      checkpointId: cp.checkpoints[0].id,
      appearance: { ...DEFAULT_CHECKPOINT_APPEARANCE,
        type: "fa", icon: "mountain", size: 32, color: "#ffaa11",
        labelMode: "hover", showRoadName: true }
    });
    await m.scene.setFlag("fvtt-atlas-navigation", "atlas", styled);
    m.controller.refresh();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(loadedPaths,
      ["modules/fvtt-atlas-navigation/assets/checkpoint-icons/mountain.svg"]);
    assert.equal(sprites.filter(sprite => sprite.tint === 0xffaa11).length, 1,
      "only the visible checkpoint marker uses the configured tint");
    assert.ok(sprites.length >= 9,
      "the silhouette border is rendered with offset sprites");
    assert.equal(sprites[0].width, 32);
    assert.equal(sprites[0].tint, 0xffaa11);
    assert.equal(sprites[0].position.x, 30);
    assert.equal(sprites[0].position.y, 30, "visual icon is anchored above the checkpoint node at y=60");
    assert.equal(m.controller.labels.filter(x => x instanceof Text).length, 0);
    // canvas point x=sceneX(10)+20, y=sceneY(30)+30 => client midpoint (15,30).
    m.listeners.get("pointermove")(pointEvent(15, 30));
    const title = m.controller.labels.find(l => l instanceof Text && l.text === "Pass");
    const subtitle = m.controller.labels.find(l => l instanceof Text &&
      l.text === "Mountain Track");
    assert.ok(title && subtitle, "checkpoint hover has distinct name and road labels");
    assert.equal(title.style.fontSize, 16);
    assert.equal(title.style.fontWeight, "bold");
    assert.equal(subtitle.style.fontSize, 12);
    assert.equal(subtitle.style.fontStyle, "italic");
    assert.ok(subtitle.position.y > title.position.y);
    m.listeners.get("pointerleave")();
    assert.equal(m.controller.labels.filter(x => x instanceof Text).length, 0);
    m.controller.tearDown();
    assert.ok(sprites.some(s => s.destroyed), "sprites released on teardown");
  } finally {
    m.controller.tearDown();
    Object.assign(globalThis, previous);
  }
});

test("v0.2.21.1 font glyph renders above checkpoint and hover works on icon", async () => {
  const previous = { game: globalThis.game, PIXI: globalThis.PIXI,
    foundry: globalThis.foundry, document: globalThis.document };
  const m = setup();
  class Text {
    constructor(content, style) {
      this.text = String(content); this.style = style;
      this.position = { set(x, y) { this.x = x; this.y = y; } };
      this.anchor = { set() {} };
    }
    destroy() {}
  }
  m.Graphics.prototype.addChild = function(label) { label.parent = this; };
  try {
    globalThis.game = { user: { isGM: true } };
    globalThis.PIXI = { Graphics: m.Graphics, Text };
    globalThis.document = { fonts: { load: async () => [{}] } };
    globalThis.foundry = { canvas: { loadTexture: async () => {
      throw new Error("font icon must never request a texture");
    } } };
    let n = 0;
    const road = addRoad(createEmptyAtlas(), {
      name: "The Underpass", points: [{ x: 20, y: 30 }, { x: 140, y: 30 }],
      idFactory: () => "font" + ++n
    });
    const cp = addRoadCheckpoint(road, {
      roadId: road.roads[0].id,
      candidate: { kind: "node", nodeId: road.segments[0].from },
      name: "Crossing", elevationMeters: 0, idFactory: () => "font" + ++n
    });
    const styled = editCheckpointAppearance(cp, {
      checkpointId: cp.checkpoints[0].id,
      appearance: { ...DEFAULT_CHECKPOINT_APPEARANCE, type: "fa",
        icon: "brands:github", size: 40, labelMode: "hover" }
    });
    await m.scene.setFlag("fvtt-atlas-navigation", "atlas", styled);
    m.controller.refresh();
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
    const glyph = m.controller.labels.find(l => l instanceof Text &&
      l.style.fontFamily === "Atlas FA 7 Brands");
    assert.ok(glyph, "a locally loaded webfont glyph is shown without any image requests");
    assert.equal(glyph.position.y, 26, "40 px glyph floats 34 px above node at y=60");
    assert.equal(glyph.style.fontSize, 40);
    // Clicking/hovering the floating graphic is visually separate from the node.
    m.listeners.get("pointermove")(pointEvent(15, 16));
    assert.ok(m.controller.labels.some(l => l instanceof Text && l.text === "Crossing"));
    assert.ok(!m.controller.labels.some(l => l.text === "The Underpass"),
      "road subtitle stays optional");
  } finally {
    m.controller.tearDown();
    Object.assign(globalThis, previous);
  }
});

test("click-to-draw uses canvas coordinates and saves with visible feedback", async () => {
  const prev = { game: globalThis.game, PIXI: globalThis.PIXI };
  const m = setup();
  try {
    globalThis.game = { user: { isGM: true } };
    globalThis.PIXI = { Graphics: m.Graphics };
    let refreshes = 0;
    m.controller.start(m.scene, () => refreshes++);
    assert.ok(m.listeners.has("pointerdown"));
    assert.ok(m.docListeners.has("keydown"));
    const first = pointEvent(10, 20);
    m.listeners.get("pointerdown")(first);
    assert.equal(first.prevented, true);
    m.listeners.get("pointerdown")(pointEvent(30, 40));
    assert.deepEqual(m.controller.getDraft(m.scene), { points: 2, saving: false, mode: "new" });
    assert.equal(await m.controller.finish(), true);
    assert.equal(m.controller.getDraft(m.scene), null);
    assert.ok(!m.listeners.has("pointerdown"), "pointer capture removed after finish");
    assert.ok(!m.docListeners.has("keydown"));
    const atlas = readAtlas(m.scene);
    assert.deepEqual(atlas.nodes.map(n => ({ x: n.x, y: n.y })), [
      { x: 10, y: 10 }, { x: 50, y: 50 }
    ]);
    assert.equal(atlas.segments.length, 1);
    assert.ok(m.notifications.info.some(s => s.includes("saved")));
    assert.ok(refreshes >= 3);
    m.controller.selectRoad(m.scene, atlas.roads[0].id);
    assert.ok(m.controller.graphics.strokes > 0);
  } finally {
    m.controller.tearDown();
    Object.assign(globalThis, prev);
  }
});

test("Escape cancels a draft with no Scene flag mutation", () => {
  const prev = { game: globalThis.game, PIXI: globalThis.PIXI };
  const m = setup();
  try {
    globalThis.game = { user: { isGM: true } };
    globalThis.PIXI = { Graphics: m.Graphics };
    m.controller.start(m.scene, () => {});
    m.listeners.get("pointerdown")(pointEvent(2, 3));
    m.docListeners.get("keydown")({
      key: "Escape", target: {}, preventDefault() {}
    });
    assert.equal(m.controller.getDraft(m.scene), null);
    assert.equal(readAtlas(m.scene).segments.length, 0);
    assert.deepEqual([...m.listeners.keys()], [],
      "canceling an unsaved draft releases editor listeners");
  } finally {
    m.controller.tearDown();
    Object.assign(globalThis, prev);
  }
});

test("non-GM cannot create roads or see overlays", () => {
  const prev = { game: globalThis.game, PIXI: globalThis.PIXI };
  const m = setup();
  try {
    globalThis.game = { user: { isGM: false } };
    globalThis.PIXI = { Graphics: m.Graphics };
    assert.throws(() => m.controller.start(m.scene, () => {}), /Only a GM/);
    m.controller.refresh();
    assert.equal(m.controller.graphics, null);
  } finally { Object.assign(globalThis, prev); }
});

test("road overlay tracks image movement after Scene padding changes", async () => {
  const prev = { game: globalThis.game, PIXI: globalThis.PIXI };
  const m = setup();
  try {
    globalThis.game = { user: { isGM: true } };
    globalThis.PIXI = { Graphics: m.Graphics };
    m.controller.start(m.scene, () => {});
    m.listeners.get("pointerdown")(pointEvent(10, 20));
    m.listeners.get("pointerdown")(pointEvent(30, 40));
    assert.equal(await m.controller.finish(), true);
    const before = m.controller.graphics.drawn[0];
    assert.deepEqual(before, { x: 20, y: 40 });
    m.canvas.dimensions.sceneX = 30;
    m.canvas.dimensions.sceneY = 70;
    m.controller.refresh();
    assert.deepEqual(m.controller.graphics.drawn[0], { x: 40, y: 80 },
      "stored image-local geometry follows the moving Scene image origin");
    assert.deepEqual(readAtlas(m.scene).nodes[0], { id: "node1", x: 10, y: 10 });
  } finally {
    m.controller.tearDown();
    Object.assign(globalThis, prev);
  }
});

test("closing the Scene Config cancels drafts and releases selected highlights", async () => {
  const prev = { game: globalThis.game, PIXI: globalThis.PIXI };
  const m = setup();
  try {
    globalThis.game = { user: { isGM: true } };
    globalThis.PIXI = { Graphics: m.Graphics };
    m.controller.start(m.scene, () => {});
    m.listeners.get("pointerdown")(pointEvent(2, 3));
    m.controller.endEditor(m.scene);
    assert.equal(m.controller.getDraft(m.scene), null);
    assert.deepEqual([...m.listeners.keys()], [],
      "canceling an unsaved draft releases editor listeners");
    assert.equal(readAtlas(m.scene).segments.length, 0);
    m.controller.start(m.scene, () => {});
    m.listeners.get("pointerdown")(pointEvent(20, 30));
    m.listeners.get("pointerdown")(pointEvent(50, 30));
    assert.equal(await m.controller.finish(), true);
    const roadId = readAtlas(m.scene).roads[0].id;
    m.controller.selectRoad(m.scene, roadId);
    assert.equal(m.controller.selectedRoadId, roadId);
    m.controller.endEditor(m.scene);
    assert.equal(m.controller.selectedRoadId, null);
  } finally {
    m.controller.tearDown();
    Object.assign(globalThis, prev);
  }
});


test("drag handles preview without writes; undo, cancel, and save are reversible",async()=>{
 const prev={game:globalThis.game,PIXI:globalThis.PIXI};
 const m=setup();
 try {
  globalThis.game={user:{isGM:true}};
  globalThis.PIXI={Graphics:m.Graphics};
  m.controller.start(m.scene,()=>{});
  m.listeners.get("pointerdown")(pointEvent(20,30));
  m.listeners.get("pointerdown")(pointEvent(35,40));
  m.listeners.get("pointerdown")(pointEvent(50,30));
  assert.equal(await m.controller.finish(),true);
  const prior=readAtlas(m.scene), roadId=prior.roads[0].id;
  const startBend=prior.segments[0].via[0];
  assert.deepEqual(startBend,{x:60,y:50});
  m.controller.startPointEdit(m.scene,roadId,()=>{});
  assert.equal(m.controller.getDraft(m.scene).mode,"points");
  m.listeners.get("pointerdown")(pointEvent(35,40));
  m.listeners.get("pointermove")(pointEvent(40,50));
  assert.deepEqual(readAtlas(m.scene).segments[0].via[0],startBend,"drag is not persisted");
  m.listeners.get("pointerup")(pointEvent(40,50));
  assert.equal(m.controller.getDraft(m.scene).dirty,true);
  m.controller.undo();
  assert.equal(m.controller.getDraft(m.scene).dirty,false);
  m.listeners.get("pointerdown")(pointEvent(35,40));
  m.listeners.get("pointermove")(pointEvent(40,50));
  m.listeners.get("pointerup")(pointEvent(40,50));
  m.controller.cancel();
  assert.deepEqual(readAtlas(m.scene).segments[0].via[0],startBend,"Cancel discards pending edits");
  assert.deepEqual([...m.listeners.keys()], ["pointerleave"],
      "only the read-only road hover listener remains after editing");
  m.controller.startPointEdit(m.scene,roadId,()=>{});
  m.listeners.get("pointerdown")(pointEvent(35,40));
  m.listeners.get("pointermove")(pointEvent(40,50));
  m.listeners.get("pointerup")(pointEvent(40,50));
  assert.equal(await m.controller.finish(),true);
  assert.deepEqual(readAtlas(m.scene).segments[0].via[0],{x:70,y:70});
  assert.equal(readAtlas(m.scene).segments[0].id,prior.segments[0].id);
  assert.equal(readAtlas(m.scene).segments[0].from,prior.segments[0].from);
  assert.deepEqual([...m.listeners.keys()], ["pointerleave"],
      "only the read-only road hover listener remains after editing");
  assert.ok(m.notifications.info.some(message=>message.includes("points saved")));
 } finally {m.controller.tearDown();Object.assign(globalThis,prev);}
});

test("point editing ends on Scene configuration close without mutating flags",async()=>{
 const prev={game:globalThis.game,PIXI:globalThis.PIXI};
 const m=setup();
 try {
  globalThis.game={user:{isGM:true}};
  globalThis.PIXI={Graphics:m.Graphics};
  m.controller.start(m.scene,()=>{});
  m.listeners.get("pointerdown")(pointEvent(20,30));
  m.listeners.get("pointerdown")(pointEvent(50,30));
  assert.equal(await m.controller.finish(),true);
  const before=readAtlas(m.scene);
  m.controller.startPointEdit(m.scene,before.roads[0].id,()=>{});
  m.listeners.get("pointerdown")(pointEvent(20,30));
  m.listeners.get("pointermove")(pointEvent(25,35));
  m.listeners.get("pointerup")(pointEvent(25,35));
  m.controller.endEditor(m.scene);
  assert.equal(m.controller.getDraft(m.scene),null);
  assert.deepEqual([...m.listeners.keys()], ["pointerleave"],
      "only the read-only road hover listener remains after editing");
  assert.deepEqual(readAtlas(m.scene),before);
 } finally {m.controller.tearDown();Object.assign(globalThis,prev);}
});

test("double-click a road inserts a bend through the dedicated dblclick handler", async () => {
  const prev = { game: globalThis.game, PIXI: globalThis.PIXI };
  const m = setup();
  try {
    globalThis.game = { user: { isGM: true } };
    globalThis.PIXI = { Graphics: m.Graphics };
    m.controller.start(m.scene, () => {});
    m.listeners.get("pointerdown")(pointEvent(20, 30));
    m.listeners.get("pointerdown")(pointEvent(60, 30));
    assert.equal(await m.controller.finish(), true);
    const initial = readAtlas(m.scene);
    m.controller.startPointEdit(m.scene, initial.roads[0].id, () => {});
    assert.ok(m.listeners.has("dblclick"));
    m.listeners.get("dblclick")(pointEvent(40, 30));
    assert.equal(m.controller.getDraft(m.scene).dirty, true);
    assert.equal(readAtlas(m.scene).segments[0].via.length, 0,
      "new bends must remain unsaved until Save Points");
    assert.equal(await m.controller.finish(), true);
    assert.deepEqual(readAtlas(m.scene).segments[0].via, [{ x: 70, y: 30 }]);
    assert.deepEqual([...m.listeners.keys()], ["pointerleave"],
      "only the read-only road hover listener remains after editing");
  } finally {
    m.controller.tearDown();
    Object.assign(globalThis, prev);
  }
});

test("new-road attachment needs approval and never merges names", async () => {
  const prev = { game: globalThis.game, PIXI: globalThis.PIXI };
  const m = setup();
  try {
    globalThis.game = { user: { isGM: true }, i18n: { localize: k => k } };
    globalThis.PIXI = { Graphics: m.Graphics };
    m.controller.start(m.scene, () => {});
    m.listeners.get("pointerdown")(pointEvent(20, 30));
    m.listeners.get("pointerdown")(pointEvent(60, 30));
    assert.equal(await m.controller.finish(), true);
    const baseline = readAtlas(m.scene);
    m.approve(false);
    m.controller.start(m.scene, () => {});
    m.listeners.get("pointerdown")(pointEvent(40, 30));
    m.listeners.get("pointerdown")(pointEvent(50, 70));
    assert.equal(await m.controller.finish(), false, "GM declined connection");
    assert.equal(readAtlas(m.scene).revision, baseline.revision);
    assert.equal(readAtlas(m.scene).roads.length, 1);
    assert.deepEqual(m.prompts[0].targetNames, ["Road 1"]);
    assert.equal(m.controller.getDraft(m.scene).points, 2, "draft remains available");
    m.controller.cancel();
    m.approve(true);
    m.controller.start(m.scene, () => {});
    m.listeners.get("pointerdown")(pointEvent(40, 30));
    m.listeners.get("pointerdown")(pointEvent(50, 70));
    assert.equal(await m.controller.finish(), true);
    const joined = readAtlas(m.scene);
    assert.deepEqual(joined.roads.map(r => r.name), ["Road 1", "Road 2"]);
    assert.equal(joined.segments.filter(s => s.roadId === joined.roads[0].id).length, 2);
    assert.equal(m.prompts.length, 2, "both attempted snaps asked for approval");
  } finally {
    m.controller.tearDown();
    Object.assign(globalThis, prev);
  }
});

test("dragged junction asks approval and can join another road without merging names", async () => {
  const prev = { game: globalThis.game, PIXI: globalThis.PIXI };
  const m = setup();
  try {
    globalThis.game = { user: { isGM: true }, i18n: { localize: k => k } };
    globalThis.PIXI = { Graphics: m.Graphics };
    m.controller.start(m.scene, () => {});
    m.listeners.get("pointerdown")(pointEvent(20, 30));
    m.listeners.get("pointerdown")(pointEvent(60, 30));
    assert.equal(await m.controller.finish(), true);
    m.controller.start(m.scene, () => {});
    m.listeners.get("pointerdown")(pointEvent(20, 55));
    m.listeners.get("pointerdown")(pointEvent(60, 55));
    assert.equal(await m.controller.finish(), true);
    const initial = readAtlas(m.scene);
    const spurId = initial.roads[1].id;
    m.approve(false);
    m.controller.startPointEdit(m.scene, spurId, () => {});
    m.listeners.get("pointerdown")(pointEvent(20, 55));
    m.listeners.get("pointermove")(pointEvent(40, 30));
    await m.listeners.get("pointerup")(pointEvent(40, 30));
    assert.equal(m.controller.getDraft(m.scene).dirty, false,
      "declining must revert the proposed drag, not leave a false visual join");
    m.approve(true);
    m.listeners.get("pointerdown")(pointEvent(20, 55));
    m.listeners.get("pointermove")(pointEvent(40, 30));
    await m.listeners.get("pointerup")(pointEvent(40, 30));
    assert.equal(m.controller.getDraft(m.scene).dirty, true);
    assert.equal(m.prompts.length, 2);
    assert.deepEqual(m.prompts[1].sourceNames, ["Road 2"]);
    assert.deepEqual(m.prompts[1].targetNames, ["Road 1"]);
    assert.equal(readAtlas(m.scene).revision, initial.revision, "pending edit only");
    assert.equal(await m.controller.finish(), true);
    const after = readAtlas(m.scene);
    assert.deepEqual(after.roads.map(r=>r.name),["Road 1","Road 2"]);
    assert.equal(after.segments.length,3);
    assert.deepEqual([...m.listeners.keys()], ["pointerleave"],
      "only the read-only road hover listener remains after editing");
  } finally {
    m.controller.tearDown();
    Object.assign(globalThis, prev);
  }
});

test("one new shortcut connecting two differently named roads requires one explicit review", async () => {
  const prev = { game: globalThis.game, PIXI: globalThis.PIXI };
  const m = setup();
  try {
    globalThis.game = { user: { isGM: true }, i18n: { localize: k => k } };
    globalThis.PIXI = { Graphics: m.Graphics };
    const draw = async (from, to) => {
      m.controller.start(m.scene, () => {});
      m.listeners.get("pointerdown")(pointEvent(...from));
      m.listeners.get("pointerdown")(pointEvent(...to));
      return m.controller.finish();
    };
    assert.equal(await draw([20,30],[60,30]), true);
    assert.equal(await draw([20,80],[60,80]), true);
    assert.equal(await draw([40,30],[40,80]), true);
    const atlas = readAtlas(m.scene);
    assert.deepEqual(atlas.roads.map(r => r.name), ["Road 1","Road 2","Road 3"]);
    assert.deepEqual(m.prompts.map(p=>p.targetNames), [["Road 1","Road 2"]]);
    assert.equal(atlas.segments.length, 5,
      "both main roads are subdivided topologically, but not logically merged");
    assert.equal(atlas.roads.length, 3);
  } finally {
    m.controller.tearDown();
    Object.assign(globalThis, prev);
  }
});

test("Alt-click gold junction safely detaches one named road; undo and save preserve main", async () => {
  const prev = { game: globalThis.game, PIXI: globalThis.PIXI };
  const m = setup();
  try {
    globalThis.game = { user: { isGM: true }, i18n: { localize: key => key } };
    globalThis.PIXI = { Graphics: m.Graphics };
    m.controller.start(m.scene, () => {});
    m.listeners.get("pointerdown")(pointEvent(20,30));
    m.listeners.get("pointerdown")(pointEvent(60,30));
    assert.equal(await m.controller.finish(),true);
    m.controller.start(m.scene,()=>{});
    m.listeners.get("pointerdown")(pointEvent(40,30));
    m.listeners.get("pointerdown")(pointEvent(40,60));
    assert.equal(await m.controller.finish(),true);
    const before = readAtlas(m.scene), branchId=before.roads[1].id;
    const sourceNodeId=before.segments.find(s=>s.roadId===branchId).from;
    m.controller.startPointEdit(m.scene,branchId,()=>{});
    const detachClick = () => ({...pointEvent(40,30), altKey:true});
    m.approveDetach(false);
    await m.listeners.get("pointerdown")(detachClick());
    assert.equal(m.controller.getDraft(m.scene).dirty,false,"No leaves shared junction intact");
    assert.equal(readAtlas(m.scene).revision,before.revision);
    m.approveDetach(true);
    await m.listeners.get("pointerdown")(detachClick());
    assert.equal(m.controller.getDraft(m.scene).dirty,true);
    assert.deepEqual(m.detachPrompts.at(-1),{roadName:"Road 2",otherNames:["Road 1"]});
    assert.equal(readAtlas(m.scene).revision,before.revision,
      "Detach is staged, not immediately written to the Scene");
    m.controller.undo();
    assert.equal(m.controller.getDraft(m.scene).dirty,false,"Undo cancels detachment");
    await m.listeners.get("pointerdown")(detachClick());
    m.listeners.get("pointerdown")(pointEvent(40,30));
    m.listeners.get("pointermove")(pointEvent(45,45));
    await m.listeners.get("pointerup")(pointEvent(45,45));
    assert.equal(await m.controller.finish(),true);
    const saved=readAtlas(m.scene);
    assert.deepEqual(saved.roads.map(r=>r.name),["Road 1","Road 2"]);
    const branch=saved.segments.find(s=>s.roadId===branchId);
    assert.notEqual(branch.from,sourceNodeId,"branch now has independent junction ID");
    assert.deepEqual(saved.nodes.find(n=>n.id===sourceNodeId),
      before.nodes.find(n=>n.id===sourceNodeId),"the main road has not moved");
    assert.deepEqual(saved.nodes.find(n=>n.id===branch.from),
      {id:branch.from,x:80,y:60},"only branch endpoint moves");
    assert.equal(saved.segments.length,before.segments.length,
      "detachment does not split, duplicate or rename road segments");
    assert.deepEqual([...m.listeners.keys()], ["pointerleave"],
      "only the read-only road hover listener remains after editing");
  } finally {
    m.controller.tearDown();
    Object.assign(globalThis, prev);
  }
});

test("Junctions [+] stages an interior graph node and can undo, save and highlight it", async () => {
  const previous={game:globalThis.game,PIXI:globalThis.PIXI};
  const m=setup();
  try {
    globalThis.game={user:{isGM:true},i18n:{localize:key=>key}};
    globalThis.PIXI={Graphics:m.Graphics};
    m.controller.start(m.scene,()=>{});
    m.listeners.get("pointerdown")(pointEvent(20,30));
    m.listeners.get("pointerdown")(pointEvent(60,30));
    assert.equal(await m.controller.finish(),true);
    const prior=readAtlas(m.scene);
    m.controller.startJunction(m.scene,()=>{});
    assert.equal(m.controller.getDraft(m.scene).mode,"junction");
    m.listeners.get("pointerdown")(pointEvent(20,30));
    assert.equal(m.controller.getDraft(m.scene).mode,"junction",
      "clicking an existing endpoint does not duplicate that junction");
    m.listeners.get("pointerdown")(pointEvent(40,30));
    assert.equal(m.controller.getDraft(m.scene).mode,"points",
      "placing a waypoint transitions to reversible point editing");
    assert.equal(m.controller.getDraft(m.scene).source,"junction",
      "Save/Undo/Cancel controls belong in the Junctions section");
    assert.equal(m.controller.getDraft(m.scene).dirty,true);
    assert.equal(readAtlas(m.scene).nodes.length,prior.nodes.length,
      "the Scene remains unchanged until Save Points");
    m.controller.undo();
    assert.equal(m.controller.getDraft(m.scene).dirty,false);
    m.controller.cancel();
    assert.deepEqual(readAtlas(m.scene),prior);
    m.controller.startJunction(m.scene,()=>{});
    m.listeners.get("pointerdown")(pointEvent(40,30));
    assert.equal(await m.controller.finish(),true);
    const saved=readAtlas(m.scene);
    assert.equal(saved.nodes.length,prior.nodes.length+1);
    assert.equal(saved.segments.length,prior.segments.length+1);
    assert.deepEqual(saved.roads,prior.roads);
    const created=saved.nodes.at(-1);
    m.controller.selectJunction(m.scene,created.id);
    assert.equal(m.controller.selectedJunctionId,created.id);
    m.controller.endEditor(m.scene);
    assert.equal(m.controller.selectedJunctionId,null);
  } finally {m.controller.tearDown();Object.assign(globalThis,previous);}
});

test("Shift-click promotes a bend; its new gold junction connects only with approval",async()=>{
 const previous={game:globalThis.game,PIXI:globalThis.PIXI};
 const m=setup();
 try {
  globalThis.game={user:{isGM:true},i18n:{localize:key=>key}};
  globalThis.PIXI={Graphics:m.Graphics};
  const draw=async(points)=>{
   m.controller.start(m.scene,()=>{});
   for(const [x,y] of points)m.listeners.get("pointerdown")(pointEvent(x,y));
   assert.equal(await m.controller.finish(),true);
  };
  await draw([[20,30],[60,30]]);
  await draw([[40,20],[40,30],[40,40]]);
  const original=readAtlas(m.scene);
  assert.equal(original.segments.length,2,"visual crossing is not connected");
  const sourceId=original.roads[1].id;
  m.controller.startPointEdit(m.scene,sourceId,()=>{});
  await m.listeners.get("pointerdown")({...pointEvent(40,30),shiftKey:true});
  assert.equal(m.controller.getDraft(m.scene).dirty,true);
  const editor=m.controller.pointEditor;
  assert.equal(editor.session.working.segments.length,3);
  assert.equal(readAtlas(m.scene).segments.length,2,"promotion remains staged");
  m.approve(false);
  m.listeners.get("pointerdown")(pointEvent(40,30));
  m.listeners.get("pointermove")(pointEvent(40,30));
  await m.listeners.get("pointerup")(pointEvent(40,30));
  assert.equal(editor.session.working.segments.length,3,
   "declining leaves promoted junction unconnected");
  m.approve(true);
  m.listeners.get("pointerdown")(pointEvent(40,30));
  m.listeners.get("pointermove")(pointEvent(40,30));
  await m.listeners.get("pointerup")(pointEvent(40,30));
  assert.equal(editor.session.working.segments.length,4);
  assert.deepEqual(m.prompts.at(-1).targetNames,["Road 1"]);
  assert.equal(await m.controller.finish(),true);
  const result=readAtlas(m.scene);
  assert.equal(result.segments.length,4);
  assert.deepEqual(result.roads.map(r=>r.name),["Road 1","Road 2"]);
  const joinedNode=result.segments.filter(s=>s.roadId===sourceId)[0].to;
  assert.equal(result.segments.filter(s=>s.from===joinedNode||s.to===joinedNode).length,4);
 } finally {m.controller.tearDown();Object.assign(globalThis,previous);}
});


test("Shift-click a gold single-road subdivision safely converts it back to a bend", async () => {
  const previous={game:globalThis.game,PIXI:globalThis.PIXI};
  const m=setup();
  try {
    globalThis.game={user:{isGM:true},i18n:{localize:key=>key}};
    globalThis.PIXI={Graphics:m.Graphics};
    m.controller.start(m.scene,()=>{});
    for(const pos of [[20,30],[40,40],[60,30]])
      m.listeners.get("pointerdown")(pointEvent(...pos));
    assert.equal(await m.controller.finish(),true);
    const original=readAtlas(m.scene);
    const roadId=original.roads[0].id;
    m.controller.startPointEdit(m.scene,roadId,()=>{});
    await m.listeners.get("pointerdown")({...pointEvent(40,40),shiftKey:true});
    assert.equal(await m.controller.finish(),true);
    const promoted=readAtlas(m.scene);
    assert.equal(promoted.segments.length,2);
    m.controller.startPointEdit(m.scene,roadId,()=>{});
    await m.listeners.get("pointerdown")({...pointEvent(40,40),shiftKey:true});
    assert.equal(m.controller.getDraft(m.scene).dirty,true);
    assert.deepEqual(readAtlas(m.scene),promoted,"demotion remains staged");
    m.controller.undo();
    assert.equal(m.controller.getDraft(m.scene).dirty,false);
    await m.listeners.get("pointerdown")({...pointEvent(40,40),shiftKey:true});
    assert.equal(await m.controller.finish(),true);
    const final=readAtlas(m.scene);
    assert.deepEqual(final.roads,original.roads);
    assert.deepEqual(final.segments,original.segments);
    assert.deepEqual(final.nodes,original.nodes);
  } finally { m.controller.tearDown();Object.assign(globalThis,previous); }
});

test("Shift-click a shared junction refuses conversion without disconnecting roads",async()=>{
  const previous={game:globalThis.game,PIXI:globalThis.PIXI};
  const m=setup();
  try {
    globalThis.game={user:{isGM:true},i18n:{localize:key=>key}};
    globalThis.PIXI={Graphics:m.Graphics};
    const draw=async(points)=>{
      m.controller.start(m.scene,()=>{});
      for(const p of points)m.listeners.get("pointerdown")(pointEvent(...p));
      assert.equal(await m.controller.finish(),true);
    };
    await draw([[20,30],[60,30]]);
    await draw([[40,30],[40,60]]);
    const original=readAtlas(m.scene);
    m.controller.startPointEdit(m.scene,original.roads[0].id,()=>{});
    await m.listeners.get("pointerdown")({...pointEvent(40,30),shiftKey:true});
    assert.equal(m.controller.getDraft(m.scene).dirty,false);
    assert.ok(m.notifications.warn.some(message=>message.includes("Detach shared")));
    assert.deepEqual(readAtlas(m.scene),original);
    m.controller.cancel();
  } finally { m.controller.tearDown();Object.assign(globalThis,previous); }
});


test("v0.2.24.1 player zoom redraws revealed clusters into individual icons", async () => {
  const previous = { game: globalThis.game, PIXI: globalThis.PIXI };
  const m = setup();
  class Text {
    constructor(value) { this.text = String(value); this.anchor = { set() {} };
      this.position = { set() {} }; }
    destroy() {}
  }
  m.Graphics.prototype.addChild = function(label) { label.parent = this; };
  try {
    globalThis.game = { user: { isGM: false } };
    globalThis.PIXI = { Graphics: m.Graphics, Text };
    m.canvas.stage = { scale: { x: 0.5 } };
    let i = 0;
    const idFactory = () => "player-zoom" + ++i;
    let atlas = addRoad(createEmptyAtlas(), {
      points: [{ x: 10, y: 10 }, { x: 50, y: 10 }], name: "Private road", idFactory
    });
    for (const [nodeId, name] of [
      [atlas.segments[0].from, "First"], [atlas.segments[0].to, "Second"]
    ]) {
      atlas = addRoadCheckpoint(atlas, { roadId: atlas.roads[0].id,
        candidate: { kind: "node", nodeId }, name, idFactory });
      atlas = setCheckpointPlayerVisibility(atlas, {
        checkpointId: atlas.checkpoints.at(-1).id, visible: true
      });
    }
    await m.scene.setFlag("fvtt-atlas-navigation", "atlas", atlas);
    m.controller.refresh();
    assert.ok(m.controller.labels.some(label => label.text === "2"),
      "player sees clustered count when zoomed out");
    m.canvas.stage.scale.x = 2;
    m.controller.onCanvasPan(m.canvas);
    await new Promise(resolve => setTimeout(resolve, 85));
    assert.equal(m.controller.lastZoom, 2, "non-GM zoom was redrawn");
    assert.ok(!m.controller.labels.some(label => label.text === "2"),
      "cluster count disappears once checkpoints separate");
    assert.equal(m.controller.graphics.drawn.length, 0, "hidden road contributes no path geometry after zoom");
  } finally { m.controller.tearDown(); Object.assign(globalThis, previous); }
});

test("v0.2.24.1 player road hover reveals only permitted names at crisp resolution", async () => {
  const previous = { game: globalThis.game, PIXI: globalThis.PIXI };
  const m = setup();
  class Text {
    constructor(value, style) { this.text = String(value); this.style = style;
      this.resolution = 1;
      this.anchor = { set() {} }; this.position = { set() {} }; }
    destroy() {}
  }
  m.Graphics.prototype.addChild = function(label) { label.parent = this; };
  try {
    globalThis.game = { user: { isGM: false } };
    globalThis.PIXI = { Graphics: m.Graphics, Text };
    m.canvas.stage = { scale: { x: 2 } };
    let i = 0;
    const idFactory = () => "player-hover" + ++i;
    let atlas = addRoad(createEmptyAtlas(), {
      name: "Hidden Trade Road", points: [{ x: 20, y: 100 }, { x: 150, y: 100 }], idFactory
    });
    atlas = addRoad(atlas, {
      name: "Public Way", points: [{ x: 20, y: 30 }, { x: 150, y: 30 }], idFactory
    });
    atlas = upgradeAtlasRoadAppearance(atlas);
    atlas.roads[0].appearance = { color: "#aabbcc", width: 4, opacity: 0.9,
      pattern: "solid", labelVisibility: "hover" };
    atlas.roads[1].appearance = { color: "#aabbcc", width: 4, opacity: 0.9,
      pattern: "solid", labelVisibility: "hover" };
    atlas = setRoadPlayerVisibility(atlas, { roadId: atlas.roads[1].id, visible: true });
    await m.scene.setFlag("fvtt-atlas-navigation", "atlas", atlas);
    m.controller.refresh();
    assert.ok(m.listeners.has("pointermove"), "only visible road gets a hover listener");
    assert.equal(m.listeners.has("pointerdown"), false, "no player editing shortcuts");
    m.listeners.get("pointermove")(pointEvent(15, 30));
    const label = m.controller.labels.find(item => item.text === "Public Way");
    assert.ok(label, "road name appears for revealed road");
    assert.ok(label.resolution >= 2, "road name is rasterized at higher resolution");
    assert.ok(!m.controller.labels.some(item => item.text === "Hidden Trade Road"));
    m.listeners.get("pointerleave")();
    assert.ok(!m.controller.labels.some(item => item.text === "Public Way"));
  } finally { m.controller.tearDown(); Object.assign(globalThis, previous); }
});

test("v0.2.24.2 player checkpoint hover reveals its name but never a hidden road", async () => {
  const previous = { game: globalThis.game, PIXI: globalThis.PIXI };
  const m = setup();
  class Text {
    constructor(value, style) {
      this.text = String(value); this.style = style; this.resolution = 1;
      this.anchor = { set() {} }; this.position = { set() {} };
    }
    destroy() {}
  }
  m.Graphics.prototype.addChild = function(label) { label.parent = this; };
  try {
    globalThis.game = { user: { isGM: false } };
    globalThis.PIXI = { Graphics: m.Graphics, Text };
    m.canvas.stage = { scale: { x: 1 } };
    let index = 0;
    const idFactory = () => "checkpoint-hover" + ++index;
    let atlas = addRoad(createEmptyAtlas(), {
      name: "Undiscovered Passage",
      points: [{ x: 20, y: 30 }, { x: 150, y: 30 }], idFactory
    });
    atlas = addRoadCheckpoint(atlas, {
      roadId: atlas.roads[0].id,
      candidate: { kind: "node", nodeId: atlas.segments[0].from },
      name: "Public Dock", elevationMeters: 420, idFactory
    });
    const roadId = atlas.roads[0].id;
    const checkpointId = atlas.checkpoints[0].id;
    atlas = editCheckpointAppearance(atlas, {
      checkpointId,
      appearance: { ...DEFAULT_CHECKPOINT_APPEARANCE, type: "fa",
        icon: "solid:dragon", size: 40, showRoadName: true }
    });
    atlas = setCheckpointPlayerVisibility(atlas, { checkpointId, visible: true });
    await m.scene.setFlag("fvtt-atlas-navigation", "atlas", atlas);
    m.controller.refresh();
    assert.ok(m.listeners.has("pointermove"), "revealed icon receives player hover");
    assert.equal(m.listeners.has("pointerdown"), false, "no player editing shortcut");
    m.listeners.get("pointermove")(pointEvent(15, 16));
    // The 40px floating icon is at canvas y=32, above its graph point at y=60.
    assert.ok(m.controller.labels.some(item => item.text === "Public Dock"));
    assert.ok(!m.controller.labels.some(item => item.text === "Undiscovered Passage"),
      "visible checkpoint must not expose its hidden road's name");
    assert.ok(!m.controller.labels.some(item => item.text.includes("420") ||
      item.text.startsWith("Elevation")), "player receives no GM elevation");
    const title = m.controller.labels.find(item => item.text === "Public Dock");
    assert.ok(title.resolution >= 2, "checkpoint name uses sharp text");

    atlas = setRoadPlayerVisibility(atlas, { roadId, visible: true });
    await m.scene.setFlag("fvtt-atlas-navigation", "atlas", atlas);
    m.controller.refresh();
    const subtitle = m.controller.labels.find(item => item.text === "Undiscovered Passage");
    assert.ok(subtitle, "revealing the road independently permits its subtitle");
    assert.equal(subtitle.style.fontStyle, "italic");

    atlas = setRoadPlayerVisibility(atlas, { roadId, visible: false });
    await m.scene.setFlag("fvtt-atlas-navigation", "atlas", atlas);
    m.controller.refresh();
    assert.ok(m.controller.labels.some(item => item.text === "Public Dock"));
    assert.ok(!m.controller.labels.some(item => item.text === "Undiscovered Passage"),
      "hiding the road removes its subtitle without hiding the checkpoint name");

    atlas = setCheckpointPlayerVisibility(atlas, { checkpointId, visible: false });
    await m.scene.setFlag("fvtt-atlas-navigation", "atlas", atlas);
    m.controller.refresh();
    assert.ok(!m.controller.labels.some(item => item.text === "Public Dock"),
      "hiding the checkpoint removes its previously hovered name");
    assert.equal(m.listeners.has("pointerdown"), false);
  } finally { m.controller.tearDown(); Object.assign(globalThis, previous); }
});

test("v0.2.25 World curvature redraws existing roads for GM and player with matching hover", async () => {
  const previous = { game: globalThis.game, PIXI: globalThis.PIXI };
  const m = setup();
  let curvature = "off";
  const defaults = structuredClone(DEFAULT_WORLD_ROAD_APPEARANCE);
  defaults.profiles.land.labelVisibility = "hover";
  class Text {
    constructor(value, style) {
      this.text = String(value); this.style = style;
      this.anchor = { set() {} }; this.position = { set() {} };
    }
    destroy() {}
  }
  m.Graphics.prototype.addChild = function(label) { label.parent = this; };
  try {
    globalThis.game = { user: { isGM: true }, settings: { get(_module, key) {
      if (key === ROAD_CURVE_SETTING) return curvature;
      if (key === ROAD_APPEARANCE_SETTING) return defaults;
      return undefined;
    } } };
    globalThis.PIXI = { Graphics: m.Graphics, Text };
    m.canvas.stage = { scale: { x: 1 } };
    let index = 0;
    let atlas = addRoad(createEmptyAtlas(), {
      name: "Curved Trade Route",
      points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }],
      idFactory: () => "curve-render-" + ++index
    });
    const original = structuredClone(atlas);
    await m.scene.setFlag("fvtt-atlas-navigation", "atlas", atlas);
    m.controller.refresh();
    const straightCount = m.controller.graphics.drawn.length;
    curvature = "strong";
    m.controller.refresh();
    assert.ok(m.controller.graphics.drawn.length > straightCount,
      "GM road line changes to a sampled spline without editing nodes");
    assert.deepEqual(readAtlas(m.scene), original, "render refresh never persists geometry");

    atlas = setRoadPlayerVisibility(atlas, { roadId: atlas.roads[0].id, visible: true });
    await m.scene.setFlag("fvtt-atlas-navigation", "atlas", atlas);
    globalThis.game.user.isGM = false;
    m.controller.refresh();
    const curvedPoint = m.controller.graphics.drawn.find(point =>
      point.x > 650 && point.x < 850 && point.y < 10);
    assert.ok(curvedPoint, "player overlay draws a curved segment off the original chord");
    assert.ok(m.listeners.has("pointermove"));
    m.listeners.get("pointermove")(pointEvent(curvedPoint.x / 2, curvedPoint.y / 2));
    assert.ok(m.controller.labels.some(label => label.text === "Curved Trade Route"),
      "visible road label hit testing matches the displayed curve");
    curvature = "off";
    m.controller.refresh();
    assert.equal(m.controller.graphics.drawn.length, 3,
      "World Off selection restores the three original road vertices on the player overlay");
    assert.deepEqual(readAtlas(m.scene).nodes, atlas.nodes);
    assert.deepEqual(readAtlas(m.scene).segments, atlas.segments);
  } finally { m.controller.tearDown(); Object.assign(globalThis, previous); }
});

test("v0.2.25 player road and checkpoint respect explored fog boundaries", async () => {
  const previous = { game: globalThis.game, PIXI: globalThis.PIXI };
  const m = setup();
  class Text { constructor(text) { this.text = String(text); } destroy() {} }
  m.Graphics.prototype.addChild = function(node) { node.parent = this; };
  try {
    globalThis.game = { user: { isGM: false } };
    globalThis.PIXI = { Graphics: m.Graphics, Text };
    m.canvas.stage = { scale: { x: 1 } };
    m.scene.tokenVision = true;
    m.scene.fogExploration = true;
    m.canvas.fog = { isPointExplored: point => point.x <= 90 };
    let n = 0;
    const idFactory = () => "fog-" + ++n;
    let atlas = addRoad(createEmptyAtlas(), {
      points: [{ x: 10, y: 10 }, { x: 150, y: 10 }],
      name: "Half-discovered", idFactory
    });
    atlas = addRoadCheckpoint(atlas, {
      candidate: { kind: "node", nodeId: atlas.segments[0].to },
      roadId: atlas.roads[0].id, name: "Unexplored Keep", elevationMeters: null,
      idFactory
    });
    atlas = setRoadPlayerVisibility(atlas, {
      roadId: atlas.roads[0].id, visible: true
    });
    atlas = setCheckpointPlayerVisibility(atlas, {
      checkpointId: atlas.checkpoints[0].id, visible: true
    });
    await m.scene.setFlag("fvtt-atlas-navigation", "atlas", atlas);
    m.controller.refresh();
    assert.equal(m.controller.graphics.strokes, 1,
      "explored portion of a revealed road remains drawn");
    assert.ok(m.controller.graphics.drawn.every(point => point.x <= 91),
      "no road geometry is drawn in unexplored terrain");
    assert.deepEqual(m.controller.playerCheckpointHoverGeometry, [],
      "revealed but unexplored checkpoint is not hoverable");
    m.canvas.fog.isPointExplored = () => true;
    m.controller.refresh();
    assert.ok(m.controller.graphics.drawn.some(point => point.x > 100),
      "previously explored road appears even when no token currently sees it");
    assert.ok(m.controller.playerCheckpointHoverGeometry.length > 0);
  } finally { m.controller.tearDown(); Object.assign(globalThis, previous); }
});

test("v0.2.25 Always road labels use the visible section of a checkpoint-split named road", async () => {
  const previous = { game: globalThis.game, PIXI: globalThis.PIXI };
  const m = setup();
  m.canvas.app.canvas.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 20, bottom: 50 });
  m.canvas.stage = { scale: { x: 1 } };
  m.Graphics.prototype.addChild = function(node) { node.parent = this; };
  class Text {
    constructor(text) {
      this.text = String(text);
      this.anchor = { set() {} };
      this.position = { set: (x, y) => { this.x = x; this.y = y; } };
    }
    destroy() {}
  }
  try {
    globalThis.game = { user: { isGM: true } };
    globalThis.PIXI = { Graphics: m.Graphics, Text };
    let id = 0;
    const idFactory = () => "viewport-" + ++id;
    let atlas = addRoad(createEmptyAtlas(), {
      points: [{ x: 10, y: 10 }, { x: 200, y: 10 }],
      name: "Long Road", idFactory
    });
    atlas = addRoadCheckpoint(atlas, {
      candidate: { kind: "edge", segmentId: atlas.segments[0].id,
        edgeIndex: 0, x: 50, y: 10 },
      roadId: atlas.roads[0].id, name: "First Stop",
      elevationMeters: null, idFactory
    });
    atlas = upgradeAtlasRoadAppearance(atlas);
    atlas.roads[0].appearance = { color: "#ff00ff", width: 4, opacity: 1,
      pattern: "solid", labelVisibility: "always" };
    await m.scene.setFlag("fvtt-atlas-navigation", "atlas", atlas);
    m.controller.refresh();
    const label = m.controller.labels.find(item => item.text === "Long Road");
    assert.ok(label, "one named-road label is visible");
    assert.ok(label.x <= 40, "label anchors on the first visible section, not the longer remote section");
  } finally { m.controller.tearDown(); Object.assign(globalThis, previous); }
});

test("v14 manual exploration uses native grid polygons and image-local cell centers", () => {
  const view = {
    scene: { grid: { size: 50, type: 1 }, dimensions: { rows: 2, columns: 2 } },
    dimensions: { sceneX: 10, sceneY: 30 },
    grid: {
      getShape: () => [{ x: -25, y: -25 }, { x: 25, y: -25 },
        { x: 25, y: 25 }, { x: -25, y: 25 }],
      getCenterPoint: ({ i, j }) => ({ x: 35 + 50 * j, y: 55 + 50 * i })
    }
  };
  const cells = nativeFogCells(view);
  assert.equal(cells.length, 4);
  assert.deepEqual(cells.map(({ x, y }) => ({ x, y })), [
    { x: 25, y: 25 }, { x: 75, y: 25 },
    { x: 25, y: 75 }, { x: 75, y: 75 }
  ], "only persisted image-local cell centers are stored as exploration coordinates");
  assert.deepEqual(cells[0].polygon,
    [[10, 30], [60, 30], [60, 80], [10, 80]],
    "render-time geometry follows Foundry's native cell shape");
});

test("v14 manual exploration fails closed on unsupported or malformed grid geometry", () => {
  const view = {
    scene: { grid: { size: 50, type: 1 }, dimensions: { rows: 2, columns: 2 } },
    dimensions: { sceneX: 0, sceneY: 0 },
    grid: { isGridless: true }
  };
  assert.throws(() => nativeFogCells(view), /square or hex Scene grid/);
  view.grid = { isGridless: false, getShape: () => [{ x: 0, y: 0 }],
    getCenterPoint: () => ({ x: 25, y: 25 }) };
  assert.throws(() => nativeFogCells(view), /Invalid native grid cell polygon/);
  view.grid.getShape = () => [{ x: -25, y: -25 }, { x: 25, y: -25 },
    { x: 25, y: 25 }, { x: -25, y: 25 }];
  assert.throws(() => nativeFogCells(view, 3), /cell limit/,
    "oversized fog grids are rejected before traversal");
});
