# Phase 2 revised design — Scene Atlas, roads, waypoints, and Regions

## Phase 2c v0.2.5 implementation (October 23, 2026)

This next **development test build**, following the owner's v0.2.4 tests, adds image-local schema v2 roads with an explicit one-time GM anchoring action for existing v1 maps; nearest-interior road splitting when a new road endpoint joins an existing path; bend redrawing with fixed junction endpoints; and automatic temporary highlight/draft cleanup on closing Scene Configuration. The underlying graph remains per Scene and Foundry-native Grid distance remains untouched. Unit tests do not replace in-client Foundry v14 testing.

The next gate is owner testing of v0.2.5 in a backed-up world against `docs/PHASE2_TESTING.md`. After passing, proposed follow-on work includes Waypoints and UX (style/label/hover/context menu), then native Region association in Phase 2d. **Phase 3 route calculation is not yet authorized.** PR #3 remains draft and unmerged.


**Decision date:** October 23, 2026. **Target:** Foundry VTT v14, system agnostic.
**Status:** approved design. Phase 2b native Grid updates and Phase 2c **v0.2.4** road creation, rename/delete, Scene isolation, reload persistence, and highlight were verified by the owner in Foundry v14 on October 23, 2026. Two blocking authoring issues remain: Scene-padding alignment and connecting roads at mid-segment points. Advanced road controls are scoped below but not implemented. Region linking and route calculations remain unimplemented; draft PR #3 remains unmerged.

## 1. GM experience and ownership

The **v0.2.4 build** registers an **Atlas** tab in native Scene Configuration alongside Basics, Grid, and Levels. It replaces v0.2.1's awkward above-form control. A supported in-sheet Misc/Grid fallback is available for nonstandard sheets; its tab placement and saving were confirmed in Foundry v14 using v0.2.2.

| Atlas section | GM work | Canonical data |
| --- | --- | --- |
| **Roads** | Add/rename/select/delete roads; list connected segments and visibility metadata | Versioned module data on that Scene |
| **Waypoints / junctions** | Add/list/rename or associate waypoints with native map Notes; edit graph connections | Versioned Scene road graph; optional references to Note UUIDs |
| **Terrain Regions** | Link/unlink **existing native Regions**; show native Region name, active movement-related Behaviors, warnings, and an action to open native Region configuration | Native Region shapes/name/levels/Behaviors; minimal Atlas opt-in association only |
| **Measurement** | Display the native Scene's grid size/distance/unit; configure them only in the native Grid tab | Native Scene Grid exclusively; no Atlas scale flag |

A GM can find the Atlas section on any Scene without explicitly enabling it. **Presence of saved roads** determines whether the Scene has an active Atlas; there is no longer a separate Configure Atlas button or activation checkbox. The legacy v1 `enabled` flag stays in persisted data and is synchronized by road add/delete; older Scenes with enabled flags but zero roads display as unconfigured. A full migration will be separately reviewed. Opening a sheet alone never writes flags.

**The tab is a management surface, not a spatial drawing canvas.**

- Author junction positions, polyline road geometry, connections, and selections using a GM-only Atlas canvas toolset.
- Use **Foundry's native Region canvas controls** to draw/edit geographical areas and holes. The Atlas module must not reinvent or copy a second set of Region polygons.
- Selecting a road/waypoint/linked Region in the Atlas tab may focus/highlight it on the map without changing its underlying document.
- Keep all map-space coordinates independent from camera zoom/pan.

### Foundry v14 UI integration rule

Investigate supported ApplicationV2/SceneConfig tab extension conventions first. Do not monkey-patch private SceneConfig methods or overwrite core templates to add a tab. If a stable hook-based tab cannot be implemented safely, provide an in-sheet Atlas entry that opens a standalone native-looking Atlas manager, and validate its placement with an actual Foundry v14 build. The current top-of-form banner is not an accepted final UI.

### Phase 2c first editor behavior (v0.2.4)

- Each saved Roads entry is one named, bidirectional v1 segment with optional intermediate bend points. The [+] button activates click-to-place drawing on the **viewed** Scene; the Scene being configured must be on the canvas. Finish (or Enter) saves two or more points; Cancel (or Esc) abandons them; Backspace removes the last unsaved point. An overlay shows saved lines and the draft to the GM.
- Two road endpoints within 14 Scene pixels of existing junctions share that junction ID. Merely crossing a line does not create a connection. Creating a junction *in the middle of an existing segment* and dragging/editing saved vertices remain future tasks; do not infer connectivity by visual proximity to a bend.
- Road deletion preserves orphaned junction nodes to avoid cascading loss; later cleanup tools may handle unused nodes. Roads with no saved segments are inactive. Older explicit enabled values remain as historical metadata, not a UI switch.
- This is a road network authoring test build, not a usable navigation/router: no authoritative road distance, itinerary, token terrain, or player-facing overlay yet.

### Owner's Phase 2c acceptance findings — October 23, 2026

**Verified in real Foundry v14 (0.2.4):** GM creates roads with Roads [+], renames and deletes them, reload preserves roads, separate Scenes display independent road information, and road highlighting works.

**Prioritized functional corrections before expanding the editor:**

1. **Map-image anchoring across Scene padding/shift:** Increasing Scene padding from 0.00 to 0.05 visibly moved the background image relative to the existing Atlas overlay. Changing it back realigned the roads. The current model stores the result of `canvas.canvasCoordinatesFromClient` directly as persistent coordinates and renders them directly with PIXI. Foundry v14 `SceneDimensions.sceneX`, `sceneY`, and `sceneRect` identify the image rectangle inside its larger padded canvas ([official v14 API](https://foundryvtt.com/api/v14/interfaces/foundry.documents.types.SceneDimensions.html)). **Design objective:** retain road positions relative to the same map art when the surrounding canvas padding changes, without warping the road geometry. Test Scene padding, shift, dimensions, pan/zoom, and grid adjustment separately. Resolve the v1 absolute-coordinate data migration *before* silently changing persisted coordinates. Older maps cannot safely be converted if the original anchoring context is unknown; never guess or discard authored roads.
2. **Real connections to an existing road:** v0.2.4 only snaps to the existing endpoint/junction **nodes** (14px); clicking near an interior line or `via[]` bend leaves separate topology. Allow a GM to snap a new road endpoint to a segment centerline and explicitly **split the target segment at that position**, inserting a shared stable junction and replacing the old segment with two connected segments. Preserve the road name/style and old geometry, avoid zero-length edges, and keep unrelated crossing roads unconnected unless the GM chooses to join. Show a snap preview and explicit join/leave-disconnected affordance for bridges or overlapping roads, so the GM can tell when a genuine network connection will be made.
3. **Temporary highlight lifetime:** Selecting a road highlights it as expected. Clear the selected highlight when Scene Configuration closes, the GM exits the Atlas editing context, or a different Scene becomes active. Do not delete roads or change their persistent visibility.

**Road editing and presentation backlog (separate features, not present in 0.2.4):**

| Feature | Proposed behavior | Intended slice |
| --- | --- | --- |
| Edit existing path geometry | Click or right-click road to select; move/add/remove junctions or bends; undo/cancel; persist stable connectivity | Remaining **2c** |
| Right-click road | Context menu with edit path, edit style/shape, rename, focus, hide/show, and delete (permission-checked, confirmation for destructive actions) | 2c editing foundation, **4** polish |
| Road appearance | Per-road color palette, stroke width, solid/dashed/dotted style, optional module defaults; don't alter network topology | **4** |
| Road label visibility | Off, on hover, or always; avoid obscuring critical map details and keep GM/player visibility distinct | **4** |
| Smoother curves | Optional visually smoothed path, e.g. constrained spline with adjustable tension. Preserve control points and make clear whether smoothing is visual-only; route calculations must use the authoritative underlying geometry | **4** |
| Hover card | Road name and **native Foundry-measured** path length once Phase 3a measurement exists; temporary highlight is optional | **3a** measurement + **4** UI |
| Focus on entire path | Pan/zoom canvas to fit the selected road's full bounds | **4** |
| Hide/show a road | User/GM display filtering versus world-persisted road visibility to be explicitly chosen; never equate UI hiding with secure player-reveal permissions | **4** display; **5** protected reveal |

Retain the **same Scene Grid measurement** used by Foundry's ruler. A smoothed visual line must not quietly report a distance calculated from unrelated geometry. Native Regions and their Behaviors remain Phase 2d/3b work, not a parallel Atlas terrain rule system.

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
| **2b — UI and native measurement** | **Verified by owner in v0.2.3:** native Atlas tab, native Scene Grid only, legacy manual values safely dormant | Native Grid update from 7.5 to 8 shown correctly in Atlas; further square/hex/gridless coverage encouraged |
| **2c — Road/waypoint authoring** | **v0.2.4 owner-tested baseline:** Roads [+], persistence, per-Scene isolation, rename/delete and highlight. **Next:** fix Scene-padding anchoring and migrate existing coordinates safely; split/connect at mid-road, clear ephemeral highlights when editor closes; then Waypoints [+] and editing existing geometry | Owner reports alignment failure at 0.05 padding and lack of mid-segment junction; rerun pan/zoom, saved-road migration, intentional non-connections, Scene switch, and tab close tests |
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
