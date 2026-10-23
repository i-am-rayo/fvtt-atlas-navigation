/**
 * v0.2.15: World-shared Atlas travel presets.
 * These are descriptive movement-cost proposals, NOT native Region Behaviors.
 * All defaults are neutral (1.0); the GM chooses any system-specific costs.
 */
export const TRAVEL_PRESET_SETTING = "corridorTravelPresets";
export const REGION_TRAVEL_PRESET_FLAG = "travelPreset";
export const TRAVEL_PRESET_SCHEMA_VERSION = 1;
export const TRAVEL_TYPES = Object.freeze(["land", "air", "water"]);
export const MAX_TRAVEL_PRESETS = 120;

const defaults = [
  ["land-stone", "land", "Stone Road"],
  ["land-gravel", "land", "Gravel Road"],
  ["land-dirt", "land", "Dirt Road"],
  ["land-forest", "land", "Forest Trail"],
  ["air-clear", "air", "Clear Skies"],
  ["air-turbulent", "air", "Turbulent Air"],
  ["water-calm", "water", "Calm Waters"],
  ["water-rough", "water", "Rough Seas"]
];

export function defaultTravelPresets() {
  return { schemaVersion: TRAVEL_PRESET_SCHEMA_VERSION,
    presets: defaults.map(([id, mode, name]) =>
      ({ id, mode, name, movementCostMultiplier: 1 })) };
}

export function validateTravelPresetId(id) {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    throw new Error("Travel preset IDs must use 1–128 letters, digits, hyphens or underscores.");
  }
  return id;
}

export function validateTravelPresets(value) {
  if (value == null) return defaultTravelPresets();
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).some(k => !["schemaVersion", "presets"].includes(k)) ||
      value.schemaVersion !== TRAVEL_PRESET_SCHEMA_VERSION ||
      !Array.isArray(value.presets) || value.presets.length > MAX_TRAVEL_PRESETS) {
    throw new Error("Atlas travel presets have unsupported data; no presets were changed.");
  }
  const ids = new Set(), names = new Set();
  const presets = value.presets.map((preset, index) => {
    if (!preset || typeof preset !== "object" || Array.isArray(preset) ||
        Object.keys(preset).some(k => !["id", "mode", "name", "movementCostMultiplier"].includes(k))) {
      throw new Error("Invalid travel preset at index " + index + ".");
    }
    const id = validateTravelPresetId(preset.id);
    if (ids.has(id)) throw new Error("Duplicate travel preset ID.");
    ids.add(id);
    if (!TRAVEL_TYPES.includes(preset.mode) ||
        typeof preset.name !== "string" || !preset.name.trim() ||
        preset.name.length > 120 ||
        !Number.isFinite(preset.movementCostMultiplier) ||
        preset.movementCostMultiplier < 0.1 || preset.movementCostMultiplier > 10) {
      throw new Error("Travel presets require a Land/Air/Water type, name, and movement cost between 0.1 and 10.");
    }
    const name = preset.name.trim();
    const nameKey = preset.mode + ":" + name.toLocaleLowerCase();
    if (names.has(nameKey)) throw new Error("Travel preset names must be unique within each travel type.");
    names.add(nameKey);
    return { id, mode: preset.mode, name,
      movementCostMultiplier: preset.movementCostMultiplier };
  });
  return { schemaVersion: TRAVEL_PRESET_SCHEMA_VERSION, presets };
}

export function upsertTravelPreset(settings, preset) {
  const current = validateTravelPresets(settings);
  const id = validateTravelPresetId(preset.id);
  const next = current.presets.filter(p => p.id !== id);
  if (next.length >= MAX_TRAVEL_PRESETS) throw new Error("Atlas supports up to 120 travel presets.");
  return validateTravelPresets({ ...current, presets: [...next, preset] });
}

export function removeTravelPreset(settings, presetId) {
  const current = validateTravelPresets(settings);
  validateTravelPresetId(presetId);
  if (!current.presets.some(p => p.id === presetId)) throw new Error("This preset no longer exists.");
  return validateTravelPresets({
    ...current, presets: current.presets.filter(p => p.id !== presetId)
  });
}

export function validateRegionTravelFlag(value) {
  if (value == null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).some(k => !["schemaVersion", "presetId"].includes(k)) ||
      value.schemaVersion !== TRAVEL_PRESET_SCHEMA_VERSION) {
    throw new Error("Unsupported Region travel preset annotation.");
  }
  return { schemaVersion: TRAVEL_PRESET_SCHEMA_VERSION,
    presetId: validateTravelPresetId(value.presetId) };
}
