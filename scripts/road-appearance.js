/** GM-facing presentation settings. These never influence graph geometry or Region rules. */
export const ROAD_APPEARANCE_SETTING = "roadAppearanceDefaults";
export const ROAD_LINE_PATTERNS = ["solid", "dashed", "dotted"];
export const ROAD_LABEL_VISIBILITY = ["off", "hover", "always"];
export const ROAD_APPEARANCE_MODES = ["land", "air", "water"];
export const ROAD_APPEARANCE_CATALOG_VERSION = 2;

export const DEFAULT_ROAD_APPEARANCE = Object.freeze({
  color: "#35c9ef",
  width: 4,
  opacity: 0.9,
  pattern: "solid",
  labelVisibility: "off",
  textColor: "#ffffff"
});

export const DEFAULT_WORLD_ROAD_APPEARANCE = Object.freeze({
  schemaVersion: ROAD_APPEARANCE_CATALOG_VERSION,
  profiles: {
    land: { ...DEFAULT_ROAD_APPEARANCE },
    air: { ...DEFAULT_ROAD_APPEARANCE, color: "#b18cff" },
    water: { ...DEFAULT_ROAD_APPEARANCE, color: "#279cdf" }
  }
});

const LEGACY_FIELDS = ["color", "width", "opacity", "pattern", "labelVisibility"];
const APPEARANCE_FIELDS = [...LEGACY_FIELDS, "textColor"];

function validateAppearanceFields(value, fields) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Road appearance must be an object.");
  }
  if (Object.keys(value).length !== fields.length ||
      Object.keys(value).some(key => !fields.includes(key))) {
    throw new Error("Road appearance needs exactly " + fields.join(", ") + ".");
  }
  for (const key of ["color", ...(fields.includes("textColor") ? ["textColor"] : [])]) {
    if (typeof value[key] !== "string" || !/^#[\da-fA-F]{6}$/.test(value[key])) {
      throw new Error("Road " + (key === "color" ? "line" : "text") +
        " color must be a six-digit hex color.");
    }
  }
  if (!Number.isFinite(value.width) || value.width < 1 || value.width > 16) {
    throw new Error("Road line width must be between 1 and 16 pixels.");
  }
  if (!Number.isFinite(value.opacity) || value.opacity < 0.1 || value.opacity > 1) {
    throw new Error("Road opacity must be between 0.10 and 1.00.");
  }
  if (!ROAD_LINE_PATTERNS.includes(value.pattern) ||
      !ROAD_LABEL_VISIBILITY.includes(value.labelVisibility)) {
    throw new Error("Choose a supported road line pattern and label visibility.");
  }
  return { ...value, color: value.color.toLowerCase(),
    ...(fields.includes("textColor") ? { textColor: value.textColor.toLowerCase() } : {}) };
}

/** No silently cleaned values: a wrong setting must be fixed before being written. */
export function validateRoadAppearance(value) {
  return validateAppearanceFields(value, APPEARANCE_FIELDS);
}

export function validateLegacyRoadAppearance(value) {
  return validateAppearanceFields(value, LEGACY_FIELDS);
}

/** v0.2.20 flat World setting is accepted in memory only, never rewritten on read. */
export function validateWorldRoadAppearance(value) {
  if (!Object.hasOwn(value ?? {}, "schemaVersion")) {
    const legacy = validateLegacyRoadAppearance(value);
    const migrated = { ...legacy, textColor: DEFAULT_ROAD_APPEARANCE.textColor };
    return { schemaVersion: ROAD_APPEARANCE_CATALOG_VERSION,
      profiles: Object.fromEntries(ROAD_APPEARANCE_MODES.map(mode =>
        [mode, { ...migrated }])) };
  }
  if (value.schemaVersion !== ROAD_APPEARANCE_CATALOG_VERSION ||
      Object.keys(value).length !== 2 || !Object.hasOwn(value, "profiles") ||
      !value.profiles || Array.isArray(value.profiles) ||
      Object.keys(value.profiles).length !== ROAD_APPEARANCE_MODES.length ||
      Object.keys(value.profiles).some(mode => !ROAD_APPEARANCE_MODES.includes(mode))) {
    throw new Error("Expected exactly one Land, Air and Water road appearance profile.");
  }
  return { schemaVersion: ROAD_APPEARANCE_CATALOG_VERSION,
    profiles: Object.fromEntries(ROAD_APPEARANCE_MODES.map(mode =>
      [mode, validateRoadAppearance(value.profiles[mode])])) };
}

export function readWorldRoadAppearance() {
  const saved = globalThis.game?.settings?.get?.("fvtt-atlas-navigation", ROAD_APPEARANCE_SETTING);
  return validateWorldRoadAppearance(saved ?? DEFAULT_WORLD_ROAD_APPEARANCE);
}

export function roadAppearanceMode(road, presets = []) {
  const selected = presets.find(preset => preset.id === road?.travelPresetId);
  return ROAD_APPEARANCE_MODES.includes(selected?.mode) ? selected.mode : "land";
}

export function resolveRoadAppearance(road,
  worldDefaults = DEFAULT_WORLD_ROAD_APPEARANCE, mode = "land") {
  const catalog = validateWorldRoadAppearance(worldDefaults);
  const appearance = road?.appearance ?? catalog.profiles[mode];
  // Existing Scene schema v6 road overrides have no textColor. They inherit
  // the World profile's label color until the GM explicitly saves an update.
  if (appearance && !Object.hasOwn(appearance, "textColor")) {
    return validateRoadAppearance({ ...validateLegacyRoadAppearance(appearance),
      textColor: catalog.profiles[mode].textColor });
  }
  return validateRoadAppearance(appearance);
}

/** Return line spans along a polyline, with dash lengths continuous across bends. */
export function roadStrokeSpans(points, pattern, width) {
  if (!Array.isArray(points) || points.length < 2) return [];
  if (pattern === "solid") return [points];
  if (!ROAD_LINE_PATTERNS.includes(pattern)) throw new Error("Invalid road line pattern.");
  const on = pattern === "dotted" ? Math.max(1, width * 0.3) : Math.max(4, width * 3);
  const off = pattern === "dotted" ? Math.max(4, width * 2) : Math.max(3, width * 2);
  let drawing = true;
  let phase = 0;
  const spans = [];
  let current = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    if (!distance) continue;
    let part = 0;
    while (part < distance - 1e-8) {
      const interval = drawing ? on : off;
      const remaining = interval - phase;
      if (remaining < 1e-7) {
        phase = 0;
        drawing = !drawing;
        continue;
      }
      const step = Math.min(distance - part, remaining);
      const first = { x: a.x + (b.x - a.x) * part / distance,
        y: a.y + (b.y - a.y) * part / distance };
      const end = part + step;
      const last = { x: a.x + (b.x - a.x) * end / distance,
        y: a.y + (b.y - a.y) * end / distance };
      if (drawing) {
        if (!current.length) current.push(first);
        current.push(last);
      } else if (current.length) {
        spans.push(current);
        current = [];
      }
      part = end;
      phase += step;
      if (phase >= interval - 1e-7) {
        phase = 0;
        if (drawing && current.length) {
          spans.push(current);
          current = [];
        }
        drawing = !drawing;
      }
    }
  }
  if (current.length) spans.push(current);
  return spans;
}

/** Middle of a path by drawn distance, not midpoint between its endpoints. */
export function roadLabelPoint(points) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const lengths = points.slice(1).map((p, i) =>
    Math.hypot(p.x - points[i].x, p.y - points[i].y));
  const target = lengths.reduce((sum, n) => sum + n, 0) / 2;
  let cursor = 0;
  for (let i = 0; i < lengths.length; i++) {
    if (cursor + lengths[i] >= target && lengths[i]) {
      const t = (target - cursor) / lengths[i];
      return { x: points[i].x + (points[i + 1].x - points[i].x) * t,
        y: points[i].y + (points[i + 1].y - points[i].y) * t };
    }
    cursor += lengths[i];
  }
  return points.at(-1);
}
