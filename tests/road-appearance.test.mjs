import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyAtlas, upgradeAtlasRoadAppearance, upgradeAtlasRoadTextAppearance,
  validateAtlas, TEXT_APPEARANCE_ATLAS_SCHEMA_VERSION } from "../scripts/atlas-model.js";
import { addRoad } from "../scripts/road-model.js";
import { addRoadCheckpoint } from "../scripts/checkpoint-model.js";
import { readAtlas } from "../scripts/atlas-storage.js";
import { saveRoadAppearance } from "../scripts/road-storage.js";
import { DEFAULT_ROAD_APPEARANCE, DEFAULT_WORLD_ROAD_APPEARANCE,
  resolveRoadAppearance, roadAppearanceMode, validateWorldRoadAppearance,
  roadStrokeSpans, roadLabelPoint, validateRoadAppearance,
  ROAD_CURVE_PRESETS, DEFAULT_ROAD_CURVE_PRESET, smoothRoadPath,
  readRoadCurvePreset, ROAD_CURVE_SETTING, roadCurveNeighbors }
  from "../scripts/road-appearance.js";

const points = [{ x: 10, y: 10 }, { x: 110, y: 10 }];
const custom = { color: "#aa2255", width: 6, opacity: 0.65,
  pattern: "dashed", labelVisibility: "always", textColor: "#aabbcc" };
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
    { ...custom, labelVisibility: "private" }, { ...custom, textColor: "navy" },
    { ...custom, extra: "x" }
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
    assert.equal(upgraded.schemaVersion, TEXT_APPEARANCE_ATLAS_SCHEMA_VERSION);
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
    assert.equal(reset.schemaVersion, 7);
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

test("legacy v6 styles remain unchanged until explicit v7 text-color edit", () => {
  const legacy = { color: "#667788", width: 4, opacity: 0.9,
    pattern: "solid", labelVisibility: "always" };
  const old = addRoad(createEmptyAtlas(), { points, idFactory: ids() });
  const v6 = validateAtlas({ ...upgradeAtlasRoadAppearance(old),
    roads: [{ ...upgradeAtlasRoadAppearance(old).roads[0], appearance: legacy }] });
  assert.deepEqual(v6.roads[0].appearance, legacy);
  assert.equal(resolveRoadAppearance(v6.roads[0]).textColor, "#ffffff");
  const v7 = upgradeAtlasRoadTextAppearance(v6);
  assert.equal(v7.schemaVersion, 7);
  assert.equal(v7.roads[0].appearance.textColor, "#ffffff");
  assert.deepEqual(v7.nodes, v6.nodes);
  assert.deepEqual(v7.segments, v6.segments);
});

test("World Land/Air/Water profiles use assigned preset category; old flat defaults stay readable", () => {
  const profiles = validateWorldRoadAppearance(DEFAULT_WORLD_ROAD_APPEARANCE);
  assert.equal(profiles.profiles.air.color, "#b18cff");
  assert.equal(profiles.profiles.water.color, "#279cdf");
  const road = { travelPresetId: "rough-water" };
  const presets = [{ id: "rough-water", mode: "water" }];
  assert.equal(roadAppearanceMode(road, presets), "water");
  assert.equal(resolveRoadAppearance(road, profiles, roadAppearanceMode(road, presets)).color,
    "#279cdf");
  assert.equal(roadAppearanceMode({ travelPresetId: null }, presets), "land");
  assert.equal(resolveRoadAppearance({ appearance: custom }, profiles, "water").color,
    custom.color);
  const oldWorld = Object.fromEntries(Object.entries(DEFAULT_ROAD_APPEARANCE)
    .filter(([key]) => key !== "textColor"));
  const migrated = validateWorldRoadAppearance(oldWorld);
  for (const mode of ["land", "air", "water"]) {
    assert.deepEqual(migrated.profiles[mode], DEFAULT_ROAD_APPEARANCE);
  }
  assert.throws(() => validateWorldRoadAppearance({ ...profiles,
    profiles: { land: profiles.profiles.land } }), /Land, Air and Water/);
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

test("v0.2.25 World curve presets smooth display paths without touching original road points", () => {
  const vertices = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
  const original = structuredClone(vertices);
  assert.equal(DEFAULT_ROAD_CURVE_PRESET, "gentle");
  assert.deepEqual(Object.keys(ROAD_CURVE_PRESETS), ["off", "gentle", "moderate", "strong"]);
  assert.equal(smoothRoadPath(vertices, "off"), vertices);
  assert.equal(smoothRoadPath(vertices.slice(0, 2), "strong").length, 2,
    "two points do not imply a bend direction");
  const paths = ["gentle", "moderate", "strong"].map(mode => smoothRoadPath(vertices, mode));
  const bend = path => Math.max(...path.map(point => Math.max(0, -point.y, point.x - 100)));
  assert.ok(paths[0].length > vertices.length);
  assert.ok(bend(paths[0]) > 0);
  assert.ok(bend(paths[1]) > bend(paths[0]));
  assert.ok(bend(paths[2]) > bend(paths[1]));
  for (const path of paths) {
    assert.deepEqual(path[0], vertices[0]);
    assert.deepEqual(path.at(-1), vertices.at(-1));
    assert.ok(path.some(p => p === vertices[1]), "spline passes through the authored bend");
    assert.ok(path.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
    assert.ok(roadStrokeSpans(path, "dashed", 4).length > 2,
      "dash pattern can follow the same sampled curve continuously");
  }
  assert.deepEqual(vertices, original, "World preference cannot mutate Scene graph coordinates");
  assert.throws(() => smoothRoadPath(vertices, "unbounded"), /curvature preset/);
});

test("v0.2.25 World curvature reader uses registered choice or safe strong default", () => {
  const previous = globalThis.game;
  try {
    globalThis.game = { settings: { get(_module, setting) {
      return setting === ROAD_CURVE_SETTING ? "strong" : null;
    } } };
    assert.equal(readRoadCurvePreset(), "strong");
    globalThis.game.settings.get = () => "unsupported";
    assert.equal(readRoadCurvePreset(), "strong");
    globalThis.game.settings.get = () => undefined;
    assert.equal(readRoadCurvePreset(), "strong");
  } finally { globalThis.game = previous; }
});

test("v0.2.25 checkpoint-split sections share a continuous road bend", () => {
  let index = 0;
  const idFactory = () => "curve-split-" + ++index;
  const original = addRoad(createEmptyAtlas(), {
    name: "Joined river path",
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], idFactory
  });
  const split = addRoadCheckpoint(original, {
    roadId: original.roads[0].id,
    candidate: { kind: "edge", segmentId: original.segments[0].id,
      edgeIndex: 1, atVertex: true, x: 100, y: 0 },
    name: "River Port", idFactory
  });
  assert.equal(split.segments.length, 2);
  const map = new Map(split.nodes.map(node => [node.id, node]));
  const adjacent = roadCurveNeighbors(split);
  const first = split.segments[0], second = split.segments[1];
  const lead = smoothRoadPath([map.get(first.from), map.get(first.to)], "strong",
    adjacent.get(first.id));
  const tail = smoothRoadPath([map.get(second.from), map.get(second.to)], "strong",
    adjacent.get(second.id));
  assert.ok(lead.length > 2 && tail.length > 2,
    "splitting a road at a checkpoint must not revert each section to a straight line");
  assert.deepEqual(lead.at(-1), tail[0], "both splines meet exactly on the authored checkpoint");
  assert.ok(lead.some(point => point.y < -0.1));
  assert.ok(tail.some(point => point.x > 100.1));
  assert.equal(split.nodes.length, original.nodes.length + 1,
    "the only new graph node is the deliberately created checkpoint junction");
});
