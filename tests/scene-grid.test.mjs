import assert from "node:assert/strict";
import test from "node:test";
import { readSceneGridScale } from "../scripts/scene-grid.js";

test("native Scene Grid supplies measurement settings without writing atlas flags", () => {
  const scene = {
    grid: { size: 49, distance: 7.5, units: "km", type: 3 },
    getFlag() { throw Error("Grid reader must not read flags"); },
    setFlag() { throw Error("Grid reader must never write flags"); }
  };
  const grid = readSceneGridScale(scene);
  assert.deepEqual(grid, {
    unit: "km",
    pixelsPerSpace: 49,
    unitsPerSpace: 7.5,
    gridType: 3
  });
  assert.equal("unitsPerPixel" in grid, false,
    "a linear pixels-to-distance ratio is not authoritative for hex or gridless rulers");
});

test("legacy manual atlas flags cannot change native Scene measurement", () => {
  const scene = {
    grid: { size: 49, distance: 7.5, units: "km" },
    calibration: { source: "manual", unitsPerPixel: 0.05, unit: "mi" }
  };
  assert.deepEqual(readSceneGridScale(scene), {
    unit: "km", pixelsPerSpace: 49, unitsPerSpace: 7.5, gridType: null
  });
  assert.equal(scene.calibration.unit, "mi", "legacy state stays untouched");
});

test("invalid Grid geometry is unavailable, but a unit label may be blank", () => {
  assert.equal(readSceneGridScale({ grid: { size: 0, distance: 5, units: "mi" } }), null);
  assert.equal(readSceneGridScale({ grid: { size: 100, distance: 0, units: "mi" } }), null);
  assert.equal(readSceneGridScale(null), null);
  const scene = { grid: { size: 100, distance: 2, units: " leagues " } };
  assert.equal(readSceneGridScale(scene).unit, "leagues");
  assert.equal(readSceneGridScale({ grid: { size: 100, distance: 2, units: "" } }).unit, "");
});
