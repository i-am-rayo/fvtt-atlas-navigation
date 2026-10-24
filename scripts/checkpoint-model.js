import { validateAtlas, upgradeAtlasCheckpoints, upgradeAtlasCheckpointAppearance } from "./atlas-model.js";
import { validateCheckpointAppearance } from "./checkpoint-appearance.js";
import { applyRoadGeometryEdit } from "./road-model.js";

const MAX_NAME = 120;

function cleanName(name) {
  if (typeof name !== "string" || !name.trim() || name.length > MAX_NAME) {
    throw new Error("Checkpoint name must contain 1–120 characters.");
  }
  return name.trim();
}

function elevation(value) {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) ||
      Math.abs(value) > 10000000) {
    throw new Error("Checkpoint elevation must be a finite number of meters, or empty.");
  }
  return value;
}

function uniqueId(existing, factory) {
  if (typeof factory !== "function") throw new Error("A checkpoint ID generator is required.");
  for (let i = 0; i < 20; i++) {
    const next = factory();
    if (typeof next === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(next) &&
        !existing.has(next)) {
      existing.add(next);
      return next;
    }
  }
  throw new Error("Unable to allocate a unique checkpoint identifier.");
}

/**
 * A checkpoint is optional semantic metadata on a stable road graph node.
 * If placed on an edge, split that named road in the SAME Scene-flag update.
 * It does not join crossings, affect native Regions or change Grid measurement.
 */
export function addRoadCheckpoint(atlas, {
  roadId, candidate, name, elevationMeters = null, idFactory
}) {
  let current = upgradeAtlasCheckpoints(atlas);
  if (!current.roads.some(r => r.id === roadId)) {
    throw new Error("Choose a named road for this checkpoint.");
  }
  let nodeId;
  if (candidate?.kind === "node") {
    nodeId = candidate.nodeId;
    if (!current.segments.some(s => s.roadId === roadId &&
        (s.from === nodeId || s.to === nodeId))) {
      throw new Error("The chosen graph point is not on the selected road.");
    }
  } else if (candidate?.kind === "edge") {
    const segment = current.segments.find(s => s.id === candidate.segmentId);
    if (!segment || segment.roadId !== roadId) {
      throw new Error("The chosen road section no longer belongs to that road.");
    }
    const nodeIds = new Set(current.nodes.map(n => n.id));
    const segmentIds = new Set(current.segments.map(s => s.id));
    nodeId = uniqueId(nodeIds, idFactory);
    current = applyRoadGeometryEdit(current, {
      roadId,
      operation: {
        kind: "create-junction", segmentId: candidate.segmentId,
        edgeIndex: candidate.edgeIndex, atVertex: candidate.atVertex === true,
        x: candidate.x, y: candidate.y, newNodeId: nodeId,
        newSegmentId: uniqueId(segmentIds, idFactory)
      }
    });
  } else {
    throw new Error("Click a saved road point or a point on its centerline.");
  }
  if (current.checkpoints.some(c => c.roadId === roadId && c.nodeId === nodeId)) {
    throw new Error("This road already has a checkpoint at that graph point.");
  }
  const checkpointId = uniqueId(
    new Set(current.checkpoints.map(c => c.id)), idFactory);
  return validateAtlas({
    ...current,
    checkpoints: [...current.checkpoints, {
      id: checkpointId, roadId, nodeId,
      name: cleanName(name), elevationMeters: elevation(elevationMeters),
      ...(current.schemaVersion >= 8 ? { appearance: null } : {}),
      ...(current.schemaVersion >= 9 ? { playerVisible: false } : {})
    }]
  });
}

/** Explicit style update without touching names, elevation, graph or native Regions. */
export function editCheckpointAppearance(atlas, { checkpointId, appearance }) {
  const previous = validateAtlas(atlas);
  if (!previous.checkpoints?.some(c => c.id === checkpointId)) {
    throw new Error("Checkpoint no longer exists in this Scene.");
  }
  if (appearance === null && previous.schemaVersion < 8) return previous;
  const value = appearance === null ? null : validateCheckpointAppearance(appearance);
  const current = upgradeAtlasCheckpointAppearance(previous);
  return validateAtlas({
    ...current, checkpoints: current.checkpoints.map(c =>
      c.id === checkpointId ? { ...c, appearance: value } : c)
  });
}

export function editRoadCheckpoint(atlas, { checkpointId, name, elevationMeters }) {
  const current = validateAtlas(atlas);
  if (current.schemaVersion < 4) throw new Error("No checkpoints are configured.");
  if (!current.checkpoints.some(c => c.id === checkpointId)) {
    throw new Error("Checkpoint no longer exists in this Scene.");
  }
  return validateAtlas({
    ...current,
    checkpoints: current.checkpoints.map(c => c.id === checkpointId ?
      { ...c, name: cleanName(name), elevationMeters: elevation(elevationMeters) } : c)
  });
}

export function removeRoadCheckpoint(atlas, { checkpointId }) {
  const current = validateAtlas(atlas);
  if (current.schemaVersion < 4 ||
      !current.checkpoints.some(c => c.id === checkpointId)) {
    throw new Error("Checkpoint no longer exists in this Scene.");
  }
  // Do not collapse/delete the graph node; it may serve the road topology.
  return validateAtlas({
    ...current, checkpoints: current.checkpoints.filter(c => c.id !== checkpointId)
  });
}

/** Read-only, bounded by the UI; no unfiltered Scene-sized markup. */
export function listRoadCheckpoints(atlas, { roadId = null, scope = "scene" } = {}) {
  const current = validateAtlas(atlas);
  if (current.schemaVersion < 4) return [];
  if (!["selected", "connected", "scene"].includes(scope)) {
    throw new Error("Unknown checkpoint filter.");
  }
  if (scope !== "scene" && !current.roads.some(r => r.id === roadId)) return [];
  const allowed = new Set(scope === "scene" ? current.roads.map(r => r.id) : [roadId]);
  if (scope === "connected") {
    const ownedNodes = new Set(current.segments.filter(s => s.roadId === roadId)
      .flatMap(s => [s.from, s.to]));
    for (const s of current.segments) {
      if (ownedNodes.has(s.from) || ownedNodes.has(s.to)) allowed.add(s.roadId);
    }
  }
  const names = new Map(current.roads.map(r => [r.id, r.name]));
  const nodes = new Map(current.nodes.map(n => [n.id, n]));
  return current.checkpoints.filter(c => allowed.has(c.roadId))
    .map(c => ({
      ...c, roadName: names.get(c.roadId),
      x: nodes.get(c.nodeId).x, y: nodes.get(c.nodeId).y
    }));
}
