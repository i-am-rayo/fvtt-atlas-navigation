import assert from "node:assert/strict";
import test from "node:test";
import { atlasPointExplored, exploredRoadSpans } from "../scripts/road-fog.js";

test("explored-only player projection clips crossing roads into disconnected spans", () => {
  const saved = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
  const spans = exploredRoadSpans(saved, point => point.x <= 30 || point.x >= 70);
  assert.equal(spans.length, 2);
  assert.ok(spans[0].at(-1).x <= 31);
  assert.ok(spans[1][0].x >= 69);
  assert.ok(spans.every(span => span.every(point => point.x < 35 || point.x > 65)));
  assert.deepEqual(saved, [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    "fog clipping does not modify authored geometry");
});

test("unexplored regions never create player road spans", () => {
  const path = [{ x: 0, y: 0 }, { x: 50, y: 0 }];
  assert.deepEqual(exploredRoadSpans(path, () => false), []);
  assert.deepEqual(exploredRoadSpans(path, () => true)[0].at(-1), path.at(-1));
});

test("v14 fog manager controls explored areas; missing fog fails closed", () => {
  const scene = { tokenVision: true, fogExploration: true };
  const canvas = { scene, fog: { isPointExplored: point => point.x < 20 } };
  assert.equal(atlasPointExplored(canvas, { x: 10, y: 0 }), true);
  assert.equal(atlasPointExplored(canvas, { x: 40, y: 0 }), false);
  assert.equal(atlasPointExplored({ scene }, { x: 10, y: 0 }), false);
  assert.equal(atlasPointExplored({ scene: { ...scene, fogExploration: false } }, {}), true);
  assert.equal(atlasPointExplored({ scene: { tokenVision: false } }, {}), true);
});
