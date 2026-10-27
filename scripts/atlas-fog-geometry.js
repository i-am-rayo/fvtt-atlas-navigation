/**
 * Atlas map-fog presentation geometry. Discovery stays in image-local scene
 * coordinates; grid offsets are generated transiently for display only.
 * This file is independent of Foundry's FogExploration document/texture.
 */
/** Any discovered terrain touching a native cell reveals that entire cell.
 * Checking only its center can hide previously visited cell edges after the
 * explorer moves, even though the saved route/discs are still present.
 */
export function discoveredCellIntersectsDisc(polygon, disc) {
  if (!Number.isFinite(disc?.x) || !Number.isFinite(disc?.y) ||
      !Number.isFinite(disc?.radius) || disc.radius <= 0) return false;
  const r2 = disc.radius * disc.radius;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    if ((a.x - disc.x) ** 2 + (a.y - disc.y) ** 2 <= r2) return true;
    const dx = b.x - a.x, dy = b.y - a.y;
    const length2 = dx * dx + dy * dy;
    if (!length2) continue;
    const t = Math.max(0, Math.min(1,
      ((disc.x - a.x) * dx + (disc.y - a.y) * dy) / length2));
    const ex = a.x + t * dx - disc.x;
    const ey = a.y + t * dy - disc.y;
    if (ex * ex + ey * ey <= r2) return true;
  }
  // A small reveal wholly inside a large grid cell has no vertices or edge
  // within radius: test the disc center against the polygon as well.
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > disc.y) !== (b.y > disc.y) &&
        disc.x < (b.x - a.x) * (disc.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function fogCoverForGrid(grid, bounds, revealed, dimensions, maxCells = 40000,
    discs = []) {
  if (!grid || typeof grid.getShape !== "function" ||
      typeof grid.getCenterPoint !== "function") {
    throw new Error("Atlas grid-aligned fog requires Foundry v14 grid geometry.");
  }
  // Foundry v14 Scene dimensions expose the actual grid row/column count.
  // Do not rely on getOffsetRange here: depending on grid orientation the
  // returned values are not guaranteed to be integer {i,j} cell addresses.
  const rows = Number(dimensions?.rows);
  const columns = Number(dimensions?.columns);
  if (!Number.isSafeInteger(rows) || !Number.isSafeInteger(columns) ||
      rows <= 0 || columns <= 0 || rows * columns > maxCells) {
    throw new Error("Atlas fog requires a bounded native Scene grid.");
  }
  const vertices = grid.getShape();
  if (!Array.isArray(vertices) || vertices.length < 3 ||
      vertices.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
    throw new Error("Invalid native Scene grid cell shape.");
  }
  const polygons = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < columns; j++) {
      const center = grid.getCenterPoint({ i, j });
      if (!Number.isFinite(center?.x) || !Number.isFinite(center?.y)) {
        throw new Error("Invalid native Scene grid cell center.");
      }
      const polygon = vertices.map(p => ({ x: p.x + center.x, y: p.y + center.y }));
      if (revealed(center)) continue;
      // Coarse bounds avoid expensive circle-vs-polygon checks when most of a
      // large Scene is undiscovered. The complete saved union is authoritative.
      const minX = Math.min(...polygon.map(p => p.x));
      const maxX = Math.max(...polygon.map(p => p.x));
      const minY = Math.min(...polygon.map(p => p.y));
      const maxY = Math.max(...polygon.map(p => p.y));
      if (discs.some(d => d.x + d.radius >= minX && d.x - d.radius <= maxX &&
          d.y + d.radius >= minY && d.y - d.radius <= maxY &&
          discoveredCellIntersectsDisc(polygon, d))) continue;
      polygons.push(polygon);
    }
  }
  return polygons;
}

/** Gridless fallback: opaque horizontal runs outside the union of reveals.
 * Unlike multiple Pixi holes, unions cannot self-intersect or create wedges.
 */
export function fogCoverRuns(bounds, discs, step = 5, maxRows = 12000) {
  const { x, y, width, height } = bounds;
  if (![x, y, width, height, step].every(Number.isFinite) ||
      width <= 0 || height <= 0 || step <= 0 ||
      Math.ceil(height / step) > maxRows) {
    throw new Error("Invalid or oversized Atlas fog raster geometry.");
  }
  const rects = [];
  const right = x + width;
  for (let rowY = y; rowY < y + height; rowY += step) {
    const h = Math.min(step, y + height - rowY);
    const line = rowY + h / 2;
    const holes = [];
    for (const disc of discs) {
      const dy = line - disc.y;
      if (Math.abs(dy) >= disc.radius) continue;
      const half = Math.sqrt(disc.radius * disc.radius - dy * dy);
      const from = Math.max(x, disc.x - half);
      const to = Math.min(right, disc.x + half);
      if (from < to) holes.push([from, to]);
    }
    holes.sort((a, b) => a[0] - b[0]);
    let cursor = x;
    for (const [start, end] of holes) {
      if (start > cursor) rects.push({ x: cursor, y: rowY, width: start - cursor, height: h });
      cursor = Math.max(cursor, end);
    }
    if (cursor < right) rects.push({ x: cursor, y: rowY, width: right - cursor, height: h });
  }
  return rects;
}
