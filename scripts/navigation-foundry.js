import { readSceneGridScale } from "./scene-grid.js";
import { toCanvasPoint } from "./road-coordinates.js";
import { calculateRoadRoute } from "./navigation-route.js";

/**
 * Adapter for the public Foundry v14 canvas.grid.measurePath API.
 * The route model stores image-local coordinates; Foundry measures canvas
 * coordinates including the current Scene image origin / padding.
 */
export function createNativeRouteMeasurement(view, scene, atlas) {
  if (!view?.ready || view.scene?.id !== scene?.id ||
      typeof view.grid?.measurePath !== "function" ||
      !readSceneGridScale(scene)) {
    throw new Error("Open the Scene with a configured native Grid before navigating.");
  }
  return points => {
    const canvasPoints = points.map(point => toCanvasPoint(view, atlas, point));
    const measured = view.grid.measurePath(canvasPoints);
    if (!Number.isFinite(measured?.distance) || measured.distance < 0) {
      throw new Error("Foundry could not measure this route using the Scene Grid.");
    }
    return measured.distance;
  };
}

/** Read-only route query: no Scene flags, token movement, or Region changes. */
export function calculateSceneRoadRoute(view, scene, atlas, start, end, options = {}) {
  const measurePath = createNativeRouteMeasurement(view, scene, atlas);
  const attachmentTolerancePixels = options.attachmentTolerancePixels ?? scene.grid.size / 2;
  return calculateRoadRoute(atlas, start, end,
    { ...options, attachmentTolerancePixels, measurePath });
}
