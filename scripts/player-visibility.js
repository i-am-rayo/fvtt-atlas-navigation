import { validateAtlas, upgradeAtlasPlayerVisibility } from "./atlas-model.js";

// Preserve existing public imports while separating player display data from
// the GM-authorized Scene-flag mutators below.
export { isRoadVisibleToPlayers,playerAtlasOverlay } from "./player-overlay-model.js";

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
