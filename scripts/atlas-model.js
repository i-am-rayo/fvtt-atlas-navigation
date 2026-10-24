import { validateRoadAppearance, validateLegacyRoadAppearance,
  DEFAULT_ROAD_APPEARANCE } from "./road-appearance.js";
import { validateCheckpointAppearance } from "./checkpoint-appearance.js";

/**
 * Pure atlas data validation. No Foundry globals are used in this module.
 *
 * Schemas are strict and versioned; v1/v2 remain readable. Unknown fields are rejected so an older
 * editor cannot silently delete newer data when saving a Scene flag.
 */
export const ATLAS_SCHEMA_VERSION = 3;
export const CHECKPOINT_ATLAS_SCHEMA_VERSION = 4;
export const TRAVEL_ATLAS_SCHEMA_VERSION = 5;
export const APPEARANCE_ATLAS_SCHEMA_VERSION = 6;
export const TEXT_APPEARANCE_ATLAS_SCHEMA_VERSION = 7;
export const CHECKPOINT_APPEARANCE_ATLAS_SCHEMA_VERSION = 8;
export const IMAGE_ATLAS_SCHEMA_VERSION = 2;
export const LEGACY_ATLAS_SCHEMA_VERSION = 1;
const MAX_NODES = 10000;
const MAX_SEGMENTS = 20000;
const MAX_VIA_POINTS = 1000;
const MAX_CHECKPOINTS = 5000;

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
  const withCheckpointAppearance = data.schemaVersion === CHECKPOINT_APPEARANCE_ATLAS_SCHEMA_VERSION;
  const withTextAppearance = data.schemaVersion === TEXT_APPEARANCE_ATLAS_SCHEMA_VERSION ||
    withCheckpointAppearance;
  const withAppearance = data.schemaVersion === APPEARANCE_ATLAS_SCHEMA_VERSION || withTextAppearance;
  const withTravel = data.schemaVersion === TRAVEL_ATLAS_SCHEMA_VERSION || withAppearance;
  const withCheckpoints = data.schemaVersion === CHECKPOINT_ATLAS_SCHEMA_VERSION || withTravel;
  const current = data.schemaVersion === ATLAS_SCHEMA_VERSION || withCheckpoints;
  if (!legacy && !imageV2 && !current) {
    fail("unsupported schemaVersion " + String(data.schemaVersion));
  }
  fields(data, legacy
    ? ["schemaVersion", "revision", "enabled", "calibration", "nodes", "segments"]
    : ["schemaVersion", "coordinateSpace", "revision", "enabled", "calibration", "nodes", "segments", ...(current ? ["roads"] : []), ...(withCheckpoints ? ["checkpoints"] : [])], "root");
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
      fields(r, withAppearance ? ["id", "name", "travelPresetId", "appearance"] :
        withTravel ? ["id", "name", "travelPresetId"] : ["id", "name"], "road");
      const roadId = id(r.id, "road ID");
      if (roadIds.has(roadId)) fail("duplicate road ID " + roadId);
      roadIds.add(roadId);
      if (typeof r.name !== "string" || !r.name.trim() || r.name.length > 120) {
        fail("road " + roadId + " has invalid name");
      }
      const travelPresetId = r.travelPresetId ?? null;
      if (withTravel && travelPresetId !== null &&
          (typeof travelPresetId !== "string" ||
           !/^[A-Za-z0-9_-]{1,128}$/.test(travelPresetId))) {
        fail("road " + roadId + " has invalid travel preset ID");
      }
      if (withAppearance && !Object.hasOwn(r, "appearance")) {
        fail("road " + roadId + " is missing appearance data");
      }
      const appearance = withAppearance && r.appearance !== null
        ? (withTextAppearance ? validateRoadAppearance(r.appearance) :
          validateLegacyRoadAppearance(r.appearance)) : null;
      roads.push({ id: roadId, name: r.name.trim(),
        ...(withTravel ? { travelPresetId } : {}),
        ...(withAppearance ? { appearance } : {}) });
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

  const checkpoints = [];
  if (withCheckpoints) {
    if (!Array.isArray(data.checkpoints) || data.checkpoints.length > MAX_CHECKPOINTS) {
      fail("checkpoints must be an array of at most " + MAX_CHECKPOINTS);
    }
    const checkpointIds = new Set();
    const locations = new Set();
    const attachedRoadNodes = new Set(segments.flatMap(s => [
      s.roadId + "/" + s.from, s.roadId + "/" + s.to
    ]));
    for (const [index, value] of data.checkpoints.entries()) {
      const c = record(value, "checkpoints[" + index + "]");
      fields(c, withCheckpointAppearance
        ? ["id", "roadId", "nodeId", "name", "elevationMeters", "appearance"]
        : ["id", "roadId", "nodeId", "name", "elevationMeters"], "checkpoint");
      const checkpointId = id(c.id, "checkpoint ID");
      if (checkpointIds.has(checkpointId)) fail("duplicate checkpoint ID " + checkpointId);
      checkpointIds.add(checkpointId);
      const roadId = id(c.roadId, "checkpoint roadId");
      const nodeId = id(c.nodeId, "checkpoint nodeId");
      if (!roadIds.has(roadId) || !attachedRoadNodes.has(roadId + "/" + nodeId)) {
        fail("checkpoint " + checkpointId + " must attach to a node on its named road");
      }
      const locationKey = roadId + "/" + nodeId;
      if (locations.has(locationKey)) fail("duplicate checkpoint on road node " + locationKey);
      locations.add(locationKey);
      if (typeof c.name !== "string" || !c.name.trim() || c.name.length > 120) {
        fail("checkpoint " + checkpointId + " has an invalid name");
      }
      if (c.elevationMeters !== null &&
          (!Number.isFinite(c.elevationMeters) || Math.abs(c.elevationMeters) > 10000000)) {
        fail("checkpoint " + checkpointId + " needs a finite elevation in meters, or null");
      }
      if (withCheckpointAppearance && !Object.hasOwn(c, "appearance")) {
        fail("checkpoint " + checkpointId + " is missing appearance data");
      }
      checkpoints.push({ id: checkpointId, roadId, nodeId,
        name: c.name.trim(), elevationMeters: c.elevationMeters,
        ...(withCheckpointAppearance ? {
          appearance: c.appearance === null ? null : validateCheckpointAppearance(c.appearance)
        } : {}) });
    }
  }

  return {
    schemaVersion: data.schemaVersion,
    ...(legacy ? {} : { coordinateSpace: "image" }),
    revision: data.revision,
    enabled: data.enabled,
    calibration,
    nodes,
    segments,
    ...(current ? { roads } : {}),
    ...(withCheckpoints ? { checkpoints } : {})
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

/** Upgrade a v3 road Scene only when the GM explicitly adds a checkpoint. */
export function upgradeAtlasCheckpoints(atlas) {
  const old = validateAtlas(atlas);
  if (old.schemaVersion === CHECKPOINT_ATLAS_SCHEMA_VERSION ||
      old.schemaVersion === TRAVEL_ATLAS_SCHEMA_VERSION ||
      old.schemaVersion === APPEARANCE_ATLAS_SCHEMA_VERSION ||
      old.schemaVersion === TEXT_APPEARANCE_ATLAS_SCHEMA_VERSION ||
      old.schemaVersion === CHECKPOINT_APPEARANCE_ATLAS_SCHEMA_VERSION) return old;
  if (old.schemaVersion !== ATLAS_SCHEMA_VERSION) {
    throw new Error("Organize named roads before adding checkpoints.");
  }
  return validateAtlas({ ...old, schemaVersion: CHECKPOINT_ATLAS_SCHEMA_VERSION, checkpoints: [] });
}

/**
 * Explicit v0.2.15 upgrade on the GM's first named-road preset assignment.
 * A v3 Scene gains an empty checkpoints array; v4 checkpoint IDs are preserved.
 * Every road keeps its ID, name, graph ownership and original geometry.
 */
export function upgradeAtlasTravelPresets(atlas) {
  const old = validateAtlas(atlas);
  if (old.schemaVersion === TRAVEL_ATLAS_SCHEMA_VERSION ||
      old.schemaVersion === APPEARANCE_ATLAS_SCHEMA_VERSION ||
      old.schemaVersion === TEXT_APPEARANCE_ATLAS_SCHEMA_VERSION ||
      old.schemaVersion === CHECKPOINT_APPEARANCE_ATLAS_SCHEMA_VERSION) return old;
  const withCheckpoints = old.schemaVersion === ATLAS_SCHEMA_VERSION
    ? upgradeAtlasCheckpoints(old) : old;
  if (withCheckpoints.schemaVersion !== CHECKPOINT_ATLAS_SCHEMA_VERSION) {
    throw new Error("Organize named roads before assigning travel presets.");
  }
  return validateAtlas({
    ...withCheckpoints,
    schemaVersion: TRAVEL_ATLAS_SCHEMA_VERSION,
    roads: withCheckpoints.roads.map(road => ({ ...road, travelPresetId: null }))
  });
}

/** Explicit GM-authored per-road display customization, never on Scene read. */
export function upgradeAtlasRoadAppearance(atlas) {
  const old = validateAtlas(atlas);
  if (old.schemaVersion === APPEARANCE_ATLAS_SCHEMA_VERSION ||
      old.schemaVersion === TEXT_APPEARANCE_ATLAS_SCHEMA_VERSION ||
      old.schemaVersion === CHECKPOINT_APPEARANCE_ATLAS_SCHEMA_VERSION) return old;
  const current = upgradeAtlasTravelPresets(old);
  return validateAtlas({
    ...current,
    schemaVersion: APPEARANCE_ATLAS_SCHEMA_VERSION,
    roads: current.roads.map(road => ({ ...road, appearance: null }))
  });
}

/** First post-v0.2.20 style save adds label color without rewriting old Scenes on load. */
export function upgradeAtlasRoadTextAppearance(atlas) {
  const current = upgradeAtlasRoadAppearance(atlas);
  if (current.schemaVersion === TEXT_APPEARANCE_ATLAS_SCHEMA_VERSION ||
      current.schemaVersion === CHECKPOINT_APPEARANCE_ATLAS_SCHEMA_VERSION) return current;
  return validateAtlas({ ...current, schemaVersion: TEXT_APPEARANCE_ATLAS_SCHEMA_VERSION,
    roads: current.roads.map(road => ({ ...road,
      appearance: road.appearance
        ? { ...road.appearance, textColor: DEFAULT_ROAD_APPEARANCE.textColor }
        : null })) });
}

/** First explicitly saved checkpoint style adds null overrides; no Scene read changes flags. */
export function upgradeAtlasCheckpointAppearance(atlas) {
  const current = upgradeAtlasRoadTextAppearance(atlas);
  if (current.schemaVersion === CHECKPOINT_APPEARANCE_ATLAS_SCHEMA_VERSION) return current;
  return validateAtlas({
    ...current, schemaVersion: CHECKPOINT_APPEARANCE_ATLAS_SCHEMA_VERSION,
    checkpoints: current.checkpoints.map(checkpoint => ({ ...checkpoint, appearance: null }))
  });
}
