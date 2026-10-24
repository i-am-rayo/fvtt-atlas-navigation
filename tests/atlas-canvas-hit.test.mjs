import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyAtlas } from "../scripts/atlas-model.js";
import { addRoad } from "../scripts/road-model.js";
import { addRoadCheckpoint } from "../scripts/checkpoint-model.js";
import { DEFAULT_CHECKPOINT_APPEARANCE,
  checkpointMarkerPosition } from "../scripts/checkpoint-appearance.js";
import { atlasShortcutTarget } from "../scripts/atlas-canvas-hit.js";

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
