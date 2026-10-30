/**
 * Foundry v14 adapter: opt-in native Region creation and conservative
 * regeneration. Never mutates road flags or existing Region Behaviors.
 */
import { readAtlas, MODULE_ID } from "./atlas-storage.js";
import { sceneImageOrigin } from "./road-coordinates.js";
import { buildGeneratedRegionPlan, GENERATED_REGION_FLAG, shapeSignature,
  validateGeneratedRegionFlag } from "./generated-region-model.js";
import { REGION_TRAVEL_PRESET_FLAG, TRAVEL_PRESET_SETTING,
  TRAVEL_PRESET_SCHEMA_VERSION, validateTravelPresets, validateRegionTravelFlag }
  from "./travel-preset-model.js";
import { buildNativeMovementCostBehavior, nativeCostBehaviors, nativeCostSummary,
  editableManagedNativeCost, sameMovementCosts }
  from "./native-movement-cost.js";
import { routingPriority, REGION_ROUTING_PRIORITY_FLAG, REGION_ROUTING_ORDER_FLAG,
  orderedRoutingRegions, moveRoutingRegion } from "./navigation-terrain.js";

function checkScene(scene) {
  const user = globalThis.game?.user;
  if (!user?.isGM || !scene?.canUserModify?.(user, "update")) {
    throw new Error("Only a GM with Scene editing access can generate native Regions.");
  }
  const view = globalThis.canvas;
  if (!view?.ready || view.scene?.id !== scene.id) {
    throw new Error("Open the chosen Scene on the canvas before generating Regions.");
  }
  if (!Number.isFinite(scene?.grid?.size) || !(scene.grid.size > 0)) {
    throw new Error("This Scene has no valid grid pixel size for Region width.");
  }
  return view;
}

export function planSceneGeneratedRegion(scene, settings) {
  const view = checkScene(scene);
  return buildGeneratedRegionPlan(readAtlas(scene), {
    ...settings, gridSize: scene.grid.size,
    origin: sceneImageOrigin(view)
  });
}

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
    return { id: region.id, name: region.name, color: region.color ?? null,
      metadata, invalid, presetId, invalidPreset,
      priority: routingPriority(region.getFlag(MODULE_ID, REGION_ROUTING_PRIORITY_FLAG)),
      nativeCost: nativeCostSummary(region),
      modified: !!metadata && shapeSignature(region.shapes ?? []) !== metadata.shapeSignature };
  }).filter(region => region.metadata || region.invalid);
}

/** Metadata only: no native Region or Behavior properties are modified. */
export async function setGeneratedRegionRoutingPriority(scene, regionId, priority) {
  checkScene(scene);
  routingPriority(priority);
  const region = scene.regions?.get(regionId);
  if (!region?.canUserModify?.(game.user, "update") ||
      !validateGeneratedRegionFlag(region.getFlag(MODULE_ID, GENERATED_REGION_FLAG))) {
    throw new Error("Choose an editable Atlas-generated Region.");
  }
  await region.setFlag(MODULE_ID, REGION_ROUTING_PRIORITY_FLAG, priority);
}

export function listSceneOrderedGeneratedRegions(scene) {
  const regions = listGeneratedRegions(scene).filter(entry => entry.metadata);
  const saved = scene.getFlag?.(MODULE_ID, REGION_ROUTING_ORDER_FLAG) ?? null;
  return orderedRoutingRegions(regions, saved);
}

/** One atomic Scene flag update, no native Region edits or Behavior changes. */
export async function moveSceneGeneratedRegion(scene, movingId, targetId) {
  checkScene(scene);
  const regions = listGeneratedRegions(scene).filter(entry => entry.metadata);
  const order = scene.getFlag?.(MODULE_ID, REGION_ROUTING_ORDER_FLAG) ?? null;
  const next = moveRoutingRegion(regions, order, movingId, targetId);
  await scene.setFlag(MODULE_ID, REGION_ROUTING_ORDER_FLAG, next);
  return next;
}

function matchingRegion(scene, flag) {
  const matching = listGeneratedRegions(scene);
  if (matching.some(r => r.invalid)) {
    throw new Error("A native Region contains unsupported generated-Region metadata. Resolve it before generating more.");
  }
  return matching.filter(r => r.metadata.roadId === flag.roadId &&
    r.metadata.kind === flag.kind &&
    r.metadata.checkpointIds.join("|") === flag.checkpointIds.join("|"));
}

/**
 * Reject a stale multi-mode or legacy cost after confirmation, before any write.
 * Costs are snapshots; editing world presets never mutates existing Behaviors.
 */
function confirmedCostSnapshot(behavior, multiplier, costs) {
  const flag = behavior.flags[MODULE_ID].nativeMovementCost;
  return flag.schemaVersion === 1
    ? costs === null && multiplier === flag.multiplier
    : multiplier === null && sameMovementCosts(costs, flag.movementCosts);
}

/** Called only after an explicit preview/confirmation in the GM UI. */
export async function saveGeneratedNativeRegion(scene, plan,
  { regenerate = false, presetId = null, movementAction = null,
    expectedMultiplier = null, applyNativeCost = false, expectedCosts = null,
    expectedColor = undefined } = {}) {
  checkScene(scene);
  // Rebuild against current image origin, grid and graph to reject stale dialogs.
  const checkpointId = plan.startCheckpointId;
  const endCheckpointId = plan.endCheckpointId;
  const fresh = planSceneGeneratedRegion(scene, {
    kind: plan.kind, roadId: plan.roadId, checkpointId, endCheckpointId,
    widthCells: plan.generatedRegion.widthCells
  });
  if (fresh.expectedRevision !== plan.expectedRevision ||
      fresh.generatedRegion.shapeSignature !== plan.generatedRegion.shapeSignature) {
    throw new Error("Road, grid or Scene padding changed since preview. Reopen the generator.");
  }
  if (applyNativeCost && (regenerate || plan.kind !== "corridor" || !presetId)) {
    throw new Error("Native movement cost can be applied only when creating a corridor with a selected preset.");
  }
  if (!applyNativeCost && (movementAction !== null || expectedCosts !== null ||
      expectedMultiplier !== null)) {
    throw new Error("Native movement-cost data requires an explicit opt-in.");
  }
  const matches = matchingRegion(scene, plan.generatedRegion);
  if (matches.length > 1) {
    throw new Error("Multiple generated native Regions already represent this checkpoint interval. Resolve duplicates manually.");
  }
  if (regenerate) {
    if (!matches.length) throw new Error("No generated native Region exists to regenerate.");
    const entry = matches[0];
    if (entry.modified) {
      throw new Error("This native Region's geometry was edited by the GM. Regeneration is blocked to preserve it.");
    }
    const region = scene.regions?.get(entry.id);
    if (!region?.canUserModify?.(game.user, "update")) {
      throw new Error("You cannot update that native Region.");
    }
    // Only shapes and module-owned generation metadata are touched.
    // Preserve the GM's native name, Levels, visibility and Behaviors.
    await region.update({
      shapes: fresh.shapes,
      ["flags." + MODULE_ID + "." + GENERATED_REGION_FLAG]: fresh.generatedRegion
    });
    return { id: region.id, created: false };
  }
  if (matches.length) {
    throw new Error("A generated Region already exists for this checkpoint or corridor. Choose Regenerate to update unchanged geometry.");
  }
  const selectedPreset = presetId === null ? null : requireExistingPreset(presetId);
  if (expectedColor !== undefined && expectedColor !== selectedPreset?.color) {
    throw new Error("The preset Region color changed since confirmation. Preview again.");
  }
  // Validate the full native schema before writing any Region or Behavior.
  const behavior = !applyNativeCost ? null :
    buildNativeMovementCostBehavior(presetId, movementAction);
  if (behavior && !confirmedCostSnapshot(behavior, expectedMultiplier, expectedCosts)) {
    throw new Error("The world preset costs changed since confirmation. Preview again; nothing was created.");
  }
  const [created] = await scene.createEmbeddedDocuments("Region", [{
    name: fresh.name,
    ...(plan.kind === "corridor" && selectedPreset ? { color: selectedPreset.color } : {}),
    shapes: fresh.shapes,
    behaviors: behavior ? [behavior] : [],
    flags: {
      [MODULE_ID]: {
        atlas: { schemaVersion: 1, linked: true },
        [GENERATED_REGION_FLAG]: fresh.generatedRegion,
        ...(presetId === null ? {} : {
          [REGION_TRAVEL_PRESET_FLAG]: {
            schemaVersion: TRAVEL_PRESET_SCHEMA_VERSION, presetId
          }
        })
      }
    }
  }]);
  if (!created) throw new Error("Foundry did not create the native Region.");
  return { id: created.id, created: true };
}

/** A Region's descriptive preset is independent of native geometry/Behaviors. */
function requireExistingPreset(presetId) {
  const list = validateTravelPresets(game.settings.get(MODULE_ID, TRAVEL_PRESET_SETTING));
  const found = list.presets.find(p => p.id === presetId);
  if (!found) throw new Error("Choose a travel preset still configured in Atlas world settings.");
  return found;
}

export async function setGeneratedRegionTravelPreset(scene, regionId, presetId = null) {
  checkScene(scene);
  const region = scene.regions?.get(regionId);
  if (!region || !region.canUserModify?.(game.user, "update") ||
      !validateGeneratedRegionFlag(region.getFlag(MODULE_ID, GENERATED_REGION_FLAG))) {
    throw new Error("Choose an existing Atlas-generated native Region.");
  }
  if (presetId === null) {
    await region.unsetFlag(MODULE_ID, REGION_TRAVEL_PRESET_FLAG);
  } else {
    requireExistingPreset(presetId);
    await region.setFlag(MODULE_ID, REGION_TRAVEL_PRESET_FLAG, {
      schemaVersion: TRAVEL_PRESET_SCHEMA_VERSION, presetId
    });
  }
}


/**
 * Explicit, separately confirmed application to one existing generated corridor.
 * Native/manual movement-cost Behaviors are never edited, replaced or stacked.
 */
export async function applyGeneratedRegionMovementCost(scene, regionId,
  { movementAction = null, expectedPresetId, expectedMultiplier = null,
    expectedCosts = null } = {}) {
  checkScene(scene);
  const region = scene.regions?.get(regionId);
  if (!region?.canUserModify?.(game.user, "update")) {
    throw new Error("Choose an editable Atlas-generated native Region.");
  }
  const generated = validateGeneratedRegionFlag(
    region.getFlag(MODULE_ID, GENERATED_REGION_FLAG));
  if (!generated || generated.kind !== "corridor") {
    throw new Error("Native movement cost applies only to Atlas-generated corridors.");
  }
  const savedPreset = validateRegionTravelFlag(
    region.getFlag(MODULE_ID, REGION_TRAVEL_PRESET_FLAG));
  if (!savedPreset || savedPreset.presetId !== expectedPresetId) {
    throw new Error("This corridor's travel preset changed. Open the action again.");
  }
  if (nativeCostBehaviors(region).length) {
    throw new Error("This Region already has a native Modify Movement Cost Behavior. Configure it manually in Foundry; Atlas will not overwrite or stack costs.");
  }
  const behavior = buildNativeMovementCostBehavior(savedPreset.presetId, movementAction);
  if (!confirmedCostSnapshot(behavior, expectedMultiplier, expectedCosts)) {
    throw new Error("The world preset costs changed since confirmation. Open the action again.");
  }
  if (typeof region.createEmbeddedDocuments !== "function") {
    throw new Error("This Foundry Region does not support embedded Region Behaviors.");
  }
  const created = await region.createEmbeddedDocuments("RegionBehavior", [behavior]);
  if (!created?.length) {
    throw new Error("Foundry did not create the native Region Behavior.");
  }
  return created[0];
}

/**
 * Deliberate one-Region color sync, separately confirmed by the GM.
 * Never change native shapes, elevation, visibility, Levels, or Behaviors.
 */
export async function applyGeneratedRegionPresetColor(scene, regionId, {
  expectedPresetId, expectedColor, expectedCurrentColor
} = {}) {
  checkScene(scene);
  const region = scene.regions?.get(regionId);
  if (!region?.canUserModify?.(game.user, "update")) {
    throw new Error("Choose an editable Atlas-generated native Region.");
  }
  const generated = validateGeneratedRegionFlag(
    region.getFlag(MODULE_ID, GENERATED_REGION_FLAG));
  if (generated?.kind !== "corridor") {
    throw new Error("Only generated corridors can receive a surface preset color.");
  }
  const association = validateRegionTravelFlag(
    region.getFlag(MODULE_ID, REGION_TRAVEL_PRESET_FLAG));
  if (!association || association.presetId !== expectedPresetId) {
    throw new Error("The corridor preset changed since color confirmation.");
  }
  const preset = requireExistingPreset(association.presetId);
  if (preset.color !== expectedColor) {
    throw new Error("The world preset color changed since confirmation.");
  }
  if ((region.color ?? null) !== expectedCurrentColor) {
    throw new Error("The Region color was manually changed since confirmation.");
  }
  if (region.color === preset.color) return false;
  await region.update({ color: preset.color });
  return true;
}


/**
 * Refresh an existing Atlas-authored native cost in place. Unlike creating a
 * second corridor or adding a second Behavior, this preserves the Region ID,
 * its shapes/Levels/color/visibility, all unrelated Behaviors and the Behavior
 * document ID. Manual or disabled cost Behaviors must be edited in Foundry.
 */
export async function updateGeneratedRegionMovementCost(scene, regionId, {
  expectedPresetId, expectedBehaviorId, expectedPreviousCosts,
  expectedMultiplier = null, expectedCosts = null, movementAction = null
} = {}) {
  checkScene(scene);
  const region = scene.regions?.get(regionId);
  if (!region?.canUserModify?.(game.user, "update")) {
    throw new Error("Choose an editable Atlas-generated native Region.");
  }
  const generated = validateGeneratedRegionFlag(
    region.getFlag(MODULE_ID, GENERATED_REGION_FLAG));
  if (generated?.kind !== "corridor") {
    throw new Error("Only Atlas-generated corridors can refresh their native movement cost.");
  }
  const savedPreset = validateRegionTravelFlag(
    region.getFlag(MODULE_ID, REGION_TRAVEL_PRESET_FLAG));
  if (!savedPreset || savedPreset.presetId !== expectedPresetId) {
    throw new Error("This corridor's travel preset changed. Open the action again.");
  }
  const native = nativeCostSummary(region);
  if (!editableManagedNativeCost(native) ||
      native.behaviorId !== expectedBehaviorId) {
    throw new Error("The native cost was manually edited, disabled, replaced or duplicated. Atlas will not overwrite it; review it in Foundry.");
  }
  const previous = native.detail.schemaVersion === 1
    ? { [native.detail.action]: native.detail.multiplier }
    : native.detail.movementCosts;
  if (!sameMovementCosts(previous, expectedPreviousCosts)) {
    throw new Error("The native cost changed since confirmation. Open the action again.");
  }
  const behavior = nativeCostBehaviors(region)[0];
  if (!behavior?.canUserModify?.(game.user, "update") ||
      typeof region.updateEmbeddedDocuments !== "function") {
    throw new Error("This native Region Behavior is not editable.");
  }
  const replacement = buildNativeMovementCostBehavior(savedPreset.presetId, movementAction);
  if (!confirmedCostSnapshot(replacement, expectedMultiplier, expectedCosts)) {
    throw new Error("The world preset costs changed since confirmation. Open the action again.");
  }
  const nextFlag = replacement.flags[MODULE_ID].nativeMovementCost;
  const selected = nextFlag.schemaVersion === 1
    ? { [nextFlag.action]: nextFlag.multiplier } : nextFlag.movementCosts;
  // Foundry document updates merge native maps. Explicit neutral ×1 values
  // disable former Atlas-authored modes that are not in the new preset.
  // They must not retain the old non-neutral cost as a hidden override.
  const difficulties = { ...selected };
  for (const mode of Object.keys(previous)) {
    if (!Object.hasOwn(difficulties, mode)) difficulties[mode] = 1;
  }
  const updated = await region.updateEmbeddedDocuments("RegionBehavior", [{
    _id: behavior.id,
    "system.difficulties": difficulties,
    ["flags." + MODULE_ID + ".nativeMovementCost"]: nextFlag
  }]);
  if (!updated?.length) throw new Error("Foundry did not update the native cost Behavior.");
  const after = nativeCostSummary(region);
  if (!after.managed || after.behaviorId !== behavior.id ||
      !sameMovementCosts(after.detail?.schemaVersion === 1
        ? { [after.detail.action]: after.detail.multiplier }
        : after.detail?.movementCosts, selected) ||
      !after.actualCosts ||
      Object.entries(difficulties).some(([mode, cost]) =>
        (after.actualCosts[mode] ?? 1) !== cost)) {
    throw new Error("Foundry did not retain the refreshed native costs exactly. Review this Behavior in Foundry; no other Region was changed.");
  }
  return updated[0];
}
