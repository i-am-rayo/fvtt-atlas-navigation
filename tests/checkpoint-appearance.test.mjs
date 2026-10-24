import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyAtlas, validateAtlas, upgradeAtlasRoadTextAppearance,
  upgradeAtlasCheckpointAppearance } from "../scripts/atlas-model.js";
import { addRoad } from "../scripts/road-model.js";
import { addRoadCheckpoint, editCheckpointAppearance, editRoadCheckpoint }
  from "../scripts/checkpoint-model.js";
import { CHECKPOINT_ICONS, CHECKPOINT_ICON_ROOT,
  validateCheckpointAppearance, checkpointIconPath,
  DEFAULT_CHECKPOINT_APPEARANCE } from "../scripts/checkpoint-appearance.js";
import { saveCheckpointAppearance } from "../scripts/road-storage.js";
import { ATLAS_FLAG, MODULE_ID } from "../scripts/atlas-storage.js";

function fixture() {
  let n = 0;
  const road = addRoad(createEmptyAtlas(), {
    name: "Hidden mountain pass",
    points: [{ x: 1, y: 2 }, { x: 130, y: 110 }],
    idFactory: () => "id" + ++n
  });
  const checkpoint = addRoadCheckpoint(road, {
    roadId: road.roads[0].id,
    candidate: { kind: "node", nodeId: road.segments[0].from },
    name: "Ridge Lookout", elevationMeters: 470,
    idFactory: () => "id" + ++n
  });
  return upgradeAtlasRoadTextAppearance(checkpoint);
}

const fancy = { ...DEFAULT_CHECKPOINT_APPEARANCE, type: "fa",
  icon: "mountain", color: "#edcc44", textColor: "#171717",
  labelMode: "hover", showRoadName: true, size: 32 };

test("v8 checkpoint appearance is an explicit lossless GM-authored migration", () => {
  const old = fixture();
  assert.equal(old.schemaVersion, 7);
  const v8 = upgradeAtlasCheckpointAppearance(old);
  assert.equal(v8.schemaVersion, 8);
  assert.equal(v8.checkpoints[0].appearance, null);
  assert.deepEqual(v8.nodes, old.nodes);
  assert.deepEqual(v8.segments, old.segments);
  assert.deepEqual(v8.roads, old.roads);
  assert.equal(v8.revision, old.revision);
  assert.equal(old.checkpoints[0].appearance, undefined,
    "reading or migrating does not mutate the prior object");

  const updated = editCheckpointAppearance(old, {
    checkpointId: old.checkpoints[0].id, appearance: fancy
  });
  assert.equal(updated.schemaVersion, 8);
  assert.deepEqual(updated.checkpoints[0].appearance, fancy);
  assert.equal(updated.checkpoints[0].elevationMeters, 470);
  assert.equal(updated.checkpoints[0].name, "Ridge Lookout");
  assert.deepEqual(updated.segments, old.segments);
  assert.deepEqual(updated.roads, old.roads);
  assert.deepEqual(editRoadCheckpoint(updated, {
    checkpointId: updated.checkpoints[0].id,
    name: "New label", elevationMeters: 990
  }).checkpoints[0].appearance, fancy, "metadata edits preserve icon configuration");
  assert.equal(editCheckpointAppearance(updated, {
    checkpointId: updated.checkpoints[0].id, appearance: null
  }).checkpoints[0].appearance, null);
  assert.equal(editCheckpointAppearance(old, {
    checkpointId: old.checkpoints[0].id, appearance: null
  }).schemaVersion, 7, "reset on an old Scene does not force migration");
});

test("checkpoint icon style whitelist, type and local image paths are strict", () => {
  assert.equal(CHECKPOINT_ICONS.length, 12);
  assert.equal(checkpointIconPath(fancy), CHECKPOINT_ICON_ROOT + "mountain.svg");
  assert.equal(checkpointIconPath(DEFAULT_CHECKPOINT_APPEARANCE), null);
  const image = { ...fancy, type: "image", image: "worlds/my-world/map-icon.webp" };
  assert.equal(checkpointIconPath(image), image.image);
  for (const bad of [
    { ...fancy, icon: "user-secret" },
    { ...fancy, size: 101 },
    { ...fancy, color: "red" },
    { ...fancy, labelMode: "sometimes" },
    { ...fancy, showRoadName: "true" },
    { ...fancy, extra: "unexpected" },
    { ...fancy, type: "image", image: "" },
    { ...fancy, type: "image", image: "../secrets.svg" },
    { ...fancy, type: "image", image: "https://example.org/a.svg" },
    { ...fancy, type: "image", image: "worlds/map.html" }
  ]) assert.throws(() => validateCheckpointAppearance(bad));
  const old = fixture();
  const invalidV8 = { ...upgradeAtlasCheckpointAppearance(old) };
  invalidV8.checkpoints = [{ ...invalidV8.checkpoints[0], appearance: { ...fancy, icon: "hacked" } }];
  assert.throws(() => validateAtlas(invalidV8));
  assert.throws(() => validateAtlas({ ...invalidV8,
    checkpoints: [{ ...old.checkpoints[0] }] }),
  "schema v8 must not silently lose or omit appearance");
});

test("checkpoint appearance storage requires GM permission and fresh revision", async () => {
  let stored = fixture();
  const scene = {
    getFlag: (module, key) => module === MODULE_ID && key === ATLAS_FLAG ? stored : undefined,
    canUserModify: () => true,
    setFlag: async (_module, _key, value) => { stored = value; }
  };
  const original = globalThis.game;
  try {
    globalThis.game = { user: { isGM: false } };
    await assert.rejects(saveCheckpointAppearance(scene, {
      checkpointId: stored.checkpoints[0].id, appearance: fancy, expectedRevision: 0
    }), /GM/);
    globalThis.game = { user: { isGM: true } };
    await assert.rejects(saveCheckpointAppearance(scene, {
      checkpointId: stored.checkpoints[0].id, appearance: fancy, expectedRevision: 5
    }), /changed/);
    const revision = stored.revision;
    await saveCheckpointAppearance(scene, {
      checkpointId: stored.checkpoints[0].id, appearance: fancy, expectedRevision: revision
    });
    assert.equal(stored.schemaVersion, 8);
    assert.equal(stored.revision, revision + 1);
    assert.deepEqual(stored.checkpoints[0].appearance, fancy);
    await assert.rejects(saveCheckpointAppearance(scene, {
      checkpointId: stored.checkpoints[0].id, appearance: fancy, expectedRevision: revision
    }), /changed/);
  } finally {
    globalThis.game = original;
  }
});
