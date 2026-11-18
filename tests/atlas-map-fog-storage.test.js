import test from "node:test";
import assert from "node:assert/strict";
import { defaultPartyExploration } from "../scripts/party-exploration-model.js";
import { defaultAtlasMapFog } from "../scripts/atlas-map-fog-model.js";
import { readAtlasMapFog, saveAtlasMapFogMode,
  recordAtlasMapFogMovement, editAtlasFogTrail } from "../scripts/atlas-map-fog-storage.js";

test("GM opts in with a placed token; native fog history is never accessed", async () => {
  const originalGame = globalThis.game;
  const originalCanvas = globalThis.canvas;
  const state = new Map();
  const token = { id: "party-token", x: 100, y: 200, width: 1, height: 1 };
  const scene = {
    id: "atlas-scene", tokenVision: true, grid: { size: 50, distance: 5 },
    dimensions: { rows: 20, columns: 20 },
    tokens: new Map([[token.id, token]]),
    canUserModify: () => true,
    getFlag: (_module, key) => state.get(key),
    async setFlag(_module, key, value) { state.set(key, structuredClone(value)); }
  };
  token.parent = scene;
  state.set("partyExploration", {
    ...defaultPartyExploration(), enabled: true, tokenId: token.id, radius: 10
  });
  try {
    globalThis.game = { user: { isGM: true } };
    globalThis.canvas = { ready: true, scene, dimensions: { sceneX: 10, sceneY: 30 },
      grid: {
        getShape: () => [{ x: -25, y: -25 }, { x: 25, y: -25 },
          { x: 25, y: 25 }, { x: -25, y: 25 }],
        getCenterPoint: ({ i, j }) => ({ x: j * 50 + 25, y: i * 50 + 25 })
      } };
    const enabled = await saveAtlasMapFogMode(scene, {
      enabled: true, expected: defaultAtlasMapFog()
    });
    assert.equal(enabled.enabled, true);
    assert.deepEqual(enabled.trail, [
      { x: 115, y: 195, radiusCells: 2 }
    ]);
    assert.equal(scene.tokenVision, true, "Atlas does not change core Scene settings");
    assert.equal(state.has("fogExploration"), false, "native fog records remain untouched");
    scene.tokenVision = false;
    token.x = 300;
    assert.equal(await recordAtlasMapFogMovement(token), true);
    assert.equal(readAtlasMapFog(scene).trail.length, 2);
    await assert.rejects(() => saveAtlasMapFogMode(scene, {
      enabled: false, expected: readAtlasMapFog(scene)
    }), /Re-enable native Scene Token Vision/);
    scene.tokenVision = true;
    const saved = await saveAtlasMapFogMode(scene, {
      enabled: false, expected: readAtlasMapFog(scene)
    });
    assert.equal(saved.enabled, false);
    assert.equal(saved.trail.length, 2, "disabling preserves Atlas travel history");
    assert.equal(state.has("fogExploration"), false);
  } finally {
    globalThis.game = originalGame;
    globalThis.canvas = originalCanvas;
  }
});

test("non-GM and stale saves cannot activate a Scene mask", async () => {
  const originalGame = globalThis.game;
  const scene = {
    tokenVision: true,
    canUserModify: () => true,
    getFlag: () => undefined,
    async setFlag() { throw new Error("unexpected write"); }
  };
  try {
    globalThis.game = { user: { isGM: false } };
    await assert.rejects(() => saveAtlasMapFogMode(scene, {
      enabled: true, expected: defaultAtlasMapFog()
    }), /Only a GM/);
    globalThis.game.user.isGM = true;
    await assert.rejects(() => saveAtlasMapFogMode(scene, {
      enabled: true, expected: { ...defaultAtlasMapFog(), enabled: true }
    }), /changed/);
  } finally { globalThis.game = originalGame; }
});

test("GM-only revisions prevent stale or unauthorized trail removals", async () => {
  const originalGame = globalThis.game;
  const flags = new Map();
  const scene = {
    canUserModify: () => true,
    getFlag: (_scope, key) => flags.get(key),
    async setFlag(_scope, key, value) { flags.set(key, structuredClone(value)); }
  };
  const first = {
    ...defaultAtlasMapFog(), enabled: true,
    trail: [{ x: 100, y: 200, radiusCells: 2.6666666666666665 },
      { x: 300, y: 400, radiusCells: 0.5 }]
  };
  flags.set("mapFog", structuredClone(first));
  try {
    globalThis.game = { user: { isGM: false } };
    await assert.rejects(() => editAtlasFogTrail(scene, {
      expected: first, removeIndex: 0
    }), /Only a GM/);
    globalThis.game.user.isGM = true;
    await assert.rejects(() => editAtlasFogTrail(scene, {
      expected: { ...first, trail: [] }, removeIndex: 0
    }), /changed/);
    assert.deepEqual(flags.get("mapFog"), first, "no unauthorized edits");
    const after = await editAtlasFogTrail(scene, {
      expected: first, removeIndex: 0
    });
    assert.equal(after.trail.length, 1);
    assert.deepEqual(after.trail[0], first.trail[1]);
    await assert.rejects(() => editAtlasFogTrail(scene, {
      expected: first, clear: true
    }), /changed/);
    const cleared = await editAtlasFogTrail(scene, { expected: after, clear: true });
    assert.equal(cleared.trail.length, 0);
    assert.equal(cleared.enabled, true);
    assert.equal(flags.has("fogExploration"), false,
      "native Foundry fog remains completely untouched");
  } finally {
    globalThis.game = originalGame;
  }
});
