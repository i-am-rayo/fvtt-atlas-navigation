# Atlas data model — schema v1 (Phase 2a)

**Status:** schema v1 is now implemented for Phase 2a (atlas setup/calibration only). Road editing is deferred; validators already enforce node/segment integrity. This example illustrates the persisted contract.

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
  "calibration": {
    "source": "manual",
    "unitsPerPixel": 0.05,
    "unit": "mi"
  },
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

This is one connected three-junction graph. Its `via` coordinates are **interior** polyline points, not duplicated endpoints. The displayed distance of `road-ab` is approximately 20.10 mi, and `road-bc` is 15.00 mi, under the illustrative calibration.

### Field contract

| Field | Type | Meaning / constraint |
| --- | --- | --- |
| `schemaVersion` | positive integer | Persisted schema for forward migration; initially `1` |
| `revision` | nonnegative integer | Detects stale dialogs; not an atomic transactional lock |
| `enabled` | boolean | Whether this Scene is currently marked as an atlas; disabling preserves road data |
| `calibration.source` | string | `manual` initially; later `scene-grid` if confirmed appropriate |
| `calibration.unitsPerPixel` | positive finite number | Travel units per one Scene pixel; required before real-unit distance is shown |
| `calibration.unit` | short string | Unit code for display, e.g. `mi` or `km`; never assume every world uses miles |
| `nodes[]` | array | Authored junctions with unique stable IDs and finite pixel coordinates |
| `segments[]` | array | Authored road segments with unique stable IDs and valid endpoint IDs |
| `segments[].via` | ordered array | Interior Scene-space polyline points, from `from` toward `to` |
| `segments[].bidirectional` | boolean | `true` in v1; reserve directed edges for a later explicit feature |
| `segments[].name` | string | Optional GM road label, never an identifier |

**Current v1 runtime behavior:** calibration is manual or null. The planned use of native Scene Grid measurements is a **future derived input**, not an already implemented `calibration.source` value. If calibration is unknown, store `calibration: null` and do not invent miles/km. A new unconfigured Scene has no `atlas` flag and reads as `{schemaVersion: 1, revision: 0, enabled: false, calibration: null, nodes: [], segments: []}` without writing. Only an explicit GM save persists the flag.

## 3. Coordinates and topology

- Coordinates are stored in **Scene/image pixels** and remain invariant when the viewer zooms, pans, or resizes.
- Pixel-to-unit conversion is specific to the Scene. In implemented v1, a calibrated route's distance is the sum of its segment polyline lengths times manual `unitsPerPixel`. The revised Phase 2 design prefers native `scene.grid.distance / scene.grid.size` as the default **when validated**, with a deliberate override and v1 migration policy. Hex/gridless semantics require verification.
- Nodes are topological junctions. Only equal **node IDs** connect roads; matching x/y pixels or visually crossing polylines alone do not connect them.
- Every `from`/`to` must reference a currently existing node; a segment cannot connect a node to itself in v1.
- Duplicate node or segment IDs, nonfinite coordinates, negative/zero calibration, and degenerate zero-length geometry are invalid.
- Editing node coordinates updates every attached segment geometrically, because endpoints are read from node references.
- Deleting a connected node requires an explicit UX policy (prevent deletion, or confirm cascaded segment deletion). Never leave dangling references.
- If the user later wants bridges and roads to cross without intersecting, explicit IDs already represent that distinction.

The example uses hand-readable IDs. Actual IDs should be generated uniquely and remain stable under edits, saves, exports, and imports.

## 4. Derived graph, not stored twice

The routing engine builds an in-memory adjacency list from validated nodes/segments.

For each segment:

1. Form a polyline: `node[from]` → each `via` point → `node[to]`.
2. Calculate a positive finite geometric length.
3. Add an edge from `from` to `to` with that weight.
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
  distanceUnits: number | null; // null when calibration is absent
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

### Native Scene Grid as default measurement

- Native Scene fields `grid.size`, `grid.distance`, and `grid.units` describe its visual distance scale. A simple continuous-distance scale is `distance / size`, subject to hex/gridless validation.
- Use them **as read-only inputs** for the default route-distance display. An explicit manual override remains possible.
- Preserve existing manual calibration **as an override** until the GM opts into native Grid values; never silently reinterpret or delete v1 `{source:"manual",unitsPerPixel,unit}` objects.
- A future schema version should record source choice, override values, and migration provenance explicitly. A global Metric/Imperial setting, if introduced, is only a display conversion for recognized units, not a source of map-scale truth.
- Scaled route lengths are derived and can be recomputed after Scene Grid updates without mutating the authored road polylines.

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

1. Keep its geometric distance calculated from road polyline and Scene Grid/override as **distance**, unchanged by terrain.
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
