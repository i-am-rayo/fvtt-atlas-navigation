import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultPartyExploration, validatePartyExploration, checkpointKnowledge,
  checkpointMayRender, setCheckpointKnowledge, pruneCheckpointKnowledge
} from "../scripts/party-exploration-model.js";

const checkpoint = { id: "port", playerVisible: true };
const guild = { id: "guild", playerVisible: true };

test("party exploration defaults off and never silently selects a token", () => {
  assert.deepEqual(validatePartyExploration(null), defaultPartyExploration());
  assert.equal(defaultPartyExploration().tokenId, null);
  assert.equal(defaultPartyExploration().enabled, false);
  assert.equal(defaultPartyExploration().radius, 10);
});

test("legacy player visibility remains unchanged until explicit opt-in", () => {
  const old = defaultPartyExploration();
  assert.equal(checkpointMayRender(checkpoint, old, true), true);
  assert.equal(checkpointMayRender(checkpoint, old, false), false);
});

test("new guild in previously explored port is hidden until visited", () => {
  let state = { ...defaultPartyExploration(), enabled: true, tokenId: "party" };
  state = setCheckpointKnowledge(state, "port", "visited");
  assert.equal(checkpointMayRender(checkpoint, state, true), true);
  assert.equal(checkpointMayRender(guild, state, true), false);
  state = setCheckpointKnowledge(state, "guild", "visited");
  assert.equal(checkpointMayRender(guild, state, true), true);
  assert.equal(checkpointMayRender(guild, state, false), false);
});

test("GM lore reveal bypasses unexplored terrain but never playerVisible", () => {
  let state = { ...defaultPartyExploration(), enabled: true, tokenId: "party" };
  state = setCheckpointKnowledge(state, "guild", "lore");
  assert.equal(checkpointKnowledge(state, "guild"), "lore");
  assert.equal(checkpointMayRender(guild, state, false), true);
  assert.equal(checkpointMayRender({ ...guild, playerVisible: false }, state, false), false);
});

test("a GM can revoke both kinds of knowledge", () => {
  let state = { ...defaultPartyExploration(), enabled: true };
  state = setCheckpointKnowledge(state, "guild", "lore");
  state = setCheckpointKnowledge(state, "guild", "visited");
  assert.equal(checkpointKnowledge(state, "guild"), "visited");
  assert.deepEqual(state.loreKnownCheckpointIds, []);
  state = setCheckpointKnowledge(state, "guild", "unknown");
  assert.equal(checkpointKnowledge(state, "guild"), "unknown");
});

test("malformed flags fail closed; do not leak checkpoints", () => {
  assert.throws(() => validatePartyExploration({ ...defaultPartyExploration(), radius: Infinity }));
  assert.throws(() => validatePartyExploration({ ...defaultPartyExploration(), tokenId: "" }));
  assert.throws(() => validatePartyExploration({
    ...defaultPartyExploration(), discoveredCheckpointIds: ["port", "port"]
  }));
  assert.throws(() => validatePartyExploration({
    ...defaultPartyExploration(), discoveredCheckpointIds: ["port"], loreKnownCheckpointIds: ["port"]
  }));
  assert.throws(() => validatePartyExploration({ ...defaultPartyExploration(), secret: "unexpected" }));
});

test("prune only obsolete IDs without mutating stored state", () => {
  const original = { ...defaultPartyExploration(), enabled: true,
    discoveredCheckpointIds: ["port", "deleted"], loreKnownCheckpointIds: ["guild"] };
  const updated = pruneCheckpointKnowledge(original, ["port", "guild"]);
  assert.deepEqual(updated.discoveredCheckpointIds, ["port"]);
  assert.deepEqual(updated.loreKnownCheckpointIds, ["guild"]);
  assert.deepEqual(original.discoveredCheckpointIds, ["port", "deleted"]);
});
