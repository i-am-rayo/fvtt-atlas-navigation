import { validateAtlas } from "./atlas-model.js";

export const MODULE_ID = "fvtt-atlas-navigation";
export const ATLAS_FLAG = "atlas";

/** Read-only: viewing or validating an atlas never writes to a Scene. */
export function readAtlas(scene) {
  if (!scene || typeof scene.getFlag !== "function") {
    throw new Error("Select a Scene before configuring an atlas.");
  }
  return validateAtlas(scene.getFlag(MODULE_ID, ATLAS_FLAG));
}

/**
 * Save only Atlas activation. Preserve authored network data and any dormant
 * legacy v1 calibration without using or modifying it.
 * A revision comparison catches stale dialogs, but is not an atomic CAS lock:
 * this first editor explicitly supports one GM editing at a time.
 */
export async function saveAtlasSetup(scene, { enabled, expectedRevision }) {
  if (!globalThis.game?.user?.isGM || !scene?.canUserModify?.(game.user, "update")) {
    throw new Error("Only a GM with permission to update this Scene may edit its atlas.");
  }
  const previous = readAtlas(scene);
  if (previous.revision !== expectedRevision) {
    throw new Error("This Scene's atlas changed while the editor was open. Reopen setup to avoid overwriting edits.");
  }
  if (previous.revision >= Number.MAX_SAFE_INTEGER) {
    throw new Error("Atlas revision exceeded the safe limit.");
  }
  const next = validateAtlas({
    ...previous,
    enabled,
    revision: previous.revision + 1
  });
  await scene.setFlag(MODULE_ID, ATLAS_FLAG, next);
  return next;
}
