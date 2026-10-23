> **v0.2.9 additive graph editing (schema v3, no migration):** An intermediate `via[]` coordinate is a visual bend, **not** a routable graph node. The explicit GM `create-junction` edit uses the chosen owning `segmentId`, `edgeIndex` and optional `atVertex` to replace that point by a stable `nodes[]` entry and two connected `segments[]` entries retaining the same logical `roadId` and original first segment ID. IDs, indices, geometry and graph validity are checked and staged through the existing revision-checked Save Points path. Waypoints [+] uses the same edit after picking an existing edge; Shift-click promotes a selected bend. A junction overlapping another road is **not** connected until the separate `connect-node` operation is GM-confirmed. Orphaned historical nodes are excluded from the active Waypoints list. No arbitrary waypoint name, new native Note, Region metadata or distance override is stored.

# Atlas data model — schema v3 (Phase 2c v0.2.8)

**Current contract:** Each Foundry Scene stores one validated `flags.fvtt-atlas-navigation.atlas` payload. Schema v3 separates a **named logical road** from one or more **graph segments**, which can be split at junctions without duplicating a name in the road list.

```json
{
  "schemaVersion": 3,
  "coordinateSpace": "image",
  "revision": 0,
  "enabled": false,
  "calibration": null,
  "nodes": [],
  "roads": [],
  "segments": []
}
```

Example of one main road split by a spur: `roads: [{id:"main",name:"Main Road"},{id:"spur",name:"Spur"}]`; two distinct segments have `roadId:"main"`, and the spur segment has `roadId:"spur"`. Segments retain independent stable `id`, shared `from`/`to` node IDs, ordered interior `via` points, and `bidirectional:true`. `roads[].id` and `segments[].id` belong to separate ID namespaces.

Migration is deliberately explicit:
1. Legacy schema v1 (absolute padded-canvas coordinates) must first be anchored into image-local v2 coordinates, using the GM-confirmed currently aligned Scene image origin.
2. Populated v2 Scene data must be converted with **Organize named roads (v0.2.6)**. This retains every junction ID, segment ID, geometry, name, revision history (incrementing revision for the write), and inactive historical calibration. Each v2 named segment initially becomes one v3 logical road with the same ID.
3. **Identically named v2 segments are not merged by assumption.** The GM can explicitly **Merge connected roads** when two logical road groups share a junction; merging only reassigns the segment `roadId` and removes the secondary name, never changing geometry or junction IDs. Split operations on v3 segments preserve their parent `roadId`.
4. New Scenes start with empty v3; empty old Scenes upgrade when their first road is saved.

Since v0.2.7, potential connections are proposed and confirmed by the GM before affecting topology. On newly drawn roads, Finish Road prompts for any endpoint snap (including shortcuts touching two distinct named roads). Dragged junctions similarly prompt before attaching to a different existing graph node or a road interior. Declining a dragged-junction connection reverts that pending drag; approving splits the target segment if necessary, retains logical `roadId` ownership and road names, and stages the change for Save Points. Shared source junctions bring all their incident road sections into the new connection. A node-target attachment removes the now-unused source junction record; an edge-target split reuses the source junction ID and allocates one new segment ID. There is **no silent name merge**—the separate Merge connected roads action alone changes group membership. Orphan nodes from deletions are never offered as new snap destinations.

In v0.2.8 a GM can explicitly **detach one named road from a shared node** by Alt/Option-clicking its gold edit handle and confirming. The `detach-node` staged edit allocates one new node ID at the old node's coordinates and rewires only segments with the selected `roadId` that touch the old node. Other road IDs and their incident sections stay at the old node; no edges, roads, names or shapes are removed, and the original node stays valid. The detached handle can then move independently or attach elsewhere with another confirmation. Detach is rejected when no other named road shares the node. Undo/Cancel and revision-checked Save Points replay the operation without a schema migration.

**Counts in the Scene Atlas list describe internal graph segments**, not the number of independently drawn lines or visually distinct branches. Splitting one road's segment at a new junction adds an internal segment, even though its logical road name and visual continuity stay the same.

Road geometry editor operations are validated, revision-checked and staged in memory until **Save Points**. `move-node` changes a shared graph node and thus all connected segments; `connect-node`, `move-bend`, `insert-bend`, and `remove-bend` only alter the appropriate segment's interior `via` point list. Undo/Cancel discard uncommitted work. No Foundry `WallDocument` or `DrawingDocument` is created, and no movement/sight collision is introduced. The module uses native Scene Grid exclusively for future distance, never an independent scale.

The archived v2/v1 design below is retained to document backwards compatibility, not as the current write format.

---

## Archived schema v2 — Phase 2c v0.2.5

**Current contract:** The Scene flag remains `flags.fvtt-atlas-navigation.atlas`. New Scene atlases and successfully anchored legacy graphs use `schemaVersion: 2` and `coordinateSpace: "image"`. Positions are **local to the top-left of the Scene background image**, not the whole padded canvas. When authoring, subtract the Foundry canvas `dimensions.sceneX/sceneY`; when drawing, add them back. Native Scene Grid remains the exclusive authority for measurement.

```json
{
  "schemaVersion": 2,
  "coordinateSpace": "image",
  "revision": 0,
  "enabled": false,
  "calibration": null,
  "nodes": [],
  "segments": []
}
```

- Existing v1 payloads are accepted intact for viewing, rename and delete. Their positions remain canvas-absolute until a GM confirms migration in an aligned Scene.
- Migration: validate v1, subtract the **current** image origin from every node and `via` point, preserve names and IDs, switch schema to v2, and increment the revision through one permission-checked `scene.setFlag`. Do not guess old Scene padding or migrate behind the user's back. Once v2, changing padding alters only the canvas origin, not stored geometry.
- When a new road endpoint is within 14 local image pixels of an existing node, reuse the node. Otherwise, if it is within 14 pixels of an existing road *interior*, split that road into two segments sharing a newly created stable node; the old ID stays on the first half and both halves retain the old name. The new segment reuses that junction. Snap only endpoints, never arbitrary crossings or internal bends; Alt disables endpoint snapping.
- A saved road can be **reshaped** by replacing its intermediate `via` points only; endpoint node IDs and connectivity cannot change through this command. All updates validate the complete graph and check the current revision.
- Schema v2 remains **system agnostic** and uses existing Foundry Regions only in later milestones; no terrain math, routing or player visibility is invented here.

---

## Historical schema v1 contract and rationale


**Status:** schema v1 remains unchanged in Phase 2c v0.2.4. The module can now add, rename and remove one named segment/road at a time from the GM Atlas tab, while distances continue to rely exclusively on native Scene Grid. Historical calibration is preserved but inert. Explicit waypoint editing, splitting existing road segments, and routing are deferred.

## 1. Storage boundary

An atlas belongs to one Foundry `Scene`. The Phase 2a module reads and writes:

- Module namespace: `fvtt-atlas-navigation`
- Flag key: `atlas`
- API pattern (subject to v14 smoke test): `scene.getFlag("fvtt-atlas-navigation", "atlas")` / `scene.setFlag("fvtt-atlas-navigation", "atlas", value)`
- Full conceptual path: `flags.fvtt-atlas-navigation.atlas`

Keep authored roads in this single versioned payload initially; **do not** scatter the same source of truth across Drawings, Token documents, world settings, or duplicated client caches.

The canonical network is always the **validated persisted model**, never the graphics, the computed route, or a temporary cursor state.

## 2. Proposed version 1 JSON

```json
{
  "schemaVersion": 1,
  "revision": 1,
  "enabled": true,
  "calibration": null,
  "nodes": [
    { "id": "junction-a", "x": 100, "y": 100 },
    { "id": "junction-b", "x": 500, "y": 100 },
    { "id": "junction-c", "x": 500, "y": 400 }
  ],
  "segments": [
    {
      "id": "road-ab",
      "from": "junction-a",
      "to": "junction-b",
      "via": [{ "x": 300, "y": 80 }],
      "name": "Western Road",
      "bidirectional": true
    },
    {
      "id": "road-bc",
      "from": "junction-b",
      "to": "junction-c",
      "via": [],
      "name": "Southern Track",
      "bidirectional": true
    }
  ]
}
```

This is one connected three-junction graph. Its `via` coordinates are **interior** polyline points, not duplicated endpoints. Distances are intentionally **not** stored or computed by applying a manual pixels-to-miles scale. Phase 3 will measure the ordered Scene-space road path with Foundry's native Grid API.

### Field contract

| Field | Type | Meaning / constraint |
| --- | --- | --- |
| `schemaVersion` | positive integer | Persisted schema for forward migration; initially `1` |
| `revision` | nonnegative integer | Detects stale dialogs; not an atomic transactional lock |
| `enabled` | boolean | Legacy compatibility field (retained in v1). The v0.2.4 UI derives active Atlas state from the presence of segments; adding a road sets this flag true and deleting the last sets it false. Older `enabled:true` with no segments shows as unconfigured. |
| `calibration` | null or legacy object | New atlas flags use `null`. Old `{source:"manual",unitsPerPixel,unit}` is supported for lossless v1 reading/writing but **ignored** as a distance source. Never add new manual overrides. |
| `nodes[]` | array | Authored junctions with unique stable IDs and finite pixel coordinates |
| `segments[]` | array | Authored road segments with unique stable IDs and valid endpoint IDs |
| `segments[].via` | ordered array | Interior Scene-space polyline points, from `from` toward `to` |
| `segments[].bidirectional` | boolean | `true` in v1; reserve directed edges for a later explicit feature |
| `segments[].name` | string | Optional GM road label, never an identifier |

**Current v1 runtime behavior (v0.2.4):** all distances and units come from the native Scene Grid regardless of `calibration`. New Scenes store `calibration:null`; old manual objects remain intact **only as dormant historical data** and have no precedence. Never persist `calibration.source = "scene-grid"` in v1. A new unconfigured Scene has no `atlas` flag and reads as `{schemaVersion: 1, revision: 0, enabled: false, calibration: null, nodes: [], segments: []}` without writing. Only a GM road add/rename/delete persists new Atlas data. The obsolete activation form is no longer presented.

## 3. Coordinates and topology

- Schema v1 currently stores absolute **canvas pixel coordinates** from `canvas.canvasCoordinatesFromClient`. They remain invariant when merely zooming or panning the camera, but the v0.2.4 owner test found they **do not remain anchored to the background image** when Scene padding changes (0.00 → 0.05). This is an unresolved coordinate-space defect; do not assume v1 saved positions are already image-relative.
- Road distance comes **exclusively from Foundry's native Grid path measurement** on the active Scene. Plain Euclidean pixel lengths are useful for geometry validation or rendering, not authoritative travel units. The Phase 3 adapter will use `canvas.grid.measurePath(waypoints).distance` and verify square, hexagonal, and gridless behavior against the native ruler.
- Nodes are topological junctions. Only equal **node IDs** connect roads; matching x/y pixels or visually crossing polylines alone do not connect them.
- Every `from`/`to` must reference a currently existing node; a segment cannot connect a node to itself in v1.
- Duplicate node or segment IDs, nonfinite coordinates, invalid legacy calibration objects, and degenerate zero-length geometry are invalid.
- Editing node coordinates updates every attached segment geometrically, because endpoints are read from node references.
- Deleting a connected node requires an explicit UX policy (prevent deletion, or confirm cascaded segment deletion). Never leave dangling references.
- If the user later wants bridges and roads to cross without intersecting, explicit IDs already represent that distinction.

The example uses hand-readable IDs. Actual IDs should be generated uniquely and remain stable under edits, saves, exports, and imports.

### Phase 2c editor subset

- A Roads [+] authoring session stores one segment for each finished click-to-place path. The first/last points become nodes and interior bends become `via[]`, without any schema extension.
- A new road endpoint within 14 Scene pixels of an **existing node** reuses that stable node ID. Snapping to arbitrary interior `via[]` points or splitting an existing segment is not implemented in v0.2.4; visually crossing roads are not automatically connected. Owner testing confirmed that clicking the middle of an existing road does **not** connect it to a new road.
- Renaming changes only `segments[].name`. Deleting removes only the chosen segment and intentionally retains even unreferenced nodes, protecting shared junctions and leaving future cleanup to an explicit tool.
- The segment ID and node IDs are stable across saved renames/reloads. A revision check rejects stale concurrent edits (not an atomic multi-GM lock). GMs should coordinate ownership.

### Upcoming anchoring and junction migration design (not implemented)

Foundry v14 `SceneDimensions.sceneX`/`sceneY` and `sceneRect` expose the unpadded Scene rectangle within the larger canvas ([API](https://foundryvtt.com/api/v14/interfaces/foundry.documents.types.SceneDimensions.html)). Phase 2c must define a **background-image-relative** coordinate contract (and adapter conversions at the canvas boundary) so padding/shift changes do not displace saved roads. Distinguish changes to the *map image's placement* from actually resizing the image. Do not infer a missing v1 origin or rewrite old points without a reversible migration/back-up and a live Foundry test. Preserve stable node IDs and path geometry.

Joining an existing road at a non-junction location requires a deliberate graph operation: locate an interior point on an edge, split that edge into two edges joined by one new node, then attach the new road to that node. Preserve the original line's name and attributes and avoid silently connecting unrelated crossings. Its persistence API must reject stale revisions and invalid graphs.

Per-road visual style, smoothing/label preferences, and display hide/show require a separately reviewed schema extension; they must not be injected into v1 because the existing validator explicitly rejects unknown keys. UI-only hiding is **not** confidential player visibility.

## 4. Derived graph, not stored twice

The routing engine builds an in-memory adjacency list from validated nodes/segments.

For each segment:

1. Form a polyline: `node[from]` → each `via` point → `node[to]`.
2. Validate a positive finite **pixel-space geometric** length; in Phase 3, ask the Foundry grid measurement adapter for the road's native distance when computing routes.
3. Add an edge from `from` to `to` using a verified native-distance weight. Investigate grid step/diagonal semantics: if full-path measurement is not additive across independently measured segments, plain scalar-edge Dijkstra alone is insufficient; preserve measurement state or check full routes.
4. For a bidirectional segment, add the reverse edge with reverse traversal geometry.
5. Use Dijkstra for the shortest-distance query; apply deterministic tie-breaking for equal-distance candidates.

A future optimizer may add a spatial index or cached graph keyed to the data revision, but the adjacency list and shortest path are **derived**. They do not need a second permanent flag.

### Temporary query and result shapes

These are in-memory interface examples, **not** Scene flags:

```ts
type RouteQuery = {
  sceneId: string;
  startNodeId: string;
  endNodeId: string;
};

type RouteResult = {
  sceneId: string;
  nodeIds: string[];
  segmentIds: string[];
  distancePixels: number;
  distanceUnits: number | null; // measured natively; null when unavailable
  path: Array<{ x: number; y: number }>; // ordered Scene coordinates
};
```

For a disconnected graph, return an explicit typed "unreachable" outcome; do not return a straight line or silently fall back to Euclidean distance between endpoints.

## 5. Places, Notes, and linked lore

Do **not** copy journal text, permissions, or full pin records into `atlas`. Foundry `NoteDocument` already supports placed notes linked to `JournalEntry` / `JournalEntryPage`; use IDs/UUIDs only if an explicit connection to a graph junction is needed.

Potential later extension:

- A Note/POI can be route-selectable by snapping its Scene position to a segment with an explicit tolerance.
- The snap creates **temporary** virtual graph nodes for the query.
- If a stable POI-to-junction association is needed, model it as a separately versioned, optional reference, validating stale links without deleting the user's original Note.
- Native Note and Journal permissions remain authoritative for lore visibility.

Do not introduce arbitrary namespaced flag metadata on Note/Journal documents unless a real use case demands it.

## 6. Persistence and migrations

- Always validate and normalize on read, without mutating the Scene as a side effect of viewing it.
- Only an authorized GM action may persist changes.
- Before writing, validate the entire replacement payload, increment the revision, and re-read if necessary.
- A `revision` field alone **does not** provide atomic compare-and-swap; implement collision handling or explicitly support only one simultaneous editor in the first release.
- Keep JSON compatible (no `Map`/`Set`, class instances, `undefined`, cyclic objects, or executable values).
- On a future breaking change, add a pure migration `v1 → v2`, make backups/import-export practical, and never silently discard unknown saved content.
- For import, validate the schema and bounded array sizes before allowing an explicit user-approved replacement. An import operation must not execute or trust embedded script/HTML.
- Consider payload size and update frequency as the network grows; if these become limiting, decide on a more granular authorized storage model, with a migration plan.

## 7. Privacy boundary

A flag on a Scene is not automatically protected just because only the GM sees the UI rendering it. In v1 all road-network authoring and navigation is **GM-only**, and the saved model must not be assumed confidential if a player has access to the Scene.

Do not add `isHidden` and interpret that as secure storage. A future player/reveal schema needs an actual transport/access design, verified with two clients, before launch.

## 8. Revised Phase 2 design: Scene Grid and native Region links

**This is a design for future schema revisions, not a change to implemented schema v1.** The current `atlas-model.js` validator does not accept extra fields or `calibration.source = "scene-grid"`. Do not write new shapes using the v1 validator.

### Native Scene Grid exclusively

- Scene fields `grid.size`, `grid.distance`, and `grid.units` remain the sole authoritative distance configuration. Atlas Phase 2c v0.2.4 still displays those fields read-only without an Atlas-specific pixels-per-unit ratio.
- No manual override UI, persisted source selection, or global Metric/Imperial scale choice. The GM changes native distances only in the Scene Grid tab.
- Existing v1 manual objects remain in the flag for lossless backwards compatibility, but **do not affect Atlas measurements**. Road add/delete synchronizes the legacy `enabled` flag while retaining old calibration exactly; a separately reviewed migration may eventually remove obsolete fields.
- For each road polyline, the later Foundry adapter uses public v14 `canvas.grid.measurePath(waypoints).distance`, not `polylineLength * grid.distance / grid.size`. The latter is not generally ruler-equivalent on square/hex grids. Verify grid snapping, intermediate waypoint semantics, and distance additivity in actual v14 before finalizing shortest-path edge weights.
- Recalculate native distances after Scene Grid changes without mutating authored road polylines.
- A later optional conversion of **display labels only**, if ever approved, may recognize metric/imperial units but cannot replace native measurements.

### Native Regions as geometry and movement-cost source of truth

Foundry v14 `RegionDocument` instances own their names, shapes, holes, levels, and Behaviors. Native behaviors, including `Modify Movement Cost` and any behaviors registered by the active game system, determine token movement costs. Atlas must not duplicate Region geometry **or** store an independent terrain speed multiplier.

**Proposed Atlas association only** (future versioned schema; *not* part of implemented Scene atlas v1):

```json
{
  "schemaVersion": 1,
  "linked": true
}
```

A namespaced flag on the Region (for example `region.getFlag("fvtt-atlas-navigation", "atlas")`) is one candidate. Confirm its exact name, schema validation, and link lifecycle in Phase 2d. The Region's native `name` is the default Atlas label. Optional organizational tags are **purely decorative** and never interpreted as movement costs. No `speedMultiplier` or `terrainType` rule is required.

- An unlinked Region is excluded from **Atlas planning**, but its native Behaviors still apply to **real token movement**. Do not disable or alter Behaviors when unlinking.
- Region IDs/UUIDs remain stable references; deletion or renaming causes recoverable UI state, never silent road deletion.
- The native editor remains the only place to configure terrain Behaviors. Atlas can show active Behavior names/status but does not edit or serialize their internal system-specific data.
- The active party token, movement action (walk/fly/etc.), elevation/level, and the Region's Behavior configuration matter for calculating movement costs.

### Native terrain-aware movement preview (proposed Phase 3b)

Foundry v14 publicly documents `Token#createTerrainMovementPath`, which inserts intermediate waypoints at relevant Region entry/exit boundaries, resolves applicable Behavior terrain effects, and stores derived terrain data on the movement path. `Token#measureMovementPath` reports movement measurement for that token. These APIs are promising **non-mutating calculations** but require real v14 runtime tests of the correct waypoint options and behavior in varied game systems.

For each candidate Atlas road route:

1. Keep its road distance measured with Foundry's native Grid path API as **distance**, unchanged by terrain.
2. Build a prospective movement path for the **selected party token** along the route, without calling `move` or changing any Token/Region document.
3. Delegate terrain/Region handling and cost aggregation to the Foundry movement pipeline, including movement mode, shape/size, elevation, Behavior enablement, and overlapping native effects. Do **not** implement a competing road-polygon clipping + multiplier engine, a `slowest-wins` policy, or a hand-written `speedMultiplier` formula.
4. Decide during testing whether the native pipeline can safely restrict effects to Atlas-linked Regions. If it cannot, disclose that all applicable native Regions affect cost or defer linked-only terrain-cost mode; no silent false filtering.
5. Return `distance` and native-derived `movementCost` as distinct properties. The actual result shape and units will be documented only after integration tests.
6. If no suitable token exists, show geometric distance and clearly mark movement cost **unavailable**. Do not create or automatically move a token.
7. Conversion to travel hours/days is a **different** feature requiring a chosen party travel speed and explicit treatment of scale; movement cost is not by itself a universal time unit.

Recalculate future derived costs when Region shapes/Behaviors, link flags, Scene Grid, road graph, selected token, or movement mode changes; never rewrite canonical road or Region data as a side effect. Graph connections remain explicit node IDs, regardless of Region intersections.

## 9. Deferred data extensions

- Optional overland travel-speed profiles and time estimates, explicit road closures and one-way rules; native movement-mode/terrain precedence remains Foundry's responsibility.
- Named saved itineraries separate from canonical roads.
- Cross-Scene atlas transitions and multi-Scene route IDs.
- Per-user explored/revealed layers and filtered route projections.
- Versioned export/import package format.

Do not append speculative fields to v1 JSON merely to anticipate these features. See [Revised Phase 2 design](PHASE2_DESIGN.md).

## References

- [Foundry v14 Scene API](https://foundryvtt.com/api/v14/classes/foundry.documents.Scene.html)
- [Foundry v14 API index](https://foundryvtt.com/api/v14/)
- [Architecture proposal](ARCHITECTURE.md)
- [Milestones](ROADMAP.md)
- [Phase 2 revised Scene, road, and Region design](PHASE2_DESIGN.md)
- [Foundry v14 native Region API](https://foundryvtt.com/api/v14/classes/foundry.documents.RegionDocument.html)
- [Foundry v14 Token movement-path and cost API](https://foundryvtt.com/api/v14/classes/foundry.canvas.placeables.Token.html)
- [Foundry v14 native Grid path measurement API](https://foundryvtt.com/api/v14/classes/foundry.grid.BaseGrid.html)
