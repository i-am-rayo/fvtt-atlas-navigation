/**
 * Atlas map-fog presentation geometry. Discovery stays in image-local scene
 * coordinates; grid offsets are generated transiently for display only.
 * This file is independent of Foundry's FogExploration document/texture.
 */
export function fogCoverForGrid(grid, bounds, revealed, dimensions, maxCells = 40000) {
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
      if (revealed(center)) continue;
      polygons.push(vertices.map(p => ({ x: p.x + center.x, y: p.y + center.y })));
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
