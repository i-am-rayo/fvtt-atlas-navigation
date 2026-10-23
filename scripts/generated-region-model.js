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
  const adjacency = new Map();
  for (const segment of atlas.segments.filter(s => s.roadId === roadId)) {
    for (const [a, b] of [[segment.from, segment.to], [segment.to, segment.from]]) {
      if (!adjacency.has(a)) adjacency.set(a, []);
      adjacency.get(a).push({ nodeId: b, segment });
    }
  }
  const path = (forbiddenId = null) => {
    const visited = new Set([fromId]), queue = [fromId], cameFrom = new Map();
    for (let i = 0; i < queue.length; i++) {
      const node = queue[i];
      for (const edge of adjacency.get(node) ?? []) {
        if (edge.segment.id === forbiddenId || visited.has(edge.nodeId)) continue;
        visited.add(edge.nodeId);
        cameFrom.set(edge.nodeId, { from: node, segment: edge.segment });
        if (edge.nodeId === toId) {
          const result = [];
          let cursor = toId;
          while (cursor !== fromId) {
            const item = cameFrom.get(cursor);
            result.unshift({ ...item, to: cursor });
            cursor = item.from;
          }
          return result;
        }
        queue.push(edge.nodeId);
      }
    }
    return null;
  };
  const chosen = path();
  if (!chosen) throw new Error("These checkpoints are disconnected on the selected road.");
  if (chosen.some(edge => path(edge.segment.id))) {
    throw new Error("More than one route connects these checkpoints on this named road. Choose an unambiguous corridor.");
  }
  return chosen;
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
      obj.radiusX, obj.radiusY, obj.rotation ?? 0, !!obj.hole];
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
  if (atlas.schemaVersion !== 4) {
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
  let points, checkpointIds, name, shapes;
  if (kind === "checkpoint") {
    points = [project(requirePoint(nodes.get(first.nodeId)))];
    checkpointIds = [first.id];
    name = road.name + " — " + first.name;
    shapes = [ellipse(points[0], radius)];
  } else {
    const last = roadAndCheckpoint(atlas, roadId, endCheckpointId);
    points = edgePoints(atlas, chainBetween(atlas, roadId, first.nodeId, last.nodeId))
      .map(project);
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
    expectedRevision: atlas.revision };
}
