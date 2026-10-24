/**
 * v0.2.16: conservative opt-in adapter for Foundry v14's native
 * "Modify Movement Cost" Region Behavior.
 *
 * The world preset mode (Land/Air/Water) is descriptive. The GM must choose an
 * actual movement action registered by the active system, and the native
 * behavior model validates the exact cost before any document is written.
 */
import { MODULE_ID } from "./atlas-storage.js";
import { TRAVEL_PRESET_SETTING, validateTravelPresets } from "./travel-preset-model.js";

export const NATIVE_MOVEMENT_COST_TYPE = "modifyMovementCost";
export const ATLAS_MOVEMENT_COST_FLAG = "nativeMovementCost";
export const ATLAS_MOVEMENT_COST_SCHEMA_VERSION = 1;

function nativeBehaviorClass(config = globalThis.CONFIG) {
  return config?.RegionBehavior?.dataModels?.[NATIVE_MOVEMENT_COST_TYPE] ?? null;
}

/**
 * Native Region cost slots are not the same thing as selectable Token actions.
 * An action can have a fixed terrain cost (terrainAction: null), or derive its
 * terrain cost from another action. Neither can be authored independently.
 *
 * Some systems also expose action descriptors that their Region Behavior schema
 * does not retain. Probe the actual DataModel with a harmless, non-default cost:
 * no RegionDocument or game setting is modified by this read-only check.
 */
function isDirectMovementAction(id, descriptor) {
  return /^[A-Za-z0-9_.-]{1,128}$/.test(id) &&
    descriptor && typeof descriptor === "object" &&
    descriptor.deriveTerrainDifficulty == null &&
    descriptor.terrainAction === undefined &&
    descriptor.measure !== false &&
    !descriptor.teleport;
}

function nativeModelRetainsCost(Type, action) {
  if (!Type?.schema?.fields?.difficulties) return false;
  try {
    const probe = 1.25;
    const model = new Type({ difficulties: { [action]: probe } });
    if (model.validate({ strict: true }) === false) return false;
    const retained = model.toObject(true)?.difficulties?.[action];
    return Number.isFinite(retained) && Math.abs(retained - probe) < 1e-8;
  } catch {
    return false;
  }
}

/** Only actions that the current system can store as native Region costs. */
export function availableMovementActions(config = globalThis.CONFIG) {
  const actions = config?.Token?.movement?.actions;
  const Type = nativeBehaviorClass(config);
  if (!Type || !actions || typeof actions !== "object") return [];
  return Object.entries(actions)
    .filter(([id, descriptor]) =>
      isDirectMovementAction(id, descriptor) && nativeModelRetainsCost(Type, id))
    .map(([id, descriptor]) => ({
      id, label: String(descriptor.label || id)
    }));
}

/** Modes visible to Tokens but not independently editable as Region costs. */
export function unavailableMovementActions(config = globalThis.CONFIG) {
  const actions = config?.Token?.movement?.actions;
  if (!actions || typeof actions !== "object") return [];
  const usable = new Set(availableMovementActions(config).map(action => action.id));
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

/**
 * Read-only preview using the *exact requested preset value*, not a sample
 * value (the action availability probe only checks independent editability).
 * Foundry v14 can normalize fractional movement costs (for example 1.10 -> 1).
 * The preview is safe to call while rendering the Scene Atlas form.
 */
export function previewNativeMovementCost(presetId, action, config = globalThis.CONFIG) {
  const preset = readPreset(presetId);
  const Type = nativeBehaviorClass(config);
  if (!Type) {
    return { ok: false, message: "The active Foundry system does not expose the native Modify Movement Cost Behavior." };
  }
  if (!Type.schema?.fields?.difficulties) {
    return { ok: false, message: "The native movement-cost Behavior schema is unavailable or unsupported. Nothing was saved." };
  }
  const selection = availableMovementActions(config).find(entry => entry.id === action);
  if (!selection) {
    return { ok: false, message: "That movement action cannot store an independent native Region cost in this game system. Choose a listed action, or create a corridor without a native cost Behavior." };
  }
  let nativeData;
  try {
    const model = new Type({ difficulties: { [action]: preset.movementCostMultiplier } });
    if (model.validate({ strict: true }) === false) {
      throw new Error("The native Behavior rejected this difficulty.");
    }
    nativeData = model.toObject(true);
  } catch (error) {
    return { ok: false, message: "Foundry rejected the selected native movement cost: " + error.message };
  }
  const effective = nativeData?.difficulties?.[action];
  if (!Number.isFinite(effective)) {
    return { ok: false, message: "Foundry did not retain a native movement cost for this action. Nothing was saved." };
  }
  if (Math.abs(effective - preset.movementCostMultiplier) > 1e-8) {
    const formatted = n => "×" + n.toFixed(2);
    return { ok: false, requested: preset.movementCostMultiplier, effective,
      message: "Foundry changes " + preset.name + "'s requested cost " +
        formatted(preset.movementCostMultiplier) + " to " + formatted(effective) +
        " for this movement action. Edit the global preset to a native-compatible value (in this v14 World, try multiples of 0.25). Atlas will not round it silently; nothing was saved." };
  }
  return { ok: true, nativeData, preset, actionLabel: selection.label };
}

/** No system-independent approximation: fail closed on an unfamiliar schema. */
export function buildNativeMovementCostBehavior(presetId, action,
  config = globalThis.CONFIG) {
  const result = previewNativeMovementCost(presetId, action, config);
  if (!result.ok) throw new Error(result.message);
  const { preset, nativeData, actionLabel } = result;
  const translated = globalThis.game?.i18n?.localize?.(actionLabel) || actionLabel;
  return {
    name: "Atlas · " + preset.name + " (×" + preset.movementCostMultiplier +
      "; " + translated + ")",
    type: NATIVE_MOVEMENT_COST_TYPE,
    system: nativeData,
    disabled: false,
    flags: { [MODULE_ID]: {
      [ATLAS_MOVEMENT_COST_FLAG]: {
        schemaVersion: ATLAS_MOVEMENT_COST_SCHEMA_VERSION,
        presetId: preset.id, action, multiplier: preset.movementCostMultiplier
      }
    } }
  };
}

export function nativeCostBehaviors(region) {
  return Array.from(region?.behaviors?.values?.() ?? region?.behaviors ?? [])
    .filter(behavior => behavior?.type === NATIVE_MOVEMENT_COST_TYPE);
}

export function nativeCostSummary(region) {
  const existing = nativeCostBehaviors(region);
  if (!existing.length) return { existing: false, managed: false, detail: null };
  const behavior = existing[0];
  const flag = behavior.getFlag?.(MODULE_ID, ATLAS_MOVEMENT_COST_FLAG) ??
    behavior.flags?.[MODULE_ID]?.[ATLAS_MOVEMENT_COST_FLAG];
  const managed = flag?.schemaVersion === ATLAS_MOVEMENT_COST_SCHEMA_VERSION &&
    typeof flag?.presetId === "string" && typeof flag?.action === "string" &&
    Number.isFinite(flag?.multiplier);
  return {
    existing: true, managed,
    detail: managed ? flag : null,
    count: existing.length
  };
}
