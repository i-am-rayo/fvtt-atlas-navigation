import assert from "node:assert/strict";
import test from "node:test";
import { commitRoadDraft, commitCheckpointDraft } from "../scripts/road-authoring-workflow.js";

test("road workflow saves the graph before its optional Journal link", async () => {
  const calls = [];
  const result = await commitRoadDraft({
    request: { name: "North Road", expectedRevision: 4, journalUuid: "JournalEntry.example" },
    createRoad: async input => {
      calls.push(["graph", input]);
      return { roads: [{ id: "older" }, { id: "new-road" }], revision: 5 };
    },
    saveJournalLink: async input => calls.push(["journal", input])
  });
  assert.deepEqual(calls, [
    ["graph", { name: "North Road", expectedRevision: 4 }],
    ["journal", { roadId: "new-road", journalUuid: "JournalEntry.example" }]
  ]);
  assert.equal(result.atlas.revision, 5);
  assert.equal(result.roadId, "new-road");
  assert.equal(result.journalError, null);
});

test("road Journal failure reports a partial commit; graph failure does not link", async () => {
  const failure = new Error("Journal permission changed");
  const partial = await commitRoadDraft({
    request: { name: "Saved", journalUuid: "JournalEntry.example" },
    createRoad: async () => ({ roads: [{ id: "saved-road" }] }),
    saveJournalLink: async () => { throw failure; }
  });
  assert.equal(partial.roadId, "saved-road");
  assert.equal(partial.journalError, failure);
  let linked = false;
  await assert.rejects(commitRoadDraft({
    request: { name: "Rejected", journalUuid: "JournalEntry.example" },
    createRoad: async () => { throw Error("Stale Scene revision"); },
    saveJournalLink: async () => { linked = true; }
  }), /Stale Scene revision/);
  assert.equal(linked, false);
});

test("checkpoint workflow keeps one authoritative graph commit before ordered metadata", async () => {
  const calls = [];
  const record = (key, input) => calls.push([key, input]);
  const config = {
    roadId: "road-a", name: "Harbor", knowledge: "visited",
    journalUuid: "JournalEntry.harbor", checkpointType: "town",
    terrainSuggestion: "marsh", checkpointPresetId: "preset-a",
    transportationOffers: [{ id: "cart" }]
  };
  const result = await commitCheckpointDraft({
    config, candidate: { kind: "node", nodeId: "node-a" },
    expectedRevision: 12, idFactory: () => "new-id",
    createCheckpoint: async input => {
      record("graph", input);
      return { checkpoints: [{ id: "other" }, { id: "new-checkpoint" }], revision: 13 };
    },
    saveKnowledge: async input => record("knowledge", input),
    saveJournalLink: async input => record("journal", input),
    saveCategory: async input => record("category", input),
    saveTerrainSuggestion: async input => record("terrain", input),
    savePresetAssignment: async input => record("preset", input),
    saveOffers: async input => record("offers", input)
  });
  assert.equal(result.checkpointId, "new-checkpoint");
  assert.equal(result.metadataError, null);
  assert.equal(result.atlas.revision, 13);
  assert.deepEqual(calls.map(([key]) => key), [
    "graph", "knowledge", "journal", "category", "terrain", "preset", "offers"
  ]);
  assert.equal(calls[0][1].expectedRevision, 12);
  assert.deepEqual(calls[0][1].candidate, { kind: "node", nodeId: "node-a" });
  assert.deepEqual(calls[1][1], {
    checkpointId: "new-checkpoint", knowledge: "visited",
    revealRadiusCells: 3, method: "automatic"
  });
  assert.deepEqual(calls[2][1], {
    checkpointId: "new-checkpoint", journalUuid: "JournalEntry.harbor"
  });
});

test("checkpoint metadata error stops later secondary writes without undoing graph", async () => {
  const calls = [];
  const failure = Error("Journal link unavailable");
  const result = await commitCheckpointDraft({
    config: { name: "Bridge", roadId: "road-a", knowledge: "seen",
      discoveryMethod: "gm", revealRadiusCells: 7,
      journalUuid: "JournalEntry.bridge", checkpointType: "town" },
    candidate: { kind: "edge", segmentId: "ab" }, expectedRevision: 4,
    idFactory: () => "id",
    createCheckpoint: async () => {
      calls.push("graph");
      return { checkpoints: [{ id: "checkpoint" }] };
    },
    saveKnowledge: async args => {
      calls.push("knowledge");
      assert.equal(args.method, "gm");
      assert.equal(args.revealRadiusCells, 7);
    },
    saveJournalLink: async () => { calls.push("journal"); throw failure; },
    saveCategory: async () => calls.push("category")
  });
  assert.deepEqual(calls, ["graph", "knowledge", "journal"]);
  assert.equal(result.checkpointId, "checkpoint");
  assert.equal(result.metadataError, failure);
});

test("rejected checkpoint graph write never saves metadata", async () => {
  let metadataCalled = false;
  await assert.rejects(commitCheckpointDraft({
    config: { name: "Nope", knowledge: "seen" },
    candidate: { kind: "node", nodeId: "n" }, expectedRevision: 2,
    idFactory: () => "new",
    createCheckpoint: async () => { throw Error("GM permission revoked"); },
    saveKnowledge: async () => { metadataCalled = true; }
  }), /GM permission revoked/);
  assert.equal(metadataCalled, false);
});
