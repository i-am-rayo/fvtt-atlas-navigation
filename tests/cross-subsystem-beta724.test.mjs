import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyAtlas } from "../scripts/atlas-model.js";
import { readAtlas } from "../scripts/atlas-storage.js";
import { saveNewRoad, saveNewCheckpoint, saveRoadPlayerVisibility,
  savePointEdits } from "../scripts/road-storage.js";
import { playerAtlasOverlay } from "../scripts/player-visibility.js";
import { coveredManualFogCells } from "../scripts/atlas-manual-fog-projection.js";
import { listGeneratedRegions, sceneRoadSurfaces } from "../scripts/region-native-read.js";
import { shapeSignature } from "../scripts/generated-region-model.js";
import { approvedTransportRecoverySelection }
  from "../scripts/navigation-transport-recovery.js";

const fogState = Object.freeze({schemaVersion: 1, enabled: true,
  revealed: [{x: 50, y: 50}], hidden: [{x: 150, y: 50}]});
const nativeShape = {type: "polygon", points: [0, 0, 110, 0, 110, 80, 0, 80], hole: false};
const surfacePresets = [{id: "sea", name: "Turbulent Ocean", color: "#215caa"}];

function fixtureScene() {
  let atlas = createEmptyAtlas();
  const writes = {atlas: 0, region: 0, other: 0};
  const regionFlags = {
    generatedRegion: {schemaVersion: 1, kind: "checkpoint", roadId: "road",
      checkpointIds: ["checkpoint"], widthCells: 1, gridSize: 100,
      shapeSignature: shapeSignature([nativeShape])},
    travelPreset: {schemaVersion: 1, presetId: "sea"},
    routingPriority: 2
  };
  const region = {
    id: "native-region", name: "Sea", color: "#114488",
    elevation: {bottom: -10, top: 20}, hidden: false,
    behaviors: [{id: "native-cost", type: "modifyMovementCost", disabled: false,
      system: {difficulties: {swim: 2}}}],
    shapes: [structuredClone(nativeShape)],
    getFlag(_scope, key) { return regionFlags[key]; },
    update() { writes.region++; throw Error("Atlas must not write native Regions in this test"); },
    setFlag() { writes.region++; throw Error("Atlas must not write native Region flags on read"); }
  };
  const scene = {
    regions: {contents: [region], values: () => [region].values()},
    getFlag(scope, key) {
      assert.equal(scope, "fvtt-atlas-navigation");
      if (key === "atlas") return atlas;
      if (key === "manualFog") return fogState;
      if (key === "routingRegionOrder") return null;
      throw Error(`Unexpected Atlas Scene flag ${key}`);
    },
    canUserModify() { return true; },
    async setFlag(scope, key, next) {
      assert.equal(scope, "fvtt-atlas-navigation");
      if (key !== "atlas") { writes.other++; throw Error(`Unexpected Scene write ${key}`); }
      writes.atlas++;
      atlas = next;
      return this;
    }
  };
  return {scene, region, writes};
}

let sequence = 0;
const idFactory = () => `integrated-${++sequence}`;

test("beta.7.24 GM Road and Checkpoint commits leave Fog, native Regions and unrelated records intact", async () => {
  const previous = globalThis.game;
  globalThis.game = {user: {isGM: true}};
  try {
    const {scene, region, writes} = fixtureScene();
    const regionBefore = structuredClone({shapes: region.shapes,
      elevation: region.elevation, behaviors: region.behaviors});
    const fogBefore = structuredClone(scene.getFlag("fvtt-atlas-navigation", "manualFog"));
    const road = await saveNewRoad(scene, {name: "Coastal Pass",
      points: [{x: 0, y: 40}, {x: 100, y: 40}],
      expectedRevision: 0, idFactory});
    const roadId = road.roads[0].id;
    const endpoint = road.segments[0].to;
    const checkpoint = await saveNewCheckpoint(scene, {roadId,
      candidate: {kind: "node", nodeId: endpoint}, name: "Harbor",
      elevationMeters: 0, expectedRevision: road.revision,
      idFactory, playerVisible: true});
    const checkpointId = checkpoint.checkpoints[0].id;
    const segmentId = checkpoint.segments[0].id;

    const changed = await savePointEdits(scene, {roadId,
      expectedRevision: checkpoint.revision,
      operations: [{kind: "insert-bend", segmentId, edgeIndex: 0, x: 50, y: 45}]});
    assert.equal(changed.checkpoints[0].id, checkpointId);
    assert.equal(changed.checkpoints[0].nodeId, endpoint);
    assert.deepEqual(changed.segments[0].via, [{x: 50, y: 45}]);
    assert.equal(writes.atlas, 3, "three approved graph transactions only");
    assert.deepEqual({shapes: region.shapes, elevation: region.elevation,
      behaviors: region.behaviors}, regionBefore);
    assert.deepEqual(scene.getFlag("fvtt-atlas-navigation", "manualFog"), fogBefore);
    assert.deepEqual({region: writes.region, other: writes.other}, {region: 0, other: 0});

    await assert.rejects(savePointEdits(scene, {roadId,
      expectedRevision: checkpoint.revision,
      operations: [{kind: "remove-bend", segmentId, viaIndex: 0}]}),
    /changed since/);
    assert.equal(writes.atlas, 3, "stale graph edit does not alter other systems");

    globalThis.game.user.isGM = false;
    await assert.rejects(saveRoadPlayerVisibility(scene, {roadId, visible: true,
      expectedRevision: changed.revision}), /Only a GM/);
    assert.equal(writes.atlas, 3, "player cannot commit reveal or alter Scene topology");
  } finally { globalThis.game = previous; }
});

test("beta.7.24 player Road/Checkpoint, native Region and Fog projections are isolated across refresh", async () => {
  const previous = globalThis.game;
  globalThis.game = {user: {isGM: true}};
  try {
    const {scene, region, writes} = fixtureScene();
    const made = await saveNewRoad(scene, {name: "Hidden Coast Road",
      points: [{x: 0, y: 40}, {x: 100, y: 40}],
      expectedRevision: 0, idFactory});
    const roadId = made.roads[0].id;
    const checkpoint = await saveNewCheckpoint(scene, {roadId,
      candidate: {kind: "node", nodeId: made.segments[0].to},
      name: "Lore Harbor", elevationMeters: 42,
      playerVisible: true, expectedRevision: made.revision, idFactory});
    const checkpointId = checkpoint.checkpoints[0].id;
    const beforeRead = writes.atlas;
    const first = playerAtlasOverlay(readAtlas(scene));
    assert.equal(first.roads.length, 0, "Lore reveals place without exposing its hidden road");
    assert.equal(first.segments.length, 0);
    assert.equal(first.checkpoints[0].id, checkpointId);
    assert.equal(first.checkpoints[0].roadId, null);
    assert.equal(first.checkpoints[0].elevationMeters, null);
    assert.ok(!JSON.stringify(first).includes("Hidden Coast Road"));

    const cells = [{x: 50, y: 50}, {x: 150, y: 50}, {x: 250, y: 50}];
    const covered = coveredManualFogCells(cells, fogState,
      new Set(["150,50"]));
    assert.deepEqual(covered.map(cell => cell.x), [150, 250],
      "manual Hide takes priority over Checkpoint reveal");
    const surface = sceneRoadSurfaces(scene, surfacePresets);
    assert.equal(surface[0].id, region.id);
    assert.equal(surface[0].color, "#215caa");
    assert.equal(listGeneratedRegions(scene)[0].modified, false);

    // A GM edits the native shape independently: a visual reread must see it,
    // while never changing it or silently regenerating Atlas provenance.
    region.shapes.push({type: "polygon", points: [10, 10, 20, 10, 20, 20, 10, 20], hole: true});
    assert.equal(listGeneratedRegions(scene)[0].modified, true);
    assert.equal(sceneRoadSurfaces(scene, surfacePresets)[0].shapes.length, 2);
    const second = playerAtlasOverlay(readAtlas(scene));
    assert.deepEqual(second, first, "Scene redraw does not invent a reveal or mutate Road data");
    assert.equal(writes.atlas, beforeRead, "reads do not write Scene graph flags");
    assert.deepEqual({region: writes.region, other: writes.other}, {region: 0, other: 0});

    const revealed = await saveRoadPlayerVisibility(scene, {roadId,
      visible: true, expectedRevision: checkpoint.revision});
    const withRoad = playerAtlasOverlay(readAtlas(scene));
    assert.equal(withRoad.roads.length, 1);
    assert.equal(withRoad.segments.length, 1);
    assert.equal(withRoad.checkpoints[0].roadId, roadId);
    assert.equal(revealed.checkpoints[0].id, checkpointId);
    assert.equal(writes.region, 0);
  } finally { globalThis.game = previous; }
});

test("beta.7.24 legacy Scene reads and interrupted Journey transport selection stay read-only", () => {
  const {scene, writes} = fixtureScene();
  const before = structuredClone(readAtlas(scene));
  for (let n = 0; n < 3; n++) {
    assert.deepEqual(readAtlas(scene), before);
    assert.equal(playerAtlasOverlay(readAtlas(scene)).roads.length, 0);
    assert.equal(listGeneratedRegions(scene).length, 1);
  }
  assert.deepEqual(writes, {atlas: 0, region: 0, other: 0});

  const journal = {status: "interrupted", legs: [{completedPercent: 41,
    transport: {methodId: "ferry", kind: "vehicle", surface: "water",
      arrangement: "hire", operation: "continuous"}}]};
  const snapshot = structuredClone(journal);
  const approved = approvedTransportRecoverySelection(journal,
    [{id: "ferry", kind: "vehicle", surface: "water"}]);
  assert.deepEqual(approved, {methodId: "ferry", arrangement: "hire", operation: "continuous"});
  assert.deepEqual(journal, snapshot, "recovery selection never approves or edits the Journal");
  assert.throws(() => approvedTransportRecoverySelection(journal,
    [{id: "ferry", kind: "vehicle", surface: "land"}]), /no longer compatible/);
  assert.deepEqual(journal, snapshot, "incompatible recovery must fail closed");
});
