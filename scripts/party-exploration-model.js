/**
 * Per-Scene Atlas exploration state. This is independent of the road graph
 * schema and never modifies a Token, Actor, native Region, or Foundry fog data.
 *
 * Checkpoint IDs are opaque IDs issued by the existing Atlas checkpoint model.
 * Knowledge is not a secrecy boundary: Foundry Scene flags may be readable by
 * a connected player. The player renderer must project only revealed records.
 */
export const PARTY_EXPLORATION_SCHEMA_VERSION = 1;
export const PARTY_EXPLORATION_FLAG = "partyExploration";

export function defaultPartyExploration() {
  return {
    schemaVersion: PARTY_EXPLORATION_SCHEMA_VERSION,
    enabled: false,
    tokenId: null,
    radius: 10,
    discoveredCheckpointIds: [],
    loreKnownCheckpointIds: []
  };
}

function ids(value, field) {
  if (!Array.isArray(value) || value.length > 20000 ||
      value.some(id => typeof id !== "string" || !id || id.length > 160) ||
      new Set(value).size !== value.length) {
    throw new Error("Invalid Atlas party exploration " + field + ".");
  }
  return [...value];
}

export function validatePartyExploration(value) {
  if (value === null || value === undefined) return defaultPartyExploration();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid Atlas party exploration configuration.");
  }
  const fields = ["schemaVersion", "enabled", "tokenId", "radius",
    "discoveredCheckpointIds", "loreKnownCheckpointIds"];
  if (Object.keys(value).some(key => !fields.includes(key)) ||
      fields.some(key => !Object.hasOwn(value, key)) ||
      value.schemaVersion !== PARTY_EXPLORATION_SCHEMA_VERSION ||
      typeof value.enabled !== "boolean" ||
      (value.tokenId !== null && (typeof value.tokenId !== "string" ||
        !value.tokenId || value.tokenId.length > 160)) ||
      !Number.isFinite(value.radius) || value.radius <= 0 || value.radius > 100000) {
    throw new Error("Invalid Atlas party exploration configuration.");
  }
  const discoveredCheckpointIds = ids(value.discoveredCheckpointIds, "discovery IDs");
  const loreKnownCheckpointIds = ids(value.loreKnownCheckpointIds, "lore IDs");
  if (discoveredCheckpointIds.some(id => loreKnownCheckpointIds.includes(id))) {
    throw new Error("A checkpoint cannot have two Atlas knowledge sources.");
  }
  return { schemaVersion: 1, enabled: value.enabled, tokenId: value.tokenId,
    radius: value.radius, discoveredCheckpointIds, loreKnownCheckpointIds };
}

export function checkpointKnowledge(exploration, checkpointId) {
  const state = validatePartyExploration(exploration);
  if (!state.enabled) return "legacy";
  if (state.loreKnownCheckpointIds.includes(checkpointId)) return "lore";
  if (state.discoveredCheckpointIds.includes(checkpointId)) return "visited";
  return "unknown";
}

/** A GM-authored lore reveal bypasses geographic fog, not playerVisible. */
export function checkpointMayRender(checkpoint, exploration, explored) {
  const knowledge = checkpointKnowledge(exploration, checkpoint?.id);
  if (knowledge === "legacy") return checkpoint?.playerVisible === true && explored;
  return knowledge === "lore" || knowledge === "visited";
}

export function setCheckpointKnowledge(exploration, checkpointId, knowledge) {
  const state = validatePartyExploration(exploration);
  if (typeof checkpointId !== "string" || !checkpointId || checkpointId.length > 160 ||
      !["unknown", "visited", "lore"].includes(knowledge)) {
    throw new Error("Invalid checkpoint knowledge change.");
  }
  return validatePartyExploration({
    ...state,
    discoveredCheckpointIds: [...state.discoveredCheckpointIds.filter(id => id !== checkpointId),
      ...(knowledge === "visited" ? [checkpointId] : [])],
    loreKnownCheckpointIds: [...state.loreKnownCheckpointIds.filter(id => id !== checkpointId),
      ...(knowledge === "lore" ? [checkpointId] : [])]
  });
}

/** Remove only stale IDs in memory; caller must explicitly confirm any save. */
export function pruneCheckpointKnowledge(exploration, checkpointIds) {
  const state = validatePartyExploration(exploration);
  const available = new Set(checkpointIds);
  return validatePartyExploration({
    ...state,
    discoveredCheckpointIds: state.discoveredCheckpointIds.filter(id => available.has(id)),
    loreKnownCheckpointIds: state.loreKnownCheckpointIds.filter(id => available.has(id))
  });
}
