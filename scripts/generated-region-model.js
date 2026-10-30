/**
 * v0.2.14 pure, bounded generator for opt-in native Scene Regions.
 * The graph is never mutated and an apparent crossing is not a connection.
 */
import { validateAtlas } from "./atlas-model.js";

export const GENERATED_REGION_FLAG = "generatedRegion";
export const GENERATED_REGION_SCHEMA_VERSION = 1;
export const MAX_CORRIDOR_EDGES = 100;
const KEY_FIELDS = ["schemaVersion", "kind", "roadId", "checkpointIds",
  "widthCells", "gridSize", "shapeSignature"];

function requirePoint(p) {
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
    throw new Error("A finite road point or active Scene image origin is required.");
  }
  return p;
}

function roadAndCheckpoint(atlas, roadId, checkpointId) {
  const checkpoint = atlas.checkpoints?.find(c =>
    c.id === checkpointId && c.roadId === roadId);
  if (!checkpoint) throw new Error("Choose a checkpoint belonging to this named road.");
  return checkpoint;
}

function chainBetween(atlas, roadId, fromId, toId) {
  if (fromId === toId) throw new Error("Select two different checkpoints.");
  const nodes = new Map(atlas.nodes.map(node => [node.id, node]));
  const adjacency = new Map();
  for (const segment of atlas.segments.filter(s => s.roadId === roadId)) {
    const points = [nodes.get(segment.from), ...segment.via, nodes.get(segment.to)];
    const length = points.slice(1).reduce((sum, p, i) =>
      sum + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0);
    if (!(length > 0) || !Number.isFinite(length)) {
      throw new Error("A named-road section has invalid corridor geometry.");
    }
    for (const [a, b] of [[segment.from, segment.to], [segment.to, segment.from]]) {
      if (!adjacency.has(a)) adjacency.set(a, []);
      adjacency.get(a).push({ nodeId:b, segment, length });
    }
  }
  // Deterministic shortest geometric corridor. Terrain movement costs do not
  // influence native Region geometry; no road or Region data is modified.
  const solve = (forbiddenId = null) => {
    const distances = new Map([[fromId, 0]]);
    const routes = new Map();
    const visited = new Set();
    while (true) {
      const next = [...distances.keys()].filter(id => !visited.has(id))
        .sort((a, b) => distances.get(a) - distances.get(b) || a.localeCompare(b))[0];
      if (!next) return null;
      if (next === toId) {
        const result = [];
        let cursor = toId;
        while (cursor !== fromId) {
          const edge = routes.get(cursor);
          if (!edge) throw new Error("Incomplete corridor path.");
          result.unshift({ from:edge.from, to:cursor, segment:edge.segment });
          cursor = edge.from;
        }
        return { steps:result, distancePixels:distances.get(toId) };
      }
      visited.add(next);
      for (const edge of [...(adjacency.get(next) ?? [])].sort((a,b) =>
        a.segment.id.localeCompare(b.segment.id) || a.nodeId.localeCompare(b.nodeId))) {
        if (edge.segment.id === forbiddenId || visited.has(edge.nodeId)) continue;
        const candidate = distances.get(next) + edge.length;
        if (candidate < (distances.get(edge.nodeId) ?? Infinity) - 1e-8) {
          distances.set(edge.nodeId, candidate);
          routes.set(edge.nodeId, { from:next, segment:edge.segment });
        }
      }
    }
  };
  const selected = solve();
  if (!selected) throw new Error("These checkpoints are disconnected on the selected road.");
  return {
    ...selected,
    alternatives: selected.steps.some(edge => solve(edge.segment.id) !== null)
  };
}

function edgePoints(atlas, chosen) {
  const nodes = new Map(atlas.nodes.map(n => [n.id, n]));
  const points = [];
  for (const step of chosen) {
    const forward = step.segment.from === step.from;
    const route = [nodes.get(step.from),
      ...(forward ? step.segment.via : [...step.segment.via].reverse()),
      nodes.get(step.to)].map(requirePoint);
    if (points.length) {
      const prior = points.at(-1);
      if (prior.x !== route[0].x || prior.y !== route[0].y) {
        throw new Error("The stored road geometry is discontinuous.");
      }
    }
    points.push(...route.slice(points.length ? 1 : 0));
  }
  const unique = [points[0]];
  for (const point of points.slice(1)) {
    if (point.x !== unique.at(-1).x || point.y !== unique.at(-1).y) unique.push(point);
  }
  if (unique.length < 2) throw new Error("The selected corridor is zero length.");
  if (unique.length - 1 > MAX_CORRIDOR_EDGES) {
    throw new Error("This corridor has over 100 geometry edges. Choose closer checkpoints to keep native Regions responsive.");
  }
  return unique;
}

function ellipse(p, radius) {
  return { type: "ellipse", x: p.x, y: p.y,
    radiusX: radius, radiusY: radius, rotation: 0, gridBased: false, hole: false };
}

function rectangleAround(a, b, radius) {
  const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
  if (!(distance > 0)) throw new Error("A corridor contains a zero-length edge.");
  const ox = -dy / distance * radius, oy = dx / distance * radius;
  const coords = [
    { x: a.x + ox, y: a.y + oy }, { x: b.x + ox, y: b.y + oy },
    { x: b.x - ox, y: b.y - oy }, { x: a.x - ox, y: a.y - oy }
  ];
  return { type: "polygon", hole: false,
    origin: { x: a.x, y: a.y },
    points: coords.flatMap(p => [p.x, p.y]) };
}

/** Geometry-only signature. Native Region names and Behaviors are intentionally excluded. */
export function shapeSignature(shapes) {
  const normalized = Array.from(shapes, shape => {
    const obj = typeof shape.toObject === "function" ? shape.toObject() : shape;
    if (obj.type === "ellipse") return ["ellipse", obj.x, obj.y,
      obj.radiusX, obj.radiusY, obj.rotation ?? 0, !!obj.gridBased, !!obj.hole];
    if (obj.type === "polygon") return ["polygon", obj.origin?.x, obj.origin?.y,
      ...obj.points, !!obj.hole];
    return ["other"];
  });
  const raw = JSON.stringify(normalized);
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function validateGeneratedRegionFlag(value) {
  if (value == null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).some(key => !KEY_FIELDS.includes(key)) ||
      value.schemaVersion !== GENERATED_REGION_SCHEMA_VERSION ||
      !["checkpoint", "corridor"].includes(value.kind) ||
      typeof value.roadId !== "string" || !value.roadId ||
      !Array.isArray(value.checkpointIds) ||
      value.checkpointIds.length !== (value.kind === "checkpoint" ? 1 : 2) ||
      value.checkpointIds.some(id => typeof id !== "string" || !id) ||
      new Set(value.checkpointIds).size !== value.checkpointIds.length ||
      !(value.widthCells >= 0.25 && value.widthCells <= 3 && Number.isFinite(value.widthCells)) ||
      !(value.gridSize > 0 && Number.isFinite(value.gridSize)) ||
      !/^[a-f0-9]{8}$/.test(value.shapeSignature)) {
    throw new Error("Unsupported generated Region metadata; no native Region was changed.");
  }
  return value;
}

/** Generate a single independent native Region plan; the GM must approve it. */
export function buildGeneratedRegionPlan(atlasData, {
  kind, roadId, checkpointId, endCheckpointId = null,
  widthCells = 0.5, gridSize, origin
}) {
  const atlas = validateAtlas(atlasData);
  if (atlas.schemaVersion < 4) {
    throw new Error("Create named checkpoints before generating a Region.");
  }
  const road = atlas.roads.find(r => r.id === roadId);
  if (!road) throw new Error("Choose an existing named road.");
  const first = roadAndCheckpoint(atlas, roadId, checkpointId);
  if (!["checkpoint", "corridor"].includes(kind)) throw new Error("Choose a Region type.");
  if (!(Number.isFinite(widthCells) && widthCells >= 0.25 && widthCells <= 3) ||
      !(Number.isFinite(gridSize) && gridSize > 0)) {
    throw new Error("Region half-width must be 0.25–3 grid cells with a valid Scene grid.");
  }
  requirePoint(origin);
  const nodes = new Map(atlas.nodes.map(n => [n.id, n]));
  const radius = widthCells * gridSize;
  const project = point => ({ x: point.x + origin.x, y: point.y + origin.y });
  let points, checkpointIds, name, shapes, routeSelection = null;
  if (kind === "checkpoint") {
    points = [project(requirePoint(nodes.get(first.nodeId)))];
    checkpointIds = [first.id];
    name = road.name + " — " + first.name;
    shapes = [ellipse(points[0], radius)];
  } else {
    const last = roadAndCheckpoint(atlas, roadId, endCheckpointId);
    routeSelection = chainBetween(atlas, roadId, first.nodeId, last.nodeId);
    points = edgePoints(atlas, routeSelection.steps).map(project);
    checkpointIds = [first.id, last.id].sort();
    name = road.name + " — " + first.name + " → " + last.name;
    shapes = [];
    for (let i = 1; i < points.length; i++) {
      shapes.push(rectangleAround(points[i-1], points[i], radius));
    }
    for (const point of points) shapes.push(ellipse(point, radius));
  }
  const generatedRegion = validateGeneratedRegionFlag({
    schemaVersion: GENERATED_REGION_SCHEMA_VERSION,
    kind, roadId, checkpointIds, widthCells, gridSize,
    shapeSignature: shapeSignature(shapes)
  });
  return { name, kind, roadId, checkpointIds, startCheckpointId: first.id, endCheckpointId: kind === "corridor" ? endCheckpointId : null, points, radius, shapes, generatedRegion,
    expectedRevision: atlas.revision,
    ...(routeSelection ? { routeSelection: {
      alternatives:routeSelection.alternatives,
      distancePixels:routeSelection.distancePixels,
      segmentIds:routeSelection.steps.map(step => step.segment.id)
    }} : {}) };
}
