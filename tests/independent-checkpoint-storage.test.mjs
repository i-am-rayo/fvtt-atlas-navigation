import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyAtlas } from "../scripts/atlas-model.js";
import { saveNewIndependentCheckpoint } from "../scripts/road-storage.js";

function sceneFixture() {
  let stored = { ...createEmptyAtlas(), revision: 5 };
  let writes = 0;
  return { canUserModify: () => true,
    getFlag: () => stored,
    async setFlag(_namespace, _flag, value) { stored = value; writes++; },
    get writes() { return writes; }, get current() { return stored; } };
}

test("GM confirmation creates independent Checkpoint in one revisioned Scene write", async () => {
  const previous = globalThis.game;
  globalThis.game = { user: { isGM: true } };
  try {
    const scene = sceneFixture();
    let next = 0;
    const saved = await saveNewIndependentCheckpoint(scene, {
      at: { x: 72, y: 15 }, name: "Village", expectedRevision: 5,
      idFactory: () => `id${++next}`
    });
    assert.equal(saved.revision, 6);
    assert.equal(saved.schemaVersion, 10);
    assert.equal(saved.roads.length, 0);
    assert.equal(saved.checkpoints[0].roadId, null);
    assert.equal(scene.writes, 1);
    await assert.rejects(saveNewIndependentCheckpoint(scene, {
      at: { x: 74, y: 20 }, name: "Stale", expectedRevision: 5,
      idFactory: () => `other${++next}`
    }), /changed since/);
    assert.equal(scene.writes, 1);
  } finally { globalThis.game = previous; }
});

test("non-GM standalone Checkpoint attempts never write", async () => {
  const previous = globalThis.game;
  globalThis.game = { user: { isGM: false } };
  try {
    const scene = sceneFixture();
    await assert.rejects(saveNewIndependentCheckpoint(scene, {
      at: { x: 1, y: 2 }, name: "Forbidden", expectedRevision: 5,
      idFactory: () => "id"
    }), /Only a GM/);
    assert.equal(scene.writes, 0);
  } finally { globalThis.game = previous; }
});
