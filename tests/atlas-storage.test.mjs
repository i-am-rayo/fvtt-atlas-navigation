import assert from "node:assert/strict";
import test from "node:test";
import { readAtlas, saveAtlasSetup } from "../scripts/atlas-storage.js";

function mockScene(initial = undefined) {
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

test("atlas setup saves only activation and preserves existing network/calibration", async () => {
  const oldGame = globalThis.game;
  globalThis.game = { user: { isGM: true } };
  try {
    const manual = { source: "manual", unitsPerPixel: 0.05, unit: "km" };
    const original = { schemaVersion: 1, revision: 5, enabled: false, calibration: manual, nodes: [], segments: [] };
    const first = mockScene(original);
    const second = mockScene();
    const result = await saveAtlasSetup(first, {
      enabled: true, expectedRevision: 5
    });
    assert.equal(result.enabled, true);
    assert.equal(result.revision, 6);
    assert.deepEqual(readAtlas(first).calibration, manual);
    assert.equal(readAtlas(second).enabled, false);
    assert.equal(first.writes, 1);
    assert.equal(second.writes, 0);

    await saveAtlasSetup(first, {
      enabled: false, expectedRevision: 6,
      calibration: null // even obsolete callers may not erase existing legacy data
    });
    assert.deepEqual(readAtlas(first).calibration, manual);
    assert.equal(readAtlas(first).enabled, false);
    assert.equal(readAtlas(first).revision, 7);
    assert.equal(first.writes, 2);
  } finally {
    globalThis.game = oldGame;
  }
});

test("new Scenes cannot acquire manual override through Atlas setup", async () => {
  const oldGame = globalThis.game;
  globalThis.game = { user: { isGM: true } };
  try {
    const scene = mockScene();
    await saveAtlasSetup(scene, {
      enabled: true, expectedRevision: 0,
      calibration: { source: "manual", unitsPerPixel: 0.05, unit: "mi" }
    });
    assert.equal(readAtlas(scene).calibration, null);
    await assert.rejects(
      saveAtlasSetup(scene, { enabled: false, expectedRevision: 0 }),
      /changed while the editor was open/
    );
    assert.equal(scene.writes, 1);
    assert.equal(readAtlas(scene).enabled, true);
  } finally {
    globalThis.game = oldGame;
  }
});

test("a non-GM can never mutate Scene atlas flags", async () => {
  const oldGame = globalThis.game;
  globalThis.game = { user: { isGM: false } };
  try {
    const scene = mockScene();
    await assert.rejects(
      saveAtlasSetup(scene, { enabled: true, expectedRevision: 0 }),
      /Only a GM/
    );
    assert.equal(scene.writes, 0);
  } finally {
    globalThis.game = oldGame;
  }
});
