import { validateAtlas } from "./atlas-model.js";

const MAX_NAME = 120;
const SNAP_PIXELS = 14;

export function suggestRoadName(atlas) {
  const names = new Set((atlas.roads ?? atlas.segments).map(road => road.name));
  let number = 1;
  while (names.has(`Road ${number}`)) number++;
  return `Road ${number}`;
}

function cleanedName(name) {
  if (typeof name !== "string") throw new Error("Road name must be text.");
  const clean = name.trim();
  if (!clean || clean.length > MAX_NAME) throw new Error("Road name must contain 1–120 characters.");
  return clean;
}

function uniqueId(ids, idFactory) {
  for (let i = 0; i < 20; i++) {
    const value = idFactory();
    if (typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value) && !ids.has(value)) {
      ids.add(value);
      return value;
    }
  }
  throw new Error("Could not generate a unique road identifier.");
}

function project(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const squared = dx * dx + dy * dy;
  if (squared < 1) return null;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / squared));
  const position = { x: a.x + dx * t, y: a.y + dy * t };
  return {
    ...position, t,
    distance: Math.hypot(point.x - position.x, point.y - position.y),
    before: t * Math.sqrt(squared), after: (1 - t) * Math.sqrt(squared)
  };
}

/**
 * A road endpoint can join an existing stable node or split an existing road
 * at its nearest interior edge. Ordinary crossings never create a junction.
 * The projection and snap radius are in image-local Scene pixels for schema v2.
 */
export function findRoadSnap(atlas, position, snapPixels = SNAP_PIXELS, excludeNodeId = null, excluded = {}) {
  const current = validateAtlas(atlas);
  if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) return null;
  let nearestNode = null;
  let nodeDistance = snapPixels;
  const activeNodeIds = new Set(current.segments.flatMap(s => [s.from, s.to]));
  for (const node of current.nodes) {
    // Removed roads intentionally retain their records; never snap to an
    // orphaned/invisible node left behind by deletion.
    if (!activeNodeIds.has(node.id) || node.id === excludeNodeId ||
        excluded.nodeIds?.has(node.id)) continue;
    const distance = Math.hypot(position.x - node.x, position.y - node.y);
    if (distance <= nodeDistance) {
      nearestNode = node;
      nodeDistance = distance;
    }
  }
  if (nearestNode) return { kind: "node", nodeId: nearestNode.id, x: nearestNode.x, y: nearestNode.y };

  const nodes = new Map(current.nodes.map(n => [n.id, n]));
  let nearestEdge = null;
  let edgeDistance = snapPixels;
  for (const segment of current.segments) {
    if (excluded.segment?.(segment)) continue;
    const path = [nodes.get(segment.from), ...segment.via, nodes.get(segment.to)];
    for (let edgeIndex = 0; edgeIndex < path.length - 1; edgeIndex++) {
      const hit = project(position, path[edgeIndex], path[edgeIndex + 1]);
      if (!hit) continue;
      // A bend is not yet a graph node, but clicking exactly on it should
      // make a real junction without preserving a zero-length bend.
      let vertexIndex = null;
      if (hit.before < 1 && edgeIndex > 0) vertexIndex = edgeIndex;
      else if (hit.after < 1 && edgeIndex + 1 < path.length - 1) {
        vertexIndex = edgeIndex + 1;
      }
      const candidate = vertexIndex === null
        ? { kind: "edge", segmentId: segment.id, edgeIndex, x: hit.x, y: hit.y }
        : { kind: "edge", segmentId: segment.id, edgeIndex: vertexIndex,
            atVertex: true, x: path[vertexIndex].x, y: path[vertexIndex].y };
      const distance = Math.hypot(position.x - candidate.x, position.y - candidate.y);
      if ((vertexIndex === null && (hit.before < 1 || hit.after < 1)) ||
          distance > edgeDistance) continue;
      nearestEdge = candidate;
      edgeDistance = distance;
    }
  }
  return nearestEdge;
}

/**
 * A dragged junction can connect to another node or road interior, but never
 * to one of its own incident segments or directly adjacent endpoint. It is a
 * suggestion only: the GM must explicitly approve the connection.
 */
export function findJunctionAttachment(atlas, sourceNodeId, position, tolerance = SNAP_PIXELS) {
  const current = validateAtlas(atlas);
  if (current.schemaVersion < 3 || !current.nodes.some(node => node.id === sourceNodeId)) return null;
  const incident = current.segments.filter(s => s.from === sourceNodeId || s.to === sourceNodeId);
  if (!incident.length) return null;
  const neighborIds = new Set(incident.map(s => s.from === sourceNodeId ? s.to : s.from));
  return findRoadSnap(current, position, tolerance, sourceNodeId, {
    nodeIds: neighborIds,
    segment: s => s.from === sourceNodeId || s.to === sourceNodeId
  });
}

/** Names of existing logical roads meeting at a node or edge; no implicit merge. */
export function attachmentRoadNames(atlas, candidate) {
  const current = validateAtlas(atlas);
  if (current.schemaVersion < 3 || !candidate) return [];
  const segments = candidate.kind === "node"
    ? current.segments.filter(s => s.from === candidate.nodeId || s.to === candidate.nodeId)
    : current.segments.filter(s => s.id === candidate.segmentId);
  const ids = new Set(segments.map(s => s.roadId));
  return current.roads.filter(r => ids.has(r.id)).map(r => r.name);
}

function splitEdge(nodes, segments, candidate, nodeIds, segmentIds, idFactory) {
  const index = segments.findIndex(s => s.id === candidate.segmentId);
  if (index < 0) throw new Error("The selected road no longer exists.");
  const road = segments[index];
  const junctionId = uniqueId(nodeIds, idFactory);
  nodes.push({ id: junctionId, x: candidate.x, y: candidate.y });
  const firstVia = road.via.slice(0, candidate.atVertex ?
    candidate.edgeIndex - 1 : candidate.edgeIndex);
  const secondVia = road.via.slice(candidate.edgeIndex);
  segments[index] = { ...road, to: junctionId, via: firstVia };
  segments.push({
    ...road,
    id: uniqueId(segmentIds, idFactory),
    from: junctionId,
    via: secondVia
  });
  return junctionId;
}

/**
 * Return only navigable branching points. An endpoint (degree 1) or a
 * same-road pass-through subdivision (degree 2) is not a junction in the
 * GM's inspection list, even though it remains a real graph node.
 *
 * "connected" means one hop: roads sharing a node with the chosen road.
 * No crossings are inferred from overlapping geometry.
 */
export function listRoadJunctions(atlas, { roadId = null, scope = "scene" } = {}) {
  const current = validateAtlas(atlas);
  if (current.schemaVersion < 3) return [];
  if (!["selected", "connected", "scene"].includes(scope)) {
    throw new Error("Unknown road junction filter.");
  }
  if (scope !== "scene" && !current.roads.some(road => road.id === roadId)) {
    return [];
  }
  const incident = new Map();
  for (const segment of current.segments) {
    for (const id of [segment.from, segment.to]) {
      if (!incident.has(id)) incident.set(id, { degree: 0, roadIds: new Set() });
      const item = incident.get(id);
      item.degree++;
      item.roadIds.add(segment.roadId);
    }
  }
  const allowedRoads = new Set(scope === "scene" ? current.roads.map(r => r.id) : [roadId]);
  if (scope === "connected") {
    for (const item of incident.values()) {
      if (item.roadIds.has(roadId)) {
        for (const connectedId of item.roadIds) allowedRoads.add(connectedId);
      }
    }
  }
  return current.nodes.flatMap(node => {
    const item = incident.get(node.id);
    if (!item || (item.degree < 3 && item.roadIds.size < 2) ||
        ![...item.roadIds].some(id => allowedRoads.has(id))) return [];
    return [{
      id: node.id, x: node.x, y: node.y,
      degree: item.degree, roadIds: [...item.roadIds]
    }];
  });
}

export function addRoad(atlas, {
  points, name, idFactory, snapPixels = SNAP_PIXELS, snapEndpoints = [true, true]
}) {
  const current = validateAtlas(atlas);
  if (current.schemaVersion < 3) {
    throw new Error("Organize existing roads before creating new roads (see the Atlas tab).");
  }
  if (!Array.isArray(points) || points.length < 2 || points.length > 1002) {
    throw new Error("Add at least two road points (at most 1002).");
  }
  if (typeof idFactory !== "function") throw new Error("A road ID generator is required.");
  const path = points.map(point => ({ x: point?.x, y: point?.y }));
  if (path.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    throw new Error("Road coordinates must be finite Scene positions.");
  }
  for (let i = 1; i < path.length; i++) {
    if (Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y) < 1) {
      throw new Error("Each road point must be at least 1 Scene pixel from the previous point.");
    }
  }
  const roadIds = new Set(current.roads.map(r => r.id));
  const nodeIds = new Set(current.nodes.map(n => n.id));
  const segmentIds = new Set(current.segments.map(s => s.id));
  const nodes = current.nodes.map(n => ({ ...n }));
  const segments = current.segments.map(s => ({ ...s, via: s.via.map(p => ({ ...p })) }));
  const chooseEndpoint = (position, allowSnap, excludeId = null) => {
    const working = { ...current, nodes, segments };
    const candidate = allowSnap ? findRoadSnap(working, position, snapPixels, excludeId) : null;
    if (candidate?.kind === "node") return candidate.nodeId;
    if (candidate?.kind === "edge") {
      return splitEdge(nodes, segments, candidate, nodeIds, segmentIds, idFactory);
    }
    const id = uniqueId(nodeIds, idFactory);
    nodes.push({ id, x: position.x, y: position.y });
    return id;
  };

  const from = chooseEndpoint(path[0], snapEndpoints[0] !== false);
  const to = chooseEndpoint(path.at(-1), snapEndpoints[1] !== false, from);
  if (from === to) throw new Error("Road endpoints must be different junctions.");

  const roadId = uniqueId(roadIds, idFactory);
  const road = { id: roadId, name: cleanedName(name ?? suggestRoadName(current)),
    ...(current.schemaVersion >= 5 ? { travelPresetId: null } : {}),
    ...(current.schemaVersion >= 6 ? { appearance: null } : {}) };
  const segment = {
    id: uniqueId(segmentIds, idFactory), roadId,
    from, to, via: path.slice(1, -1), bidirectional: true
  };
  return validateAtlas({
    ...current, enabled: true, nodes,
    roads: [...current.roads, road], segments: [...segments, segment]
  });
}

export function reshapeRoad(atlas, { segmentId, via }) {
  const current = validateAtlas(atlas);
  if (current.schemaVersion < 3) {
    throw new Error("Organize existing roads before editing their shape.");
  }
  if (!Array.isArray(via) || via.length > 1000 ||
      via.some(point => !Number.isFinite(point?.x) || !Number.isFinite(point?.y))) {
    throw new Error("Road bends must be an array of at most 1000 finite points.");
  }
  if (!current.segments.some(s => s.id === segmentId)) {
    throw new Error("Road no longer exists in this Scene.");
  }
  return validateAtlas({
    ...current,
    segments: current.segments.map(s =>
      s.id === segmentId ? { ...s, via: via.map(p => ({ x: p.x, y: p.y })) } : s)
  });
}


export function renameRoad(atlas, { roadId, segmentId, name }) {
  const current = validateAtlas(atlas);
  if (current.schemaVersion < 3) {
    // Legacy compatibility: road list still provides rename before conversion.
    if (!current.segments.some(s => s.id === segmentId)) throw new Error("Road no longer exists in this Scene.");
    return validateAtlas({
      ...current,
      segments: current.segments.map(s =>
        s.id === segmentId ? { ...s, name: cleanedName(name) } : s)
    });
  }
  if (!current.roads.some(r => r.id === roadId)) throw new Error("Road no longer exists in this Scene.");
  return validateAtlas({
    ...current,
    roads: current.roads.map(r => r.id === roadId ? { ...r, name: cleanedName(name) } : r)
  });
}

export function removeRoad(atlas, { roadId, segmentId }) {
  const current = validateAtlas(atlas);
  if (current.schemaVersion < 3) {
    if (!current.segments.some(s => s.id === segmentId)) throw new Error("Road no longer exists in this Scene.");
    const segments = current.segments.filter(s => s.id !== segmentId);
    return validateAtlas({ ...current, segments, enabled: segments.length > 0 });
  }
  if (!current.roads.some(r => r.id === roadId)) throw new Error("Road no longer exists in this Scene.");
  if (current.checkpoints?.some(c => c.roadId === roadId)) {
    throw new Error("Remove or reassign this road’s checkpoints before deleting it.");
  }
  const roads = current.roads.filter(r => r.id !== roadId);
  const segments = current.segments.filter(s => s.roadId !== roadId);
  // Keep shared and orphaned junctions; removing a Road never cascades to others.
  return validateAtlas({ ...current, roads, segments, enabled: segments.length > 0 });
}

export function getRoadMergeCandidates(atlas, roadId) {
  const current = validateAtlas(atlas);
  if (current.schemaVersion < 3) return [];
  const source = current.segments.filter(s => s.roadId === roadId);
  if (!source.length) return [];
  const endpointIds = new Set(source.flatMap(s => [s.from, s.to]));
  return current.roads.filter(r => r.id !== roadId &&
    current.segments.some(s => s.roadId === r.id &&
      (endpointIds.has(s.from) || endpointIds.has(s.to))));
}

/** Merge explicitly chosen adjacent road groups without altering their edges. */
export function mergeRoadGroups(atlas, { keepRoadId, mergeRoadId }) {
  const current = validateAtlas(atlas);
  if (current.schemaVersion < 3) throw new Error("Organize roads before merging.");
  if (keepRoadId === mergeRoadId ||
      !getRoadMergeCandidates(current, keepRoadId).some(r => r.id === mergeRoadId)) {
    throw new Error("Roads must be distinct and meet at a shared junction to merge.");
  }
  return validateAtlas({
    ...current,
    roads: current.roads.filter(r => r.id !== mergeRoadId),
    segments: current.segments.map(s => s.roadId === mergeRoadId ?
      { ...s, roadId: keepRoadId } : s),
    ...(current.checkpoints ? { checkpoints: current.checkpoints.map(c =>
      c.roadId === mergeRoadId ? { ...c, roadId: keepRoadId } : c) } : {})
  });
}

/**
 * Pure in-place authoring operation. Selectable bend points belong to one
 * named road; junctions are shared node records and update all connected roads.
 */
export function applyRoadGeometryEdit(atlas, { roadId, operation }) {
  const current = validateAtlas(atlas);
  if (current.schemaVersion < 3) throw new Error("Organize roads before editing points.");
  const related = current.segments.filter(s => s.roadId === roadId);
  if (!related.length) throw new Error("Road no longer exists in this Scene.");
  const op = operation;
  if (!op || typeof op !== "object") throw new Error("Missing edit operation.");
  const position = { x: op.x, y: op.y };
  if (!["remove-bend", "demote-junction", "detach-branch"].includes(op.kind) &&
      (!Number.isFinite(position.x) || !Number.isFinite(position.y))) {
    throw new Error("Edit coordinates must be finite.");
  }

  if (op.kind === "create-junction") {
    // Turn a bend or a point along one named road into a real graph node.
    // Crossings are never inferred: the GM explicitly invokes this operation.
    const segment = related.find(s => s.id === op.segmentId);
    if (!segment) throw new Error("This road section no longer exists.");
    const valid = (id, items) => typeof id === "string" &&
      /^[A-Za-z0-9_-]{1,128}$/.test(id) && !items.some(item => item.id === id);
    if (!valid(op.newNodeId, current.nodes) ||
        !valid(op.newSegmentId, current.segments)) {
      throw new Error("New unique junction and segment IDs are required.");
    }
    const path = [
      current.nodes.find(n => n.id === segment.from),
      ...segment.via,
      current.nodes.find(n => n.id === segment.to)
    ];
    const index = op.edgeIndex;
    const atVertex = op.atVertex === true;
    if (!Number.isSafeInteger(index) || index < (atVertex ? 1 : 0) ||
        index > segment.via.length) {
      throw new Error("Junction edge index is invalid.");
    }
    const location = atVertex ? path[index] : position;
    if (atVertex) {
      if (Math.hypot(position.x - location.x, position.y - location.y) > 0.01) {
        throw new Error("The road bend has changed.");
      }
    } else {
      const hit = project(location, path[index], path[index + 1]);
      if (!hit || hit.distance > 0.01 || hit.before < 1 || hit.after < 1) {
        throw new Error("A junction must lie within a road, away from its endpoints.");
      }
    }
    const firstVia = segment.via.slice(0, atVertex ? index - 1 : index);
    const secondVia = segment.via.slice(index);
    return validateAtlas({
      ...current,
      nodes: [...current.nodes, { id: op.newNodeId, x: location.x, y: location.y }],
      segments: [
        ...current.segments.map(s => s.id === segment.id
          ? { ...s, to: op.newNodeId, via: firstVia } : s),
        { ...segment, id: op.newSegmentId, from: op.newNodeId, via: secondVia }
      ]
    });
  }

  if (op.kind === "demote-junction") {
    const point = current.nodes.find(n => n.id === op.nodeId);
    const incident = current.segments.filter(s =>
      s.from === op.nodeId || s.to === op.nodeId);
    if (!point || incident.length !== 2 ||
        incident.some(s => s.roadId !== roadId)) {
      throw new Error("Only a two-section pass-through on one named road can become a bend. Detach shared connections first.");
    }
    if (current.checkpoints?.some(c => c.nodeId === point.id)) {
      throw new Error("This node has a named checkpoint. Remove or relocate the checkpoint before demoting it.");
    }
    const [first, second] = incident;
    const before = first.to === point.id
      ? { from: first.from, via: first.via }
      : { from: first.to, via: [...first.via].reverse() };
    const after = second.from === point.id
      ? { to: second.to, via: second.via }
      : { to: second.from, via: [...second.via].reverse() };
    if (before.from === after.to) {
      throw new Error("A loop junction cannot become a bend without changing the road graph.");
    }
    const via = [...before.via, { x: point.x, y: point.y }, ...after.via];
    if (via.length > 1000) throw new Error("The combined road section has too many shaping points.");
    // Preserve the first segment ID, logical road ID and original polyline.
    // The second segment and redundant graph node disappear together.
    return validateAtlas({
      ...current,
      nodes: current.nodes.filter(n => n.id !== point.id),
      segments: current.segments.filter(s => s.id !== second.id)
        .map(s => s.id === first.id
          ? { ...s, from: before.from, to: after.to, via } : s)
    });
  }

  if (op.kind === "detach-branch") {
    // A prior named-road merge can leave three or more sections of the SAME
    // logical road meeting at one node. Detach only the explicitly chosen arm:
    // detaching the whole road would leave the branching topology unchanged.
    const source = current.nodes.find(n => n.id === op.nodeId);
    const incident = current.segments.filter(s =>
      s.from === op.nodeId || s.to === op.nodeId);
    if (!source || incident.length < 3 ||
        incident.some(s => s.roadId !== roadId)) {
      throw new Error("Only a branch shared by sections of one named road can be separated this way.");
    }
    const selected = incident.find(s => s.id === op.segmentId);
    if (!selected) {
      throw new Error("Select a road section connected to this junction.");
    }
    if (typeof op.newNodeId !== "string" ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(op.newNodeId) ||
        current.nodes.some(n => n.id === op.newNodeId)) {
      throw new Error("A new unique endpoint ID is required.");
    }
    // Preserve all names, IDs, paths, and other attached arms. The new
    // endpoint initially overlaps the old node, so the GM may drag it away.
    return validateAtlas({
      ...current,
      nodes: [...current.nodes, { id: op.newNodeId, x: source.x, y: source.y }],
      segments: current.segments.map(s => s.id !== selected.id ? s : {
        ...s,
        from: s.from === source.id ? op.newNodeId : s.from,
        to: s.to === source.id ? op.newNodeId : s.to
      })
    });
  }

  if (op.kind === "detach-node") {
    const source = current.nodes.find(n => n.id === op.nodeId);
    if (!source || !related.some(s => s.from === source.id || s.to === source.id)) {
      throw new Error("This junction does not belong to the selected road.");
    }
    const otherRoadsMeetHere = current.segments.some(s => s.roadId !== roadId &&
      (s.from === source.id || s.to === source.id));
    if (!otherRoadsMeetHere) {
      throw new Error("This junction is not shared with another named road.");
    }
    if (typeof op.newNodeId !== "string" ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(op.newNodeId) ||
        current.nodes.some(n => n.id === op.newNodeId)) {
      throw new Error("A new unique junction ID is required.");
    }
    // Keep the original junction for the other roads. Move only this named
    // road's incident edges to an independent, initially coincident node.
    return validateAtlas({
      ...current,
      nodes: [...current.nodes, { id: op.newNodeId, x: source.x, y: source.y }],
      segments: current.segments.map(s => s.roadId === roadId
        ? { ...s,
            from: s.from === source.id ? op.newNodeId : s.from,
            to: s.to === source.id ? op.newNodeId : s.to }
        : s),
      ...(current.checkpoints ? { checkpoints: current.checkpoints.map(c =>
        c.roadId === roadId && c.nodeId === source.id
          ? { ...c, nodeId: op.newNodeId } : c) } : {})
    });
  }

  if (op.kind === "connect-node") {
    const source = current.nodes.find(n => n.id === op.nodeId);
    if (!source || !related.some(s => s.from === source.id || s.to === source.id)) {
      throw new Error("This junction does not belong to the selected road.");
    }
    const target = op.target;
    if (target?.kind === "node") {
      const destination = current.nodes.find(n => n.id === target.nodeId);
      if (!destination || destination.id === source.id) throw new Error("Invalid destination junction.");
      if (current.segments.some(s =>
        (s.from === source.id && s.to === destination.id) ||
        (s.to === source.id && s.from === destination.id))) {
        throw new Error("Cannot collapse an existing road section into a junction.");
      }
      return validateAtlas({
        ...current,
        nodes: current.nodes.filter(n => n.id !== source.id),
        segments: current.segments.map(s => ({
          ...s,
          from: s.from === source.id ? destination.id : s.from,
          to: s.to === source.id ? destination.id : s.to
        })),
        ...(current.checkpoints ? { checkpoints: current.checkpoints.map(c =>
          c.nodeId === source.id ? { ...c, nodeId: destination.id } : c) } : {})
      });
    }
    if (target?.kind === "edge") {
      const segment = current.segments.find(s => s.id === target.segmentId);
      if (!segment || segment.from === source.id || segment.to === source.id) {
        throw new Error("Cannot attach a junction to one of its own road sections.");
      }
      const validId = typeof op.newSegmentId === "string" &&
        /^[A-Za-z0-9_-]{1,128}$/.test(op.newSegmentId) &&
        !current.segments.some(s => s.id === op.newSegmentId);
      if (!validId) throw new Error("A new unique segment ID is required.");
      const nodesById = new Map(current.nodes.map(n => [n.id, n]));
      const path = [nodesById.get(segment.from), ...segment.via, nodesById.get(segment.to)];
      const atVertex = target.atVertex === true;
      const index = target.edgeIndex;
      if (!Number.isSafeInteger(index) || index < (atVertex ? 1 : 0) ||
          index > (atVertex ? segment.via.length : segment.via.length)) {
        throw new Error("Destination edge index is invalid.");
      }
      const snapped = { x: op.x, y: op.y };
      if (atVertex) {
        if (Math.hypot(snapped.x - path[index].x, snapped.y - path[index].y) > 0.01) {
          throw new Error("Destination road bend has changed.");
        }
      } else {
        const projection = project(snapped, path[index], path[index + 1]);
        if (!projection || projection.distance > 0.01 ||
            projection.before < 0.01 || projection.after < 0.01) {
          throw new Error("Destination must lie inside an existing road section.");
        }
      }
      const firstVia = segment.via.slice(0, atVertex ? index - 1 : index);
      const secondVia = segment.via.slice(index);
      return validateAtlas({
        ...current,
        nodes: current.nodes.map(n => n.id === source.id ? { ...n, ...snapped } : n),
        segments: [
          ...current.segments.map(s => s.id === segment.id
            ? { ...s, to: source.id, via: firstVia } : s),
          { ...segment, id: op.newSegmentId, from: source.id, via: secondVia }
        ]
      });
    }
    throw new Error("Invalid junction attachment target.");
  }
  if (op.kind === "move-node") {
    if (!related.some(s => s.from === op.nodeId || s.to === op.nodeId)) {
      throw new Error("This junction does not belong to the selected road.");
    }
    return validateAtlas({
      ...current,
      nodes: current.nodes.map(n => n.id === op.nodeId ? { ...n, ...position } : n)
    });
  }
  const segment = related.find(s => s.id === op.segmentId);
  if (!segment) throw new Error("This segment does not belong to the selected road.");
  const via = segment.via.map(p => ({ ...p }));
  if (op.kind === "move-bend" || op.kind === "remove-bend") {
    if (!Number.isSafeInteger(op.viaIndex) ||
        op.viaIndex < 0 || op.viaIndex >= via.length) {
      throw new Error("Bend index is invalid.");
    }
    if (op.kind === "move-bend") via[op.viaIndex] = position;
    else via.splice(op.viaIndex, 1);
  } else if (op.kind === "insert-bend") {
    if (!Number.isSafeInteger(op.edgeIndex) ||
        op.edgeIndex < 0 || op.edgeIndex > via.length || via.length >= 1000) {
      throw new Error("Road edge index is invalid or has too many bends.");
    }
    via.splice(op.edgeIndex, 0, position);
  } else {
    throw new Error("Unsupported road editing operation.");
  }
  return validateAtlas({
    ...current,
    segments: current.segments.map(s => s.id === segment.id ? { ...s, via } : s)
  });
}
