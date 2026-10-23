/**
 * Read-only Scene Grid distance calibration for atlas route measurements.
 *
 * The Scene remains the source of truth. Schema v1 stores ONLY a manual
 * override; a null calibration means "follow this Scene's Grid" when valid.
 * No Foundry globals are needed here.
 */
export function readSceneGridScale(scene) {
  const grid = scene?.grid;
  if (!grid) return null;
  const size = grid.size;
  const distance = grid.distance;
  const unit = typeof grid.units === "string" ? grid.units.trim() : "";
  if (!Number.isFinite(size) || size <= 0 ||
      !Number.isFinite(distance) || distance <= 0 || !unit) return null;

  const unitsPerPixel = distance / size;
  if (!Number.isFinite(unitsPerPixel) || unitsPerPixel <= 0) return null;

  return {
    source: "scene-grid",
    unitsPerPixel,
    unit,
    pixelsPerSpace: size,
    unitsPerSpace: distance,
    gridType: grid.type ?? null
  };
}

/** Existing v1 manual data takes precedence until an explicit GM switch. */
export function resolveAtlasScale(scene, atlas) {
  if (atlas?.calibration) return { ...atlas.calibration };
  return readSceneGridScale(scene);
}

/** Used for an informational warning; never silently replaces an override. */
export function differsFromSceneGrid(manual, gridScale) {
  if (!manual || !gridScale || manual.source !== "manual") return false;
  if (manual.unit.trim().toLowerCase() !== gridScale.unit.toLowerCase()) return true;
  const relative = Math.abs(manual.unitsPerPixel - gridScale.unitsPerPixel) /
    Math.max(manual.unitsPerPixel, gridScale.unitsPerPixel);
  return relative > 0.001;
}
