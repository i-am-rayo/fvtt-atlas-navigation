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

/** The current system, not Land/Air/Water names, defines native actions. */
export function availableMovementActions(config = globalThis.CONFIG) {
  const actions = config?.Token?.movement?.actions;
  if (!nativeBehaviorClass(config) || !actions || typeof actions !== "object") return [];
  return Object.entries(actions)
    .filter(([id, descriptor]) => /^[A-Za-z0-9_.-]{1,128}$/.test(id) &&
      descriptor && typeof descriptor === "object" &&
      // The native Behavior UI does not configure derived difficulties.
      typeof descriptor.deriveTerrainDifficulty !== "function" &&
      !descriptor.terrainAction)
    .map(([id, descriptor]) => ({
      id, label: String(descriptor.label || id)
    }));
}

export function readPreset(presetId) {
  const list = validateTravelPresets(globalThis.game?.settings?.get(
    MODULE_ID, TRAVEL_PRESET_SETTING));
  const preset = list.presets.find(p => p.id === presetId);
  if (!preset) throw new Error("The corridor travel preset is missing from Atlas world settings.");
  return preset;
}

/** No system-independent approximation: fail closed on an unfamiliar schema. */
export function buildNativeMovementCostBehavior(presetId, action,
  config = globalThis.CONFIG) {
  const preset = readPreset(presetId);
  const Type = nativeBehaviorClass(config);
  if (!Type) throw new Error("The active Foundry system does not expose the native Modify Movement Cost Behavior.");
  if (!availableMovementActions(config).some(entry => entry.id === action)) {
    throw new Error("Choose an available non-derived movement action for this game system.");
  }
  // Foundry v14 supplies a system-dependent difficulties SchemaField.
  // Check its existence and validate the constructed model before persisting.
  if (!Type.schema?.fields?.difficulties) {
    throw new Error("The native movement-cost Behavior schema is unavailable or unsupported. Nothing was saved.");
  }
  let nativeData;
  try {
    const model = new Type({ difficulties: { [action]: preset.movementCostMultiplier } });
    if (model.validate({ strict: true }) === false) {
      throw new Error("The native Behavior rejected this difficulty.");
    }
    nativeData = model.toObject(true);
  } catch (error) {
    throw new Error("Foundry rejected the selected native movement cost: " + error.message);
  }
  const effective = nativeData?.difficulties?.[action];
  if (!Number.isFinite(effective) ||
      Math.abs(effective - preset.movementCostMultiplier) > 1e-8) {
    throw new Error("Foundry did not retain the selected cost multiplier for this movement action. Nothing was saved.");
  }
  const label = availableMovementActions(config).find(a => a.id === action).label;
  const translated = globalThis.game?.i18n?.localize?.(label) || label;
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
