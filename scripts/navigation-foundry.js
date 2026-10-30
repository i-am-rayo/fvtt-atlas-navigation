import { readSceneGridScale } from "./scene-grid.js";
import { toCanvasPoint } from "./road-coordinates.js";
import { calculateRoadRoute } from "./navigation-route.js";
import { MODULE_ID } from "./atlas-storage.js";
import { nativeCostSummary } from "./native-movement-cost.js";
import { REGION_TRAVEL_PRESET_FLAG, TRAVEL_PRESET_SETTING,
  validateTravelPresets } from "./travel-preset-model.js";
import { createRegionCostMeasurement, routingPriority, orderedRoutingRegions,
  REGION_ROUTING_PRIORITY_FLAG, REGION_ROUTING_ORDER_FLAG } from "./navigation-terrain.js";

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
  // Only Atlas-managed, active, single-Behavior costs can be read reliably.
  // Unsupported/manual native terrain rules are intentionally not guessed.
  const action = options.movementAction ?? "walk";
  const regions = [];
  let unsupported = false;
  const incompatible=[];
  let presets=[];
  try {presets=validateTravelPresets(game.settings.get(MODULE_ID,TRAVEL_PRESET_SETTING)).presets;}
  catch {unsupported=true;incompatible.push("Atlas World presets");}
  for (const region of scene.regions?.contents ?? []) {
    const cost = nativeCostSummary(region);
    if (!cost.existing || cost.disabled) continue;
    if (!cost.managed || cost.count !== 1 || !Number.isFinite(cost.actualCosts?.[action]) ||
        cost.actualCosts[action] <= 0 || !Array.from(region.shapes ?? []).every(shape =>
          ["polygon", "ellipse"].includes(shape.type))) {
      unsupported = true;
      incompatible.push(region.name || region.id);
      continue;
    }
    const priority = routingPriority(region.getFlag?.(MODULE_ID, REGION_ROUTING_PRIORITY_FLAG));
    const presetId=region.getFlag?.(MODULE_ID,REGION_TRAVEL_PRESET_FLAG)?.presetId;
    const surface=presets.find(item=>item.id===presetId)?.name ?? region.name;
    regions.push({ id: region.id, name:region.name, surface, priority,
      multiplier: cost.actualCosts[action], shapes: region.shapes });
  }
  // Never silently present an incorrect terrain-weighted estimate if a native
  // movement-cost Region cannot be represented by this conservative adapter.
  const useTerrain = options.terrainAware !== false && !unsupported && regions.length > 0;
  const ordered = orderedRoutingRegions(regions, scene.getFlag?.(MODULE_ID, REGION_ROUTING_ORDER_FLAG) ?? null);
  const ranked = ordered.map((region,index)=>({ ...region, rank:index }));
  const measureCost = !useTerrain ? null : createRegionCostMeasurement({
    regions: ranked, gridSize: scene.grid.size, toCanvasPoint: point => toCanvasPoint(view, atlas, point),
    measurePath: points => view.grid.measurePath(points).distance
  });
  const route = calculateRoadRoute(atlas, start, end,
    { ...options, attachmentTolerancePixels, measurePath, measureCost });
  if(route.status==="ok" && measureCost?.describe){
    route.legs=route.legs.map(leg=>({ ...leg,
      terrainSlices:measureCost.describe(leg.points).slices }));
  }
  return { ...route, terrainWarning: unsupported
    ? "Native/manual movement costs cannot be safely resolved for: " +
      incompatible.slice(0,3).join(", ") + (incompatible.length>3?` (+${incompatible.length-3} more)`:"") +
      ". Showing distance-only navigation; inspect their native Behaviors in Foundry."
    : useTerrain ? "Terrain costs are a sampled Atlas estimate, not native Token movement measurements." : null };
}
