import { MODULE_ID } from "./atlas-storage.js";
import { readPartyExploration } from "./party-exploration-storage.js";
import { sceneImageOrigin } from "./road-coordinates.js";
import { ATLAS_MAP_FOG_FLAG, validateAtlasMapFog, atlasFogSurveyRadiusCells,
  appendAtlasFogTrail, removeAtlasFogTrailPoint, clearAtlasFogTrail
} from "./atlas-map-fog-model.js";

export function readAtlasMapFog(scene) {
  if (!scene?.getFlag) throw new Error("Select an Atlas Scene.");
  return validateAtlasMapFog(scene.getFlag(MODULE_ID, ATLAS_MAP_FOG_FLAG));
}

function authorize(scene) {
  if (!globalThis.game?.user?.isGM || !scene?.canUserModify?.(game.user, "update")) {
    throw new Error("Only a GM with Scene update permission may change Atlas map fog.");
  }
}

function tokenTrailPoint(canvas, scene, tokenDoc, party) {
  const cellSize = Number(scene.grid?.size);
  if (!Number.isFinite(cellSize) || cellSize <= 0) {
    throw new Error("Atlas map fog requires a positive Scene grid size.");
  }
  const radiusCells = atlasFogSurveyRadiusCells(party, Number(scene.grid?.distance));
  const origin = sceneImageOrigin(canvas);
  // The PIXI Token center may still be animating at the previous position
  // when Foundry emits updateToken. Persist the authoritative TokenDocument
  // position, never a transient rendering/animation coordinate.
  const x = Number(tokenDoc?.x);
  const y = Number(tokenDoc?.y);
  const width = Number(tokenDoc?.width ?? 1);
  const height = Number(tokenDoc?.height ?? 1);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    throw new Error("The Atlas explorer token has invalid document coordinates.");
  }
  return {
    x: x + width * cellSize / 2 - origin.x,
    y: y + height * cellSize / 2 - origin.y,
    radiusCells
  };
}

/** GM-only opt-in. Does not change Scene vision settings or native fog history. */
export async function saveAtlasMapFogMode(scene, { enabled, expected }) {
  authorize(scene);
  if (typeof enabled !== "boolean") throw new Error("Choose a map-fog mode.");
  const before = readAtlasMapFog(scene);
  if (JSON.stringify(before) !== JSON.stringify(validateAtlasMapFog(expected))) {
    throw new Error("Atlas map fog changed. Reopen the Scene Atlas tab.");
  }
  if (!enabled && before.enabled && scene.tokenVision === false) {
    throw new Error("Re-enable native Scene Token Vision before disabling Atlas Map Fog, or players will see the entire map.");
  }
  let after = { ...before, enabled };
  if (enabled && !before.enabled) {
    const party = readPartyExploration(scene);
    if (!party.enabled || !party.tokenId) {
      throw new Error("Enable party exploration and assign a placed party token first.");
    }
    const view = globalThis.canvas;
    if (!view?.ready || view.scene?.id !== scene.id) {
      throw new Error("Open this Scene on the canvas before enabling Atlas map fog.");
    }
    const token = scene.tokens?.get?.(party.tokenId);
    if (!token) throw new Error("The selected party token is no longer on this Scene.");
    // Store the original token location so first movement never hides it again.
    after = appendAtlasFogTrail(after, tokenTrailPoint(view, scene, token, party));
  }
  // Disabling retains the Atlas trail for possible re-enabling.
  await scene.setFlag(MODULE_ID, ATLAS_MAP_FOG_FLAG, after);
  return after;
}

// Per-Scene write queue prevents rapid token movements from racing each
// other through Foundry's asynchronous Scene flag updates.
const movementSaves = new Map();

/** Persist the exact token position observed at each movement update. */
export function recordAtlasMapFogMovement(tokenDoc) {
  const scene = tokenDoc?.parent;
  if (!globalThis.game?.user?.isGM || !scene?.canUserModify?.(game.user, "update") ||
      !globalThis.canvas?.ready || canvas.scene?.id !== scene.id) return Promise.resolve(false);
  const party = readPartyExploration(scene);
  if (!party.enabled || party.tokenId !== tokenDoc.id) return Promise.resolve(false);
  // Capture NOW: by the time the queued write executes the token may have
  // moved again. Both the token position and image-local origin are immutable
  // snapshots for this movement.
  const point = tokenTrailPoint(canvas, scene, tokenDoc, party);
  const key = scene.id;
  const previous = movementSaves.get(key) ?? Promise.resolve();
  const task = previous.catch(() => {}).then(async () => {
    const before = readAtlasMapFog(scene);
    if (!before.enabled) return false;
    const current = readPartyExploration(scene);
    if (!current.enabled || current.tokenId !== tokenDoc.id) return false;
    const next = appendAtlasFogTrail(before, point);
    if (next.trail.length === before.trail.length) return false;
    if (JSON.stringify(readAtlasMapFog(scene)) !== JSON.stringify(before)) return false;
    await scene.setFlag(MODULE_ID, ATLAS_MAP_FOG_FLAG, next);
    return true;
  });
  movementSaves.set(key, task);
  void task.finally(() => {
    if (movementSaves.get(key) === task) movementSaves.delete(key);
  }).catch(() => {});
  return task;
}

/**
 * Explicit, revision-checked GM corrections to Atlas-only history.
 * No Foundry FogExploration, native token or checkpoint knowledge changes.
 */
export async function editAtlasFogTrail(scene, { expected, removeIndex = null, clear = false }) {
  authorize(scene);
  const before = readAtlasMapFog(scene);
  if (JSON.stringify(before) !== JSON.stringify(validateAtlasMapFog(expected))) {
    throw new Error("Atlas travel exploration changed. Reopen the Scene Atlas tab.");
  }
  if (clear === (removeIndex !== null)) {
    throw new Error("Choose exactly one Atlas history correction.");
  }
  const after = clear ? clearAtlasFogTrail(before) : removeAtlasFogTrailPoint(before, removeIndex);
  await scene.setFlag(MODULE_ID, ATLAS_MAP_FOG_FLAG, after);
  return after;
}
