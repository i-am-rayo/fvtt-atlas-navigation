import assert from "node:assert/strict";
import test from "node:test";
import { differsFromSceneGrid, readSceneGridScale, resolveAtlasScale } from "../scripts/scene-grid.js";

test("native Scene Grid supplies per-Scene scale without writing any flags", () => {
  const scene = {
    grid: { size: 49, distance: 7.5, units: "km", type: 3 },
    getFlag() { throw Error("Grid reader must not read flags"); },
    setFlag() { throw Error("Grid reader must never write flags"); }
  };
  const grid = readSceneGridScale(scene);
  assert.equal(grid.source, "scene-grid");
  assert.equal(grid.gridType, 3);
  assert.equal(grid.unit, "km");
  assert.equal(grid.unitsPerSpace, 7.5);
  assert.equal(grid.pixelsPerSpace, 49);
  assert.equal(grid.unitsPerPixel, 7.5 / 49);
  assert.deepEqual(resolveAtlasScale(scene, { calibration: null }), grid);
});

test("manual v1 calibration takes precedence and survives resolution intact", () => {
  const scene = { grid: { size: 49, distance: 7.5, units: "km" } };
  const manual = { source: "manual", unitsPerPixel: 0.05, unit: "km" };
  const resolved = resolveAtlasScale(scene, { calibration: manual });
  assert.deepEqual(resolved, manual);
  assert.notEqual(resolved, manual, "derive a copy, never mutate the stored flag");
  assert.equal(differsFromSceneGrid(manual, readSceneGridScale(scene)), true);
  assert.equal(manual.unitsPerPixel, 0.05);
});

test("custom units are displayed as entered; missing/bad Grid scale stays uncalibrated", () => {
  assert.equal(readSceneGridScale({ grid: { size: 0, distance: 5, units: "mi" } }), null);
  assert.equal(readSceneGridScale({ grid: { size: 100, distance: 0, units: "mi" } }), null);
  assert.equal(readSceneGridScale({ grid: { size: 100, distance: 1, units: "" } }), null);
  assert.equal(readSceneGridScale(null), null);
  const scene = { grid: { size: 100, distance: 2, units: " leagues " } };
  assert.equal(readSceneGridScale(scene).unit, "leagues");
  assert.equal(resolveAtlasScale(scene, { calibration: null }).unitsPerPixel, 0.02);
});

test("near-equal overrides do not produce a scale mismatch warning", () => {
  const grid = readSceneGridScale({ grid: { size: 100, distance: 5, units: "km" } });
  assert.equal(differsFromSceneGrid({ source: "manual", unitsPerPixel: 0.05002, unit: "km" }, grid), false);
  assert.equal(differsFromSceneGrid({ source: "manual", unitsPerPixel: 0.05, unit: "mi" }, grid), true);
  assert.equal(differsFromSceneGrid(null, grid), false);
});
