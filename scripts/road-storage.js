import { addRoad, removeRoad, renameRoad, reshapeRoad } from "./road-model.js";
import { anchorLegacyAtlas, validateAtlas } from "./atlas-model.js";
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
  return saveChange(scene, expectedRevision, previous =>
    addRoad(previous.schemaVersion === 1 && !previous.nodes.length && !previous.segments.length
      ? anchorLegacyAtlas(previous, { x: 0, y: 0 }) : previous,
      { points, name, idFactory, snapEndpoints }));
}

export function saveReshapedRoad(scene, { segmentId, via, expectedRevision }) {
  return saveChange(scene, expectedRevision, previous =>
    reshapeRoad(previous, { segmentId, via }));
}

export function saveRenamedRoad(scene, { segmentId, name, expectedRevision }) {
  return saveChange(scene, expectedRevision, previous =>
    renameRoad(previous, { segmentId, name }));
}

export function saveRemovedRoad(scene, { segmentId, expectedRevision }) {
  return saveChange(scene, expectedRevision, previous =>
    removeRoad(previous, { segmentId }));
}

/**
 * Migrate only with a GM-confirmed current canvas origin while roads are
 * aligned to the background image. Never guess the original padding.
 */
export function saveAnchoredLegacyRoads(scene, { origin, expectedRevision }) {
  return saveChange(scene, expectedRevision, previous =>
    anchorLegacyAtlas(previous, origin));
}
