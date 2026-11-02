/** Pure, bounded waypoint planning for Foundry v14's native TokenDocument.move API. */
export const MAX_GUIDED_WAYPOINTS = 1024;
const valid = point => Number.isFinite(point?.x) && Number.isFinite(point?.y);

function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const kept = new Uint8Array(points.length);
  kept[0] = kept[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const threshold = tolerance * tolerance;
  while (stack.length) {
    const [first, last] = stack.pop();
    const a = points[first], b = points[last];
    const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
    let maxDistance = threshold, index = -1;
    for (let i = first + 1; i < last; i++) {
      const point = points[i];
      const t = length ? Math.max(0, Math.min(1,
        ((point.x - a.x) * dx + (point.y - a.y) * dy) / length)) : 0;
      const ex = point.x - a.x - t * dx, ey = point.y - a.y - t * dy;
      const distance = ex * ex + ey * ey;
      if (distance > maxDistance) { maxDistance = distance; index = i; }
    }
    if (index >= 0) {
      kept[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => kept[i]);
}

/**
 * Convert the exact displayed route into center-aligned native token positions.
 * Never invent shortcuts through an overlong route: fail closed if the bounded
 * simplification cannot preserve the visible shape to the given tolerance.
 */
export function createGuidedTokenWaypoints(legPaths, token, gridSize, {
  maxWaypoints = MAX_GUIDED_WAYPOINTS
} = {}) {
  if (!Array.isArray(legPaths) || !legPaths.length || legPaths.length > 4096 ||
      !Number.isFinite(gridSize) || gridSize <= 0 ||
      !Number.isFinite(token?.x) || !Number.isFinite(token?.y) ||
      !Number.isFinite(token?.width) || token.width <= 0 ||
      !Number.isFinite(token?.height) || token.height <= 0 ||
      !Number.isSafeInteger(maxWaypoints) || maxWaypoints < 2 || maxWaypoints > 4096) {
    throw Error("Choose an eligible token and a valid road route before travel.");
  }
  const centers = [];
  for (const leg of legPaths) {
    if (!Array.isArray(leg.points) || leg.points.length > 8192) throw Error("Route is too complex for guided travel.");
    for (const point of leg.points) {
      if (!valid(point)) throw Error("Route contains an invalid travel position.");
      const last = centers.at(-1);
      if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 0.01)
        centers.push({ x: point.x, y: point.y });
      if (centers.length > 20000) throw Error("Route is too complex for guided travel.");
    }
  }
  if (centers.length < 2) throw Error("The route has no distance to travel.");
  const halfWidth = token.width * gridSize / 2;
  const halfHeight = token.height * gridSize / 2;
  const origin = { x: token.x + halfWidth, y: token.y + halfHeight };
  if (Math.hypot(origin.x - centers[0].x, origin.y - centers[0].y) > gridSize * 0.75) {
    throw Error("Place Point A on the party token before starting guided travel.");
  }
  const reduced = simplify(centers, Math.max(0.4, gridSize / 40));
  if (reduced.length > maxWaypoints)
    throw Error("The curved route is too detailed for one safe movement. Choose a shorter journey.");
  return reduced.map(point => ({ x: point.x - halfWidth, y: point.y - halfHeight }));
}
