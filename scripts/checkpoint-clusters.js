/**
 * Presentation-only, screen-space checkpoint grouping. The underlying Atlas
 * checkpoints, graph nodes, Region geometry, and IDs are never modified.
 * Each marker is processed once against up to nine nearby screen-space bins.
 */
export function groupCheckpointMarkers(markers, zoom = 1, {
  radius = 46, maxZoom = 1.5
} = {}) {
  const scale = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const within = Number.isFinite(radius) && radius >= 12 && radius <= 150 ? radius : 46;
  const groups = [];
  if (scale >= maxZoom || markers.length < 2) {
    return markers.map(marker => ({ id: marker.id, x: marker.x, y: marker.y,
      members: [marker] }));
  }
  const bins = new Map();
  const binKey = (x, y) => `${x}:${y}`;
  for (const marker of markers) {
    if (!Number.isFinite(marker.x) || !Number.isFinite(marker.y)) continue;
    const screenX = marker.x * scale, screenY = marker.y * scale;
    const gx = Math.floor(screenX / within), gy = Math.floor(screenY / within);
    let closest = null;
    let nearestDistance = within;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const group of bins.get(binKey(gx + dx, gy + dy)) ?? []) {
        const distance = Math.hypot(screenX - group.anchorX, screenY - group.anchorY);
        if (distance <= nearestDistance) {
          closest = group;
          nearestDistance = distance;
        }
      }
    }
    if (closest) {
      closest.members.push(marker);
      const count = closest.members.length;
      closest.x += (marker.x - closest.x) / count;
      closest.y += (marker.y - closest.y) / count;
    } else {
      const group = { id: marker.id, x: marker.x, y: marker.y,
        anchorX: screenX, anchorY: screenY, members: [marker] };
      groups.push(group);
      const key = binKey(gx, gy);
      if (!bins.has(key)) bins.set(key, []);
      bins.get(key).push(group);
    }
  }
  return groups.map(({ id, x, y, members }) => ({ id, x, y, members }));
}

/** Short, read-only hover descriptions; no Journal or hidden network lookup. */
export function checkpointQuickInfo(checkpoint, road) {
  const detail = [checkpoint.name];
  if (road?.name) detail.push(`Road: ${road.name}`);
  if (checkpoint.elevationMeters !== null &&
      Number.isFinite(checkpoint.elevationMeters)) {
    detail.push(`Elevation: ${checkpoint.elevationMeters} m`);
  }
  return detail.join("\n");
}

export function clusterQuickInfo(members) {
  const names = members.slice(0, 4).map(item => item.checkpoint.name);
  const remaining = members.length - names.length;
  return `${members.length} checkpoints\n${names.join("\n")}` +
    (remaining > 0 ? `\n+${remaining} more — zoom in` : "\nZoom in to select");
}
