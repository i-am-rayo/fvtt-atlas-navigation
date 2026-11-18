import { commitRoadDraft, commitCheckpointDraft } from "./road-authoring-workflow.js";
import { saveNewRoad, saveNewCheckpoint, saveNewIndependentCheckpoint } from "./road-storage.js";
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

function commitFoundryCheckpoint(scene, {
  config, candidate, expectedRevision, idFactory, createCheckpoint
}) {
  return commitCheckpointDraft({
    config, candidate, expectedRevision, idFactory,
    createCheckpoint,
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

/** Road and independent Checkpoints use the same complete metadata pipeline.
 * The graph commit is authoritative; secondary metadata writes fail visibly
 * and stop in order without redoing that commit. */
export function createCheckpointFromDraft(scene, request) {
  return commitFoundryCheckpoint(scene, {
    ...request,
    createCheckpoint: options => saveNewCheckpoint(scene, options)
  });
}

export function createIndependentCheckpointFromDraft(scene, {
  config, at, expectedRevision, idFactory
}) {
  return commitFoundryCheckpoint(scene, {
    config, candidate: null, expectedRevision, idFactory,
    createCheckpoint: options => saveNewIndependentCheckpoint(scene, {
      ...options, at
    })
  });
}
