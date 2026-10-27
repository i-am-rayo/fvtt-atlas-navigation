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


/** Materialize durable, image-relative discovered cells from the complete
 * saved travel history. A grid presentation is never a movement database.
 * Existing history remains authoritative for explicit GM history corrections.
 */
export function discoveredCellsForGrid(grid, dimensions, discs, imageOrigin,
    maxCells = 40000) {
  if (!grid || grid.isGridless || typeof grid.getShape !== "function" ||
      typeof grid.getCenterPoint !== "function") {
    throw new Error("Atlas persistent discovery requires a square or hex grid.");
  }
  const rows = Number(dimensions?.rows);
  const cols = Number(dimensions?.columns);
  if (!Number.isSafeInteger(rows) || !Number.isSafeInteger(cols) ||
      rows <= 0 || cols <= 0 || rows * cols > maxCells ||
      ![imageOrigin?.x, imageOrigin?.y].every(Number.isFinite)) {
    throw new Error("Invalid Atlas grid geometry or image origin.");
  }
  const vertices = grid.getShape();
  if (!Array.isArray(vertices) || vertices.length < 3 ||
      vertices.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
    throw new Error("Invalid native Scene grid cell shape.");
  }
  const cells = [];
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const center = grid.getCenterPoint({ i, j });
    if (![center?.x, center?.y].every(Number.isFinite)) {
      throw new Error("Invalid native Scene grid cell center.");
    }
    const polygon = vertices.map(p => ({ x: p.x + center.x, y: p.y + center.y }));
    const covered = discs.some(d => {
      if (!Number.isFinite(d?.radius) || d.radius <= 0) return false;
      const pad = Math.max(...vertices.map(p => Math.hypot(p.x, p.y)));
      if (Math.hypot(center.x - d.x, center.y - d.y) > d.radius + pad) return false;
      return discoveredCellIntersectsDisc(polygon, d);
    });
    if (covered) {
      cells.push({ x: center.x - imageOrigin.x, y: center.y - imageOrigin.y });
    }
  }
  return cells;
}
