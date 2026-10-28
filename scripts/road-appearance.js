/** GM-facing presentation settings. These never influence graph geometry or Region rules. */
export const ROAD_APPEARANCE_SETTING = "roadAppearanceDefaults";
export const ROAD_LINE_PATTERNS = ["solid", "dashed", "dotted"];
export const ROAD_LABEL_VISIBILITY = ["off", "hover", "always"];
export const ROAD_APPEARANCE_MODES = ["land", "air", "water"];
export const ROAD_APPEARANCE_CATALOG_VERSION = 2;
export const ROAD_CURVE_SETTING = "roadCurvature";
export const ROAD_CURVE_PRESETS = Object.freeze({
  off: 0, gentle: 0.35, moderate: 0.7, strong: 1
});
export const DEFAULT_ROAD_CURVE_PRESET = "strong";

export const DEFAULT_ROAD_APPEARANCE = Object.freeze({
  color: "#35c9ef",
  borderColor: "#1c1c1c",
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
const APPEARANCE_FIELDS = [...LEGACY_FIELDS, "textColor", "borderColor"];

function validateAppearanceFields(value, fields) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Road appearance must be an object.");
  }
  if (fields.includes("borderColor") && !Object.hasOwn(value,"borderColor"))
    value = { ...value, borderColor: DEFAULT_ROAD_APPEARANCE.borderColor };
  if (Object.keys(value).length !== fields.length ||
      Object.keys(value).some(key => !fields.includes(key))) {
    throw new Error("Road appearance needs exactly " + fields.join(", ") + ".");
  }
  for (const key of ["color", ...(fields.includes("textColor") ? ["textColor"] : []),
    ...(fields.includes("borderColor") ? ["borderColor"] : [])]) {
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
    ...(fields.includes("textColor") ? { textColor: value.textColor.toLowerCase() } : {}),
    ...(fields.includes("borderColor") ? { borderColor: value.borderColor.toLowerCase() } : {}) };
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
    const migrated = { ...legacy, textColor: DEFAULT_ROAD_APPEARANCE.textColor,
      borderColor: DEFAULT_ROAD_APPEARANCE.borderColor };
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

/** Shared World preference; changing it never writes to a Scene or road. */
export function readRoadCurvePreset() {
  const value = globalThis.game?.settings?.get?.("fvtt-atlas-navigation", ROAD_CURVE_SETTING);
  return typeof value === "string" && Object.hasOwn(ROAD_CURVE_PRESETS, value)
    ? value : DEFAULT_ROAD_CURVE_PRESET;
}

/**
 * A sampled, bounded cardinal spline through the original points. The path is
 * used for presentation, hit tests and label placement ONLY; graph distances,
 * Region shapes and editable nodes continue to use the original polyline.
 * Two-point roads stay straight because their intended bend is undefined.
 */
export function smoothRoadPath(points, preset = DEFAULT_ROAD_CURVE_PRESET,
  { before = null, after = null } = {}) {
  if (!Object.hasOwn(ROAD_CURVE_PRESETS, preset)) {
    throw new Error("Choose a supported World road curvature preset.");
  }
  const strength = ROAD_CURVE_PRESETS[preset];
  if (!Array.isArray(points) || points.length < 2 || strength === 0 ||
      (points.length === 2 && !before && !after)) return points;
  const result = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const previous = points[i - 1] ?? before ?? a;
    const next = points[i + 2] ?? after ?? b;
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    if (distance < 1e-8) { result.push(b); continue; }
    const priorLength = Math.hypot(a.x - previous.x, a.y - previous.y);
    const followingLength = Math.hypot(next.x - b.x, next.y - b.y);
    const startRatio = i === 0 && !before ? 1 : distance / (priorLength + distance);
    const endRatio = i === points.length - 2 && !after ? 1 : distance / (distance + followingLength);
    const c1 = { x: a.x + (b.x - previous.x) * startRatio * strength / 3,
      y: a.y + (b.y - previous.y) * startRatio * strength / 3 };
    const c2 = { x: b.x - (next.x - a.x) * endRatio * strength / 3,
      y: b.y - (next.y - a.y) * endRatio * strength / 3 };
    // Adapt to map-space segment length while bounding graphics work.
    const steps = Math.min(48, Math.max(4, Math.ceil(distance / 18)));
    for (let step = 1; step < steps; step++) {
      const t = step / steps, u = 1 - t;
      result.push({
        x: u * u * u * a.x + 3 * u * u * t * c1.x +
          3 * u * t * t * c2.x + t * t * t * b.x,
        y: u * u * u * a.y + 3 * u * u * t * c1.y +
          3 * u * t * t * c2.y + t * t * t * b.y
      });
    }
    result.push(b);
  }
  return result;
}

/**
 * Look across named-road section boundaries only at unambiguous degree-two
 * continuations. Checkpoint-created subdivisions then receive the same smooth
 * tangent as an unsplit road; branches do not guess a preferred outgoing arm.
 */
export function roadCurveNeighbors(atlas) {
  const nodes = new Map(atlas.nodes.map(node => [node.id, node]));
  const incident = new Map();
  for (const segment of atlas.segments) {
    if (typeof segment.roadId !== "string" || !segment.roadId) continue;
    for (const side of ["from", "to"]) {
      const key = JSON.stringify([segment.roadId, segment[side]]);
      if (!incident.has(key)) incident.set(key, []);
      incident.get(key).push({ segment, side });
    }
  }
  const neighbors = new Map();
  for (const segment of atlas.segments) {
    const pair = {};
    if (typeof segment.roadId !== "string" || !segment.roadId) {
      neighbors.set(segment.id, pair);
      continue;
    }
    for (const [side, label] of [["from", "before"], ["to", "after"]]) {
      const key = JSON.stringify([segment.roadId, segment[side]]);
      const connections = incident.get(key);
      if (connections?.length !== 2) continue;
      const other = connections.find(item => item.segment.id !== segment.id);
      if (!other) continue;
      pair[label] = other.side === "from"
        ? other.segment.via[0] ?? nodes.get(other.segment.to)
        : other.segment.via.at(-1) ?? nodes.get(other.segment.from);
    }
    neighbors.set(segment.id, pair);
  }
  return neighbors;
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
