import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyAtlas } from "../scripts/atlas-model.js";
import { addRoad } from "../scripts/road-model.js";
import { addRoadCheckpoint } from "../scripts/checkpoint-model.js";
import { DEFAULT_CHECKPOINT_APPEARANCE,
  checkpointMarkerPosition } from "../scripts/checkpoint-appearance.js";
import { atlasShortcutTarget } from "../scripts/atlas-canvas-hit.js";
import { smoothRoadPath } from "../scripts/road-appearance.js";

test("Shift-click hit test prefers checkpoint icon and node over underlying road", () => {
  let nextId = 0;
  const idFactory = () => "hit" + ++nextId;
  const built = addRoad(createEmptyAtlas(), {
    name: "Hidden trail", points: [{ x: 10, y: 20 }, { x: 200, y: 20 }], idFactory
  });
  const withCheckpoint = addRoadCheckpoint(built, {
    roadId: built.roads[0].id,
    candidate: { kind: "node", nodeId: built.segments[0].from },
    name: "Lost gate", elevationMeters: null, idFactory
  });
  const checkpoint = withCheckpoint.checkpoints[0];
  const updated = { ...withCheckpoint, checkpoints: [{ ...checkpoint,
    appearance: { ...DEFAULT_CHECKPOINT_APPEARANCE, type: "fa", icon: "solid:dragon" }
  }] };
  const identity = point => point;
  const raised = checkpointMarkerPosition({ x: 10, y: 20 },
    updated.checkpoints[0].appearance, 1);
  assert.deepEqual(atlasShortcutTarget(updated, raised, identity),
    { kind: "checkpoint", id: checkpoint.id });
  assert.deepEqual(atlasShortcutTarget(updated, { x: 10, y: 20 }, identity),
    { kind: "checkpoint", id: checkpoint.id });
  assert.deepEqual(atlasShortcutTarget(updated, { x: 100, y: 22 }, identity),
    { kind: "road", id: built.roads[0].id });
  assert.equal(atlasShortcutTarget(updated, { x: 100, y: 45 }, identity), null);
  assert.equal(atlasShortcutTarget(updated, { x: NaN, y: 0 }, identity), null);
  assert.deepEqual(atlasShortcutTarget(updated, { x: 100, y: 22 }, identity, 4),
    { kind: "road", id: built.roads[0].id });
  assert.equal(atlasShortcutTarget(updated, { x: 100, y: 28 }, identity, 4), null,
    "hit tolerance remains small when zoomed in");
});

test("v0.2.25 GM Shift-click follows the displayed spline rather than its old straight chord", () => {
  let index = 0;
  const points = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }];
  const atlas = addRoad(createEmptyAtlas(), {
    name: "Coastal Turn", points, idFactory: () => "curve-hit-" + ++index
  });
  const curved = smoothRoadPath(points, "strong");
  const raisedPoint = curved.find(point => point.x > 650 && point.x < 850 && point.y < -20);
  assert.ok(raisedPoint, "strong preset lifts a large bend visibly from the original chord");
  assert.equal(atlasShortcutTarget(atlas, raisedPoint, point => point, 1, "off"), null);
  assert.deepEqual(atlasShortcutTarget(atlas, raisedPoint, point => point, 1, "strong"),
    { kind: "road", id: atlas.roads[0].id });
  assert.equal(atlasShortcutTarget(atlas, { x: 500, y: -100 }, point => point,
    1, "strong"), null, "empty areas cannot select the smoothed road");
});
