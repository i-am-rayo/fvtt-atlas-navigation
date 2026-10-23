import assert from "node:assert/strict";
import test from "node:test";
import { RoadCanvasController } from "../scripts/road-canvas.js";
import { readAtlas } from "../scripts/atlas-storage.js";

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
    getFlag: () => saved,
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
    }
  };
  const notifications = { info: [], error: [], warn: [] };
  const notify = {};
  for (const name of Object.keys(notifications)) {
    notify[name] = message => notifications[name].push(message);
  }
  let n = 0;
  const controller = new RoadCanvasController({
    canvasProvider: () => canvas, doc: () => doc,
    idFactory: () => "node" + ++n, notify: () => notify
  });
  return { controller, scene, canvas, listeners, docListeners, notifications, Graphics };
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
    m.controller.selectRoad(m.scene, atlas.segments[0].id);
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
    assert.equal(m.listeners.size, 0);
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
    assert.equal(m.listeners.size, 0);
    assert.equal(readAtlas(m.scene).segments.length, 0);
    m.controller.start(m.scene, () => {});
    m.listeners.get("pointerdown")(pointEvent(20, 30));
    m.listeners.get("pointerdown")(pointEvent(50, 30));
    assert.equal(await m.controller.finish(), true);
    const roadId = readAtlas(m.scene).segments[0].id;
    m.controller.selectRoad(m.scene, roadId);
    assert.equal(m.controller.selectedRoadId, roadId);
    m.controller.endEditor(m.scene);
    assert.equal(m.controller.selectedRoadId, null);
  } finally {
    m.controller.tearDown();
    Object.assign(globalThis, prev);
  }
});

test("bend redrawing retains original endpoint IDs", async () => {
  const prev = { game: globalThis.game, PIXI: globalThis.PIXI };
  const m = setup();
  try {
    globalThis.game = { user: { isGM: true } };
    globalThis.PIXI = { Graphics: m.Graphics };
    m.controller.start(m.scene, () => {});
    m.listeners.get("pointerdown")(pointEvent(20, 30));
    m.listeners.get("pointerdown")(pointEvent(50, 30));
    assert.equal(await m.controller.finish(), true);
    const old = readAtlas(m.scene).segments[0];
    m.controller.startReshape(m.scene, old.id, () => {});
    m.listeners.get("pointerdown")(pointEvent(35, 50));
    assert.equal(await m.controller.finish(), true);
    const updated = readAtlas(m.scene).segments[0];
    assert.equal(updated.id, old.id);
    assert.equal(updated.from, old.from);
    assert.equal(updated.to, old.to);
    assert.deepEqual(updated.via, [{ x: 60, y: 70 }]);
  } finally {
    m.controller.tearDown();
    Object.assign(globalThis, prev);
  }
});
