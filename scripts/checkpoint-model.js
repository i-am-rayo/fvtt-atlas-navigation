import { validateAtlas, upgradeAtlasCheckpoints, upgradeAtlasCheckpointAppearance,
  upgradeAtlasIndependentCheckpoints } from "./atlas-model.js";
import { validateCheckpointAppearance } from "./checkpoint-appearance.js";
import { applyRoadGeometryEdit } from "./road-model.js";

const MAX_NAME = 120;

/** Eligible owning roads for a node shared by roads, or an edge on one road. */
export function checkpointCandidateRoads(atlas, candidate) {
  const sections = candidate?.kind === "node"
    ? atlas.segments.filter(segment => segment.from === candidate.nodeId ||
        segment.to === candidate.nodeId)
    : candidate?.kind === "edge"
      ? atlas.segments.filter(segment => segment.id === candidate.segmentId) : [];
  const roadIds = new Set(sections.map(segment => segment.roadId));
  return atlas.roads.filter(road => roadIds.has(road.id));
}

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

/**
 * Create a standalone, Node-anchored Checkpoint without inventing a Road.
 * `at` is already converted to image-local Scene coordinates by the caller.
 * The caller owns permission checking and a revision-guarded Scene flag write.
 */
export function addIndependentCheckpoint(atlas, {
  at, name, elevationMeters = null, idFactory
}) {
  if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.y)) {
    throw new Error("Choose a finite point on the Scene image for this checkpoint.");
  }
  const current = upgradeAtlasIndependentCheckpoints(atlas);
  const nodeId = uniqueId(new Set(current.nodes.map(node => node.id)), idFactory);
  const checkpointId = uniqueId(new Set(current.checkpoints.map(c => c.id)), idFactory);
  return validateAtlas({ ...current,
    nodes: [...current.nodes, { id: nodeId, x: at.x, y: at.y }],
    checkpoints: [...current.checkpoints, {
      id: checkpointId, roadId: null, nodeId, name: cleanName(name),
      elevationMeters: elevation(elevationMeters), appearance: null, playerVisible: false
    }]
  });
}

/**
 * Detach the legacy Road ownership hint without removing a topology edge.
 * This is permitted only after the Node exists in v10; Road connectivity
 * remains derived from actual segments and is never edited by this action.
 */
export function detachCheckpointRoadHint(atlas, { checkpointId }) {
  const current = upgradeAtlasIndependentCheckpoints(atlas);
  if (!current.checkpoints.some(c => c.id === checkpointId)) {
    throw new Error("Checkpoint no longer exists in this Scene.");
  }
  return validateAtlas({ ...current, checkpoints: current.checkpoints.map(c =>
    c.id === checkpointId ? { ...c, roadId: null } : c) });
}

/**
 * Connect an isolated Checkpoint Node to an existing Road endpoint using one
 * explicit new segment. Neither Node ID changes, and no native Regions move.
 * This conservative operation refuses already-connected Checkpoints: broader
 * Road splitting/branching needs a separate geometric preview and approval.
 */
export function connectIndependentCheckpoint(atlas, {
  checkpointId, roadId, roadNodeId, idFactory
}) {
  const current = upgradeAtlasIndependentCheckpoints(atlas);
  const checkpoint = current.checkpoints.find(c => c.id === checkpointId);
  if (!checkpoint) throw new Error("Checkpoint no longer exists in this Scene.");
  if (!current.roads.some(road => road.id === roadId)) {
    throw new Error("Choose an existing Road for this connection.");
  }
  const point = current.nodes.find(node => node.id === checkpoint.nodeId);
  const roadNode = current.nodes.find(node => node.id === roadNodeId);
  if (!point || !roadNode || point.id === roadNode.id) {
    throw new Error("Choose a distinct saved Road endpoint.");
  }
  const incidents = current.segments.filter(segment =>
    segment.from === point.id || segment.to === point.id);
  if (incidents.length) {
    throw new Error("This Checkpoint already connects to the Road graph. Review its existing links first.");
  }
  if (!current.segments.some(segment => segment.roadId === roadId &&
      (segment.from === roadNodeId || segment.to === roadNodeId))) {
    throw new Error("The selected endpoint is not on the chosen Road.");
  }
  if (Math.hypot(point.x - roadNode.x, point.y - roadNode.y) <= 0) {
    throw new Error("Coincident Nodes require a separately reviewed merge, not a zero-length Road.");
  }
  const segmentId = uniqueId(new Set(current.segments.map(s => s.id)), idFactory);
  return validateAtlas({ ...current,
    checkpoints: current.checkpoints.map(c => c.id === checkpointId
      ? { ...c, roadId } : c),
    segments: [...current.segments, { id: segmentId, roadId,
      from: roadNodeId, to: point.id, via: [], bidirectional: true }]
  });
}

/** Detach only an explicitly selected terminal link, retaining the Checkpoint. */
export function disconnectIndependentCheckpoint(atlas, { checkpointId, segmentId }) {
  const current = validateAtlas(atlas);
  if (current.schemaVersion < 10) {
    throw new Error("Upgrade independent Checkpoint topology before disconnecting a Road.");
  }
  const checkpoint = current.checkpoints.find(c => c.id === checkpointId);
  if (!checkpoint) throw new Error("Checkpoint no longer exists in this Scene.");
  const incidents = current.segments.filter(segment =>
    segment.from === checkpoint.nodeId || segment.to === checkpoint.nodeId);
  if (incidents.length !== 1 || incidents[0].id !== segmentId) {
    throw new Error("Only a single explicit terminal Road link can be safely detached here.");
  }
  if (checkpoint.roadId !== null && checkpoint.roadId !== incidents[0].roadId) {
    throw new Error("Checkpoint Road ownership is ambiguous; review before detaching.");
  }
  return validateAtlas({ ...current, segments: current.segments.filter(s => s.id !== segmentId),
    checkpoints: current.checkpoints.map(c => c.id === checkpointId
      ? { ...c, roadId: null } : c) });
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
  return current.checkpoints.filter(c => scope === "scene" || allowed.has(c.roadId))
    .map(c => ({
      ...c, roadName: c.roadId === null ? "Independent checkpoint" : names.get(c.roadId),
      x: nodes.get(c.nodeId).x, y: nodes.get(c.nodeId).y
    }));
}
