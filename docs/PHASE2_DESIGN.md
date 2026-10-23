# Phase 2 revised design — Scene Atlas, roads, waypoints, and Regions

**Decision date:** October 23, 2026. **Target:** Foundry VTT v14, system agnostic.
**Status:** approved design direction, not implemented. The existing Phase 2a v0.2.1 test build, its Scene flags, and the draft PR remain unchanged until a separately reviewable implementation slice is ready. Route-time computation belongs to Phase 3, not this design-only revision.

## 1. GM experience and ownership

Show an **Atlas** section/tab in each native Scene Configuration sheet alongside Basics, Grid, and Levels. This replaces the awkward control that v0.2.1 currently prepends above the native Scene tabs.

| Atlas section | GM work | Canonical data |
| --- | --- | --- |
| **Roads** | Add/rename/select/delete roads; list connected segments and visibility metadata | Versioned module data on that Scene |
| **Waypoints / junctions** | Add/list/rename or associate waypoints with native map Notes; edit graph connections | Versioned Scene road graph; optional references to Note UUIDs |
| **Terrain Regions** | Link/unlink **existing native Regions**; show terrain tag, travel multiplier, warnings, and an action to open native Region configuration | Native Region shapes/name/levels; module-specific terrain metadata |
| **Measurement** | Read the native Scene's grid size/distance/unit; offer an explicit manual override only when necessary | Native Scene Grid, or a deliberate per-Scene override |

A GM should be able to find the Atlas section on any Scene without explicitly enabling a special mode. For existing worlds, preserve the v1 `enabled` flag until a documented, lossless migration defines what replaces it. Opening a sheet alone must not write flags.

**The tab is a management surface, not a spatial drawing canvas.**

- Author junction positions, polyline road geometry, connections, and selections using a GM-only Atlas canvas toolset.
- Use **Foundry's native Region canvas controls** to draw/edit geographical areas and holes. The Atlas module must not reinvent or copy a second set of Region polygons.
- Selecting a road/waypoint/linked Region in the Atlas tab may focus/highlight it on the map without changing its underlying document.
- Keep all map-space coordinates independent from camera zoom/pan.

### Foundry v14 UI integration rule

Investigate supported ApplicationV2/SceneConfig tab extension conventions first. Do not monkey-patch private SceneConfig methods or overwrite core templates to add a tab. If a stable hook-based tab cannot be implemented safely, provide an in-sheet Atlas entry that opens a standalone native-looking Atlas manager, and validate its placement with an actual Foundry v14 build. The current top-of-form banner is not an accepted final UI.

## 2. Distance: use Scene Grid as primary source

Foundry's native Scene Grid exposes `grid.size` (pixels per space), `grid.distance` (distance per space), and `grid.units` (unit label). These are authoritative for the Scene by default.

- Use native Scene measurements when valid. A simple continuous-map conversion is `unitsPerPixel = grid.distance / grid.size`; verify hexagonal and gridless measurement semantics during implementation rather than assuming the grid ruler and a drawn polyline are identical.
- Display the unit from the Scene Grid. Do **not** add a second required km/mi field to every atlas.
- A manual per-Scene scale override may be used for maps whose grid measurements do not represent geographic travel. Its provenance and units must be explicit in the UI.
- A possible later **global display preference** is `Follow Scene Units` (default), `Metric`, or `Imperial`, with conversions only for recognized units. This must never silently rewrite the native Scene measurement or convert arbitrary custom units.
- Existing v1 manual calibrations (e.g. 0.05 km/pixel) remain intact until a GM explicitly opts into Scene Grid or approves a versioned migration. Warn when both scales differ.

## 3. Regions are native geometry, Atlas tags are travel semantics

Reuse each Scene's embedded `RegionDocument` collection, including multi-shape Regions, holes, and native placement/level constraints.

**Linking convention (proposed, not yet a persisted schema):**

- A GM chooses an existing Region from a searchable list in the Scene's Atlas tab or links it from native Region configuration.
- Use a **namespaced module flag** on the Region, such as `flags.fvtt-atlas-navigation.terrain`, to associate it with Atlas Navigation. Do not infer a rule from free-text Region names and do not overwrite native Region behaviors.
- A conceptual metadata value is `{ tag: "rocky", speedMultiplier: 0.5, enabled: true }`. Define a versioned validator and migration contract before persisting this shape. The native Region `name` remains its visible label; `tag` is a controlled semantic category.
- The tag should be configurable and reusable (e.g. rocky, marsh, snow, river), but **the actual multiplier is explicit**. No game-specific movement rule is assumed by the word "rocky".
- Ordinary Regions without Atlas metadata have **no atlas travel effect**. They keep all existing native Behaviors, shapes, visibility, and permissions.
- Provide a clear unlink/reset action that removes only the Atlas metadata, not the Region or its native behaviors.

### Relationship to Foundry's built-in movement-cost behavior

Foundry v14 already supports the native **Modify Movement Cost** Region Behavior, primarily for token movement, with movement action choices that may vary by game system. Atlas travel-time estimation is a separate, tokenless, system-neutral calculation.

Do **not** automatically interpret, duplicate, or overwrite that behavior. Investigate explicit opt-in interoperability later, with tests across movement modes and systems; show an explanatory hint if a linked Region already has native movement-cost behavior.

## 4. Terrain-aware travel: length stays length, speed affects time

For a road drawn as an ordered Scene-space polyline:

1. Determine its physical length using the chosen Scene calibration.
2. Intersect **each piece of the polyline** with linked Region polygonal areas (including disjoint shapes and holes), yielding intervals of actual length inside/outside those Regions.
3. Filter Regions by applicable level/elevation (where relevant); do not treat roads on bridges or other levels as automatically inside terrain beneath them.
4. Use an explicit multiplier for each affected interval. For a base speed `v` and interval distance `d`, travel time is `d / (v * speedMultiplier)`.
5. Sum interval times. Keep `distance`, `travelTime`, and `routeCost` separately; a 50%-speed region doubles time **only for the distance traversed inside it**.
6. For overlapping Atlas Regions, the **initial proposed policy** is to use the slowest applicable speed multiplier in each overlapping interval, not multiply all modifiers. Make this policy visible and test it; consider a documented priority model only if needed.
7. Region visibility is presentation, not a rule for whether travel costs apply. Deleting a Region or unlinking it must not corrupt roads. On Region changes, recompute derived intervals on the next query (or invalidate a cache), not silently rewrite road geometry.

Example: a 10 km road with 4 km in a rocky Region at 50% speed, traveled at a nominal 5 km/h, takes `6/5 + 4/(5×0.5) = 2.8 hours`; the distance stays 10 km. A second route can be longer yet faster.

Never use a speed multiplier of zero as a division-by-zero shortcut for road closures. An explicit impassable/closed state requires its own semantics and tests.

## 5. Phase gates and implementation sequence

The owner authorized Phase 2 development, **not automatic expansion of runtime Phase 3 scope**.

| Slice | Implement after review | Gate |
| --- | --- | --- |
| **2b — UI and native measurement** | Replace banner with native-looking Atlas management entry/tab; show Scene Grid scale with manual override; preserve v1 values | Two different Scenes, hex/gridless check, calibration migration tests |
| **2c — Road/waypoint authoring** | Scene Atlas list with plus controls; canvas road/junction editing; stable graph persistence and undo/confirmation | Connectivity, branch/crossing, save/reload, pan/zoom |
| **2d — Region linking** | Native Region picker/link, controlled terrain tags, multipliers and GM-only metadata; geometry preview and change invalidation | Multi-shape, hole, overlap, level, renamed/deleted Region fixtures |
| **3a — Shortest distance** | Pure geometry graph and shortest-distance route with route overlay | Existing Phase 3 MVP acceptance |
| **3b — Terrain-aware travel time** | Base travel speed, per-interval travel time, fastest-route option, explainable breakdown | New approval/Phase 3 gate; slowest-overlap and alternative-route tests |

A route that merely crosses a Region on screen must never be treated as terrain-affected without actual geometric intersection and matching elevation/level semantics. An Atlas Region must not accidentally turn into a graph junction; only explicit road-node IDs connect roads.

## 6. Data and permission safeguards

- The **Scene atlas flag remains canonical for road nodes/segments**. Region documents remain canonical for their shapes and levels. Atlas metadata on a Region is only an association and travel rule, not copied geometry.
- Pure geometry and routing algorithms must not import Foundry globals. A v14 adapter reads Region polygons/holes and grid data into validated primitives for unit testing.
- Use versioned migrations before extending the already implemented Scene atlas schema v1 or adding Region metadata. Preserve prior `enabled` and manual calibration values unless explicitly migrated.
- Treat linked Region IDs/UUIDs as references that can go stale. Missing/deleted links are a recoverable warning, not a reason to erase road data.
- Only authorized GMs can edit the network or terrain links; keep the first release GM-only. A hidden Region or UI control does not make Scene/Region flags confidential to players.
- Do not copy third-party game-system terrain data, token movement mode rules, or scripts into the module.

## Primary v14 references

- [Foundry v14 ApplicationV2 and tab architecture](https://foundryvtt.com/api/v14/modules/foundry.applications.html)
- [Native Grid Data](https://foundryvtt.com/api/v14/interfaces/foundry.documents.types.GridData.html)
- [Native Scene Regions guide](https://foundryvtt.com/article/scene-regions/)
- [RegionDocument API: polygons, polygon tree, levels, Scene ownership](https://foundryvtt.com/api/v14/classes/foundry.documents.RegionDocument.html)
- [v14 Region data: flags, shapes, levels](https://foundryvtt.com/api/v14/interfaces/foundry.documents.types.RegionData.html)
- [Canvas controls extension hook](https://foundryvtt.com/api/v14/functions/hookEvents.getSceneControlButtons.html)
