import assert from "node:assert/strict";
import test from "node:test";
import { readAtlas } from "../scripts/atlas-storage.js";
import { saveNewRoad, saveRenamedRoad, saveRemovedRoad, saveReshapedRoad, saveAnchoredLegacyRoads } from "../scripts/road-storage.js";

function mockScene(initial) {
  let stored = initial;
  let writes = 0;
  return {
    canUserModify: () => true,
    getFlag(namespace, key) {
      assert.equal(namespace, "fvtt-atlas-navigation");
      assert.equal(key, "atlas");
      return stored;
    },
    async setFlag(namespace, key, value) {
      assert.equal(namespace, "fvtt-atlas-navigation");
      assert.equal(key, "atlas");
      stored = value;
      writes++;
      return this;
    },
    get writes() { return writes; }
  };
}

function ids() { let i = 0; return () => "id" + ++i; }

test("GM can create, rename and delete a Scene road without changing old calibration", async () => {
  const prior = globalThis.game;
  globalThis.game = { user: { isGM: true } };
  const manual = { source: "manual", unitsPerPixel: 0.05, unit: "km" };
  const scene = mockScene({
    schemaVersion: 1, revision: 6, enabled: false, calibration: manual,
    nodes: [], segments: []
  });
  try {
    const added = await saveNewRoad(scene, {
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      expectedRevision: 6, idFactory: ids()
    });
    assert.equal(added.revision, 7);
    assert.equal(added.enabled, true);
    assert.deepEqual(added.calibration, manual);
    assert.equal(scene.writes, 1);
    const segmentId = added.segments[0].id;

    const renamed = await saveRenamedRoad(scene, {
      segmentId, name: "Harbor Road", expectedRevision: 7
    });
    assert.equal(renamed.revision, 8);
    assert.equal(renamed.segments[0].name, "Harbor Road");
    assert.equal(scene.writes, 2);

    const removed = await saveRemovedRoad(scene, { segmentId, expectedRevision: 8 });
    assert.equal(removed.revision, 9);
    assert.equal(removed.enabled, false);
    assert.equal(removed.segments.length, 0);
    assert.deepEqual(readAtlas(scene).calibration, manual);
    assert.equal(scene.writes, 3);
  } finally { globalThis.game = prior; }
});

test("stale saves and non-GM saves do not write", async () => {
  const prior = globalThis.game;
  globalThis.game = { user: { isGM: true } };
  const scene = mockScene();
  try {
    await assert.rejects(saveNewRoad(scene, {
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      expectedRevision: 7, idFactory: ids()
    }), /changed since/);
    assert.equal(scene.writes, 0);
    globalThis.game.user.isGM = false;
    await assert.rejects(saveNewRoad(scene, {
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      expectedRevision: 0, idFactory: ids()
    }), /Only a GM/);
    assert.equal(scene.writes, 0);
  } finally { globalThis.game = prior; }
});

test("populated v1 roads cannot be newly drawn over until a GM anchors them", async () => {
  const prior = globalThis.game;
  globalThis.game = { user: { isGM: true } };
  const old = {
    schemaVersion: 1, revision: 2, enabled: true, calibration: null,
    nodes: [{ id: "a", x: 80, y: 50 }, { id: "b", x: 180, y: 50 }],
    segments: [{ id: "s", from: "a", to: "b", via: [], name: "Road", bidirectional: true }]
  };
  const scene = mockScene(old);
  try {
    await assert.rejects(saveNewRoad(scene, {
      points: [{ x: 0, y: 0 }, { x: 50, y: 50 }],
      expectedRevision: 2, idFactory: ids()
    }), /Anchor/);
    assert.equal(scene.writes, 0);
    const anchored = await saveAnchoredLegacyRoads(scene, {
      origin: { x: 60, y: 20 }, expectedRevision: 2
    });
    assert.equal(anchored.revision, 3);
    assert.equal(anchored.schemaVersion, 2);
    assert.deepEqual(anchored.nodes[0], { id: "a", x: 20, y: 30 });
    const reshaped = await saveReshapedRoad(scene, {
      segmentId: "s", via: [{ x: 60, y: 45 }], expectedRevision: 3
    });
    assert.deepEqual(reshaped.segments[0].via, [{ x: 60, y: 45 }]);
    assert.equal(reshaped.revision, 4);
  } finally { globalThis.game = prior; }
});
