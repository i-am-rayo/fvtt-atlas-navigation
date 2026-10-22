import assert from "node:assert/strict";
import test from "node:test";
import { readAtlas, saveAtlasSetup } from "../scripts/atlas-storage.js";

function mockScene() {
  let stored;
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

test("atlas setup persists calibration per Scene and retains revision", async () => {
  const oldGame = globalThis.game;
  globalThis.game = { user: { isGM: true } };
  try {
    const first = mockScene();
    const second = mockScene();
    assert.equal(readAtlas(first).revision, 0);
    const result = await saveAtlasSetup(first, {
      enabled: true,
      calibration: { source: "manual", unitsPerPixel: 0.05, unit: "km" },
      expectedRevision: 0
    });
    assert.equal(result.enabled, true);
    assert.equal(result.revision, 1);
    assert.equal(readAtlas(first).calibration.unit, "km");
    assert.equal(readAtlas(second).enabled, false);
    assert.equal(first.writes, 1);
    assert.equal(second.writes, 0);

    await saveAtlasSetup(first, {
      enabled: false,
      calibration: null,
      expectedRevision: 1
    });
    assert.equal(readAtlas(first).enabled, false);
    assert.equal(readAtlas(first).revision, 2);
    assert.equal(first.writes, 2);
  } finally {
    globalThis.game = oldGame;
  }
});

test("rejected stale writes and invalid scales leave the Scene unchanged", async () => {
  const oldGame = globalThis.game;
  globalThis.game = { user: { isGM: true } };
  try {
    const scene = mockScene();
    await saveAtlasSetup(scene, { enabled: true, calibration: null, expectedRevision: 0 });
    await assert.rejects(
      saveAtlasSetup(scene, { enabled: false, calibration: null, expectedRevision: 0 }),
      /changed while the editor was open/
    );
    await assert.rejects(
      saveAtlasSetup(scene, { enabled: true, calibration: { source: "manual", unitsPerPixel: 0, unit: "mi" }, expectedRevision: 1 }),
      /positive finite/
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
      saveAtlasSetup(scene, { enabled: true, calibration: null, expectedRevision: 0 }),
      /Only a GM/
    );
    assert.equal(scene.writes, 0);
  } finally {
    globalThis.game = oldGame;
  }
});
