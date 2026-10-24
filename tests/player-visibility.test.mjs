import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyAtlas, upgradeAtlasPlayerVisibility, validateAtlas } from "../scripts/atlas-model.js";
import { addRoad } from "../scripts/road-model.js";
import { addRoadCheckpoint } from "../scripts/checkpoint-model.js";
import { playerAtlasOverlay, setRoadPlayerVisibility,
  setCheckpointPlayerVisibility } from "../scripts/player-visibility.js";
import { saveRoadPlayerVisibility, saveCheckpointPlayerVisibility,
  saveCheckpointPresentation } from "../scripts/road-storage.js";
import { DEFAULT_CHECKPOINT_APPEARANCE } from "../scripts/checkpoint-appearance.js";

function fixture() {
  let i = 0;
  const idFactory = () => "hidden" + ++i;
  let atlas = addRoad(createEmptyAtlas(), {
    name: "Secret Road", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], idFactory
  });
  atlas = addRoadCheckpoint(atlas, {
    roadId: atlas.roads[0].id, candidate: { kind: "node", nodeId: atlas.segments[0].from },
    name: "Secret Observatory", elevationMeters: 400, idFactory
  });
  return atlas;
}

test("v9 reveal controls start hidden, validate strictly and preserve prior Scene data", () => {
  const old = fixture();
  const upgraded = upgradeAtlasPlayerVisibility(old);
  assert.equal(old.schemaVersion, 4, "no mutation on old Scene reads");
  assert.equal(upgraded.schemaVersion, 9);
  assert.equal(upgraded.revision, old.revision);
  assert.deepEqual(upgraded.nodes, old.nodes);
  assert.deepEqual(upgraded.segments, old.segments);
  assert.equal(upgraded.roads[0].playerVisible, false);
  assert.equal(upgraded.checkpoints[0].playerVisible, false);
  assert.deepEqual(validateAtlas(upgraded), upgraded);
  assert.throws(() => validateAtlas({ ...upgraded, roads: [
    { ...upgraded.roads[0], playerVisible: "yes" }
  ] }), /playerVisible/);
  assert.throws(() => validateAtlas({ ...upgraded, checkpoints: [
    { ...upgraded.checkpoints[0], playerVisible: undefined }
  ] }), /playerVisible/);
  assert.deepEqual(upgradeAtlasPlayerVisibility(upgraded), upgraded);
});

test("independent visual toggles never reveal a hidden road through checkpoint projection", () => {
  const old = fixture();
  assert.equal(playerAtlasOverlay(old).segments.length, 0);
  assert.equal(playerAtlasOverlay(old).checkpoints.length, 0);
  const checkpointId = old.checkpoints[0].id;
  const roadId = old.roads[0].id;
  const shownCheckpoint = setCheckpointPlayerVisibility(old, { checkpointId, visible: true });
  const isolated = playerAtlasOverlay(shownCheckpoint);
  assert.equal(isolated.segments.length, 0);
  assert.equal(isolated.roads.length, 0);
  assert.equal(isolated.checkpoints.length, 1);
  assert.equal(isolated.checkpoints[0].name, "");
  assert.equal(isolated.checkpoints[0].roadId, null);
  assert.equal(isolated.checkpoints[0].elevationMeters, null);
  assert.equal(isolated.nodes.length, 1, "other hidden geometry is excluded");
  assert.ok(!JSON.stringify(isolated).includes("Secret Road"));
  assert.ok(!JSON.stringify(isolated).includes("Secret Observatory"));
  const shownRoad = setRoadPlayerVisibility(shownCheckpoint, { roadId, visible: true });
  const both = playerAtlasOverlay(shownRoad);
  assert.equal(both.segments.length, 1);
  assert.equal(both.checkpoints.length, 1);
  const hiddenCheckpoint = setCheckpointPlayerVisibility(shownRoad, { checkpointId, visible: false });
  assert.equal(playerAtlasOverlay(hiddenCheckpoint).checkpoints.length, 0);
  assert.equal(playerAtlasOverlay(hiddenCheckpoint).segments.length, 1);
  assert.throws(() => setRoadPlayerVisibility(old, { roadId, visible: "true" }), /on or off/);
});

test("v9-added roads and checkpoints default hidden without touching existing reveals", () => {
  let data = setRoadPlayerVisibility(fixture(), { roadId: fixture().roads[0].id, visible: true });
  let i = 0;
  const idFactory = () => "fresh" + ++i;
  data = addRoad(data, { name: "New Road", points: [{ x: 200, y: 0 }, { x: 300, y: 0 }],
    idFactory });
  assert.equal(data.roads.at(-1).playerVisible, false);
  data = addRoadCheckpoint(data, {
    roadId: data.roads.at(-1).id,
    candidate: { kind: "node", nodeId: data.segments.at(-1).from },
    name: "New Camp", idFactory
  });
  assert.equal(data.checkpoints.at(-1).playerVisible, false);
  assert.equal(data.roads[0].playerVisible, true);
});

test("one GM checkpoint inspector save updates name, appearance and visibility atomically", async () => {
  const before = fixture();
  const previousGame = globalThis.game;
  globalThis.game = { user: { isGM: true } };
  let stored = before;
  let writes = 0;
  const scene = {
    canUserModify: () => true,
    getFlag: () => stored,
    setFlag: async (_scope, _key, next) => { stored = next; writes++; }
  };
  try {
    const roadId = before.roads[0].id;
    const checkpointId = before.checkpoints[0].id;
    const styled = { ...DEFAULT_CHECKPOINT_APPEARANCE, type: "fa", icon: "solid:dragon" };
    const saved = await saveCheckpointPresentation(scene, {
      checkpointId, name: "Revealed Port", elevationMeters: 75,
      appearance: styled, playerVisible: true, expectedRevision: before.revision
    });
    assert.equal(writes, 1);
    assert.equal(saved.schemaVersion, 9);
    assert.equal(saved.revision, 1);
    assert.equal(saved.checkpoints[0].name, "Revealed Port");
    assert.equal(saved.checkpoints[0].elevationMeters, 75);
    assert.equal(saved.checkpoints[0].playerVisible, true);
    assert.deepEqual(saved.checkpoints[0].appearance, styled);
    assert.equal(saved.roads[0].playerVisible, false);
    assert.equal(saved.roads[0].id, roadId);
    await assert.rejects(saveCheckpointPresentation(scene, {
      checkpointId, name: "stale", elevationMeters: 0,
      appearance: null, playerVisible: false, expectedRevision: 0
    }), /changed since/);
    assert.equal(writes, 1);
    await saveRoadPlayerVisibility(scene, { roadId, visible: true, expectedRevision: 1 });
    await saveCheckpointPlayerVisibility(scene, {
      checkpointId, visible: false, expectedRevision: 2
    });
    assert.equal(writes, 3);
    assert.equal(stored.roads[0].playerVisible, true);
    assert.equal(stored.checkpoints[0].playerVisible, false);
    globalThis.game.user.isGM = false;
    await assert.rejects(saveRoadPlayerVisibility(scene, {
      roadId, visible: false, expectedRevision: 3
    }), /Only a GM/);
    assert.equal(writes, 3);
  } finally { globalThis.game = previousGame; }
});
