import { checkpointKnowledge } from "./party-exploration-model.js";
import { validateAtlas, upgradeAtlasPlayerVisibility,
  PLAYER_VISIBILITY_ATLAS_SCHEMA_VERSION } from "./atlas-model.js";

/** UI-only discovery. A Scene flag is not a confidentiality boundary. */
export function isRoadVisibleToPlayers(atlas, roadId) {
  return atlas.schemaVersion >= PLAYER_VISIBILITY_ATLAS_SCHEMA_VERSION &&
    atlas.roads?.some(road => road.id === roadId && road.playerVisible === true) === true;
}

export function playerAtlasOverlay(atlas, exploration = null) {
  const roads = (atlas.roads ?? []).filter(road => isRoadVisibleToPlayers(atlas, road.id));
  const allowed = new Set(roads.map(road => road.id));
  const segments = atlas.segments.filter(segment => allowed.has(segment.roadId));
  // A revealed checkpoint may share its own name, but never elevation or
  // the identity of a road that has not also been explicitly revealed.
  // Player overlays must not derive tooltip details from raw Scene flags.
  const checkpoints = (atlas.checkpoints ?? []).filter(checkpoint =>
    atlas.schemaVersion >= PLAYER_VISIBILITY_ATLAS_SCHEMA_VERSION &&
    (exploration?.enabled === true
      ? checkpointKnowledge(exploration, checkpoint.id) !== "unknown"
      : checkpoint.playerVisible === true)).map(checkpoint => ({
      id: checkpoint.id, nodeId: checkpoint.nodeId,
      appearance: checkpoint.appearance,
      name: checkpoint.name, elevationMeters: null,
      discoveryMode: checkpointKnowledge(exploration, checkpoint.id),
      roadId: allowed.has(checkpoint.roadId) ? checkpoint.roadId : null
    }));
  const nodeIds = new Set(segments.flatMap(segment => [segment.from, segment.to]));
  for (const checkpoint of checkpoints) nodeIds.add(checkpoint.nodeId);
  return {
    ...atlas, roads,
    segments,
    nodes: atlas.nodes.filter(node => nodeIds.has(node.id)),
    checkpoints
  };
}

export function setRoadPlayerVisibility(atlas, { roadId, visible }) {
  const before = validateAtlas(atlas);
  if (typeof visible !== "boolean") throw new Error("Road player visibility must be on or off.");
  if (!before.roads?.some(road => road.id === roadId)) throw new Error("Road no longer exists.");
  const current = upgradeAtlasPlayerVisibility(before);
  return validateAtlas({ ...current, roads: current.roads.map(road =>
    road.id === roadId ? { ...road, playerVisible: visible } : road) });
}

export function setCheckpointPlayerVisibility(atlas, { checkpointId, visible }) {
  const before = validateAtlas(atlas);
  if (typeof visible !== "boolean") throw new Error("Checkpoint visibility must be on or off.");
  if (!before.checkpoints?.some(checkpoint => checkpoint.id === checkpointId)) {
    throw new Error("Checkpoint no longer exists.");
  }
  const current = upgradeAtlasPlayerVisibility(before);
  return validateAtlas({ ...current, checkpoints: current.checkpoints.map(checkpoint =>
    checkpoint.id === checkpointId ? { ...checkpoint, playerVisible: visible } : checkpoint) });
}
