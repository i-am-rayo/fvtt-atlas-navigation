/**
 * Versioned road positions: legacy v1 is padded-canvas-absolute; v2 is
 * relative to the top-left of the Scene background image (not the viewport).
 * Scene padding may change without invalidating v2 authored geometry.
 */
export function sceneImageOrigin(canvas) {
  const dimensions = canvas?.dimensions;
  if (!dimensions || !Number.isFinite(dimensions.sceneX) ||
      !Number.isFinite(dimensions.sceneY)) {
    throw new Error("The Scene image origin is unavailable. Open the Scene canvas first.");
  }
  return { x: dimensions.sceneX, y: dimensions.sceneY };
}

export function toAtlasPoint(canvas, atlas, point) {
  const origin = atlas.schemaVersion === 2 ? sceneImageOrigin(canvas) : { x: 0, y: 0 };
  return { x: point.x - origin.x, y: point.y - origin.y };
}

export function toCanvasPoint(canvas, atlas, point) {
  const origin = atlas.schemaVersion === 2 ? sceneImageOrigin(canvas) : { x: 0, y: 0 };
  return { x: point.x + origin.x, y: point.y + origin.y };
}
