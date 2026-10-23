import { addRoad, removeRoad, renameRoad } from "./road-model.js";
import { validateAtlas } from "./atlas-model.js";
import { ATLAS_FLAG, MODULE_ID, readAtlas } from "./atlas-storage.js";

/**
 * Save a complete v1 Scene graph with an optimistic revision check.
 * The schema is unchanged and dormant historical calibration is preserved.
 * One GM editor at a time remains the explicit Phase 2 limitation.
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

export function saveNewRoad(scene, { points, name, expectedRevision, idFactory }) {
  return saveChange(scene, expectedRevision, previous =>
    addRoad(previous, { points, name, idFactory }));
}

export function saveRenamedRoad(scene, { segmentId, name, expectedRevision }) {
  return saveChange(scene, expectedRevision, previous =>
    renameRoad(previous, { segmentId, name }));
}

export function saveRemovedRoad(scene, { segmentId, expectedRevision }) {
  return saveChange(scene, expectedRevision, previous =>
    removeRoad(previous, { segmentId }));
}
