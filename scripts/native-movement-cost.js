/**
 * Conservative Foundry v14 native Modify Movement Cost bridge.
 * Preset categories are descriptive; actual movement action IDs come only
 * from the active system. No native Region is touched while previewing.
 */
import { MODULE_ID } from "./atlas-storage.js";
import { TRAVEL_PRESET_SETTING, validateTravelPresets, presetCostSummary }
  from "./travel-preset-model.js";

export const NATIVE_MOVEMENT_COST_TYPE = "modifyMovementCost";
export const ATLAS_MOVEMENT_COST_FLAG = "nativeMovementCost";
export const ATLAS_MOVEMENT_COST_SCHEMA_VERSION = 2; // behavior provenance only

function nativeBehaviorClass(config = globalThis.CONFIG) {
  return config?.RegionBehavior?.dataModels?.[NATIVE_MOVEMENT_COST_TYPE] ?? null;
}

function isDirectMovementAction(id, descriptor) {
  return /^[A-Za-z0-9_.-]{1,128}$/.test(id) &&
    descriptor && typeof descriptor === "object" &&
    descriptor.deriveTerrainDifficulty == null &&
    descriptor.terrainAction === undefined &&
    descriptor.measure !== false && !descriptor.teleport;
}

function nativeModelRetainsCost(Type, action) {
  if (!Type?.schema?.fields?.difficulties) return false;
  try {
    const probe = 1.25;
    const model = new Type({ difficulties: { [action]: probe } });
    if (model.validate({ strict: true }) === false) return false;
    const retained = model.toObject(true)?.difficulties?.[action];
    return Number.isFinite(retained) && Math.abs(retained - probe) < 1e-8;
  } catch { return false; }
}

export function availableMovementActions(config = globalThis.CONFIG) {
  const actions = config?.Token?.movement?.actions;
  const Type = nativeBehaviorClass(config);
  if (!Type || !actions || typeof actions !== "object") return [];
  return Object.entries(actions)
    .filter(([id, descriptor]) =>
      isDirectMovementAction(id, descriptor) && nativeModelRetainsCost(Type, id))
    .map(([id, descriptor]) => ({ id, label: String(descriptor.label || id) }));
}

export function unavailableMovementActions(config = globalThis.CONFIG) {
  const actions = config?.Token?.movement?.actions;
  if (!actions || typeof actions !== "object") return [];
  const usable = new Set(availableMovementActions(config).map(a => a.id));
  return Object.entries(actions)
    .filter(([id, descriptor]) => /^[A-Za-z0-9_.-]{1,128}$/.test(id) &&
      descriptor && typeof descriptor === "object" && !usable.has(id))
    .map(([id, descriptor]) => ({ id, label: String(descriptor.label || id) }));
}

export function readPreset(presetId) {
  const list = validateTravelPresets(globalThis.game?.settings?.get(
    MODULE_ID, TRAVEL_PRESET_SETTING));
  const preset = list.presets.find(p => p.id === presetId);
  if (!preset) throw new Error("The corridor travel preset is missing from Atlas world settings.");
  return preset;
}

/** Canonical comparison independent of authoring field order. */
export function sameMovementCosts(left, right) {
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const keys = Object.keys(left).sort();
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every(key => Object.hasOwn(right, key) && right[key] === left[key]);
}

/** A single-action v1 cost remains readable; v2 costs are applied together. */
export function previewNativeMovementCost(presetId, action = null,
  config = globalThis.CONFIG) {
  const preset = readPreset(presetId);
  const Type = nativeBehaviorClass(config);
  if (!Type) {
    return { ok: false, message: "The active Foundry system does not expose the native Modify Movement Cost Behavior." };
  }
  if (!Type.schema?.fields?.difficulties) {
    return { ok: false, message: "The native movement-cost Behavior schema is unavailable or unsupported. Nothing was saved." };
  }
  const choices = availableMovementActions(config);
  let costs;
  if (preset.movementCosts === null) {
    if (!action || !choices.some(entry => entry.id === action)) {
      return { ok: false, message: "That movement action cannot store an independent native Region cost in this game system. Choose a listed action, or create a corridor without a native cost Behavior." };
    }
    costs = { [action]: preset.movementCostMultiplier };
  } else {
    if (action !== null) {
      return { ok: false, message: "This preset already chooses its movement actions. Apply the combined preset without choosing another action." };
    }
    costs = preset.movementCosts;
    if (!Object.keys(costs).length) {
      return { ok: false, message: "This preset has no movement-cost overrides. Select at least one movement action in Atlas Presets or create a metadata-only corridor." };
    }
    const unknown = Object.keys(costs).filter(id => !choices.some(entry => entry.id === id));
    if (unknown.length) {
      return { ok: false, message: "This system cannot independently author movement costs for: " +
        unknown.join(", ") + ". Edit the global preset or create a metadata-only corridor; nothing was saved." };
    }
  }
  // Foundry v14 DataModel initialization may mutate the source passed to it
  // while cleaning and adding default fields. Never let those transformations
  // change the GM's requested values or the later confirmation/provenance
  // snapshot; a separate input object is handed to the native model.
  const requestedCosts = { ...costs };
  let nativeData;
  try {
    const model = new Type({ difficulties: { ...requestedCosts } });
    if (model.validate({ strict: true }) === false) {
      throw new Error("The native Behavior rejected these difficulties.");
    }
    nativeData = model.toObject(true);
  } catch (error) {
    return { ok: false, message: "Foundry rejected the selected native movement costs: " + error.message };
  }
  for (const [id, requested] of Object.entries(requestedCosts)) {
    const effective = nativeData?.difficulties?.[id];
    if (!Number.isFinite(effective)) {
      return { ok: false, message: "Foundry did not retain a native movement cost for " +
        id + ". Nothing was saved." };
    }
    if (Math.abs(effective - requested) > 1e-8) {
      const formatted = n => "×" + n.toFixed(2);
      return { ok: false, requested, effective,
        message: "Foundry changes " + preset.name + "'s requested " + id +
          " cost " + formatted(requested) + " to " + formatted(effective) +
          ". Use a native-compatible value (in this v14 World, try multiples of 0.25). Atlas will not round it silently; nothing was saved." };
    }
  }
  return { ok: true, nativeData, preset, costs: requestedCosts,
    actionLabel: action ? choices.find(entry => entry.id === action)?.label : null };
}

/** No approximation or writes on incompatible Foundry systems. */
export function buildNativeMovementCostBehavior(presetId, action = null,
  config = globalThis.CONFIG) {
  const result = previewNativeMovementCost(presetId, action, config);
  if (!result.ok) throw new Error(result.message);
  const { preset, nativeData, actionLabel, costs } = result;
  const legacy = preset.movementCosts === null;
  const translated = legacy
    ? (globalThis.game?.i18n?.localize?.(actionLabel) || actionLabel)
    : presetCostSummary(preset);
  const provenance = legacy ? {
    schemaVersion: 1, presetId: preset.id,
    action, multiplier: preset.movementCostMultiplier
  } : {
    schemaVersion: ATLAS_MOVEMENT_COST_SCHEMA_VERSION,
    presetId: preset.id, movementCosts: { ...costs }
  };
  return {
    name: ("Atlas · " + preset.name + " (" +
      (legacy ? "×" + preset.movementCostMultiplier + "; " + translated : translated) +
      ")").slice(0, 180),
    type: NATIVE_MOVEMENT_COST_TYPE, system: nativeData, disabled: false,
    flags: { [MODULE_ID]: { [ATLAS_MOVEMENT_COST_FLAG]: provenance } }
  };
}

export function nativeCostBehaviors(region) {
  return Array.from(region?.behaviors?.values?.() ?? region?.behaviors ?? [])
    .filter(behavior => behavior?.type === NATIVE_MOVEMENT_COST_TYPE);
}

export function nativeCostSummary(region) {
  const existing = nativeCostBehaviors(region);
  if (!existing.length) return { existing: false, managed: false, detail: null, actualCosts: null };
  const behavior = existing[0];
  const flag = behavior.getFlag?.(MODULE_ID, ATLAS_MOVEMENT_COST_FLAG) ??
    behavior.flags?.[MODULE_ID]?.[ATLAS_MOVEMENT_COST_FLAG];
  const legacy = flag?.schemaVersion === 1 &&
    typeof flag?.presetId === "string" && typeof flag?.action === "string" &&
    Number.isFinite(flag?.multiplier);
  const multiple = flag?.schemaVersion === ATLAS_MOVEMENT_COST_SCHEMA_VERSION &&
    typeof flag?.presetId === "string" && flag?.movementCosts &&
    typeof flag.movementCosts === "object" && !Array.isArray(flag.movementCosts) &&
    Object.keys(flag.movementCosts).length > 0 &&
    Object.entries(flag.movementCosts).every(([id, cost]) =>
      /^[A-Za-z0-9_.-]{1,128}$/.test(id) && Number.isFinite(cost));
  const source = behavior.system?.difficulties ??
    behavior.toObject?.()?.system?.difficulties;
  const actualCosts = source && typeof source === "object"
    ? Object.fromEntries(Object.entries(source).filter(([id, value]) =>
      /^[A-Za-z0-9_.-]{1,128}$/.test(id) && Number.isFinite(value)))
    : null;
  return { existing: true, managed: !!(legacy || multiple),
    detail: legacy || multiple ? flag : null,
    count: existing.length, actualCosts };
}

/**
 * Read-only advisory. Provenance identifies which snapshot Atlas applied;
 * actual native values are checked separately for later GM edits.
 * No change here ever writes, re-applies, or stacks a Behavior.
 */
export function nativeCostPresetStatus(nativeCost, preset) {
  if (!preset) return { state: "unassigned", label: "No current travel preset" };
  if (!nativeCost?.existing) return { state: "not-applied", label: "Preset cost not applied" };
  if (!nativeCost.managed || nativeCost.count !== 1) {
    return { state: "manual", label: "Manual/multiple native costs — review in Foundry" };
  }
  const authored = nativeCost.detail;
  if (authored.presetId !== preset.id) {
    return { state: "different", label: "Native cost came from a different preset" };
  }
  const saved = authored.schemaVersion === 1
    ? { [authored.action]: authored.multiplier } : authored.movementCosts;
  // Foundry may include additional native action defaults. Compare only
  // the exact Atlas-authored actions rather than treating defaults as edits.
  if (!nativeCost.actualCosts ||
      Object.entries(saved).some(([id, value]) => nativeCost.actualCosts[id] !== value)) {
    return { state: "edited", label: "Native cost differs from applied Atlas values" };
  }
  const matches = preset.movementCosts === null
    ? authored.schemaVersion === 1 &&
      authored.multiplier === preset.movementCostMultiplier
    : authored.schemaVersion === ATLAS_MOVEMENT_COST_SCHEMA_VERSION &&
      sameMovementCosts(saved, preset.movementCosts);
  return matches
    ? { state: "current", label: "Native costs match world preset" }
    : { state: "outdated", label: "World preset changed since native cost was applied" };
}
