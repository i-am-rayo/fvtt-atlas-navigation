import { checkpointTerrainRevealDiscs } from "./checkpoint-terrain-reveal.js";
import { validatePartyExploration } from "./party-exploration-model.js";

export const ATLAS_MAP_FOG_FLAG = "mapFog";
export const ATLAS_MAP_FOG_SCHEMA_VERSION = 1;
export const MAX_ATLAS_FOG_TRAIL_POINTS = 2048;
export const MAX_ATLAS_EXPLORED_CELLS = 40000;

export function defaultAtlasMapFog() {
  return { schemaVersion: ATLAS_MAP_FOG_SCHEMA_VERSION, enabled: false, trail: [] };
}

/** Atlas data is separate from Foundry's FogExploration documents. */
export function validateAtlasMapFog(value) {
  if (value == null) return defaultAtlasMapFog();
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).some(key => !["schemaVersion", "enabled", "trail", "cells"].includes(key)) ||
      ![1, 2].includes(value.schemaVersion) ||
      (value.schemaVersion === 1 && Object.hasOwn(value, "cells")) ||
      (value.schemaVersion === 2 && !Array.isArray(value.cells)) ||
      typeof value.enabled !== "boolean" ||
      !Array.isArray(value.trail) || value.trail.length > MAX_ATLAS_FOG_TRAIL_POINTS) {
    throw new Error("Invalid Atlas map-fog configuration.");
  }
  const trail = value.trail.map(point => {
    if (!point || typeof point !== "object" || Array.isArray(point) ||
        Object.keys(point).some(key => !["x", "y", "radiusCells", "fromX", "fromY"].includes(key)) ||
        !["x", "y", "radiusCells"].every(key => Object.hasOwn(point, key)) ||
        !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
        Math.abs(point.x) > 1e7 || Math.abs(point.y) > 1e7 ||
        !Number.isFinite(point.radiusCells) ||
        point.radiusCells <= 0 || point.radiusCells > 100 ||
        (Object.hasOwn(point, "fromX") !== Object.hasOwn(point, "fromY")) ||
        (Object.hasOwn(point, "fromX") &&
          (![point.fromX, point.fromY].every(Number.isFinite) ||
           Math.abs(point.fromX) > 1e7 || Math.abs(point.fromY) > 1e7))) {
      throw new Error("Invalid Atlas map-fog travel point.");
    }
    return { x: point.x, y: point.y, radiusCells: point.radiusCells,
      ...(Object.hasOwn(point, "fromX") ? { fromX: point.fromX, fromY: point.fromY } : {}) };
  });
  let cells;
  if (value.schemaVersion === 2) {
    if (value.cells.length > MAX_ATLAS_EXPLORED_CELLS) {
      throw new Error("Atlas persistent discovery exceeds its bounded cell budget.");
    }
    const seen = new Set();
    cells = value.cells.map(cell => {
      if (!cell || typeof cell !== "object" || Array.isArray(cell) ||
          Object.keys(cell).some(key => !["x", "y"].includes(key)) ||
          !Number.isFinite(cell.x) || !Number.isFinite(cell.y) ||
          Math.abs(cell.x) > 1e7 || Math.abs(cell.y) > 1e7) {
        throw new Error("Invalid Atlas discovered cell position.");
      }
      const key = cell.x + "," + cell.y;
      if (seen.has(key)) throw new Error("Duplicate Atlas discovered cell.");
      seen.add(key);
      return { x: cell.x, y: cell.y };
    });
  }
  return { schemaVersion: value.schemaVersion, enabled: value.enabled, trail,
    ...(cells ? { cells } : {}) };
}

/** Snapshot derived from travel history; persists grid coverage without changing travel records. */
export function withAtlasExploredCells(state, cells) {
  const fog = validateAtlasMapFog(state);
  if (!Array.isArray(cells)) throw new Error("Expected Atlas discovered cells.");
  return validateAtlasMapFog({ ...fog, schemaVersion: 2, cells });
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
  // Older saved points remain unchanged. Only newly recorded movements
  // have a segment start, so deleting a record never rewrites history.
  const destination = last ? { ...candidate, fromX: last.x, fromY: last.y } : candidate;
  return { ...current, trail: [...current.trail, destination] };
}

/** Explicit GM history correction; indices refer to the saved, chronological trail. */
export function removeAtlasFogTrailPoint(state, index) {
  const fog = validateAtlasMapFog(state);
  if (!Number.isSafeInteger(index) || index < 0 || index >= fog.trail.length) {
    throw new Error("Select an existing Atlas travel reveal.");
  }
  return { ...fog, trail: fog.trail.filter((_, i) => i !== index) };
}

/** Empty ONLY Atlas's saved travel circles; known checkpoints remain known. */
export function clearAtlasFogTrail(state) {
  const fog = validateAtlasMapFog(state);
  return { ...fog, trail: [] };
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
  validatePartyExploration(exploration);
  return fog.enabled;
}

/** Reuse the existing known/visited checkpoint radii and add token travel. */
export function atlasMapFogDiscs(atlas, exploration, mapFog, gridSize,
    toCanvas, tokenCenter = null) {
  if (!atlasMapFogSelected(mapFog, exploration) ||
      !Number.isFinite(gridSize) || gridSize <= 0 ||
      typeof toCanvas !== "function") return [];
  const party = validatePartyExploration(exploration);
  if (!party.enabled || !party.tokenId) return [];
  const fog = validateAtlasMapFog(mapFog);
  const discs = checkpointTerrainRevealDiscs(atlas, party, gridSize, toCanvas);
  for (const point of fog.trail) {
    const center = toCanvas(point);
    if (Number.isFinite(center?.x) && Number.isFinite(center?.y)) {
      discs.push({ x: center.x, y: center.y, radius: point.radiusCells * gridSize });
      if (Number.isFinite(point.fromX) && Number.isFinite(point.fromY)) {
        const from = toCanvas({ x: point.fromX, y: point.fromY });
        const radius = point.radiusCells * gridSize;
        const distance = Math.hypot(center.x - from.x, center.y - from.y);
        // Explicit, bounded sampling for a continuous surveyed corridor.
        // Never guess coordinates from other trail records at render time.
        const steps = Math.max(1, Math.ceil(distance / Math.max(1, radius * 0.65)));
        if (steps > 512) throw new Error("Atlas travel step is too long to survey safely.");
        for (let step = 1; step < steps; step++) {
          const t = step / steps;
          discs.push({
            x: from.x + (center.x - from.x) * t,
            y: from.y + (center.y - from.y) * t,
            radius
          });
        }
      }
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
