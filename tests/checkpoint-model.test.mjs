import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyAtlas, validateAtlas, upgradeAtlasCheckpoints } from "../scripts/atlas-model.js";
import { addRoadCheckpoint, editRoadCheckpoint, removeRoadCheckpoint,
  listRoadCheckpoints } from "../scripts/checkpoint-model.js";
import { applyRoadGeometryEdit, listRoadJunctions, mergeRoadGroups, removeRoad } from "../scripts/road-model.js";

const fixture = () => ({
  ...createEmptyAtlas(),
  revision: 7,
  enabled: true,
  calibration: { source: "manual", unitsPerPixel: 0.125, unit: "mi" },
  nodes: [
    { id: "a", x: 0, y: 0 },
    { id: "b", x: 100, y: 0 },
    { id: "c", x: 200, y: 0 },
    { id: "d", x: 100, y: 100 },
    { id: "e", x: 300, y: 0 }
  ],
  roads: [
    { id: "main", name: "Main Road" },
    { id: "spur", name: "Hill Spur" },
    { id: "far", name: "Far Track" }
  ],
  segments: [
    { id: "ab", roadId: "main", from: "a", to: "b",
      via: [{ x: 50, y: 5 }], bidirectional: true },
    { id: "bc", roadId: "main", from: "b", to: "c", via: [], bidirectional: true },
    { id: "bd", roadId: "spur", from: "b", to: "d", via: [], bidirectional: true },
    { id: "ce", roadId: "far", from: "c", to: "e", via: [], bidirectional: true }
  ]
});

function factory() {
  let index = 0;
  return () => "generated" + (++index);
}

test("v3 remains valid and is upgraded only by explicit checkpoint creation", () => {
  const prior = fixture();
  const upgraded = upgradeAtlasCheckpoints(prior);
  assert.equal(prior.schemaVersion, 3);
  assert.equal(upgraded.schemaVersion, 4);
  assert.equal(upgraded.revision, 7);
  assert.deepEqual(upgraded.nodes, prior.nodes);
  assert.deepEqual(upgraded.segments, prior.segments);
  assert.deepEqual(upgraded.calibration, prior.calibration);
  assert.deepEqual(upgraded.checkpoints, []);
  assert.deepEqual(upgradeAtlasCheckpoints(upgraded), upgraded);
  assert.throws(() => upgradeAtlasCheckpoints({ schemaVersion: 2, coordinateSpace: "image", revision: 0,
    enabled: false, calibration: null, nodes: [], segments: [] }), /Organize/);
});

test("checkpoint on existing shared node preserves topology and distinct logical road name", () => {
  const before = fixture();
  const result = addRoadCheckpoint(before, {
    roadId: "spur", candidate: { kind: "node", nodeId: "b" },
    name: "  East Gate ", elevationMeters: 0, idFactory: factory()
  });
  assert.equal(result.schemaVersion, 4);
  assert.equal(result.segments.length, before.segments.length);
  assert.deepEqual(result.nodes, before.nodes);
  assert.deepEqual(result.roads, before.roads);
  assert.deepEqual(result.checkpoints.map(c => [c.roadId, c.nodeId, c.name, c.elevationMeters]),
    [["spur", "b", "East Gate", 0]]);
  assert.equal(listRoadJunctions(result).length, listRoadJunctions(before).length);
  assert.equal(before.checkpoints, undefined, "source stays unmodified");
});

test("interior checkpoint atomically splits one section but does not become a routing junction", () => {
  const result = addRoadCheckpoint(fixture(), {
    roadId: "main",
    candidate: { kind: "edge", segmentId: "ab", edgeIndex: 0, x: 25, y: 2.5 },
    name: "Mountain Pass", elevationMeters: 50, idFactory: factory()
  });
  assert.equal(result.nodes.length, 6);
  assert.equal(result.segments.length, 5);
  assert.equal(result.roads.length, 3);
  const cp = result.checkpoints[0];
  assert.equal(result.segments[0].id, "ab", "first split keeps stable segment ID");
  assert.equal(result.segments[0].to, cp.nodeId);
  assert.equal(result.segments.at(-1).from, cp.nodeId);
  assert.ok(!listRoadJunctions(result).some(j => j.id === cp.nodeId));
  assert.deepEqual(result.calibration, fixture().calibration, "manual scale is inert/preserved");
});

test("edited height and label persist; deletion removes only semantic metadata", () => {
  const initial = addRoadCheckpoint(fixture(), {
    roadId: "main", candidate: { kind: "node", nodeId: "c" },
    name: "High Point", elevationMeters: 55, idFactory: factory()
  });
  const updated = editRoadCheckpoint(initial, {
    checkpointId: initial.checkpoints[0].id,
    name: "Low Point", elevationMeters: -24.5
  });
  assert.equal(updated.checkpoints[0].elevationMeters, -24.5);
  const removed = removeRoadCheckpoint(updated, { checkpointId: updated.checkpoints[0].id });
  assert.deepEqual(removed.nodes, initial.nodes);
  assert.deepEqual(removed.segments, initial.segments);
  assert.deepEqual(removed.checkpoints, []);
});

test("a checkpoint protects its attached graph node and named road from destructive edits", () => {
  const atlas = addRoadCheckpoint(fixture(), {
    roadId: "main", candidate: { kind: "edge", segmentId: "ab", edgeIndex: 0,
      x: 25, y: 2.5 },
    name: "Watchpost", elevationMeters: null, idFactory: factory()
  });
  const checkpointNode = atlas.checkpoints[0].nodeId;
  assert.throws(() => removeRoad(atlas, { roadId: "main" }), /checkpoint/i);
  assert.throws(() => applyRoadGeometryEdit(atlas, {
    roadId: "main", operation: { kind: "demote-junction", nodeId: checkpointNode }
  }), /checkpoint/i);
  assert.throws(() => addRoadCheckpoint(atlas, {
    roadId: "main", candidate: { kind: "node", nodeId: checkpointNode },
    name: "Duplicate", elevationMeters: 2, idFactory: factory()
  }), /already has a checkpoint/i);
});

test("explicit junction detach and reconnect move checkpoints with their named road", () => {
  const initial = addRoadCheckpoint(fixture(), {
    roadId: "main", candidate: { kind: "node", nodeId: "b" },
    name: "Junction Camp", elevationMeters: 10, idFactory: factory()
  });
  const separated = applyRoadGeometryEdit(initial, { roadId: "main",
    operation: { kind: "detach-node", nodeId: "b", newNodeId: "separated", x: 100, y: 0 }
  });
  assert.equal(separated.checkpoints[0].nodeId, "separated");
  assert.equal(separated.segments.find(s => s.id === "bd").from, "b");
  const rejoined = applyRoadGeometryEdit(separated, { roadId: "main",
    operation: { kind: "connect-node", nodeId: "separated",
      target: { kind: "node", nodeId: "b" }, x: 100, y: 0 }
  });
  assert.equal(rejoined.checkpoints[0].nodeId, "b");
  assert.equal(rejoined.checkpoints[0].name, "Junction Camp");
});

test("GM road merge explicitly remaps the checkpoint owner without losing it", () => {
  const initial = addRoadCheckpoint(fixture(), {
    roadId: "spur", candidate: { kind: "node", nodeId: "d" },
    name: "Tower", elevationMeters: 30, idFactory: factory()
  });
  const merged = mergeRoadGroups(initial, { keepRoadId: "main", mergeRoadId: "spur" });
  assert.equal(merged.checkpoints[0].roadId, "main");
  assert.equal(merged.checkpoints[0].nodeId, "d");
  assert.equal(merged.checkpoints[0].elevationMeters, 30);
});

test("filters select one road, one-hop connected roads or the whole Scene", () => {
  let atlas = fixture();
  for (const [roadId, nodeId, name] of [
    ["main", "a", "Start"], ["spur", "d", "Tower"], ["far", "e", "End"]
  ]) {
    atlas = addRoadCheckpoint(atlas, {
      roadId, candidate: { kind: "node", nodeId }, name,
      elevationMeters: null, idFactory: factory()
    });
  }
  assert.deepEqual(listRoadCheckpoints(atlas, { roadId: "main", scope: "selected" })
    .map(c => c.name), ["Start"]);
  assert.deepEqual(listRoadCheckpoints(atlas, { roadId: "main", scope: "connected" })
    .map(c => c.name), ["Start", "Tower", "End"]);
  assert.equal(listRoadCheckpoints(atlas, { scope: "scene" }).length, 3);
});

test("v4 rejects stale, duplicate or malformed checkpoint payloads without losing roads", () => {
  const initial = addRoadCheckpoint(fixture(), {
    roadId: "main", candidate: { kind: "node", nodeId: "c" },
    name: "Pass", elevationMeters: 55, idFactory: factory()
  });
  const checkpoint = initial.checkpoints[0];
  assert.throws(() => validateAtlas({
    ...initial, checkpoints: [{ ...checkpoint, nodeId: "missing" }]
  }), /attach to a node/);
  assert.throws(() => validateAtlas({
    ...initial, checkpoints: [{ ...checkpoint, elevationMeters: Infinity }]
  }), /finite elevation/);
  assert.throws(() => validateAtlas({
    ...initial, checkpoints: [{ ...checkpoint, name: "" }]
  }), /invalid name/);
  assert.throws(() => validateAtlas({
    ...initial, checkpoints: [...initial.checkpoints, checkpoint]
  }), /duplicate checkpoint ID/);
  assert.throws(() => validateAtlas({ ...initial, checkpoints: undefined }), /array/);
  assert.throws(() => validateAtlas({ ...initial, checkpoints: [] , extra: true }), /unsupported field/);
});
