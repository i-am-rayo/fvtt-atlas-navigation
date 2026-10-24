/** GM-facing presentation settings. These never influence graph geometry or Region rules. */
export const ROAD_APPEARANCE_SETTING = "roadAppearanceDefaults";
export const ROAD_LINE_PATTERNS = ["solid", "dashed", "dotted"];
export const ROAD_LABEL_VISIBILITY = ["off", "hover", "always"];

export const DEFAULT_ROAD_APPEARANCE = Object.freeze({
  color: "#35c9ef",
  width: 4,
  opacity: 0.9,
  pattern: "solid",
  labelVisibility: "off"
});

export function readWorldRoadAppearance() {
  const saved = globalThis.game?.settings?.get?.("fvtt-atlas-navigation", ROAD_APPEARANCE_SETTING);
  return validateRoadAppearance(saved ?? DEFAULT_ROAD_APPEARANCE);
}

/** No silently cleaned values: a wrong setting must be fixed before being written. */
export function validateRoadAppearance(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Road appearance must be an object.");
  }
  if (Object.keys(value).some(key => !Object.hasOwn(DEFAULT_ROAD_APPEARANCE, key)) ||
      Object.keys(DEFAULT_ROAD_APPEARANCE).some(key => !Object.hasOwn(value, key))) {
    throw new Error("Road appearance needs exactly color, width, opacity, pattern and label visibility.");
  }
  if (typeof value.color !== "string" || !/^#[\da-fA-F]{6}$/.test(value.color)) {
    throw new Error("Road color must be a six-digit hex color.");
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
  return { color: value.color.toLowerCase(), width: value.width,
    opacity: value.opacity, pattern: value.pattern, labelVisibility: value.labelVisibility };
}

export function resolveRoadAppearance(road, worldDefaults = DEFAULT_ROAD_APPEARANCE) {
  return validateRoadAppearance(road?.appearance ?? worldDefaults);
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
