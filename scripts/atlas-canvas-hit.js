import { checkpointCanvasSize, checkpointMarkerPosition,
  resolveCheckpointAppearance } from "./checkpoint-appearance.js";

function distanceToSection(point, path) {
  let nearest = Infinity;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const length2 = dx * dx + dy * dy;
    if (!length2) continue;
    const t = Math.max(0, Math.min(1,
      ((point.x - a.x) * dx + (point.y - a.y) * dy) / length2));
    nearest = Math.min(nearest, Math.hypot(point.x - a.x - dx * t,
      point.y - a.y - dy * t));
  }
  return nearest;
}

/**
 * Hit test GM-only canvas shortcuts in Scene/canvas coordinates. A visible
 * checkpoint marker wins over its parent road. Only handles a Shift+click
 * when no in-progress authoring session is active.
 */
export function atlasShortcutTarget(atlas, point, toCanvas, zoom = 1) {
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return null;
  const scale = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const nodes = new Map(atlas.nodes.map(node => [node.id, node]));
  let checkpointHit = null;
  for (const checkpoint of atlas.checkpoints ?? []) {
    const node = nodes.get(checkpoint.nodeId);
    if (!node) continue;
    const position = toCanvas(node);
    const appearance = resolveCheckpointAppearance(checkpoint.appearance);
    const marker = checkpointMarkerPosition(position, appearance, scale);
    const radius = appearance.type === "dot" ? 12 / scale :
      checkpointCanvasSize(appearance.size, scale) / 2 + 6 / scale;
    const distance = Math.min(Math.hypot(point.x - position.x, point.y - position.y),
      Math.hypot(point.x - marker.x, point.y - marker.y));
    if (distance <= Math.max(12 / scale, radius) &&
        (!checkpointHit || distance < checkpointHit.distance)) {
      checkpointHit = { kind: "checkpoint", id: checkpoint.id, distance };
    }
  }
  if (checkpointHit) return { kind: "checkpoint", id: checkpointHit.id };

  let roadHit = null;
  for (const segment of atlas.segments ?? []) {
    const from = nodes.get(segment.from), to = nodes.get(segment.to);
    if (!from || !to) continue;
    const path = [from, ...segment.via, to].map(toCanvas);
    const distance = distanceToSection(point, path);
    if (distance <= 12 / scale && (!roadHit || distance < roadHit.distance)) {
      roadHit = { kind: "road", id: segment.roadId, distance };
    }
  }
  return roadHit ? { kind: "road", id: roadHit.id } : null;
}
