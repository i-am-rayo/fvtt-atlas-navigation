/**
 * Pure, read-only surface projection from normalized Region observations.
 * This is Atlas overlay coloring, not native Region movement-cost authority.
 */
import { orderedRoutingRegions, routingPriority } from "./navigation-terrain.js";

export function projectRoadSurfaceRegions(readouts, presets, order = null) {
  const lookup = new Map(presets.map(preset => [preset.id, preset]));
  const candidates = [];
  for (const region of readouts) {
    const preset = lookup.get(region.presetId);
    const shapes = Array.from(region.shapes ?? []);
    if (!preset || !shapes.length ||
        shapes.some(shape => !["polygon", "ellipse"].includes(shape.type))) continue;
    candidates.push({
      id: region.id, shapes, color: preset.color, name: preset.name,
      priority: routingPriority(region.priority)
    });
  }
  return orderedRoutingRegions(candidates, order).map((region, rank) => ({...region, rank}));
}
