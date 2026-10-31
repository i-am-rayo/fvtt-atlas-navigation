/**
 * World-shared travel presets. Catalog v3 adds native Region highlight colors
 * to the v2 movement-action costs. Region association flags remain v1.
 * Old catalogs are upgraded only in memory until an explicit GM edit.
 */
export const TRAVEL_PRESET_SETTING = "corridorTravelPresets";
export const REGION_TRAVEL_PRESET_FLAG = "travelPreset";
export const TRAVEL_PRESET_SCHEMA_VERSION = 1; // Region association (stable)
export const TRAVEL_PRESET_CATALOG_VERSION = 3;
export const TRAVEL_TYPES = Object.freeze(["land", "air", "water"]);
export const MAX_TRAVEL_PRESETS = 120;
export const MAX_PRESET_MOVEMENT_ACTIONS = 24;

const DEFAULT_COLORS = Object.freeze({
  "land-stone": "#9CA3AF", "land-gravel": "#B99A72",
  "land-dirt": "#AD7955", "land-forest": "#4F9068",
  "air-clear": "#86BDEB", "air-turbulent": "#8976BF",
  "water-calm": "#47AFC0", "water-rough": "#3F72AF",
  "water-river": "#3E9CBA", "water-lake": "#58B7B5",
  "water-sea": "#4385BD", "water-ocean": "#285B97",
  "water-canal": "#6AADB5", "water-marsh": "#5A8776"
});
const MODE_COLORS = Object.freeze({
  land: "#AD9779", air: "#869AC8", water: "#4B9FBF"
});

/** Legacy/new preset fallback colors are deterministic and never rewrite Regions. */
export function defaultTravelPresetColor(id, mode) {
  const variant=/^(water-(?:river|lake|sea|ocean|canal|marsh))-(calm|turbulent|rough)$/.exec(id);
  if(variant){
    const base=DEFAULT_COLORS[variant[1]];
    const factor={calm:1.12,turbulent:.94,rough:.76}[variant[2]];
    return "#"+[1,3,5].map(index=>Math.min(255,
      Math.round(Number.parseInt(base.slice(index,index+2),16)*factor))
      .toString(16).padStart(2,"0")).join("").toUpperCase();
  }
  return DEFAULT_COLORS[id] ?? MODE_COLORS[mode] ?? "#888888";
}

export function validateTravelPresetColor(color) {
  if (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new Error("Preset Region color must be a six-digit hex color (#RRGGBB).");
  }
  return color.toUpperCase();
}

const defaults = [
  ["land-stone", "land", "Stone Road"],
  ["land-gravel", "land", "Gravel Road"],
  ["land-dirt", "land", "Dirt Road"],
  ["land-forest", "land", "Forest Trail"],
  ["air-clear", "air", "Clear Skies"],
  ["air-turbulent", "air", "Turbulent Air"],
  ["water-calm", "water", "Calm Waters"],
  ["water-rough", "water", "Rough Seas"],
  ["water-river", "water", "River"],
  ["water-lake", "water", "Lake"],
  ["water-sea", "water", "Sea"],
  ["water-ocean", "water", "Ocean"],
  ["water-canal", "water", "Canal"],
  ["water-marsh", "water", "Marsh / Swamp"],
  ...["river","lake","sea","ocean","canal","marsh"].flatMap(body=>
    ["calm","turbulent","rough"].map(condition=>[
      `water-${body}-${condition}`,"water",
      `${condition[0].toUpperCase()+condition.slice(1)} ${body==="marsh"?"Marsh / Swamp":body[0].toUpperCase()+body.slice(1)}`
    ]))
];

const NEUTRAL_MOVEMENT_COSTS=Object.freeze({walk:1,fly:1,swim:1,burrow:1});
const BUILTIN_WATER_IDS=new Set(defaults.filter(([,mode])=>mode==="water")
  .map(([id])=>id));

/** Explicit opt-in addition for existing Worlds; never resets custom presets. */
export function addMissingRecommendedWaterPresets(current, modifiers = null) {
  const catalog=validateTravelPresets(current);
  const existing=new Set(catalog.presets.map(p=>p.id));
  const names=new Set(catalog.presets.map(p=>p.mode+":"+p.name.toLocaleLowerCase()));
  const additions=defaultTravelPresets().presets.filter(p=>p.mode==="water" &&
    !existing.has(p.id) && !names.has(p.mode+":"+p.name.toLocaleLowerCase()))
    .map(p=>{
      const match=/^water-(river|lake|sea|ocean|canal|marsh)-(calm|turbulent|rough)$/.exec(p.id);
      if(!match || !modifiers)return p;
      const base=catalog.presets.find(item=>item.id==="water-"+match[1]);
      const costs={...(base?.movementCosts??NEUTRAL_MOVEMENT_COSTS)};
      for(const [action,delta] of Object.entries(modifiers[match[2]]??{})){
        if(!/^[A-Za-z0-9_.-]{1,128}$/.test(action) ||
            !Number.isFinite(delta) || delta<0 || delta>5)
          throw new Error("Water condition modifiers must be between +0.00 and +5.00.");
        const value=(costs[action]??1)+delta;
        if(value>10)throw new Error("Water condition cost exceeds the maximum ×10.00.");
        costs[action]=Math.round(value*100)/100;
      }
      return {...p,movementCosts:costs};
    });
  return validateTravelPresets({schemaVersion:TRAVEL_PRESET_CATALOG_VERSION,
    presets:[...catalog.presets,...additions]});
}

export function defaultTravelPresets() {
  return { schemaVersion: TRAVEL_PRESET_CATALOG_VERSION,
    presets: defaults.map(([id, mode, name]) => ({
      id, mode, name, movementCostMultiplier: 1,
      movementCosts:mode==="water"?{...NEUTRAL_MOVEMENT_COSTS}:null,
      color: defaultTravelPresetColor(id, mode)
    })) };
}

export function validateTravelPresetId(id) {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    throw new Error("Travel preset IDs must use 1–128 letters, digits, hyphens or underscores.");
  }
  return id;
}

export function validateMovementCosts(costs) {
  if (costs === null) return null; // v1 legacy single-action cost
  if (!costs || typeof costs !== "object" || Array.isArray(costs) ||
      Object.getPrototypeOf(costs) !== Object.prototype ||
      Object.keys(costs).length > MAX_PRESET_MOVEMENT_ACTIONS) {
    throw new Error("Movement costs must be a plain map of at most 24 selected actions.");
  }
  const result = {};
  for (const [action, cost] of Object.entries(costs)) {
    if (!/^[A-Za-z0-9_.-]{1,128}$/.test(action) ||
        !Number.isFinite(cost) || cost < 0.1 || cost > 10) {
      throw new Error("Each movement action requires a cost between ×0.10 and ×10.00.");
    }
    Object.defineProperty(result, action, {value: cost, enumerable: true,
      writable: true, configurable: true});
  }
  return result; // absent action means No override, never prohibit movement
}

export function validateTravelPresets(value) {
  if (value == null) return defaultTravelPresets();
  const legacy = value?.schemaVersion === 1;
  const oldCatalog = value?.schemaVersion === 1 || value?.schemaVersion === 2;
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).some(k => !["schemaVersion", "presets"].includes(k)) ||
      (!oldCatalog && value.schemaVersion !== TRAVEL_PRESET_CATALOG_VERSION) ||
      !Array.isArray(value.presets) || value.presets.length > MAX_TRAVEL_PRESETS) {
    throw new Error("Atlas travel presets have unsupported data; no presets were changed.");
  }
  const ids = new Set(), names = new Set();
  const presets = value.presets.map((preset, index) => {
    if (!preset || typeof preset !== "object" || Array.isArray(preset) ||
        Object.keys(preset).some(k => !["id", "mode", "name", "movementCostMultiplier",
          ...(legacy ? [] : ["movementCosts"]),
          ...(oldCatalog ? [] : ["color"])].includes(k))) {
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
      movementCostMultiplier: preset.movementCostMultiplier,
      movementCosts:legacy?null:validateMovementCosts(
        preset.movementCosts==null && BUILTIN_WATER_IDS.has(id) &&
        preset.movementCostMultiplier===1 ? {...NEUTRAL_MOVEMENT_COSTS} :
          (preset.movementCosts??null)),
      color: validateTravelPresetColor(oldCatalog
        ? defaultTravelPresetColor(id, preset.mode)
        : (Object.hasOwn(preset, "color") ? preset.color :
          defaultTravelPresetColor(id, preset.mode))) };
  });
  return { schemaVersion: TRAVEL_PRESET_CATALOG_VERSION, presets };
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

export function presetCostSummary(preset) {
  if (!preset) return "No preset";
  if (preset.movementCosts === null || preset.movementCosts === undefined) {
    return "Legacy cost ×" + preset.movementCostMultiplier.toFixed(2);
  }
  const entries = Object.entries(preset.movementCosts);
  return entries.length ? entries.map(([action, cost]) =>
    action + " ×" + cost.toFixed(2)).join(", ") : "No movement-cost overrides";
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
