import { readAtlas } from "./atlas-storage.js";
import { toCanvasPoint } from "./road-coordinates.js";
import { atlasPointExplored } from "./road-fog.js";
import { readPartyExploration } from "./party-exploration-storage.js";
import { readAtlasMapFog } from "./atlas-map-fog-storage.js";
import { PARTY_EXPLORATION_FLAG, validatePartyExploration,
  setCheckpointKnowledge } from "./party-exploration-model.js";
import { MODULE_ID } from "./atlas-storage.js";

/** Pure distance gate; the Foundry adapter is authoritative for measurements. */
export function discoverableCheckpointIds(atlas, state, visibleAt, distanceTo) {
  const config = validatePartyExploration(state);
  if (!config.enabled || !config.tokenId) return [];
  const nodes = new Map((atlas.nodes ?? []).map(node => [node.id, node]));
  const known = new Set([...config.discoveredCheckpointIds, ...config.loreKnownCheckpointIds]);
  return (atlas.checkpoints ?? []).filter(checkpoint => {
    if (checkpoint.playerVisible !== true || known.has(checkpoint.id)) return false;
    const node = nodes.get(checkpoint.nodeId);
    if (!node || !visibleAt(node)) return false;
    const distance = distanceTo(node);
    return Number.isFinite(distance) && distance <= config.radius;
  }).map(checkpoint => checkpoint.id);
}

/**
 * GM-only update on movement of the explicitly selected Scene token.
 * Native Foundry fog must have explored the candidate checkpoint position;
 * never use the GM's unrestricted canvas visibility as proof of player sight.
 * We also use the Scene's native grid measuring engine, not Atlas geometry.
 */
export async function recordPartyDiscoveryForToken(tokenDoc) {
  const scene = tokenDoc?.parent;
  if (!game?.user?.isGM || !scene?.canUserModify?.(game.user, "update") ||
      !canvas?.ready || canvas.scene?.id !== scene.id ||
      !canvas.grid?.measurePath) return [];

  const state = readPartyExploration(scene);
  if (!state.enabled || !state.tokenId || tokenDoc.id !== state.tokenId) return [];
  const token = tokenDoc.object;
  const tokenCenter = token?.center ?? {
    x: tokenDoc.x + (tokenDoc.width || 1) * (scene.grid?.size || 100) / 2,
    y: tokenDoc.y + (tokenDoc.height || 1) * (scene.grid?.size || 100) / 2
  };
  const atlas = readAtlas(scene);
  const manualMapFog = readAtlasMapFog(scene).enabled;
  const ids = discoverableCheckpointIds(atlas, state, node => {
    if (manualMapFog) return true; // Atlas survey range below is authoritative in this mode.
    const position = toCanvasPoint(canvas, atlas, node);
    return atlasPointExplored(canvas, position);
  }, node => {
    const position = toCanvasPoint(canvas, atlas, node);
    try {
      return canvas.grid.measurePath([tokenCenter, position])?.distance;
    } catch { return NaN; }
  });
  if (!ids.length) return [];
  // A second GM could have changed the flag while measuring; refuse a stale save.
  const latest = readPartyExploration(scene);
  if (JSON.stringify(state) !== JSON.stringify(latest)) return [];
  let next = state;
  for (const id of ids) next = setCheckpointKnowledge(next, id, "visited");
  await scene.setFlag(MODULE_ID, PARTY_EXPLORATION_FLAG, next);
  return ids;
}
