import assert from "node:assert/strict";
import test from "node:test";
import { defaultPartyExploration } from "../scripts/party-exploration-model.js";
import { defaultAtlasMapFog } from "../scripts/atlas-map-fog-model.js";
import { recordAtlasMapFogMovement } from "../scripts/atlas-map-fog-storage.js";

test("rapid movements serialize Scene writes and retain image-local route positions", async () => {
  const priorGame = globalThis.game;
  const priorCanvas = globalThis.canvas;
  const flags = {
    partyExploration: { ...defaultPartyExploration(),
      enabled: true, tokenId: "party", radius: 10 },
    mapFog: { ...defaultAtlasMapFog(), enabled: true }
  };
  const scene = {
    id: "atlas-rapid-moves",
    grid: { size: 100, distance: 5 },
    canUserModify: () => true,
    getFlag: (_id, key) => flags[key],
    async setFlag(_id, key, value) {
      await Promise.resolve();
      flags[key] = structuredClone(value);
    }
  };
  const token = { id: "party", parent: scene, x: 100, y: 200,
    width: 1, height: 1, object: { center: { x: 150, y: 250 } } };
  try {
    globalThis.game = { user: { isGM: true } };
    globalThis.canvas = {
      ready: true, scene,
      dimensions: { sceneX: 100, sceneY: 200 }
    };
    const first = recordAtlasMapFogMovement(token);
    // The visual sprite has NOT reached its destination during animation.
    // The TokenDocument, however, already contains the committed location.
    token.x = 200;
    const second = recordAtlasMapFogMovement(token);
    assert.deepEqual(await Promise.all([first, second]), [true, true]);
    assert.deepEqual(flags.mapFog.trail, [
      { x: 50, y: 50, radiusCells: 2 },
      { x: 150, y: 50, radiusCells: 2, fromX: 50, fromY: 50 }
    ]);
  } finally {
    globalThis.game = priorGame;
    globalThis.canvas = priorCanvas;
  }
});


test("animated sprite coordinates never replace the committed explorer position", async () => {
  const priorGame = globalThis.game;
  const priorCanvas = globalThis.canvas;
  const flags = {
    partyExploration: { ...defaultPartyExploration(), enabled: true,
      tokenId: "animated-party", radius: 10 },
    mapFog: { ...defaultAtlasMapFog(), enabled: true }
  };
  const scene = {
    id: "atlas-animated-token", grid: { size: 100, distance: 5 },
    canUserModify: () => true,
    getFlag: (_id, key) => flags[key],
    async setFlag(_id, key, value) { flags[key] = structuredClone(value); }
  };
  const token = { id: "animated-party", parent: scene,
    x: 500, y: 600, width: 1, height: 1,
    object: { center: { x: 150, y: 150 } } };
  try {
    globalThis.game = { user: { isGM: true } };
    globalThis.canvas = { ready: true, scene,
      dimensions: { sceneX: 100, sceneY: 200 } };
    assert.equal(await recordAtlasMapFogMovement(token), true);
    assert.deepEqual(flags.mapFog.trail, [
      { x: 450, y: 450, radiusCells: 2 }
    ]);
  } finally {
    globalThis.game = priorGame;
    globalThis.canvas = priorCanvas;
  }
});
