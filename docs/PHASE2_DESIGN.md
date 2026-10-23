# Phase 2 revised design — Scene Atlas, roads, waypoints, and Regions

**Decision date:** October 23, 2026. **Target:** Foundry VTT v14, system agnostic.
**Status:** approved design. Phase 2b Scene tab and native-only Grid measurement are implemented in the **v0.2.3 development build**. The owner confirmed tab placement/saving with v0.2.2; 0.2.3 awaits retesting. Phase 2c/2d and all Region-aware route computations are not implemented. The persisted Scene atlas schema remains v1 and draft PR #3 remains unmerged.

## 1. GM experience and ownership

The **v0.2.3 build** registers an **Atlas** tab in native Scene Configuration alongside Basics, Grid, and Levels. It replaces v0.2.1's awkward above-form control. A supported in-sheet Misc/Grid fallback is available for nonstandard sheets; its tab placement and saving were confirmed in Foundry v14 using v0.2.2.

| Atlas section | GM work | Canonical data |
| --- | --- | --- |
| **Roads** | Add/rename/select/delete roads; list connected segments and visibility metadata | Versioned module data on that Scene |
| **Waypoints / junctions** | Add/list/rename or associate waypoints with native map Notes; edit graph connections | Versioned Scene road graph; optional references to Note UUIDs |
| **Terrain Regions** | Link/unlink **existing native Regions**; show native Region name, active movement-related Behaviors, warnings, and an action to open native Region configuration | Native Region shapes/name/levels/Behaviors; minimal Atlas opt-in association only |
| **Measurement** | Display the native Scene's grid size/distance/unit; configure them only in the native Grid tab | Native Scene Grid exclusively; no Atlas scale flag |

A GM should be able to find the Atlas section on any Scene without explicitly enabling a special mode. For existing worlds, preserve the v1 `enabled` flag until a documented, lossless migration defines what replaces it. Opening a sheet alone must not write flags.

**The tab is a management surface, not a spatial drawing canvas.**

- Author junction positions, polyline road geometry, connections, and selections using a GM-only Atlas canvas toolset.
- Use **Foundry's native Region canvas controls** to draw/edit geographical areas and holes. The Atlas module must not reinvent or copy a second set of Region polygons.
- Selecting a road/waypoint/linked Region in the Atlas tab may focus/highlight it on the map without changing its underlying document.
- Keep all map-space coordinates independent from camera zoom/pan.

### Foundry v14 UI integration rule

Investigate supported ApplicationV2/SceneConfig tab extension conventions first. Do not monkey-patch private SceneConfig methods or overwrite core templates to add a tab. If a stable hook-based tab cannot be implemented safely, provide an in-sheet Atlas entry that opens a standalone native-looking Atlas manager, and validate its placement with an actual Foundry v14 build. The current top-of-form banner is not an accepted final UI.

## 2. Distance: native Scene Grid is the **only** measurement source

The GM uses the **Scene's own Grid tab** to set `grid.size` (pixels per space), `grid.distance` (distance per space), and `grid.units` (display unit). There is no Atlas-specific unit selector, scale, or manual override; the ruler and Atlas must not disagree because they consult different configuration.

- Phase 2b displays those native settings as read-only information. A simple `distance / size` ratio is **not** suitable as an authoritative measurement for paths crossing square/hexagonal grids (and may differ for gridless paths).
- In Phase 3, a Foundry adapter must measure actual road waypoints on the matching active Scene via the public v14 `canvas.grid.measurePath(waypoints).distance` API. Use the native result for route distance; do not independently apply a manual pixel-to-unit multiplier.
- Native measurement must be tested against the ruler for square, hexagonal, and gridless Scenes, as well as multisegment roads. Verify whether grid-dependent distances are additive before selecting graph edge weights and a shortest-path algorithm; if not, preserve measurement state or evaluate full candidate paths.
- Existing version-1 `calibration: {source:"manual",unitsPerPixel,unit}` objects are **legacy, dormant data**. Preserve them unchanged when a GM toggles Atlas or edits roads; do not display, apply, rewrite, or remove them without a separately approved migration. New Scenes store `calibration:null`.
- A future global Metric/Imperial **display-only** conversion could be separately reviewed, but it must never change the Scene's native measurement or introduce a second competing distance source.

## 3. Regions are native geometry **and** native movement behavior

Reuse each Scene's embedded `RegionDocument` collection, including multi-shape Regions, holes, native placement/level constraints, and already configured Behaviors. Atlas must **not** create another terrain rules engine.

**Linking convention (proposed, not yet a persisted schema):**

- The GM selects an existing Region from the Atlas tab or links it from native Region configuration. **Only linked Regions** participate in optional Atlas terrain-cost planning; ordinary unlinked Regions keep operating normally in Foundry.
- Store only a minimal **namespaced Atlas association**, e.g. conceptual `region.getFlag("fvtt-atlas-navigation", "atlas")` with `{ schemaVersion: 1, linked: true }`. Final schema, migration, storage placement, and validation require a review before implementation; do not write this conceptual shape to the current runtime.
- Use the **native Region name** for its visible label and list the relevant native Behavior names/status. Optional `rocky`, `marsh`, etc. labels may help organize the Atlas UI but **never imply a numerical travel rule**.
- Configure actual terrain effects in Foundry's existing **Region Behavior** editor. Do not store Atlas-specific `speedMultiplier`, replacement terrain types, or manual stacking/priority logic.
- Unlink removes only the Atlas association; it never deletes the Region, changes its shapes/levels/visibility, or disables its native Behaviors. Unlinked Regions can still affect actual token movement in Foundry.

### Which native Behaviors matter?

The GM-provided v14 screenshot shows **Difficult Terrain** and **Modify Movement Cost**. Core Foundry's documented `Modify Movement Cost` Behavior applies movement-mode-specific costs; other behaviors, such as `Difficult Terrain`, can be provided by the active game system. Their combined effect is not necessarily a constant 0.5× speed.

Foundry v14 documents a token-aware movement pipeline: `Token#createTerrainMovementPath` adds intermediate Region entry/exit segments and resolves applicable terrain effects, and `Token#measureMovementPath` measures token movement cost. Use these **public, non-mutating path calculation** APIs where supported rather than independently reimplementing Region clipping, token dimensions, elevations, movement action applicability, or overlapping modifier stacking. Verify exact call/waypoint contracts and compatibility in a real v14 test world before integrating.

Because this is **token-specific**, the future terrain-aware preview requires an explicit party token (or an approved, equivalent Foundry token context) on the Scene. Without one, Atlas can still show **geometric road distance**, but must say terrain-adjusted cost is unavailable; it must not quietly guess a modifier or create/move real tokens.

## 4. Terrain-aware cost and travel time are different quantities

1. Atlas builds a candidate road route from the authored road graph, preserving its Scene-space geometry and unaffected geometric distance.
2. For a linked-Region-aware preview, the Foundry adapter supplies the path and selected party token/movement action to the native terrain-aware movement pipeline. It must determine how to **limit terrain influence to linked Regions without overriding core behavior**; if native APIs cannot filter that safely, either explicitly use all applicable native Regions with a clear UI description or defer opt-in cost filtering after testing. Do not falsely report a selectively filtered result.
3. Let Foundry resolve entry/exit boundaries, elevations, token size, active Behaviors, and overlapping costs. The screenshot specifically indicates native **Modify Movement Cost** modifiers stack multiplicatively, so Atlas must **not** impose our previously proposed 'slowest Region wins' rule.
4. Keep `distance` and `movementCost` as separate outputs. If a 4 km interval has double movement cost, the actual road still has 4 km of geometry; the cost is computed by Foundry in its own units and mode.
5. Estimating **hours/days** from this cost needs an explicitly defined party travel speed and appropriate interpretation of the game system's movement scale. A combat movement-cost multiplier alone does **not** imply an overland miles-per-day value.
6. Changes to linked associations, Region geometry or Behaviors, party token, movement mode, Scene Grid, or road graph invalidate a prior preview. Recalculate without modifying roads, Region documents, or token position.

For Phase 2 we only build the association/inspection UI. **No terrain-adjusted routing, travel-time engine, or automatic token movement is implemented in Phase 2.** Phase 3a still targets shortest geometric route; native terrain-cost routing is proposed for Phase 3b and requires separate approval.

## 5. Phase gates and implementation sequence

The owner authorized Phase 2 development, **not automatic expansion of runtime Phase 3 scope**.

| Slice | Implement after review | Gate |
| --- | --- | --- |
| **2b — UI and native measurement** | **Implemented in v0.2.3, pending regression acceptance:** native Atlas tab, native Scene Grid only, legacy manual values safely dormant | Two different Scenes, hex/gridless settings, old manual values retained but ignored |
| **2c — Road/waypoint authoring** | Scene Atlas list with plus controls; canvas road/junction editing; stable graph persistence and undo/confirmation | Connectivity, branch/crossing, save/reload, pan/zoom |
| **2d — Region linking** | Native Region picker/link, optional display labels, active Behavior summary, and minimal GM-only association metadata; never edit native terrain costs | Multi-shape, hole, overlap, levels, enabled/disabled Behaviors, renamed/deleted Region fixtures |
| **3a — Shortest distance** | Pure geometry graph and shortest-distance route with route overlay | Existing Phase 3 MVP acceptance |
| **3b — Token-aware terrain cost/travel time** | Verify public token terrain-path APIs, preview native movement cost on roads, optional cost-aware routing; separate party speed/time conversion | New approval/Phase 3 gate; real v14 token/system tests, overlapping Behaviors, unavailable token handling |

A route that merely crosses a Region on screen must never be treated as terrain-affected without actual geometric intersection and matching elevation/level semantics. An Atlas Region must not accidentally turn into a graph junction; only explicit road-node IDs connect roads.

## 6. Data and permission safeguards

- The **Scene atlas flag remains canonical for road nodes/segments**. Region documents remain canonical for their shapes, levels, and movement-cost Behaviors. Atlas metadata on a Region is only an association, **never a duplicate travel rule**.
- Pure road geometry and shortest-distance routing algorithms must not import Foundry globals. A separate v14 adapter integrates Foundry token-aware terrain/movement calculations when that later phase is approved, with mocked adapter tests plus real v14 checks.
- Use versioned migrations before extending the already implemented Scene atlas schema v1 or adding Region link metadata. Preserve prior `enabled` and dormant legacy calibration values unless a future migration is explicitly approved.
- Treat linked Region IDs/UUIDs as references that can go stale. Missing/deleted links are a recoverable warning, not a reason to erase road data. Region and Behavior updates invalidate optional terrain-cost previews.
- Only authorized GMs can edit the network or terrain links; keep the first release GM-only. A hidden Region or UI control does not make Scene/Region flags confidential to players.
- Do not copy third-party game-system terrain data, token movement mode rules, or scripts into the module.

## Primary v14 references

- [Foundry v14 ApplicationV2 and tab architecture](https://foundryvtt.com/api/v14/modules/foundry.applications.html)
- [Native Grid Data](https://foundryvtt.com/api/v14/interfaces/foundry.documents.types.GridData.html)
- [Native v14 grid path measurement](https://foundryvtt.com/api/v14/classes/foundry.grid.BaseGrid.html)
- [Grid path measurement result](https://foundryvtt.com/api/v14/interfaces/foundry.grid.types.GridMeasurePathResult.html)
- [Native Scene Regions guide](https://foundryvtt.com/article/scene-regions/)
- [RegionDocument API: polygons, polygon tree, levels, Scene ownership](https://foundryvtt.com/api/v14/classes/foundry.documents.RegionDocument.html)
- [Token canvas API: terrain-aware movement paths and movement measurement](https://foundryvtt.com/api/v14/classes/foundry.canvas.placeables.Token.html)
- [Native terrain-cost data model](https://foundryvtt.com/api/v14/classes/foundry.data.TerrainData.html)
- [v14 Region data: flags, shapes, levels](https://foundryvtt.com/api/v14/interfaces/foundry.documents.types.RegionData.html)
- [Canvas controls extension hook](https://foundryvtt.com/api/v14/functions/hookEvents.getSceneControlButtons.html)
