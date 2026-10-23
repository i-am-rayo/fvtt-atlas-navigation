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
  const prompts = [];
  let approve = true;
  const controller = new RoadCanvasController({
    canvasProvider: () => canvas, doc: () => doc,
    idFactory: () => "node" + ++n, notify: () => notify,
    confirmAttach: async details => { prompts.push(details); return approve; }
  });
  return { controller, scene, canvas, listeners, docListeners, notifications, Graphics,
    prompts, approve: value => { approve = value; } };
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
  assert.equal(m.listeners.size,0);
  m.controller.startPointEdit(m.scene,roadId,()=>{});
  m.listeners.get("pointerdown")(pointEvent(35,40));
  m.listeners.get("pointermove")(pointEvent(40,50));
  m.listeners.get("pointerup")(pointEvent(40,50));
  assert.equal(await m.controller.finish(),true);
  assert.deepEqual(readAtlas(m.scene).segments[0].via[0],{x:70,y:70});
  assert.equal(readAtlas(m.scene).segments[0].id,prior.segments[0].id);
  assert.equal(readAtlas(m.scene).segments[0].from,prior.segments[0].from);
  assert.equal(m.listeners.size,0);
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
  assert.equal(m.listeners.size,0);
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
    assert.equal(m.listeners.size, 0);
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
    assert.equal(m.listeners.size,0);
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
