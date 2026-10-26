/**
 * Per-Scene Atlas exploration state. This is independent of the road graph
 * schema and never modifies a Token, Actor, native Region, or Foundry fog data.
 *
 * Checkpoint IDs are opaque IDs issued by the existing Atlas checkpoint model.
 * Knowledge is not a secrecy boundary: Foundry Scene flags may be readable by
 * a connected player. The player renderer must project only revealed records.
 */
export const PARTY_EXPLORATION_SCHEMA_VERSION = 2;
export const DEFAULT_CHECKPOINT_REVEAL_RADIUS_CELLS = 3;
export const PARTY_EXPLORATION_FLAG = "partyExploration";

export function defaultPartyExploration() {
  return {
    schemaVersion: PARTY_EXPLORATION_SCHEMA_VERSION,
    enabled: false,
    tokenId: null,
    radius: 10,
    defaultRevealRadiusCells: DEFAULT_CHECKPOINT_REVEAL_RADIUS_CELLS,
    checkpointRevealRadiusCells: {},
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
  const legacy = value.schemaVersion === 1;
  const fields = ["schemaVersion", "enabled", "tokenId", "radius",
    "defaultRevealRadiusCells", "checkpointRevealRadiusCells",
    "discoveredCheckpointIds", "loreKnownCheckpointIds"];
  if (Object.keys(value).some(key => !fields.includes(key)) ||
      fields.filter(key => !legacy ||
        !["defaultRevealRadiusCells", "checkpointRevealRadiusCells"].includes(key))
        .some(key => !Object.hasOwn(value, key)) ||
      ![1, PARTY_EXPLORATION_SCHEMA_VERSION].includes(value.schemaVersion) ||
      typeof value.enabled !== "boolean" ||
      (value.tokenId !== null && (typeof value.tokenId !== "string" ||
        !value.tokenId || value.tokenId.length > 160)) ||
      !Number.isFinite(value.radius) || value.radius <= 0 || value.radius > 100000) {
    throw new Error("Invalid Atlas party exploration configuration.");
  }
  const defaultRevealRadiusCells = legacy ? DEFAULT_CHECKPOINT_REVEAL_RADIUS_CELLS :
    value.defaultRevealRadiusCells;
  const radii = legacy ? {} : value.checkpointRevealRadiusCells;
  if (!Number.isFinite(defaultRevealRadiusCells) ||
      defaultRevealRadiusCells < 0 || defaultRevealRadiusCells > 100 ||
      !radii || typeof radii !== "object" || Array.isArray(radii) ||
      Object.keys(radii).length > 20000 ||
      Object.entries(radii).some(([id, radius]) =>
        !id || id.length > 160 || !Number.isFinite(radius) || radius < 0 || radius > 100)) {
    throw new Error("Invalid Atlas checkpoint terrain reveal radii.");
  }
  const checkpointRevealRadiusCells = Object.fromEntries(
    Object.entries(radii).map(([id, radius]) => [id, radius]));
  const discoveredCheckpointIds = ids(value.discoveredCheckpointIds, "discovery IDs");
  const loreKnownCheckpointIds = ids(value.loreKnownCheckpointIds, "lore IDs");
  if (discoveredCheckpointIds.some(id => loreKnownCheckpointIds.includes(id))) {
    throw new Error("A checkpoint cannot have two Atlas knowledge sources.");
  }
  return { schemaVersion: PARTY_EXPLORATION_SCHEMA_VERSION,
    enabled: value.enabled, tokenId: value.tokenId, radius: value.radius,
    defaultRevealRadiusCells, checkpointRevealRadiusCells,
    discoveredCheckpointIds, loreKnownCheckpointIds };
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

/** A per-checkpoint radius of zero disables only Atlas's map-background reveal. */
export function checkpointRevealRadiusCells(exploration, checkpointId) {
  const state = validatePartyExploration(exploration);
  return Object.hasOwn(state.checkpointRevealRadiusCells, checkpointId)
    ? state.checkpointRevealRadiusCells[checkpointId] : state.defaultRevealRadiusCells;
}

export function setCheckpointRevealRadius(exploration, checkpointId, radius) {
  const state = validatePartyExploration(exploration);
  if (typeof checkpointId !== "string" || !checkpointId || checkpointId.length > 160 ||
      !Number.isFinite(radius) || radius < 0 || radius > 100) {
    throw new Error("Invalid checkpoint reveal radius (0–100 grid cells).");
  }
  return validatePartyExploration({ ...state,
    checkpointRevealRadiusCells: {
      ...state.checkpointRevealRadiusCells, [checkpointId]: radius
    } });
}
