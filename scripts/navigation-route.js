import { validateAtlas } from "./atlas-model.js";

/**
 * Pure, read-only road routing. Coordinates are atlas image-local pixels.
 * The caller supplies a native Foundry Grid measurement adapter. No pixel
 * scale or terrain multiplier is inferred here.
 */
const EPSILON = 1e-8;
const finitePoint = p => Number.isFinite(p?.x) && Number.isFinite(p?.y);
const distancePixels = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const interpolate = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

function measure(measurePath, path) {
  if (path.length < 2) return 0;
  const value = measurePath(path.map(p => ({ x: p.x, y: p.y })));
  if (!Number.isFinite(value) || value < 0) throw new Error("Native Scene Grid measurement is unavailable.");
  return value;
}

function segmentGeometry(segment, nodes) {
  const first = nodes.get(segment.from), last = nodes.get(segment.to);
  if (!first || !last) throw new Error("Road contains an invalid graph endpoint.");
  const path = [first, ...segment.via, last];
  const cumulative = [0];
  for (let i = 1; i < path.length; i++) cumulative.push(cumulative.at(-1) + distancePixels(path[i - 1], path[i]));
  if (cumulative.at(-1) <= EPSILON) throw new Error("Road has no navigable length.");
  return { segment, path, cumulative, length: cumulative.at(-1) };
}

function projection(geometry, position) {
  let best = null;
  const { path, cumulative } = geometry;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], dx = b.x - a.x, dy = b.y - a.y;
    const square = dx * dx + dy * dy;
    if (square <= EPSILON) continue;
    const t = Math.max(0, Math.min(1, ((position.x - a.x) * dx + (position.y - a.y) * dy) / square));
    const point = interpolate(a, b, t);
    const pixelDistance = distancePixels(position, point);
    const offset = cumulative[i - 1] + t * Math.sqrt(square);
    if (!best || pixelDistance < best.pixelDistance - EPSILON ||
      (Math.abs(pixelDistance - best.pixelDistance) <= EPSILON && offset < best.offset)) {
      best = { point, offset, pixelDistance };
    }
  }
  return best;
}

function slice(geometry, from, to) {
  const { path, cumulative } = geometry;
  const at = offset => {
    if (offset <= EPSILON) return path[0];
    if (offset >= geometry.length - EPSILON) return path.at(-1);
    let i = 1;
    while (cumulative[i] < offset - EPSILON) i++;
    const span = cumulative[i] - cumulative[i - 1];
    return span <= EPSILON ? path[i] : interpolate(path[i - 1], path[i], (offset - cumulative[i - 1]) / span);
  };
  return [at(from), ...path.filter((_, i) => i > 0 && i < path.length - 1 &&
    cumulative[i] > from + EPSILON && cumulative[i] < to - EPSILON), at(to)];
}

function candidates(geometries, point, limit, tolerance) {
  const ranked = geometries.flatMap(g => {
    const hit = projection(g, point);
    return hit ? [{ geometry: g, ...hit }] : [];
  }).sort((a, b) => a.pixelDistance - b.pixelDistance ||
    a.geometry.segment.id.localeCompare(b.geometry.segment.id) || a.offset - b.offset);
  const closest = ranked[0]?.pixelDistance ?? Infinity;
  return ranked.filter(hit => hit.pixelDistance <= closest + tolerance + EPSILON).slice(0,limit);
}

/**
 * Route between arbitrary map positions, preferring an actual connected road
 * journey. Temporary attachments are considered near each endpoint, not saved.
 * A route must traverse at least one road edge; geometric crossings without
 * shared graph nodes never become connected.
 *
 * @param {object} atlas Versioned Atlas Scene record.
 * @param {object} start Image-local start coordinate.
 * @param {object} end Image-local end coordinate.
 * @param {object} options measurePath(points) returns native Grid distance.
 * @returns {{status:string, distance?:number, legs?:object[], start:object, end:object}}
 */
export function calculateRoadRoute(atlas, start, end, { measurePath, candidateLimit = 8, attachmentTolerancePixels = 0 } = {}) {
  if (!finitePoint(start) || !finitePoint(end)) throw new Error("Select two valid map locations.");
  if (typeof measurePath !== "function") throw new Error("Native Scene Grid measurement is required.");
  if (!Number.isSafeInteger(candidateLimit) || candidateLimit < 1 || candidateLimit > 32) {
    throw new Error("Route attachment limit must be between 1 and 32.");
  }
  if (!Number.isFinite(attachmentTolerancePixels) || attachmentTolerancePixels < 0) {
    throw new Error("Route attachment tolerance must be a nonnegative pixel distance.");
  }
  const current = validateAtlas(atlas);
  if (current.schemaVersion < 3) return { status: "no-route", reason: "Roads must be organized first.", start, end };
  const nodes = new Map(current.nodes.map(n => [n.id, n]));
  const geometries = current.segments.map(s => segmentGeometry(s, nodes));
  if (!geometries.length) return { status: "no-route", reason: "No roads are available.", start, end };
  const fromHits = candidates(geometries, start, candidateLimit, attachmentTolerancePixels);
  const toHits = candidates(geometries, end, candidateLimit, attachmentTolerancePixels);
  const graph = new Map();
  const addEdge = (from, to, leg, reversible = false) => {
    if (!graph.has(from)) graph.set(from, []);
    graph.get(from).push({ to, leg });
    if (reversible) addEdge(to, from, { ...leg, points: [...leg.points].reverse() });
  };
  const attachments = new Map();
  for (const [kind, hits] of [["start", fromHits], ["end", toHits]]) {
    hits.forEach((hit, index) => {
      const key = `attach:${kind}:${index}`;
      if (!attachments.has(hit.geometry.segment.id)) attachments.set(hit.geometry.segment.id, []);
      attachments.get(hit.geometry.segment.id).push({ ...hit, key, kind });
      const endpoint = kind === "start" ? start : end;
      const points = kind === "start" ? [endpoint, hit.point] : [hit.point, endpoint];
      const leg = { kind: "off-road", points, distance: measure(measurePath, points) };
      if (kind === "start") addEdge("origin", key, leg);
      else addEdge(key, "destination", leg);
    });
  }
  for (const g of geometries) {
    const stops = [{ offset: 0, key: g.segment.from },
      ...(attachments.get(g.segment.id) ?? []),
      { offset: g.length, key: g.segment.to }];
    stops.sort((a, b) => a.offset - b.offset || a.key.localeCompare(b.key));
    for (let i = 1; i < stops.length; i++) {
      const from = stops[i - 1], to = stops[i];
      const points = slice(g, from.offset, to.offset);
      const length = measure(measurePath, points);
      const leg = { kind: "road", roadId: g.segment.roadId, segmentId: g.segment.id,
        points, distance: length };
      addEdge(from.key, to.key, leg, g.segment.bidirectional !== false);
    }
  }
  const stateKey = (node, usedRoad) => `${node}|${usedRoad ? 1 : 0}`;
  const origin = stateKey("origin", false), goal = stateKey("destination", true);
  const best = new Map([[origin, 0]]), previous = new Map();
  const pending = [{ key: origin, node: "origin", usedRoad: false, distance: 0 }];
  while (pending.length) {
    pending.sort((a, b) => a.distance - b.distance || a.key.localeCompare(b.key));
    const state = pending.shift();
    if (state.distance > best.get(state.key) + EPSILON) continue;
    if (state.key === goal) break;
    const edges = graph.get(state.node) ?? [];
    for (const edge of edges) {
      const usedRoad = state.usedRoad || (edge.leg.kind === "road" && edge.leg.distance > EPSILON);
      const key = stateKey(edge.to, usedRoad), total = state.distance + edge.leg.distance;
      if (total < (best.get(key) ?? Infinity) - EPSILON) {
        best.set(key, total);
        previous.set(key, { key: state.key, leg: edge.leg });
        pending.push({ key, node: edge.to, usedRoad, distance: total });
      }
    }
  }
  if (!best.has(goal)) return { status: "no-route", reason: "No connected road route is available.", start, end };
  const legs = [];
  let cursor = goal;
  while (cursor !== origin) {
    const item = previous.get(cursor);
    if (!item) throw new Error("Incomplete route reconstruction.");
    legs.push(item.leg);
    cursor = item.key;
  }
  legs.reverse();
  return { status: "ok", distance: best.get(goal), legs, start: { ...start }, end: { ...end } };
}
