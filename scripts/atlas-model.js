/**
 * Pure atlas data validation. No Foundry globals are used in this module.
 *
 * Schemas are strict and versioned; v1/v2 remain readable. Unknown fields are rejected so an older
 * editor cannot silently delete newer data when saving a Scene flag.
 */
export const ATLAS_SCHEMA_VERSION = 3;
export const IMAGE_ATLAS_SCHEMA_VERSION = 2;
export const LEGACY_ATLAS_SCHEMA_VERSION = 1;
const MAX_NODES = 10000;
const MAX_SEGMENTS = 20000;
const MAX_VIA_POINTS = 1000;

function fail(message) {
  throw new Error("Atlas data: " + message);
}

function record(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(label + " must be an object");
  }
  return value;
}

function fields(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(label + " has unsupported field " + key);
  }
}

function id(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    fail(label + " must be an ID of 1-128 letters, digits, hyphens or underscores");
  }
  return value;
}

function point(value, label) {
  const p = record(value, label);
  fields(p, ["x", "y"], label);
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
    fail(label + " needs finite x and y coordinates");
  }
  return { x: p.x, y: p.y };
}

export function createEmptyAtlas() {
  return {
    schemaVersion: ATLAS_SCHEMA_VERSION,
    coordinateSpace: "image",
    revision: 0,
    enabled: false,
    calibration: null,
    nodes: [],
    segments: [],
    roads: []
  };
}

/** Euclidean Scene-pixel geometry for validation only; NOT native ruler distance. */
export function polylineLength(points) {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y
    );
  }
  return length;
}

export function validateAtlas(value) {
  if (value == null) return createEmptyAtlas();

  const data = record(value, "root");
  const legacy = data.schemaVersion === LEGACY_ATLAS_SCHEMA_VERSION;
  const imageV2 = data.schemaVersion === IMAGE_ATLAS_SCHEMA_VERSION;
  const current = data.schemaVersion === ATLAS_SCHEMA_VERSION;
  if (!legacy && !imageV2 && !current) {
    fail("unsupported schemaVersion " + String(data.schemaVersion));
  }
  fields(data, legacy
    ? ["schemaVersion", "revision", "enabled", "calibration", "nodes", "segments"]
    : ["schemaVersion", "coordinateSpace", "revision", "enabled", "calibration", "nodes", "segments", ...(current ? ["roads"] : [])], "root");
  if (!legacy && data.coordinateSpace !== "image") fail("coordinateSpace must be image");
  if (!Number.isSafeInteger(data.revision) || data.revision < 0) {
    fail("revision must be a nonnegative safe integer");
  }
  if (typeof data.enabled !== "boolean") fail("enabled must be boolean");

  let calibration = null;
  if (data.calibration != null) {
    const c = record(data.calibration, "calibration");
    fields(c, ["source", "unitsPerPixel", "unit"], "calibration");
    if (c.source !== "manual") fail("calibration source must be manual");
    if (!Number.isFinite(c.unitsPerPixel) || c.unitsPerPixel <= 0) {
      fail("calibration unitsPerPixel must be a positive finite number");
    }
    if (typeof c.unit !== "string" || !/^[A-Za-z]{1,12}$/.test(c.unit)) {
      fail("calibration unit must contain 1-12 letters");
    }
    calibration = {
      source: "manual",
      unitsPerPixel: c.unitsPerPixel,
      unit: c.unit
    };
  }

  const roads = [];
  const roadIds = new Set();
  if (current) {
    if (!Array.isArray(data.roads) || data.roads.length > MAX_SEGMENTS) {
      fail("roads must be an array of at most " + MAX_SEGMENTS);
    }
    for (const [index, value] of data.roads.entries()) {
      const r = record(value, "roads[" + index + "]");
      fields(r, ["id", "name"], "road");
      const roadId = id(r.id, "road ID");
      if (roadIds.has(roadId)) fail("duplicate road ID " + roadId);
      roadIds.add(roadId);
      if (typeof r.name !== "string" || !r.name.trim() || r.name.length > 120) {
        fail("road " + roadId + " has invalid name");
      }
      roads.push({ id: roadId, name: r.name.trim() });
    }
  }

  if (!Array.isArray(data.nodes) || data.nodes.length > MAX_NODES) {
    fail("nodes must be an array of at most " + MAX_NODES);
  }
  const nodes = [];
  const nodeIds = new Set();
  for (const [index, value] of data.nodes.entries()) {
    const n = record(value, "nodes[" + index + "]");
    fields(n, ["id", "x", "y"], "node");
    const nodeId = id(n.id, "node ID");
    if (nodeIds.has(nodeId)) fail("duplicate node ID " + nodeId);
    nodeIds.add(nodeId);
    nodes.push({ id: nodeId, ...point({ x: n.x, y: n.y }, "node coordinates") });
  }

  if (!Array.isArray(data.segments) || data.segments.length > MAX_SEGMENTS) {
    fail("segments must be an array of at most " + MAX_SEGMENTS);
  }
  const segments = [];
  const segmentIds = new Set();
  const byId = new Map(nodes.map(n => [n.id, n]));
  for (const [index, value] of data.segments.entries()) {
    const s = record(value, "segments[" + index + "]");
    fields(s, current
      ? ["id", "roadId", "from", "to", "via", "bidirectional"]
      : ["id", "from", "to", "via", "name", "bidirectional"], "segment");
    const segmentId = id(s.id, "segment ID");
    if (segmentIds.has(segmentId)) fail("duplicate segment ID " + segmentId);
    segmentIds.add(segmentId);
    const roadId = current ? id(s.roadId, "segment roadId") : null;
    if (current && !roadIds.has(roadId)) fail("segment " + segmentId + " references missing road " + roadId);
    const from = id(s.from, "segment from");
    const to = id(s.to, "segment to");
    if (from === to || !byId.has(from) || !byId.has(to)) {
      fail("segment " + segmentId + " has invalid endpoints");
    }
    if (!Array.isArray(s.via) || s.via.length > MAX_VIA_POINTS) {
      fail("segment " + segmentId + " has invalid via points");
    }
    const via = s.via.map((p, i) => point(p, "via[" + i + "]"));
    if (s.bidirectional !== true) fail("segment " + segmentId + " must be bidirectional");
    if (!current && s.name !== undefined && (typeof s.name !== "string" || s.name.length > 120)) {
      fail("segment " + segmentId + " has an invalid name");
    }
    const length = polylineLength([byId.get(from), ...via, byId.get(to)]);
    if (!Number.isFinite(length) || length <= 0) {
      fail("segment " + segmentId + " has zero or invalid length");
    }
    segments.push({ id: segmentId, ...(current ? { roadId } : { name: s.name ?? "" }),
      from, to, via, bidirectional: true });
  }

  return {
    schemaVersion: data.schemaVersion,
    ...(legacy ? {} : { coordinateSpace: "image" }),
    revision: data.revision,
    enabled: data.enabled,
    calibration,
    nodes,
    segments,
    ...(current ? { roads } : {})
  };
}

/**
 * Explicit migration from absolute canvas pixels (v1) to image-local pixels (v2).
 * The caller must confirm that legacy roads CURRENTLY line up with the Scene
 * background before using the current Scene rectangle origin. No guessing.
 */
export function anchorLegacyAtlas(atlas, origin) {
  const old = validateAtlas(atlas);
  if (old.schemaVersion !== LEGACY_ATLAS_SCHEMA_VERSION) return old;
  if (!Number.isFinite(origin?.x) || !Number.isFinite(origin?.y)) {
    throw new Error("A valid image origin is required to anchor legacy roads.");
  }
  const toLocal = p => ({ x: p.x - origin.x, y: p.y - origin.y });
  return validateAtlas({
    ...old,
    schemaVersion: IMAGE_ATLAS_SCHEMA_VERSION,
    coordinateSpace: "image",
    nodes: old.nodes.map(n => ({ id: n.id, ...toLocal(n) })),
    segments: old.segments.map(s => ({ ...s, via: s.via.map(toLocal) }))
  });
}

/**
 * Explicit lossless organizational upgrade from v2. Each old segment becomes
 * its own named road. No same-name guessing or silent logical merging.
 * A GM may merge chosen adjacent roads afterward, retaining every edge ID.
 */
export function upgradeAtlasRoadGroups(atlas) {
  const old = validateAtlas(atlas);
  if (old.schemaVersion === ATLAS_SCHEMA_VERSION) return old;
  if (old.schemaVersion !== IMAGE_ATLAS_SCHEMA_VERSION) {
    throw new Error("Anchor legacy roads to the image before organizing them.");
  }
  const roads = old.segments.map(s => ({ id: s.id, name: s.name || "Unnamed road" }));
  return validateAtlas({
    ...old,
    schemaVersion: ATLAS_SCHEMA_VERSION,
    roads,
    segments: old.segments.map(s => {
      const { name, ...edge } = s;
      return { ...edge, roadId: s.id };
    })
  });
}
