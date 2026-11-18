import assert from "node:assert/strict";
import test from "node:test";
import { defaultPartyExploration } from "../scripts/party-exploration-model.js";
import { defaultAtlasMapFog } from "../scripts/atlas-map-fog-model.js";
import { recordAtlasMapFogMovement } from "../scripts/atlas-map-fog-storage.js";

const squareGrid = {
  isGridless: false,
  getCenterPoint: ({ i, j }) => ({ x: j * 100 + 50, y: i * 100 + 50 }),
  getShape: () => [{ x: -50, y: -50 }, { x: 50, y: -50 },
    { x: 50, y: 50 }, { x: -50, y: 50 }]
};

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
    dimensions: { rows: 10, columns: 10 },
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
      ready: true, scene, grid: squareGrid,
      dimensions: { sceneX: 100, sceneY: 200 }
    };
    const first = recordAtlasMapFogMovement(token);
    // The visual sprite has NOT reached its destination during animation.
    // The TokenDocument, however, already contains the committed location.
    token.x = 200;
    const second = recordAtlasMapFogMovement(token);
    assert.deepEqual(await Promise.all([first, second]), [true, true]);
    assert.equal(flags.mapFog.schemaVersion, 2);
    assert.ok(flags.mapFog.cells.length > 0);
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
    dimensions: { rows: 10, columns: 10 },
    canUserModify: () => true,
    getFlag: (_id, key) => flags[key],
    async setFlag(_id, key, value) { flags[key] = structuredClone(value); }
  };
  const token = { id: "animated-party", parent: scene,
    x: 500, y: 600, width: 1, height: 1,
    object: { center: { x: 150, y: 150 } } };
  try {
    globalThis.game = { user: { isGM: true } };
    globalThis.canvas = { ready: true, scene, grid: squareGrid,
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


test("square-grid discovered cells are persisted without canvas offset coordinates", async () => {
  const previousGame = globalThis.game;
  const previousCanvas = globalThis.canvas;
  const flags = {
    partyExploration: { ...defaultPartyExploration(), enabled: true,
      tokenId: "padding-party", radius: 10 },
    mapFog: { ...defaultAtlasMapFog(), enabled: true }
  };
  const scene = {
    id: "atlas-padding-safe",
    grid: { size: 100, distance: 5 },
    dimensions: { rows: 10, columns: 10 },
    canUserModify: () => true,
    getFlag: (_id, key) => flags[key],
    async setFlag(_id, key, value) { flags[key] = structuredClone(value); }
  };
  try {
    globalThis.game = { user: { isGM: true } };
    globalThis.canvas = { ready: true, scene, grid: squareGrid,
      dimensions: { sceneX: 100, sceneY: 200 } };
    const token = { parent: scene, id: "padding-party",
      x: 200, y: 300, width: 1, height: 1 };
    assert.equal(await recordAtlasMapFogMovement(token), true);
    assert.equal(flags.mapFog.schemaVersion, 2);
    const saved = structuredClone(flags.mapFog.cells);
    assert.ok(saved.some(c => c.x === 150 && c.y === 150));
    // Saved image-relative coordinates do not move with the canvas origin.
    globalThis.canvas.dimensions = { sceneX: 350, sceneY: 450 };
    assert.deepEqual(flags.mapFog.cells, saved);
  } finally {
    globalThis.game = previousGame;
    globalThis.canvas = previousCanvas;
  }
});
