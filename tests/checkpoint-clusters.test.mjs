import assert from "node:assert/strict";
import test from "node:test";
import { groupCheckpointMarkers, checkpointQuickInfo,
  clusterQuickInfo } from "../scripts/checkpoint-clusters.js";

test("v0.2.23 proximity groups are transient, deterministic and zoom-dependent", () => {
  const markers = [
    { id: "a", x: 100, y: 100, checkpoint: { name: "Bridge" } },
    { id: "b", x: 150, y: 105, checkpoint: { name: "Ford" } },
    { id: "c", x: 800, y: 100, checkpoint: { name: "Gate" } }
  ];
  const original = structuredClone(markers);
  const far = groupCheckpointMarkers(markers, 0.5);
  assert.equal(far.length, 2);
  assert.deepEqual(far[0].members.map(member => member.id), ["a", "b"]);
  assert.equal(far[0].x, 125);
  assert.equal(far[1].id, "c");
  const near = groupCheckpointMarkers(markers, 2);
  assert.equal(near.length, 3);
  assert.deepEqual(markers, original, "grouping never modifies stored marker positions");
});

test("v0.2.23 high-density grouping remains bounded", () => {
  const markers = Array.from({ length: 5000 }, (_, i) => ({
    id: String(i), x: 100, y: 100,
    checkpoint: { name: "Point " + i }
  }));
  const groups = groupCheckpointMarkers(markers, 0.25);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].members.length, 5000);
  assert.equal(groups[0].x, 100);
});

test("v0.2.23 quick info includes road/elevation and bounds large cluster previews", () => {
  assert.equal(checkpointQuickInfo({ name: "Outpost", elevationMeters: -20 },
    { name: "Stone Road" }), "Outpost\nRoad: Stone Road\nElevation: -20 m");
  assert.equal(checkpointQuickInfo({ name: "Watch", elevationMeters: null }, null), "Watch");
  const members = Array.from({ length: 10 }, (_, i) => ({ checkpoint: { name: "Node " + i } }));
  const info = clusterQuickInfo(members);
  assert.match(info, /10 checkpoints/);
  assert.match(info, /Node 3/);
  assert.match(info, /\+6 more/);
  assert.doesNotMatch(info, /Node 5/);
});
