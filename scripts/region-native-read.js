/**
 * Foundry v14 native Region read adapter for Atlas generated-Region listings
 * and visual surface projections. No document writes or changes to native
 * shapes, elevation, Levels, colors, or Region Behaviors occur here.
 */
import { MODULE_ID } from "./atlas-storage.js";
import { GENERATED_REGION_FLAG, shapeSignature,
  validateGeneratedRegionFlag } from "./generated-region-model.js";
import { REGION_TRAVEL_PRESET_FLAG, validateRegionTravelFlag }
  from "./travel-preset-model.js";
import { nativeCostSummary } from "./native-movement-cost.js";
import { routingPriority, REGION_ROUTING_PRIORITY_FLAG,
  REGION_ROUTING_ORDER_FLAG } from "./navigation-terrain.js";
import { projectRoadSurfaceRegions } from "./region-surface-model.js";

export function listGeneratedRegions(scene) {
  return Array.from(scene?.regions?.values?.() ?? [], region => {
    let metadata = null, invalid = false;
    try { metadata = validateGeneratedRegionFlag(region.getFlag(MODULE_ID, GENERATED_REGION_FLAG)); }
    catch { invalid = true; }
    let presetId = null, invalidPreset = false;
    try {
      presetId = validateRegionTravelFlag(
        region.getFlag(MODULE_ID, REGION_TRAVEL_PRESET_FLAG))?.presetId ?? null;
    } catch { invalidPreset = true; }
    return {
      id: region.id, name: region.name, color: region.color ?? null,
      metadata, invalid, presetId, invalidPreset,
      priority: routingPriority(region.getFlag(MODULE_ID, REGION_ROUTING_PRIORITY_FLAG)),
      nativeCost: nativeCostSummary(region),
      modified: !!metadata && shapeSignature(region.shapes ?? []) !== metadata.shapeSignature
    };
  }).filter(region => region.metadata || region.invalid);
}

/** Copy public Region shape data before handing it to pure visual modeling. */
function readShapeData(shape) {
  const data = typeof shape?.toObject === "function" ? shape.toObject() : shape;
  if (!data || typeof data !== "object") return data;
  return {
    ...data,
    ...(data.origin ? {origin: {...data.origin}} : {}),
    ...(Array.isArray(data.points) ? {points: [...data.points]} : {})
  };
}

/**
 * Observe native Region geometry and Atlas's descriptive preset association.
 * Preserve existing overlay filtering/order semantics. A Region's actual
 * movement behavior remains native and is never inferred from its color.
 */
export function sceneRoadSurfaces(scene, presets) {
  const readouts = Array.from(scene?.regions?.contents ?? [], region => ({
    id: region.id,
    shapes: Array.from(region.shapes ?? [], readShapeData),
    presetId: region.getFlag?.(MODULE_ID, REGION_TRAVEL_PRESET_FLAG)?.presetId,
    priority: region.getFlag?.(MODULE_ID, REGION_ROUTING_PRIORITY_FLAG)
  }));
  const order = scene?.getFlag?.(MODULE_ID, REGION_ROUTING_ORDER_FLAG) ?? null;
  return projectRoadSurfaceRegions(readouts, presets, order);
}
