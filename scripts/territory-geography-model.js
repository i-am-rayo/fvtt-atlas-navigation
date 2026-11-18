/** Pure Atlas geographic taxonomy and Road-directory projection (no Foundry). */
export const GEOGRAPHY_SCHEMA_VERSION = 1;
export const GEOGRAPHY_KINDS = Object.freeze({
  continent: "Continent", city: "City", town: "Town",
  village: "Village", settlement: "Settlement", area: "Area"
});

const validId = value => typeof value === "string" &&
  /^[A-Za-z0-9_-]{1,128}$/.test(value);

export function validateGeographyFlag(value) {
  if (value == null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      value.schemaVersion !== GEOGRAPHY_SCHEMA_VERSION ||
      !Object.hasOwn(GEOGRAPHY_KINDS, value.kind) ||
      Object.keys(value).some(k => !["schemaVersion", "kind", "parentRegionId", "roadOverrides"].includes(k))) {
    throw Error("Unsupported Atlas geography metadata; no Region data was changed.");
  }
  const parentRegionId = value.parentRegionId ?? null;
  if ((parentRegionId !== null && !validId(parentRegionId)) ||
      (value.kind === "continent" && parentRegionId !== null))
    throw Error("Invalid Atlas geographic parent Region.");
  const overrides = value.roadOverrides ?? {};
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides) ||
      Object.keys(overrides).length > 1000 ||
      Object.entries(overrides).some(([id,mode]) =>
        !validId(id) || !["include", "exclude"].includes(mode)))
    throw Error("Invalid Atlas Road/territory membership overrides.");
  return { schemaVersion: GEOGRAPHY_SCHEMA_VERSION, kind: value.kind,
    parentRegionId, roadOverrides: Object.fromEntries(Object.entries(overrides)) };
}

export function validateGeographyHierarchy(regionId, geography, lookup) {
  if (!geography) return;
  if (geography.kind === "continent" && geography.parentRegionId)
    throw Error("A continent cannot have a parent territory.");
  let next = geography.parentRegionId;
  const visited = new Set([regionId]);
  while (next) {
    if (visited.has(next)) throw Error("Territory hierarchy cannot contain a cycle.");
    visited.add(next);
    const parent = lookup.get(next);
    if (!parent || !parent.linked || !parent.geography || parent.invalid)
      throw Error("Select a currently Atlas-linked, classified parent Region.");
    if (parent.geography.kind !== "continent" && parent.geography.kind !== "area")
      throw Error("Parent territory must be a Continent or Area.");
    next = parent.geography.parentRegionId;
  }
}

/**
 * Pure many-to-many grouping. `roadSamples` contains actual road polyline
 * sample points in the same 2D coordinate system as `contains`. It is never
 * authoritative for movement or native Region Behaviors.
 */
export function buildTerritoryRoadDirectory({ territories, roads, roadSamples,
  contains, geometryAvailable = true }) {
  const classified = territories.filter(t => t.geography && !t.invalid);
  const known = new Set(roads.map(r => r.id));
  const direct = new Map(classified.map(t => [t.id, new Set()]));
  for (const territory of classified) {
    for (const road of roads) {
      const overrides=territory.geography.roadOverrides ?? {};
      const override=Object.hasOwn(overrides,road.id)?overrides[road.id]:null;
      const points = roadSamples.get(road.id) ?? [];
      const inferred = geometryAvailable && points.some(point => contains(territory, point));
      if (override === "include" || (override !== "exclude" && inferred))
        direct.get(territory.id).add(road.id);
    }
  }
  const byId = new Map(classified.map(t => [t.id, t]));
  const children = new Map(classified.map(t => [t.id, []]));
  const roots = [];
  for (const territory of classified) {
    const parent = byId.get(territory.geography.parentRegionId);
    if (parent && parent.id !== territory.id) children.get(parent.id).push(territory);
    else roots.push(territory);
  }
  const sorted = list => list.sort((a,b) =>
    (a.geography.kind === "continent" ? 0 : 1) -
    (b.geography.kind === "continent" ? 0 : 1) ||
    a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const visit = (territory, ancestors = new Set()) => {
    if (ancestors.has(territory.id)) return null;
    const seen = new Set(ancestors); seen.add(territory.id);
    const descendants = sorted(children.get(territory.id) ?? [])
      .map(item => visit(item, seen)).filter(Boolean);
    const roadIds = new Set(direct.get(territory.id));
    for (const child of descendants) for (const id of child.roadIds) roadIds.add(id);
    return { id: territory.id, name: territory.name, kind: territory.geography.kind,
      roadIds: [...roadIds].filter(id => known.has(id)), children: descendants };
  };
  const tree = sorted(roots).map(item => visit(item)).filter(Boolean);
  const allocated = new Set(tree.flatMap(function collect(item) {
    return [...item.roadIds, ...item.children.flatMap(collect)];
  }));
  return { tree, unclassifiedRoadIds: roads.map(r => r.id).filter(id => !allocated.has(id)),
    allRoadIds: roads.map(r => r.id), direct };
}

/** Bounded read-only samples along authored Atlas graph polylines. */
export function sampleAtlasRoads(atlas, {origin={x:0,y:0},step=16,maxPerRoad=1024}={}) {
  if (![origin.x,origin.y,step].every(Number.isFinite) || step<=0 ||
      !Number.isSafeInteger(maxPerRoad)||maxPerRoad<1)
    throw Error("Native Scene geometry is unavailable for Road categorization.");
  const nodes = new Map((atlas.nodes??[]).map(node=>[node.id,node]));
  const samples = new Map((atlas.roads??[]).map(road=>[road.id,[]]));
  const edges = new Map((atlas.roads??[]).map(road=>[road.id,[]]));
  const truncated = new Set();
  for (const segment of atlas.segments??[]) {
    const target = edges.get(segment.roadId);
    if(!target)continue;
    const route = [nodes.get(segment.from),...(segment.via??[]),nodes.get(segment.to)]
      .filter(point=>Number.isFinite(point?.x)&&Number.isFinite(point?.y));
    for (let i=1;i<route.length;i++) {
      const a=route[i-1],b=route[i];
      const length=Math.hypot(b.x-a.x,b.y-a.y);
      if(Number.isFinite(length)&&length>0)target.push({a,b,length});
    }
  }
  for(const [roadId,segments] of edges){
    const target=samples.get(roadId);
    const desired=segments.reduce((count,e)=>count+Math.ceil(e.length/step)+1,0);
    if(!segments.length)continue;
    if(desired<=maxPerRoad){
      for(const {a,b,length} of segments){
        const count=Math.max(1,Math.ceil(length/step));
        for(let j=0;j<=count;j++){
          const t=j/count;
          target.push({x:a.x+(b.x-a.x)*t+origin.x,
            y:a.y+(b.y-a.y)*t+origin.y});
        }
      }
      continue;
    }
    // A capped Road must still sample its ENTIRE network. Previously the
    // first 1024 points consumed the budget, hiding distant Region crossings.
    truncated.add(roadId);
    const total=segments.reduce((length,e)=>length+e.length,0);
    if(!Number.isFinite(total)||total<=0)continue;
    let edge=0,prior=0;
    for(let i=0;i<maxPerRoad;i++){
      const distance=maxPerRoad===1?0:total*i/(maxPerRoad-1);
      while(edge<segments.length-1&&distance>prior+segments[edge].length){
        prior+=segments[edge].length;edge++;
      }
      const {a,b,length}=segments[edge],t=Math.max(0,Math.min(1,(distance-prior)/length));
      target.push({x:a.x+(b.x-a.x)*t+origin.x,y:a.y+(b.y-a.y)*t+origin.y});
    }
  }
  return {samples,truncated};
}
