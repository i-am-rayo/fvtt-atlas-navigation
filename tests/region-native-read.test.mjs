import test from "node:test";
import assert from "node:assert/strict";
import { projectRoadSurfaceRegions } from "../scripts/region-surface-model.js";
import { listGeneratedRegions, sceneRoadSurfaces } from "../scripts/region-native-read.js";
import { shapeSignature } from "../scripts/generated-region-model.js";
import { sceneRoadSurfaces as legacySurfaceRead } from "../scripts/road-surface-overlay.js";
import { roadSurfaceAtPoint } from "../scripts/road-surface-overlay.js";
import { listGeneratedRegions as legacyGeneratedRead } from "../scripts/generated-region.js";

const rectangle = { type: "polygon", points: [0, 0, 40, 0, 40, 20, 0, 20], hole: false };
const hole = { type: "polygon", points: [10, 5, 30, 5, 30, 15, 10, 15], hole: true };
const presets = [{id: "land", name: "Land", color: "#aabbcc"},
  {id: "water", name: "Water", color: "#0011ff"}];

function region(id, flags, shapes = [rectangle], options = {}) {
  const writes = [];
  return {
    id, name: options.name ?? id, color: options.color ?? "#ffffff",
    hidden: options.hidden ?? false, shapes, elevation: options.elevation ?? {bottom: -10, top: 90},
    behaviors: options.behaviors ?? [], writes,
    getFlag(scope, key) {
      assert.equal(scope, "fvtt-atlas-navigation");
      return flags[key];
    },
    setFlag(...args) { writes.push(args); throw Error("Unexpected Region write"); },
    update(...args) { writes.push(args); throw Error("Unexpected Region update"); }
  };
}

function scene(regions, order = null) {
  return {regions: {contents: regions, values: () => regions.values()},
    getFlag(scope, key) {
      assert.equal(scope, "fvtt-atlas-navigation");
      assert.equal(key, "routingRegionOrder");
      return order;
    }};
}

test("pure surface projection derives display order without writing Region data", () => {
  const inputs = [
    {id: "l", presetId: "land", shapes: [rectangle, hole], priority: 0},
    {id: "w", presetId: "water", shapes: [rectangle], priority: 5},
    {id: "u", presetId: "missing", shapes: [rectangle], priority: 100},
    {id: "invalid", presetId: "water", shapes: [{type: "rectangle"}], priority: 100}
  ];
  const snapshot = structuredClone(inputs);
  const result = projectRoadSurfaceRegions(inputs, presets, ["l", "w"]);
  assert.deepEqual(result.map(({id, rank, color}) => ({id, rank, color})), [
    {id: "l", rank: 0, color: "#aabbcc"},
    {id: "w", rank: 1, color: "#0011ff"}
  ]);
  assert.deepEqual(result[0].shapes, [rectangle, hole]);
  assert.deepEqual(inputs, snapshot);
});

test("surface adapter keeps native shapes and manual Region attributes unchanged", () => {
  const native = region("terrain", {travelPreset: {presetId: "land"}, routingPriority: 2},
    [rectangle, hole], {hidden: true});
  const original = { shapes: native.shapes, elevation: native.elevation,
    behaviors: native.behaviors, color: native.color, hidden: native.hidden };
  const active = scene([native]);
  const readout = sceneRoadSurfaces(active, presets);
  assert.deepEqual(readout.map(r => [r.id, r.rank, r.priority]), [["terrain", 0, 2]]);
  assert.deepEqual(legacySurfaceRead(active, presets), readout);
  assert.notEqual(readout[0].shapes[0], native.shapes[0]);
  readout[0].shapes[0].points[0] = 999;
  assert.equal(native.shapes[0].points[0], 0);
  for (const [field, value] of Object.entries(original)) assert.equal(native[field], value);
  assert.deepEqual(native.writes, []);
});

test("native shape DataModels are copied for visual holes without changing the source", () => {
  let reads = 0;
  const nativeShape = {toObject() {reads++; return {type: "polygon",
    origin: {x: 0, y: 0}, points: [...rectangle.points], hole: false}; }};
  const native = region("land", {travelPreset: {presetId: "land"}}, [nativeShape, hole]);
  const surfaces = sceneRoadSurfaces(scene([native]), presets);
  assert.equal(reads, 1);
  assert.equal(roadSurfaceAtPoint({x: 5, y: 5}, surfaces), "Land");
  assert.equal(roadSurfaceAtPoint({x: 20, y: 10}, surfaces), null);
  surfaces[0].shapes[0].origin.x = 500;
  assert.equal(nativeShape.toObject().origin.x, 0);
  assert.deepEqual(native.writes, []);
});

test("generated Region reader reports edited native geometry and isolates invalid provenance", () => {
  const metadata = {
    schemaVersion: 1, kind: "checkpoint", roadId: "road",
    checkpointIds: ["checkpoint"], widthCells: 0.5, gridSize: 100,
    shapeSignature: shapeSignature([rectangle])
  };
  const valid = region("g", {generatedRegion: metadata,
    travelPreset: {schemaVersion: 1, presetId: "land"}}, [rectangle]);
  const edited = region("edited", {generatedRegion: metadata}, [rectangle, hole]);
  const invalid = region("future", {generatedRegion: {...metadata, schemaVersion: 999}});
  const manual = region("manual", {}, [rectangle]);
  const active = scene([valid, edited, invalid, manual]);
  const readouts = listGeneratedRegions(active);
  assert.deepEqual(readouts.map(r => [r.id, r.invalid, r.modified]), [
    ["g", false, false], ["edited", false, true], ["future", true, false]
  ]);
  assert.equal(readouts[0].metadata.shapeSignature, metadata.shapeSignature);
  assert.equal(readouts[0].presetId, "land");
  assert.equal(readouts[0].nativeCost.existing, false);
  assert.deepEqual(legacyGeneratedRead(active), readouts);
  for (const native of [valid, edited, invalid, manual]) assert.deepEqual(native.writes, []);
});

test("generated Region reader reports native Behavior state without rewriting it", () => {
  const nativeBehavior = {id: "b", type: "modifyMovementCost", disabled: true,
    system: {difficulties: {walk: 3}}};
  const shape = [rectangle];
  const native = region("managed", {
    generatedRegion: {schemaVersion: 1, kind: "checkpoint", roadId: "r",
      checkpointIds: ["c"], widthCells: 0.5, gridSize: 100,
      shapeSignature: shapeSignature(shape)}
  }, shape, {behaviors: [nativeBehavior]});
  const readout = listGeneratedRegions(scene([native]))[0];
  assert.equal(readout.nativeCost.existing, true);
  assert.equal(readout.nativeCost.disabled, true);
  assert.deepEqual(readout.nativeCost.actualCosts, {walk: 3});
  assert.deepEqual(native.writes, []);
  assert.equal(native.behaviors[0], nativeBehavior);
});
