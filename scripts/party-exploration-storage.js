import { MODULE_ID, readAtlas } from "./atlas-storage.js";
import { readManualFog } from "./atlas-manual-fog-storage.js";
import { nativeFogCells } from "./atlas-manual-fog-geometry.js";
import { checkpointRevealKeys, clearHiddenForCheckpoint } from "./checkpoint-exploration.js";
import { validateManualFog } from "./atlas-manual-fog-model.js";
import { PARTY_EXPLORATION_FLAG, validatePartyExploration,
  setCheckpointKnowledge, setCheckpointRevealRadius } from "./party-exploration-model.js";

export function readPartyExploration(scene) {
  if (!scene || typeof scene.getFlag !== "function") {
    throw new Error("Select a Scene for party exploration.");
  }
  return validatePartyExploration(scene.getFlag(MODULE_ID, PARTY_EXPLORATION_FLAG));
}

function authorize(scene) {
  if (!globalThis.game?.user?.isGM ||
      !scene?.canUserModify?.(game.user, "update")) {
    throw new Error("Only a GM with Scene update permission can change Atlas exploration.");
  }
}

/**
 * Separate from the Atlas road-graph flag. A snapshot check detects a stale
 * single-GM form; Foundry flag writes are not atomic compare-and-swap.
 */
async function savePartyState(scene, expected, update) {
  authorize(scene);
  const before = readPartyExploration(scene);
  if (JSON.stringify(before) !== JSON.stringify(validatePartyExploration(expected))) {
    throw new Error("Party exploration changed. Reopen the Scene Atlas tab.");
  }
  const after = validatePartyExploration(update(before));
  await scene.setFlag(MODULE_ID, PARTY_EXPLORATION_FLAG, after);
  return after;
}

export async function savePartyExplorationConfig(scene, {
  enabled, tokenId, radius, defaultRevealRadiusCells, expected
}) {
  if (typeof enabled !== "boolean") throw new Error("Enable exploration explicitly.");
  if (tokenId !== null && !scene?.tokens?.get?.(tokenId)) {
    throw new Error("Select an existing token on this Scene.");
  }
  if (enabled && !tokenId) throw new Error("Choose the party token first.");
  return savePartyState(scene, expected, before => ({
    ...before, enabled, tokenId, radius,
    defaultRevealRadiusCells: defaultRevealRadiusCells ?? before.defaultRevealRadiusCells
  }));
}

export async function saveCheckpointKnowledge(scene, {
  checkpointId, knowledge, revealRadiusCells, expected
}) {
  authorize(scene);
  const before = readPartyExploration(scene);
  if (JSON.stringify(before) !== JSON.stringify(validatePartyExploration(expected))) {
    throw new Error("Checkpoint knowledge changed. Reopen its settings.");
  }
  const atlas = readAtlas(scene);
  if (!atlas.checkpoints?.some(checkpoint => checkpoint.id === checkpointId)) {
    throw new Error("Checkpoint no longer exists.");
  }
  const manual = readManualFog(scene);
  const source = manual.enabled ? {...before,enabled:true} : before;
  const nextKnowledge = setCheckpointKnowledge(source, checkpointId, knowledge);
  const after = revealRadiusCells === undefined ? nextKnowledge :
    setCheckpointRevealRadius(nextKnowledge, checkpointId, revealRadiusCells);
  const updates = {
    ["flags." + MODULE_ID + "." + PARTY_EXPLORATION_FLAG]: after
  };
  // A fresh explicit checkpoint reveal supersedes prior Hide brush strokes only
  // within its terrain circle. Later GM Hide strokes still take precedence.
  if (manual.enabled && (knowledge === "visited" || knowledge === "lore") &&
      manual.hidden.length > 0) {
    const view = globalThis.canvas;
    if (!view?.ready || view.scene?.id !== scene.id) {
      throw new Error("Open this Scene canvas before revealing checkpoint terrain.");
    }
    const cells = nativeFogCells(view);
    const newlyVisible = checkpointRevealKeys(cells,atlas,after,
      Number(scene.grid?.size),
      {x:Number(view.dimensions.sceneX),y:Number(view.dimensions.sceneY)},
      new Set([checkpointId]));
    const hidden = clearHiddenForCheckpoint(manual.hidden,newlyVisible);
    if (hidden.length !== manual.hidden.length) {
      updates["flags." + MODULE_ID + ".manualFog"] =
        validateManualFog({...manual,hidden});
    }
  }
  // One native Scene update publishes knowledge and cleared overrides together.
  // Neither token vision nor Foundry FogExploration is changed.
  await scene.update(updates);
  return after;
}
