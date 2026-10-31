/** Read-only Atlas routing priorities. Never affects native Region Behaviors. */
export const REGION_ROUTING_PRIORITY_FLAG = "routingPriority";
export const DEFAULT_ROUTING_PRIORITY = 0;
export const REGION_ROUTING_ORDER_FLAG = "routingRegionOrder";

/** Scene-wide, explicit ordering: first matching Region takes precedence. */
export function orderedRoutingRegions(regions, order = null) {
  const ids = regions.map(region => region.id);
  if (order !== null && (!Array.isArray(order) || order.some(id =>
      typeof id !== "string") || new Set(order).size !== order.length)) {
    throw new Error("Atlas Region order is invalid; no routing priorities were changed.");
  }
  // Deleted Regions can leave stale IDs in this read-only ranking snapshot.
  const rank = new Map((order ?? []).filter(id=>ids.includes(id)).map((id,index)=>[id,index]));
  return [...regions].sort((a,b)=>
    (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) ||
    routingPriority(b.priority) - routingPriority(a.priority) || a.id.localeCompare(b.id));
}

export function moveRoutingRegion(regions, order, movingId, targetId) {
  const ordered = orderedRoutingRegions(regions, order).map(region => region.id);
  if (!ordered.includes(movingId) || !ordered.includes(targetId))
    throw new Error("Choose two existing Atlas-generated Regions.");
  if (movingId === targetId) return ordered;
  const after = ordered.indexOf(movingId) < ordered.indexOf(targetId);
  const next = ordered.filter(id => id !== movingId);
  next.splice(next.indexOf(targetId)+(after?1:0),0,movingId);
  return next;
}

export function routingPriority(value) {
  if (value == null) return DEFAULT_ROUTING_PRIORITY;
  if (!Number.isSafeInteger(value) || value < -100 || value > 100) {
    throw new Error("Atlas routing priority must be an integer from -100 to 100.");
  }
  return value;
}

/** Highest priority wins, stable region ID breaks equal-priority ties. */
export function resolveRoutingRegion(regions) {
  const sorted = [...regions].sort((a,b) =>
    (Number.isSafeInteger(a.rank) && Number.isSafeInteger(b.rank)
      ? a.rank - b.rank : routingPriority(b.priority) - routingPriority(a.priority)) ||
      a.id.localeCompare(b.id));
  return sorted[0] ?? null;
}

/** Pure geometric membership for Foundry polygon/ellipse Region shapes. */
export function regionContainsPoint(shapes, point) {
  let contained = false;
  for (const shape of shapes ?? []) {
    const obj = typeof shape.toObject === "function" ? shape.toObject() : shape;
    let inside = false;
    if (obj.type === "polygon") {
      const coords = obj.points ?? [];
      // Native shapes may store local polygon points with an origin, while
      // Atlas-generated corridor rectangles store absolute point coordinates.
      // Detect the frame conservatively from the polygon bounds rather than
      // subtracting the origin from every generated corridor.
      const xs=coords.filter((_,i)=>i%2===0),ys=coords.filter((_,i)=>i%2===1);
      const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
      const ox=obj.origin?.x??0,oy=obj.origin?.y??0;
      const local=Boolean(obj.origin) && (ox<=minX-(maxX-minX)||ox>=maxX+(maxX-minX)||
        oy<=minY-(maxY-minY)||oy>=maxY+(maxY-minY));
      const x = point.x-(local?ox:0), y = point.y-(local?oy:0);
      for (let i = 0, j = coords.length / 2 - 1; i < coords.length / 2; j = i++) {
        const xi = coords[2*i], yi = coords[2*i+1];
        const xj = coords[2*j], yj = coords[2*j+1];
        if ((yi > y) !== (yj > y) && x < (xj-xi)*(y-yi)/(yj-yi)+xi) inside = !inside;
      }
    } else if (obj.type === "ellipse" && obj.radiusX > 0 && obj.radiusY > 0) {
      const angle = -(obj.rotation ?? 0) * Math.PI / 180;
      const dx = point.x - obj.x, dy = point.y - obj.y;
      const x = Math.cos(angle)*dx - Math.sin(angle)*dy;
      const y = Math.sin(angle)*dx + Math.cos(angle)*dy;
      inside = (x/obj.radiusX)**2 + (y/obj.radiusY)**2 <= 1;
    }
    if (inside) contained = !obj.hole;
  }
  return contained;
}

/**
 * Piecewise routing estimate; sampling never changes the native Scene grid.
 * Cost is measured for every subdivision with the caller's native ruler.
 * A strictly bounded sample count avoids freezing large Scenes.
 */
export function createRegionCostMeasurement({ regions, measurePath, toCanvasPoint, gridSize,
  maxSamples = 4096, fallbackSurface = null, fallbackMultiplier = 1 }) {
  if (!Number.isFinite(gridSize) || gridSize <= 0 || typeof measurePath !== "function" ||
      typeof toCanvasPoint !== "function" ||
      !Number.isFinite(fallbackMultiplier) || fallbackMultiplier<=0)
    throw new Error("Native grid routing adapter is unavailable.");
  const stepSize = gridSize / 2;
  const describe = points => {
    let weightedPixels = 0, totalPixels = 0, count = 0;
    const slices=[];
    for (let i = 1; i < points.length; i++) {
      const from = points[i-1], to = points[i];
      const a = toCanvasPoint(from), b = toCanvasPoint(to);
      const subdivisions = Math.max(1, Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/stepSize));
      count += subdivisions;
      if (count > maxSamples) throw new Error("The route is too long for a safe terrain estimate. Use closer points.");
      for (let j=0; j<subdivisions; j++) {
        const fraction = n => ({x:a.x+(b.x-a.x)*n/subdivisions, y:a.y+(b.y-a.y)*n/subdivisions});
        const p = fraction(j), q = fraction(j+1), midpoint = fraction(j+0.5);
        const winner = resolveRoutingRegion(regions.filter(r => regionContainsPoint(r.shapes, midpoint)));
        const length = Math.hypot(q.x-p.x,q.y-p.y);
        totalPixels += length;
        weightedPixels += length * (winner?.multiplier ?? fallbackMultiplier);
        const label=winner?.surface ?? winner?.name ?? fallbackSurface ?? "Unspecified terrain";
        const key=winner?.id ?? (fallbackSurface ? "fallback:"+fallbackSurface : null);
        const last=slices.at(-1);
        if(last?.regionId===key)last.pixels+=length;
        else slices.push({regionId:key,regionName:winner?.name??null,
          terrain:label,multiplier:winner?.multiplier??fallbackMultiplier,pixels:length});
      }
    }
    // Native grid measurement of the whole leg is authoritative. Measuring
    // each sub-cell sample separately would overcount diagonal/grid rounding.
    const distance = measurePath(points.map(toCanvasPoint));
    if (!Number.isFinite(distance) || distance < 0) throw new Error("Native route distance is unavailable.");
    return {
      cost:totalPixels ? distance * weightedPixels / totalPixels : distance,
      slices:slices.map(item=>({regionId:item.regionId,regionName:item.regionName,
        terrain:item.terrain,
        multiplier:item.multiplier,distance:totalPixels?distance*item.pixels/totalPixels:0}))
    };
  };
  const measure = points=>describe(points).cost;
  measure.describe = describe;
  return measure;
}
