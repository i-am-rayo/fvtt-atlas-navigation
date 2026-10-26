import { checkpointTerrainRevealDiscs } from "./checkpoint-terrain-reveal.js";
import { validatePartyExploration } from "./party-exploration-model.js";

export const ATLAS_MAP_FOG_FLAG = "mapFog";
export const ATLAS_MAP_FOG_SCHEMA_VERSION = 1;
export const MAX_ATLAS_FOG_TRAIL_POINTS = 2048;

export function defaultAtlasMapFog() {
  return { schemaVersion: ATLAS_MAP_FOG_SCHEMA_VERSION, enabled: false, trail: [] };
}

/** Atlas data is separate from Foundry's FogExploration documents. */
export function validateAtlasMapFog(value) {
  if (value == null) return defaultAtlasMapFog();
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).some(key => !["schemaVersion", "enabled", "trail"].includes(key)) ||
      value.schemaVersion !== ATLAS_MAP_FOG_SCHEMA_VERSION ||
      typeof value.enabled !== "boolean" ||
      !Array.isArray(value.trail) || value.trail.length > MAX_ATLAS_FOG_TRAIL_POINTS) {
    throw new Error("Invalid Atlas map-fog configuration.");
  }
  const trail = value.trail.map(point => {
    if (!point || typeof point !== "object" || Array.isArray(point) ||
        Object.keys(point).some(key => !["x", "y", "radiusCells"].includes(key)) ||
        !["x", "y", "radiusCells"].every(key => Object.hasOwn(point, key)) ||
        !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
        Math.abs(point.x) > 1e7 || Math.abs(point.y) > 1e7 ||
        !Number.isFinite(point.radiusCells) ||
        point.radiusCells <= 0 || point.radiusCells > 100) {
      throw new Error("Invalid Atlas map-fog travel point.");
    }
    return { x: point.x, y: point.y, radiusCells: point.radiusCells };
  });
  return { schemaVersion: ATLAS_MAP_FOG_SCHEMA_VERSION, enabled: value.enabled, trail };
}

/** Reversible movement history: append only, never edit native fog textures. */
export function appendAtlasFogTrail(state, point) {
  const current = validateAtlasMapFog(state);
  if (!current.enabled) return current;
  const candidate = validateAtlasMapFog({
    ...current, trail: [point]
  }).trail[0];
  const last = current.trail.at(-1);
  if (last && Math.hypot(candidate.x - last.x, candidate.y - last.y) <=
      Math.min(candidate.radiusCells, last.radiusCells) * 0.35) return current;
  if (current.trail.length >= MAX_ATLAS_FOG_TRAIL_POINTS) {
    throw new Error("Atlas map-fog trail is full; stop and review before extending exploration.");
  }
  return { ...current, trail: [...current.trail, candidate] };
}

/** Convert Scene Grid-distance survey range to a bounded number of grid cells. */
export function atlasFogSurveyRadiusCells(exploration, gridDistance) {
  const party = validatePartyExploration(exploration);
  const cells = party.radius / gridDistance;
  if (!Number.isFinite(cells) || cells <= 0 || cells > 100) {
    throw new Error("Atlas map fog needs a survey radius of at most 100 grid cells.");
  }
  return cells;
}

/** Scene-owned mode is active only with a manually selected party token. */
export function atlasMapFogSelected(mapFog, exploration) {
  const fog = validateAtlasMapFog(mapFog);
  const party = validatePartyExploration(exploration);
  return fog.enabled && party.enabled && !!party.tokenId;
}

/** Reuse the existing known/visited checkpoint radii and add token travel. */
export function atlasMapFogDiscs(atlas, exploration, mapFog, gridSize,
    toCanvas, tokenCenter = null) {
  if (!atlasMapFogSelected(mapFog, exploration) ||
      !Number.isFinite(gridSize) || gridSize <= 0 ||
      typeof toCanvas !== "function") return [];
  const party = validatePartyExploration(exploration);
  const fog = validateAtlasMapFog(mapFog);
  const discs = checkpointTerrainRevealDiscs(atlas, party, gridSize, toCanvas);
  for (const point of fog.trail) {
    const center = toCanvas(point);
    if (Number.isFinite(center?.x) && Number.isFinite(center?.y)) {
      discs.push({ x: center.x, y: center.y, radius: point.radiusCells * gridSize });
    }
  }
  if (tokenCenter && Number.isFinite(tokenCenter.x) && Number.isFinite(tokenCenter.y)) {
    const cells = atlasFogSurveyRadiusCells(party, Number(tokenCenter.gridDistance));
    discs.push({ x: tokenCenter.x, y: tokenCenter.y, radius: cells * gridSize });
  }
  return discs;
}

export function atlasMapPointRevealed(point, discs) {
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return false;
  return discs.some(disc => Math.hypot(point.x - disc.x, point.y - disc.y) <= disc.radius);
}
