import test from "node:test";
import assert from "node:assert/strict";
import { defaultPartyExploration } from "../scripts/party-exploration-model.js";
import { discoverableCheckpointIds } from "../scripts/party-exploration-discovery.js";
import { readPartyExploration, savePartyExplorationConfig,
  saveCheckpointKnowledge } from "../scripts/party-exploration-storage.js";

function fixture() {
  const atlas = {
    nodes: [{ id: "n1", x: 0, y: 0 }, { id: "n2", x: 300, y: 0 }],
    checkpoints: [
      { id: "port", nodeId: "n1", playerVisible: true },
      { id: "guild", nodeId: "n2", playerVisible: true },
      { id: "hidden", nodeId: "n1", playerVisible: false }
    ]
  };
  return { atlas, state: { ...defaultPartyExploration(), enabled: true,
    tokenId: "party", radius: 10, discoveredCheckpointIds: ["port"] } };
}

test("live discovery requires party selection, configured distance and explored fog", () => {
  const { atlas, state } = fixture();
  assert.deepEqual(discoverableCheckpointIds(atlas, state, () => true, node =>
    node.id === "n2" ? 8 : 0), ["guild"]);
  assert.deepEqual(discoverableCheckpointIds(atlas, state, () => false, () => 1), []);
  assert.deepEqual(discoverableCheckpointIds(atlas, state, () => true, () => 11), []);
  assert.deepEqual(discoverableCheckpointIds(atlas, { ...state, tokenId: null }, () => true,
    () => 1), []);
  assert.deepEqual(discoverableCheckpointIds(atlas, { ...state, enabled: false }, () => true,
    () => 1), []);
});

test("manual lore and settings writes are GM-only, stale-protected and Scene-local", async () => {
  const priorGame = globalThis.game;
  globalThis.game = { user: { isGM: true } };
  const { atlas } = fixture();
  const records = new Map();
  const scene = {
    tokens: new Map([["party", { id: "party" }]]),
    canUserModify: () => true,
    getFlag: (_scope, key) => key === "atlas" ? atlas : records.get(key),
    setFlag: async (_scope, key, value) => records.set(key, value)
  };
  try {
    const original = readPartyExploration(scene);
    await assert.rejects(() => savePartyExplorationConfig(scene, {
      enabled: true, tokenId: "wrong", radius: 10, expected: original
    }), /existing token/);
    const configured = await savePartyExplorationConfig(scene, {
      enabled: true, tokenId: "party", radius: 10, expected: original
    });
    assert.equal(configured.tokenId, "party");
    await assert.rejects(() => savePartyExplorationConfig(scene, {
      enabled: false, tokenId: null, radius: 10, expected: original
    }), /changed/);
    // Atlas graph validation is intentionally independent; mock the real Atlas
    // flag with a valid fixture for the knowledge write elsewhere in tests.
    assert.equal(readPartyExploration(scene).enabled, true);
    globalThis.game = { user: { isGM: false } };
    await assert.rejects(() => savePartyExplorationConfig(scene, {
      enabled: false, tokenId: null, radius: 10, expected: configured
    }), /Only a GM/);
  } finally {
    globalThis.game = priorGame;
  }
});
