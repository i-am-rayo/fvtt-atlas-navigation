import assert from "node:assert/strict";
import test from "node:test";
import { RoadCanvasController } from "../scripts/road-canvas.js";
import { readAtlas } from "../scripts/atlas-storage.js";
import { createEmptyAtlas, upgradeAtlasRoadAppearance } from "../scripts/atlas-model.js";
import { addRoad } from "../scripts/road-model.js";

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
    constructor({ text }) { this.text = text; this.anchor = { set() {} };
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
    assert.equal(m.listeners.size,0);
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
