import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyAtlas } from "../scripts/atlas-model.js";
import { addRoad, renameRoad, removeRoad, suggestRoadName } from "../scripts/road-model.js";

function makeIds() {
  let i = 0;
  return () => `id${++i}`;
}

test("new roads form named Scene-space polylines with stable junctions", () => {
  const source = createEmptyAtlas();
  const first = addRoad(source, {
    points: [{ x: 5, y: 5 }, { x: 20, y: 40 }, { x: 80, y: 60 }],
    idFactory: makeIds()
  });
  assert.equal(first.segments.length, 1);
  assert.equal(first.nodes.length, 2);
  assert.equal(first.enabled, true);
  assert.equal(first.segments[0].name, "Road 1");
  assert.deepEqual(first.segments[0].via, [{ x: 20, y: 40 }]);
  assert.equal(source.segments.length, 0, "road operations do not mutate original state");
});

test("new roads join existing junctions only when endpoints are nearby", () => {
  const first = addRoad(createEmptyAtlas(), {
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], idFactory: makeIds()
  });
  const second = addRoad(first, {
    points: [{ x: 7, y: 5 }, { x: 60, y: 50 }, { x: 100, y: 100 }],
    idFactory: makeIds()
  });
  assert.equal(second.nodes.length, 3, "start was snapped to first road's junction");
  assert.equal(second.segments[0].from, second.segments[1].from);
  assert.notEqual(second.segments[0].to, second.segments[1].to);
  assert.equal(second.segments[1].name, "Road 2");
});

test("crossing road geometry does not create graph topology", () => {
  const first = addRoad(createEmptyAtlas(), {
    points: [{ x: 0, y: 0 }, { x: 100, y: 100 }], idFactory: makeIds()
  });
  const second = addRoad(first, {
    points: [{ x: 0, y: 100 }, { x: 100, y: 0 }], idFactory: makeIds()
  });
  assert.equal(second.nodes.length, 4);
  assert.notEqual(second.segments[0].from, second.segments[1].from);
  assert.notEqual(second.segments[0].to, second.segments[1].to);
});

test("rename and delete preserve all unrelated roads and junction data", () => {
  const first = addRoad(createEmptyAtlas(), {
    points: [{ x: 0, y: 0 }, { x: 50, y: 0 }], idFactory: makeIds()
  });
  const renamed = renameRoad(first, { segmentId: first.segments[0].id, name: " Northern Pass " });
  assert.equal(renamed.segments[0].name, "Northern Pass");
  assert.equal(first.segments[0].name, "Road 1");
  const removed = removeRoad(renamed, { segmentId: renamed.segments[0].id });
  assert.equal(removed.enabled, false);
  assert.equal(removed.segments.length, 0);
  assert.equal(removed.nodes.length, 2, "deletion must not cascade into junction data");
  assert.equal(suggestRoadName(removed), "Road 1");
});

test("invalid input or stale Road IDs cannot silently write an invalid graph", () => {
  const empty = createEmptyAtlas();
  assert.throws(() => addRoad(empty, { points: [{ x: 0, y: 0 }], idFactory: makeIds() }), /at least two/);
  assert.throws(() => addRoad(empty, {
    points: [{ x: 0, y: 0 }, { x: 0, y: 0 }], idFactory: makeIds()
  }), /at least 1/);
  assert.throws(() => addRoad(empty, {
    points: [{ x: Infinity, y: 0 }, { x: 50, y: 0 }], idFactory: makeIds()
  }), /finite/);
  assert.throws(() => renameRoad(empty, { segmentId: "missing", name: "No" }), /no longer exists/);
  assert.throws(() => removeRoad(empty, { segmentId: "missing" }), /no longer exists/);
  assert.throws(() => addRoad(empty, {
    points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], idFactory: () => "same"
  }), /unique/);
});
