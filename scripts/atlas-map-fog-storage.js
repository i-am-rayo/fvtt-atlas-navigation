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
  const center = tokenDoc?.object?.center ?? {
    x: tokenDoc.x + (tokenDoc.width || 1) * cellSize / 2,
    y: tokenDoc.y + (tokenDoc.height || 1) * cellSize / 2
  };
  return { x: center.x - origin.x, y: center.y - origin.y, radiusCells };
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

/** Persist only after movement of the GM-chosen placed token. */
export async function recordAtlasMapFogMovement(tokenDoc) {
  const scene = tokenDoc?.parent;
  if (!globalThis.game?.user?.isGM || !scene?.canUserModify?.(game.user, "update") ||
      !globalThis.canvas?.ready || canvas.scene?.id !== scene.id) return false;
  const party = readPartyExploration(scene);
  const before = readAtlasMapFog(scene);
  if (!before.enabled || !party.enabled || party.tokenId !== tokenDoc.id) return false;
  const next = appendAtlasFogTrail(before, tokenTrailPoint(canvas, scene, tokenDoc, party));
  if (next.trail.length === before.trail.length) return false;
  if (JSON.stringify(readAtlasMapFog(scene)) !== JSON.stringify(before)) return false;
  await scene.setFlag(MODULE_ID, ATLAS_MAP_FOG_FLAG, next);
  return true;
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
