import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultPartyExploration, validatePartyExploration, checkpointRevealRadiusCells,
  setCheckpointKnowledge, setCheckpointRevealRadius
} from "../scripts/party-exploration-model.js";
import { checkpointTerrainRevealDiscs }
  from "../scripts/checkpoint-terrain-reveal.js";

const atlas = {
  nodes: [{ id: "n1", x: 10, y: 20 }, { id: "n2", x: 80, y: 20 }],
  checkpoints: [
    { id: "bridge", nodeId: "n1", playerVisible: false },
    { id: "guild", nodeId: "n2", playerVisible: false }
  ]
};
const convert = node => ({ x: node.x + 100, y: node.y + 200 });
const project = state => checkpointTerrainRevealDiscs(atlas, state, 50, convert);

test("legacy v1 exploration loads as v2 in memory with no native fog operations", () => {
  const old = {
    schemaVersion: 1, enabled: true, tokenId: "placed-party", radius: 10,
    discoveredCheckpointIds: ["bridge"], loreKnownCheckpointIds: []
  };
  const original = JSON.stringify(old);
  const upgraded = validatePartyExploration(old);
  assert.equal(upgraded.schemaVersion, 2);
  assert.equal(upgraded.defaultRevealRadiusCells, 3);
  assert.deepEqual(upgraded.checkpointRevealRadiusCells, {});
  assert.equal(JSON.stringify(old), original, "read-only legacy migration");
});

test("unknown is hidden; visited and lore expose only chosen terrain circles", () => {
  let party = { ...defaultPartyExploration(), enabled: true, tokenId: "party" };
  assert.deepEqual(project(party), []);
  party = setCheckpointKnowledge(party, "bridge", "lore");
  assert.deepEqual(project(party), [{ x: 110, y: 220, radius: 100 }]);
  party = setCheckpointRevealRadius(party, "bridge", 1.25);
  assert.equal(checkpointRevealRadiusCells(party, "bridge"), 1.25);
  assert.deepEqual(project(party), [{ x: 110, y: 220, radius: 62.5 }]);
  party = setCheckpointKnowledge(party, "guild", "visited");
  assert.equal(project(party).length, 2);
  party = setCheckpointKnowledge(party, "bridge", "unknown");
  assert.deepEqual(project(party), [{ x: 180, y: 220, radius: 100 }],
    "undo removes only the Atlas overlay disc; no native fog data touched");
});

test("zero per-checkpoint radius keeps marker known without revealing terrain", () => {
  let party = { ...defaultPartyExploration(), enabled: true, tokenId: "party" };
  party = setCheckpointKnowledge(party, "bridge", "lore");
  party = setCheckpointRevealRadius(party, "bridge", 0);
  assert.deepEqual(project(party), []);
  assert.deepEqual(checkpointTerrainRevealDiscs(atlas, { ...party, enabled: false },
    50, convert), []);
});

test("radius bounds and malformed data fail closed", () => {
  const party = defaultPartyExploration();
  for (const radius of [-1, 101, Infinity, NaN]) {
    assert.throws(() => setCheckpointRevealRadius(party, "bridge", radius));
  }
  assert.throws(() => validatePartyExploration({
    ...party, checkpointRevealRadiusCells: { bridge: -4 }
  }));
  assert.deepEqual(checkpointTerrainRevealDiscs(atlas, {
    ...party, enabled: true
  }, 0, convert), []);
  assert.deepEqual(checkpointTerrainRevealDiscs({
    ...atlas, checkpoints: Array.from({ length: 513 },
      (_, index) => ({ id: String(index), nodeId: "n1" }))
  }, { ...party, enabled: true }, 50, convert), []);
});
