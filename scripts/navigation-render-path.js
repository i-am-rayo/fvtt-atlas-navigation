import { toCanvasPoint } from "./road-coordinates.js";
import { smoothRoadPath, roadCurveNeighbors, readRoadCurvePreset } from "./road-appearance.js";
import { clipNavigationSpline } from "./navigation-curvature.js";

/** One visual path source for both the route overlay and guided token movement. */
export function navigationCanvasLegPaths(view, atlas, route, {
  toCanvas = point => toCanvasPoint(view, atlas, point),
  curve = readRoadCurvePreset()
} = {}) {
  if (!Array.isArray(route?.legs)) return [];
  const nodes = new Map(atlas.nodes.map(node => [node.id, node]));
  const segments = new Map(atlas.segments.map(segment => [segment.id, segment]));
  const neighbors = roadCurveNeighbors(atlas);
  return route.legs.map(leg => {
    let points = leg.points.map(toCanvas);
    if (leg.kind === "road") {
      const segment = segments.get(leg.segmentId);
      if (segment) {
        const from = nodes.get(segment.from), to = nodes.get(segment.to);
        if (!from || !to) throw Error("Route references a missing road endpoint.");
        const adjacent = neighbors.get(segment.id);
        const full = smoothRoadPath([from, ...segment.via, to].map(toCanvas), curve, {
          before: adjacent?.before ? toCanvas(adjacent.before) : null,
          after: adjacent?.after ? toCanvas(adjacent.after) : null
        });
        points = clipNavigationSpline(full, points[0], points.at(-1));
      }
    }
    // Preserve authored IDs for read-only native movement diagnostics. Canvas
    // geometry and movement paths remain derived from the same Scene roads.
    return { kind: leg.kind, roadId: leg.roadId ?? null,
      segmentId: leg.segmentId ?? null, points };
  });
}
