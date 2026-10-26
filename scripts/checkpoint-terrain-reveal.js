/**
 * A lore-known location is remembered geography, not a live light/vision
 * source. A partially translucent background copy visually approaches
 * Foundry's dim explored state while keeping native fog untouched.
 * This is an approximate visual treatment; Foundry lighting is dynamic.
 */
export const CHECKPOINT_TERRAIN_REVEAL_OPACITY = 0.42;

import { checkpointKnowledge, checkpointRevealRadiusCells,
  validatePartyExploration } from "./party-exploration-model.js";

/**
 * Atlas-owned terrain reveal discs. These are presentation-only and NEVER
 * mutate Foundry's native FogExploration documents or stored fog texture.
 * Positions use the same image-to-canvas converter as checkpoint markers.
 */
export function checkpointTerrainRevealDiscs(atlas, exploration, gridSize, toCanvas) {
  const party = validatePartyExploration(exploration);
  if (!party.enabled || !Number.isFinite(gridSize) || gridSize <= 0 ||
      typeof toCanvas !== "function") return [];
  const nodes = new Map((atlas.nodes ?? []).map(node => [node.id, node]));
  const checkpoints = atlas.checkpoints ?? [];
  // Bounded overlay geometry; refuse unexpectedly large inputs.
  if (checkpoints.length > 512) return [];
  const discs = [];
  for (const checkpoint of checkpoints) {
    const status = checkpointKnowledge(party, checkpoint.id);
    if (status !== "lore" && status !== "visited") continue;
    const node = nodes.get(checkpoint.nodeId);
    if (!node) continue;
    const radiusCells = checkpointRevealRadiusCells(party, checkpoint.id);
    if (!radiusCells) continue;
    const point = toCanvas(node);
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) continue;
    discs.push({ x: point.x, y: point.y, radius: radiusCells * gridSize });
  }
  return discs;
}
