import { validateAtlas } from "./atlas-model.js";

const MAX_NAME = 120;
const SNAP_PIXELS = 14;

export function suggestRoadName(atlas) {
  const names = new Set(atlas.segments.map(segment => segment.name));
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

/**
 * One named road is one persisted v1 segment with ordered intermediate bends.
 * Endpoints near an existing junction use that junction's stable ID, allowing
 * an explicit network connection. Visually crossing lines never auto-connect.
 */
export function addRoad(atlas, { points, name, idFactory, snapPixels = SNAP_PIXELS }) {
  const current = validateAtlas(atlas);
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
  const nodeIds = new Set(current.nodes.map(node => node.id));
  const segmentIds = new Set(current.segments.map(segment => segment.id));
  const nodes = [...current.nodes];
  const chooseEndpoint = (position, excludeId) => {
    let nearest = null;
    let bestDistance = snapPixels;
    for (const node of current.nodes) {
      if (node.id === excludeId) continue;
      const distance = Math.hypot(position.x - node.x, position.y - node.y);
      if (distance <= bestDistance) {
        nearest = node;
        bestDistance = distance;
      }
    }
    if (nearest) return nearest.id;
    const id = uniqueId(nodeIds, idFactory);
    nodes.push({ id, x: position.x, y: position.y });
    return id;
  };

  const from = chooseEndpoint(path[0]);
  const to = chooseEndpoint(path.at(-1), from);
  if (from === to) throw new Error("Road endpoints must be different junctions.");

  const segment = {
    id: uniqueId(segmentIds, idFactory),
    from, to,
    via: path.slice(1, -1),
    name: cleanedName(name ?? suggestRoadName(current)),
    bidirectional: true
  };
  // validateAtlas enforces positive geometric length and maximum graph sizes.
  return validateAtlas({
    ...current,
    enabled: true,
    nodes,
    segments: [...current.segments, segment]
  });
}

export function renameRoad(atlas, { segmentId, name }) {
  const current = validateAtlas(atlas);
  if (!current.segments.some(segment => segment.id === segmentId)) {
    throw new Error("Road no longer exists in this Scene.");
  }
  return validateAtlas({
    ...current,
    segments: current.segments.map(segment =>
      segment.id === segmentId ? { ...segment, name: cleanedName(name) } : segment)
  });
}

export function removeRoad(atlas, { segmentId }) {
  const current = validateAtlas(atlas);
  if (!current.segments.some(segment => segment.id === segmentId)) {
    throw new Error("Road no longer exists in this Scene.");
  }
  const segments = current.segments.filter(segment => segment.id !== segmentId);
  // Leave junctions intact: they may be shared or referenced by future features.
  return validateAtlas({ ...current, segments, enabled: segments.length > 0 });
}
