/**
 * Read the native Scene Grid's configured distance, unit, and pixel size.
 *
 * A raw units-per-pixel ratio is intentionally NOT exposed: it cannot replace
 * the native measured distance across square/hex/gridless cells.
 * When routes are implemented, measure their actual Scene-space waypoints
 * through Foundry v14's canvas.grid.measurePath(...).distance, matching
 * the grid rules used by native measurement tools.
 *
 * Legacy v1 atlas.calibration objects are intentionally ignored. They remain
 * in persisted flags for reversible migration, never as active travel rules.
 */
export function readSceneGridScale(scene) {
  const grid = scene?.grid;
  if (!grid) return null;
  const size = grid.size;
  const distance = grid.distance;
  const unit = typeof grid.units === "string" ? grid.units.trim() : "";
  if (!Number.isFinite(size) || size <= 0 ||
      !Number.isFinite(distance) || distance <= 0) return null;

  return {
    unit,
    pixelsPerSpace: size,
    unitsPerSpace: distance,
    gridType: grid.type ?? null
  };
}

