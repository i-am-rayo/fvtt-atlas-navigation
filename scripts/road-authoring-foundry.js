import { commitRoadDraft, commitCheckpointDraft } from "./road-authoring-workflow.js";
import { saveNewRoad, saveNewCheckpoint } from "./road-storage.js";
import { readAtlasJournalLinks, saveAtlasJournalLink } from "./atlas-journal-links.js";
import { readPartyExploration, saveCheckpointKnowledge } from "./party-exploration-storage.js";
import { readCheckpointDiscoveryMethods } from "./checkpoint-discovery-method.js";
import { saveCheckpointCategory } from "./checkpoint-types.js";
import { saveCheckpointTerrainSuggestion } from "./checkpoint-preset-snapshot.js";
import { saveCheckpointPresetAssignment } from "./checkpoint-preset-assignment.js";
import { saveCheckpointOffers } from "./checkpoint-transportation.js";

/** Foundry persistence ports; actual GM authorization and revision checks stay in the stores. */
export function createRoadFromDraft(scene, request) {
  return commitRoadDraft({
    request,
    createRoad: options => saveNewRoad(scene, options),
    saveJournalLink: ({ roadId, journalUuid }) => saveAtlasJournalLink(scene, {
      kind: "road", id: roadId, uuid: journalUuid,
      expected: readAtlasJournalLinks(scene)
    })
  });
}

export function createCheckpointFromDraft(scene, {
  config, candidate, expectedRevision, idFactory
}) {
  return commitCheckpointDraft({
    config, candidate, expectedRevision, idFactory,
    createCheckpoint: options => saveNewCheckpoint(scene, options),
    saveKnowledge: ({ checkpointId, knowledge, revealRadiusCells, method }) =>
      saveCheckpointKnowledge(scene, {
        checkpointId, knowledge, revealRadiusCells, method,
        expected: readPartyExploration(scene),
        expectedMethods: readCheckpointDiscoveryMethods(scene)
      }),
    saveJournalLink: ({ checkpointId, journalUuid }) => saveAtlasJournalLink(scene, {
      kind: "checkpoint", id: checkpointId, uuid: journalUuid,
      expected: readAtlasJournalLinks(scene)
    }),
    saveCategory: ({ checkpointId, type }) => saveCheckpointCategory(scene, checkpointId, type),
    saveTerrainSuggestion: ({ checkpointId, suggestion }) =>
      saveCheckpointTerrainSuggestion(scene, checkpointId, suggestion),
    savePresetAssignment: ({ checkpointId, presetId }) =>
      saveCheckpointPresetAssignment(scene, checkpointId, presetId),
    saveOffers: ({ checkpointId, offers }) => saveCheckpointOffers(scene, checkpointId, offers)
  });
}
