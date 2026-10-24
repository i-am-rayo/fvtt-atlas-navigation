import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyAtlas, upgradeAtlasRoadAppearance, validateAtlas,
  APPEARANCE_ATLAS_SCHEMA_VERSION } from "../scripts/atlas-model.js";
import { addRoad } from "../scripts/road-model.js";
import { readAtlas } from "../scripts/atlas-storage.js";
import { saveRoadAppearance } from "../scripts/road-storage.js";
import { DEFAULT_ROAD_APPEARANCE, resolveRoadAppearance,
  roadStrokeSpans, roadLabelPoint, validateRoadAppearance }
  from "../scripts/road-appearance.js";

const points = [{ x: 10, y: 10 }, { x: 110, y: 10 }];
const custom = { color: "#aa2255", width: 6, opacity: 0.65,
  pattern: "dashed", labelVisibility: "always" };
const ids = () => { let n = 0; return () => "id" + ++n; };

function mockScene(initial) {
  let data = initial, writes = 0;
  return {
    canUserModify: () => true,
    getFlag: () => data,
    async setFlag(_module, _key, value) { data = value; writes++; },
    get writes() { return writes; }
  };
}

test("appearance values are strict and independent of native surface/Region costs", () => {
  assert.deepEqual(validateRoadAppearance(DEFAULT_ROAD_APPEARANCE), DEFAULT_ROAD_APPEARANCE);
  assert.deepEqual(validateRoadAppearance({ ...custom, color: "#AA2255" }), custom);
  for (const malformed of [
    { ...custom, color: "red" }, { ...custom, width: 0 },
    { ...custom, opacity: 3 }, { ...custom, pattern: "zigzag" },
    { ...custom, labelVisibility: "private" }, { ...custom, extra: "x" }
  ]) assert.throws(() => validateRoadAppearance(malformed));
  assert.deepEqual(resolveRoadAppearance({}), DEFAULT_ROAD_APPEARANCE);
  assert.deepEqual(resolveRoadAppearance({ appearance: custom }), custom);
});

test("first GM appearance edit explicitly migrates older schema without touching roads", async () => {
  const previous = globalThis.game;
  globalThis.game = { user: { isGM: true } };
  try {
    const old = addRoad(createEmptyAtlas(), { points, name: "Stone Bridge", idFactory: ids() });
    const scene = mockScene(old);
    assert.equal(readAtlas(scene).schemaVersion, 3);
    assert.equal(scene.writes, 0, "opening old Scene never migrates");
    const upgraded = await saveRoadAppearance(scene, {
      roadId: old.roads[0].id, appearance: custom, expectedRevision: old.revision
    });
    assert.equal(upgraded.schemaVersion, APPEARANCE_ATLAS_SCHEMA_VERSION);
    assert.equal(upgraded.roads[0].travelPresetId, null);
    assert.deepEqual(upgraded.roads[0].appearance, custom);
    assert.deepEqual(upgraded.nodes, old.nodes);
    assert.deepEqual(upgraded.segments, old.segments);
    assert.deepEqual(upgraded.checkpoints, []);
    assert.equal(upgraded.revision, old.revision + 1);
    assert.equal(scene.writes, 1);
    await assert.rejects(saveRoadAppearance(scene, {
      roadId: old.roads[0].id, appearance: custom, expectedRevision: old.revision
    }), /changed since/);
    assert.equal(scene.writes, 1);
    const reset = await saveRoadAppearance(scene, {
      roadId: old.roads[0].id, appearance: null, expectedRevision: upgraded.revision
    });
    assert.equal(reset.roads[0].appearance, null);
    assert.equal(reset.schemaVersion, 6);
    assert.deepEqual(resolveRoadAppearance(reset.roads[0]), DEFAULT_ROAD_APPEARANCE);
  } finally { globalThis.game = previous; }
});

test("existing v5 travel preset IDs survive appearance migration; v6 new roads stay valid", () => {
  const old = addRoad(createEmptyAtlas(), { points, name: "Stone Bridge", idFactory: ids() });
  const v5 = validateAtlas({
    ...old, schemaVersion: 5, checkpoints: [],
    roads: old.roads.map(road => ({ ...road, travelPresetId: "stone" }))
  });
  const v6 = upgradeAtlasRoadAppearance(v5);
  assert.equal(v6.roads[0].travelPresetId, "stone");
  assert.equal(v6.roads[0].appearance, null);
  assert.deepEqual(upgradeAtlasRoadAppearance(v6), v6);
  const added = addRoad(v6, {
    points: [{ x: 200, y: 10 }, { x: 300, y: 10 }],
    name: "Second road", idFactory: ids()
  });
  assert.equal(added.roads.length, 2);
  assert.equal(added.roads[1].appearance, null);
  assert.equal(added.roads[1].travelPresetId, null);
  assert.throws(() => validateAtlas({ ...added, roads: added.roads.map((r, i) =>
    i ? { id: r.id, name: r.name, travelPresetId: null } : r) }), /appearance/);
  assert.throws(() => validateAtlas({ ...old, roads: [
    { ...old.roads[0], appearance: custom }
  ] }), /unsupported field/);
});

test("non-GM/stale or invalid appearance never overwrites Scene flags", async () => {
  const previous = globalThis.game;
  globalThis.game = { user: { isGM: false } };
  try {
    const old = addRoad(createEmptyAtlas(), { points, idFactory: ids() });
    const scene = mockScene(old);
    await assert.rejects(saveRoadAppearance(scene, {
      roadId: old.roads[0].id, appearance: custom, expectedRevision: old.revision
    }), /Only a GM/);
    assert.equal(scene.writes, 0);
    globalThis.game.user.isGM = true;
    assert.throws(() => saveRoadAppearance(scene, {
      roadId: old.roads[0].id, appearance: { ...custom, pattern: "none" },
      expectedRevision: old.revision
    }), /pattern/);
    assert.equal(scene.writes, 0);
  } finally { globalThis.game = previous; }
});

test("dashed/dotted strokes keep continuous spacing across road bends", () => {
  const path = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }];
  assert.deepEqual(roadStrokeSpans(path, "solid", 4), [path]);
  const dashed = roadStrokeSpans(path, "dashed", 4);
  const dots = roadStrokeSpans(path, "dotted", 4);
  assert.ok(dashed.length > 1);
  assert.ok(dots.length > dashed.length);
  assert.ok(dashed.some(span => span.some(p => p.y > 0)), "dash continues after bend");
  assert.deepEqual(roadLabelPoint(path), { x: 20, y: 0 },
    "label uses half of the drawn distance");
});
