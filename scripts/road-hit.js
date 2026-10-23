import { validateAtlas } from "./atlas-model.js";

export function roadHandles(atlas, roadId) {
  const data = validateAtlas(atlas);
  if (data.schemaVersion < 3) return [];
  const segments = data.segments.filter(s => s.roadId === roadId);
  const nodeIds = new Set(segments.flatMap(s => [s.from, s.to]));
  const handles = data.nodes.filter(n => nodeIds.has(n.id)).map(n =>
    ({ kind: "node", nodeId: n.id, x: n.x, y: n.y }));
  for (const s of segments) for (const [viaIndex, point] of s.via.entries()) {
    handles.push({ kind: "bend", segmentId: s.id, viaIndex, x: point.x, y: point.y });
  }
  return handles;
}

export function nearestRoadHandle(atlas, roadId, point, tolerance = 12) {
  let nearest = null;
  let smallest = tolerance;
  for (const handle of roadHandles(atlas, roadId)) {
    const distance = Math.hypot(point.x - handle.x, point.y - handle.y);
    if (distance <= smallest) { nearest = handle; smallest = distance; }
  }
  return nearest;
}

export function nearestRoadEdge(atlas, roadId, point, tolerance = 12) {
  const data = validateAtlas(atlas);
  if (data.schemaVersion < 3) return null;
  const nodes = new Map(data.nodes.map(n => [n.id, n]));
  let best = null;
  let min = tolerance;
  for (const road of data.segments.filter(s => s.roadId === roadId)) {
    const path = [nodes.get(road.from), ...road.via, nodes.get(road.to)];
    for (let edgeIndex = 0; edgeIndex < path.length - 1; edgeIndex++) {
      const a = path[edgeIndex], b = path[edgeIndex + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const squared = dx * dx + dy * dy;
      if (squared < 1) continue;
      const t = Math.max(0, Math.min(1, ((point.x-a.x)*dx+(point.y-a.y)*dy)/squared));
      const x = a.x+dx*t, y = a.y+dy*t;
      const distance = Math.hypot(x-point.x,y-point.y);
      if (distance <= min) {
        min = distance;
        best = { kind: "insert-bend", segmentId: road.id, edgeIndex, x, y };
      }
    }
  }
  return best;
}
