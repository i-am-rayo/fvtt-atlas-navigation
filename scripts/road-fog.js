/** Foundry v14's fog manager is authoritative for each player's explored territory.
 * This affects only rendered segments; Atlas's GM reveal setting is still checked
 * before the path reaches this adapter. No road or Scene flags are modified.
 */
export function atlasPointExplored(canvas, point) {
  if (canvas?.scene?.tokenVision !== true || canvas?.scene?.fogExploration === false) return true;
  const query = canvas?.fog?.isPointExplored;
  if (typeof query !== "function") return false; // Fail closed until fog is initialized.
  try { return query.call(canvas.fog, point) === true; }
  catch { return false; }
}

const pointBetween = (a, b, t) =>
  ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** Produce separately rendered/hoverable spans within explored fog.
 * Resample because a long sampled curve segment may cross fog boundaries.
 * Never draw a segment with an unexplored midpoint.
 */
export function exploredRoadSpans(path, isExplored, maxStep = 12) {
  if (!Array.isArray(path) || path.length < 2) return [];
  const spans = [];
  let current = [];
  let previous = path[0];
  let wasVisible = Boolean(isExplored(previous));
  if (wasVisible) current.push(previous);
  for (const next of path.slice(1)) {
    const length = Math.hypot(next.x - previous.x, next.y - previous.y);
    const steps = Math.max(1, Math.min(512, Math.ceil(length / maxStep)));
    let priorPoint = previous;
    for (let step = 1; step <= steps; step++) {
      const point = pointBetween(previous, next, step / steps);
      const visible = Boolean(isExplored(point));
      if (visible !== wasVisible) {
        // Approximate the fog edge by bisection, with the drawn endpoint on
        // the explored side to avoid showing a shortcut into hidden terrain.
        let lo = priorPoint, hi = point;
        for (let i = 0; i < 5; i++) {
          const middle = pointBetween(lo, hi, 0.5);
          if (Boolean(isExplored(middle)) === wasVisible) lo = middle;
          else hi = middle;
        }
        const boundary = wasVisible ? lo : hi;
        if (wasVisible) {
          current.push(boundary);
          if (current.length > 1) spans.push(current);
          current = [];
        } else current = [boundary];
      }
      if (visible) current.push(point);
      wasVisible = visible;
      priorPoint = point;
    }
    previous = next;
  }
  if (current.length > 1) spans.push(current);
  return spans;
}
