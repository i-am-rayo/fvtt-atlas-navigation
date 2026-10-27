import assert from "node:assert/strict";
import test from "node:test";
import { fogCoverForGrid, fogCoverRuns } from "../scripts/atlas-fog-geometry.js";

test("grid-aligned cover uses cells with centers outside discovery", () => {
  const grid = {
    getCenterPoint: ({ i }) => ({ x: i * 10 + 5, y: 5 }),
    getShape: () => [{ x: -5, y: -5 }, { x: 5, y: -5 }, { x: 5, y: 5 },
      { x: -5, y: 5 }]
  };
  const polygons = fogCoverForGrid(grid, { x: 0, y: 0, width: 20, height: 10 },
    point => point.x < 10, { rows: 2, columns: 1 });
  assert.equal(polygons.length, 1);
  assert.deepEqual(polygons[0][0], { x: 10, y: 0 });
  assert.deepEqual(polygons[0][2], { x: 20, y: 10 });
});

test("gridless raster merges overlapping circles without triangulation holes", () => {
  const rects = fogCoverRuns({ x: 0, y: 0, width: 30, height: 10 }, [
    { x: 10, y: 5, radius: 9 }, { x: 20, y: 5, radius: 9 }
  ], 1);
  assert.ok(rects.length > 0);
  assert.ok(rects.every(r => r.width > 0 && r.height > 0));
  // The center between overlapping reveals must never receive black coverage.
  assert.ok(rects.every(r =>
    !(r.x <= 15 && r.x + r.width > 15 && r.y <= 5 && r.y + r.height > 5)));
});

test("native grid failures cannot silently produce an exposed map", () => {
  assert.throws(() => fogCoverForGrid({}, { x: 0, y: 0, width: 10, height: 10 },
    () => false), /requires/);
  assert.throws(() => fogCoverForGrid({
    getTopLeftPoint: () => ({ x: 0, y: 0 }),
    getCenterPoint: () => ({ x: 0, y: 0 }),
    getShape: () => [{ x: 0, y: 0 }, { x: 0, y: 5 }, { x: 5, y: 0 }]
  }, { x: 0, y: 0, width: 10, height: 10 }, () => false,
  { rows: 2, columns: 1 }, 1), /bounded/);
});
