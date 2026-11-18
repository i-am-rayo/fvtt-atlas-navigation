/**
 * Explicit application-level authoring commits. These workflows know neither
 * Foundry documents nor canvas state; the caller provides the persistence
 * ports. The Atlas graph write is authoritative. Ancillary Scene flag/Journal
 * writes are separate, ordered operations and cannot be rolled back atomically.
 */

export async function commitRoadDraft({ request, createRoad, saveJournalLink }) {
  const { journalUuid, ...road } = request;
  const atlas = await createRoad(road);
  const roadId = atlas.roads.at(-1)?.id;
  let journalError = null;
  if (journalUuid && roadId) {
    try { await saveJournalLink({ roadId, journalUuid }); }
    catch (error) { journalError = error; }
  }
  return { atlas, roadId, journalError };
}

/**
 * A checkpoint and its graph-node/edge split commit in one Scene revision.
 * The optional metadata stores follow only after this succeeds. Preserve the
 * existing partial-save contract: warn on the first failed secondary write,
 * leave the authored checkpoint intact, and do not continue subsequent writes.
 */
export async function commitCheckpointDraft({
  config, candidate, expectedRevision, idFactory,
  createCheckpoint, saveKnowledge, saveJournalLink, saveCategory,
  saveTerrainSuggestion, savePresetAssignment, saveOffers
}) {
  const atlas = await createCheckpoint({
    ...config, candidate, expectedRevision, idFactory
  });
  const checkpointId = atlas.checkpoints.at(-1).id;
  let metadataError = null;
  try {
    if (config.knowledge !== null && config.knowledge !== undefined) {
      await saveKnowledge({
        checkpointId, knowledge: config.knowledge,
        revealRadiusCells: config.revealRadiusCells ?? 3,
        method: config.discoveryMethod ?? "automatic"
      });
    }
    if (config.journalUuid) {
      await saveJournalLink({ checkpointId, journalUuid: config.journalUuid });
    }
    if (config.checkpointType && config.checkpointType !== "generic") {
      await saveCategory({ checkpointId, type: config.checkpointType });
    }
    if (config.terrainSuggestion) {
      await saveTerrainSuggestion({ checkpointId, suggestion: config.terrainSuggestion });
    }
    if (config.checkpointPresetId) {
      await savePresetAssignment({ checkpointId, presetId: config.checkpointPresetId });
    }
    if (config.transportationOffers) {
      await saveOffers({ checkpointId, offers: config.transportationOffers });
    }
  } catch (error) {
    metadataError = error;
  }
  return { atlas, checkpointId, metadataError };
}
