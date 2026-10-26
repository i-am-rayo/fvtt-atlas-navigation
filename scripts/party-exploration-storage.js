import { MODULE_ID, readAtlas } from "./atlas-storage.js";
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
  return savePartyState(scene, expected, before => {
    const atlas = readAtlas(scene);
    if (!atlas.checkpoints?.some(checkpoint => checkpoint.id === checkpointId)) {
      throw new Error("Checkpoint no longer exists.");
    }
    const knowledgeState = setCheckpointKnowledge(before, checkpointId, knowledge);
    return revealRadiusCells === undefined ? knowledgeState :
      setCheckpointRevealRadius(knowledgeState, checkpointId, revealRadiusCells);
  });
}
