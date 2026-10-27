/**
 * Atlas map-fog presentation geometry. Discovery stays in image-local scene
 * coordinates; grid offsets are generated transiently for display only.
 * This file is independent of Foundry's FogExploration document/texture.
 */
export function fogCoverForGrid(grid, bounds, revealed, maxCells = 40000) {
  if (!grid || typeof grid.getOffsetRange !== "function" ||
      typeof grid.getShape !== "function" ||
      typeof grid.getCenterPoint !== "function") {
    throw new Error("Atlas grid-aligned fog requires Foundry v14 grid geometry.");
  }
  const offsets = grid.getOffsetRange(bounds);
  if (!Array.isArray(offsets) || offsets.length > maxCells) {
    throw new Error("Atlas fog grid is too large; use a smaller Scene grid.");
  }
  const vertices = grid.getShape();
  if (!Array.isArray(vertices) || vertices.length < 3 ||
      vertices.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
    throw new Error("Invalid native Scene grid cell shape.");
  }
  const polygons = [];
  const seen = new Set();
  for (const offset of offsets) {
    if (!Number.isSafeInteger(offset?.i) || !Number.isSafeInteger(offset?.j)) {
      throw new Error("Invalid native Scene grid offset.");
    }
    const key = offset.i + ":" + offset.j;
    if (seen.has(key)) continue;
    seen.add(key);
    const center = grid.getCenterPoint(offset);
    if (!Number.isFinite(center?.x) || !Number.isFinite(center?.y)) {
      throw new Error("Invalid native Scene grid cell center.");
    }
    if (revealed(center)) continue;
    // Foundry's grid shape vertices are offsets FROM getCenterPoint,
    // including for staggered/rotated hex grids.
    polygons.push(vertices.map(p => ({ x: p.x + center.x, y: p.y + center.y })));
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
