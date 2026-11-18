import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyAtlas, upgradeAtlasPlayerVisibility } from "../scripts/atlas-model.js";
import { addIndependentCheckpoint, connectIndependentCheckpoint,
  disconnectIndependentCheckpoint } from "../scripts/checkpoint-model.js";
import { removeRoad } from "../scripts/road-model.js";

function fixture() {
  const v9 = upgradeAtlasPlayerVisibility({ ...createEmptyAtlas(), enabled: true,
    roads: [{ id: "road", name: "Main" }],
    nodes: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 10, y: 0 }],
    segments: [{ id: "ab", roadId: "road", from: "a", to: "b",
      via: [], bidirectional: true }] });
  let i = 0;
  return addIndependentCheckpoint(v9, { at: { x: 10, y: 20 },
    name: "Millstone", idFactory: () => `generated${++i}` });
}

test("connect and disconnect preserve Node, Checkpoint and preexisting segment identities", () => {
  const before = fixture();
  const cp = before.checkpoints[0];
  const linked = connectIndependentCheckpoint(before, { checkpointId: cp.id,
    roadId: "road", roadNodeId: "b", idFactory: () => "newLink" });
  assert.equal(linked.checkpoints[0].roadId, "road");
  assert.equal(linked.checkpoints[0].id, cp.id);
  assert.equal(linked.checkpoints[0].nodeId, cp.nodeId);
  assert.deepEqual(linked.segments[0], before.segments[0]);
  assert.equal(linked.segments[1].id, "newLink");
  assert.equal(linked.segments[1].to, cp.nodeId);
  assert.deepEqual(before.nodes, linked.nodes);
  const detached = disconnectIndependentCheckpoint(linked, {
    checkpointId: cp.id, segmentId: "newLink" });
  assert.equal(detached.checkpoints[0].roadId, null);
  assert.deepEqual(detached.nodes, before.nodes);
  assert.deepEqual(detached.segments, before.segments);
});

test("connection rejects phantom Roads, incorrect Road Nodes and duplicate connections", () => {
  const before = fixture();
  const cp = before.checkpoints[0];
  const options = { checkpointId: cp.id, roadId: "road", roadNodeId: "b",
    idFactory: () => "newLink" };
  assert.throws(() => connectIndependentCheckpoint(before, {
    ...options, roadId: "missing" }), /existing Road/);
  assert.throws(() => connectIndependentCheckpoint(before, {
    ...options, roadNodeId: cp.nodeId }), /distinct saved Road endpoint/);
  const linked = connectIndependentCheckpoint(before, options);
  assert.throws(() => connectIndependentCheckpoint(linked, options), /already connects/);
  assert.throws(() => disconnectIndependentCheckpoint(linked, {
    checkpointId: cp.id, segmentId: "ab" }), /single explicit terminal/);
});

test("deleting a v10 Road retains its independent Checkpoint, Node and metadata", () => {
  const before = fixture();
  const cp = before.checkpoints[0];
  const linked = connectIndependentCheckpoint(before, { checkpointId: cp.id,
    roadId: "road", roadNodeId: "b", idFactory: () => "newLink" });
  assert.throws(() => removeRoad(linked, { roadId: "road" }), /Remove or reassign/);
  const removed = removeRoad(linked, { roadId: "road", removeCheckpoints: true });
  assert.equal(removed.roads.length, 0);
  assert.equal(removed.segments.length, 0);
  assert.deepEqual(removed.nodes, linked.nodes);
  assert.equal(removed.checkpoints.length, 1);
  assert.deepEqual(removed.checkpoints[0], { ...cp, roadId: null });
});
