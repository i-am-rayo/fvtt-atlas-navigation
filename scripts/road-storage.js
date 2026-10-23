import { addRoadCheckpoint, editRoadCheckpoint, removeRoadCheckpoint } from "./checkpoint-model.js";
import { addRoad, removeRoad, renameRoad, reshapeRoad, mergeRoadGroups, applyRoadGeometryEdit } from "./road-model.js";
import { anchorLegacyAtlas, upgradeAtlasRoadGroups, validateAtlas } from "./atlas-model.js";
import { ATLAS_FLAG, MODULE_ID, readAtlas } from "./atlas-storage.js";

/**
 * Scene flag writes are revision-checked, but not atomic compare-and-swap.
 * Only one GM editing a given Scene at a time is supported at this stage.
 */
async function saveChange(scene, expectedRevision, update) {
  if (!globalThis.game?.user?.isGM || !scene?.canUserModify?.(game.user, "update")) {
    throw new Error("Only a GM with Scene update permission may edit roads.");
  }
  const previous = readAtlas(scene);
  if (previous.revision !== expectedRevision) {
    throw new Error("The atlas changed since you started editing. Reopen the Scene Atlas tab and try again.");
  }
  if (previous.revision >= Number.MAX_SAFE_INTEGER) {
    throw new Error("Atlas revision exceeded the safe limit.");
  }
  const updated = update(previous);
  const next = validateAtlas({ ...updated, revision: previous.revision + 1 });
  await scene.setFlag(MODULE_ID, ATLAS_FLAG, next);
  return next;
}

export function saveNewRoad(scene, { points, name, expectedRevision, idFactory, snapEndpoints }) {
  return saveChange(scene, expectedRevision, previous => {
    if (previous.schemaVersion === 1 && (previous.nodes.length || previous.segments.length)) {
      throw new Error("Anchor legacy roads before adding new ones.");
    }
    const local = previous.schemaVersion === 1 && !previous.nodes.length && !previous.segments.length
      ? anchorLegacyAtlas(previous, { x: 0, y: 0 }) : previous;
    const modern = local.schemaVersion === 2 && !local.nodes.length && !local.segments.length
      ? upgradeAtlasRoadGroups(local) : local;
    return addRoad(modern, { points, name, idFactory, snapEndpoints });
  });
}

export function saveReshapedRoad(scene, { segmentId, via, expectedRevision }) {
  return saveChange(scene, expectedRevision, previous =>
    reshapeRoad(previous, { segmentId, via }));
}

export function saveRenamedRoad(scene, { roadId, segmentId, name, expectedRevision }) {
  return saveChange(scene, expectedRevision, previous =>
    renameRoad(previous, { roadId, segmentId, name }));
}

export function saveRemovedRoad(scene, { roadId, segmentId, expectedRevision }) {
  return saveChange(scene, expectedRevision, previous =>
    removeRoad(previous, { roadId, segmentId }));
}

/**
 * Migrate only with a GM-confirmed current canvas origin while roads are
 * aligned to the background image. Never guess the original padding.
 */
export function saveAnchoredLegacyRoads(scene, { origin, expectedRevision }) {
  return saveChange(scene, expectedRevision, previous =>
    anchorLegacyAtlas(previous, origin));
}

/** Explicit, lossless organizational migration; does not merge same-name roads. */
export function saveOrganizedRoads(scene, { expectedRevision }) {
  return saveChange(scene, expectedRevision, previous => upgradeAtlasRoadGroups(previous));
}

export function saveMergedRoads(scene, { keepRoadId, mergeRoadId, expectedRevision }) {
  return saveChange(scene, expectedRevision, previous =>
    mergeRoadGroups(previous, { keepRoadId, mergeRoadId }));
}

/** Apply only a reviewed sequence of geometry operations to one road. */
export function savePointEdits(scene, { roadId, operations, expectedRevision }) {
  if (!Array.isArray(operations) || !operations.length || operations.length > 5000) {
    throw new Error("No valid point edits to save.");
  }
  return saveChange(scene, expectedRevision, previous =>
    operations.reduce((atlas, operation) =>
      applyRoadGeometryEdit(atlas, { roadId, operation }), previous));
}

/** One atomic versioned Scene flag write can add a checkpoint AND split an edge. */
export function saveNewCheckpoint(scene, { roadId, candidate, name, elevationMeters, expectedRevision, idFactory }) {
  return saveChange(scene, expectedRevision, previous =>
    addRoadCheckpoint(previous, { roadId, candidate, name, elevationMeters, idFactory }));
}

export function saveEditedCheckpoint(scene, { checkpointId, name, elevationMeters, expectedRevision }) {
  return saveChange(scene, expectedRevision, previous =>
    editRoadCheckpoint(previous, { checkpointId, name, elevationMeters }));
}

export function saveRemovedCheckpoint(scene, { checkpointId, expectedRevision }) {
  return saveChange(scene, expectedRevision, previous =>
    removeRoadCheckpoint(previous, { checkpointId }));
}
