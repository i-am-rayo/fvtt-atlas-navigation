> **Phase 2d v0.2.12 native Region adapter:** Existing Scene `RegionDocument` instances remain canonical for shapes/holes, levels, names, visibility, and native/system Behaviors. Atlas records **only** `flags.fvtt-atlas-navigation.atlas = {schemaVersion:1,linked:true}` on a linked Region. `scripts/region-atlas.js` validates/listens to native document data on demand and wraps GM-checked `setFlag`/`unsetFlag` calls; `scripts/scene-config.js` presents link/unlink, Behavior status and a native `RegionConfig` shortcut. Region flags do not affect Scene road schema v3, native Grid, or token movement. Refresh is manual after changing a Region in its native editor; no automatic terrain-cost calculations. Owner's live Foundry v14 acceptance pending; Phase 3 not authorized.\n\n> **v0.2.11 same-road branch recovery:** Old explicit named-road merges can leave degree-3+ junctions whose incident segments all share one logical `roadId`. Demotion rightly refuses them, and detaching an *entire named road* cannot split its own arms. A new GM-confirmed `detach-branch` edit requires choosing one specific incident `segmentId`: it clones only that section's endpoint at the same coordinates, rewires only that section, and preserves every road/segment name, ID, shape and unrelated connection. The detached endpoint can be dragged independently; afterward the remaining two-edge pass-through can be demoted separately. The operation participates in Undo/Cancel/revision-checked Save and does not alter schema v3 or native Grid. **Pending owner v14 acceptance.**

> **v0.2.10 semantic split:** Road `via[]` points only shape the polyline; graph `nodes[]` and `segments[]` preserve routing structure. A routable **junction** in the inspector is a node with 3+ incident segments or edges owned by more than one named `roadId`; ordinary endpoints and degree-2 same-road subdivisions remain in the graph but are hidden from that list. **Waypoint** will mean an optional named place/event attached to a road or junction and, when authorized, a native Note/Journal reference; no waypoint schema or player-visible feature is introduced in v0.2.10. Explicit `demote-junction` may fold exactly two incident segments of one named road into one, reinsert the node coordinate as a `via[]` bend and remove the unused segment/node, retaining the first segment's ID and the exact physical path. Shared/branch/terminal/loop nodes are not silently collapsed. Scene-wide junction filtering is bounded, with selected-road and one-hop directly connected-road scopes. Stored schema stays v3.

> **v0.2.9 topology addendum:** Promote an existing `via[]` bend or insert a junction on a road edge only by explicit GM action. Both operations create one stable node ID, split the selected segment into two edges owned by the *same* logical `roadId`, preserve the first edge ID, and stage a reversible point-editor operation. Separate named roads intersecting geometrically do not join; a later drag-to-connect requires confirmation. Waypoints are existing Scene graph nodes, not new Foundry documents or duplicated Region geometry. The Atlas list renders a bounded window of up to 25 active junctions; lookups occur on deliberate editor actions, not every animation frame. No schema migration or new scene measurement rules are necessary.

# Architecture — revised Phase 2 boundaries

**Status:** Phase 1 merged; Phase 2b native Grid verified; Phase 2c v0.2.5 map padding and road-junction editing owner-verified; v0.2.6 adds logical `roads[]` grouping and draggable point edits (pending live Foundry v14 test). Phase 2d Region linking and Phase 3 routing remain planned.
**Target:** Foundry VTT v14; game-system agnostic.  
**Module identity:** `fvtt-atlas-navigation`.

## 1. Product boundary

The module provides **an atlas plus a navigable authored road network**, not a general-purpose movement system. Foundry Scenes remain the source of map imagery and coordinate space. Native Notes/Journal content remains the source of place descriptions and player permissions. The module owns only the extra data and UI needed for connected roads and routes.

The first useful release is **GM-only**. The user-facing concept is journal-style reveal/hide, but player access is a separate acceptance gate because hiding a rendered object does not necessarily prevent a player client from receiving its backing Scene flags.

## 2. Foundry ownership map

| Responsibility | Native / module component | Decision |
| --- | --- | --- |
| Atlas image, dimensions, coordinate system | `Scene` | Reuse native Scene documents; no parallel map backend |
| Places and map pins | `NoteDocument` + linked `JournalEntry`/`JournalEntryPage` | Reference existing documents and their permissions |
| Geographic terrain polygons, shapes, holes, level scope | Native `RegionDocument` | Reuse as-is, without copying geometry or replacing behaviors |
| Authored roads and junctions | `flags.fvtt-atlas-navigation.atlas` on each Scene | Module-managed, versioned data |
| Region-to-atlas link | Optional future namespaced Atlas link flag on each Region | Minimal opt-in association and optional UI label only; use native Region Behaviors for actual movement costs |
| Searchable adjacency graph | Pure in-memory projection of road data | Derived, not an independently persisted document |
| Highlighted route | Temporary route result + canvas overlay | Does not modify the authored roads |
| Controls / side panel | Foundry `ApplicationV2` or supported v14 UI conventions | GM editing and route query |
| Visual road/network overlay | Module-owned canvas overlay/layer | Registration, ordering, teardown verified against v14 |
| Distance and measurement units | Native Scene Grid only; native `canvas.grid.measurePath` for future road measurement | No duplicate per-Scene override or global travel scale |
| UI/session preferences | Foundry module settings / client preferences as appropriate | Not core road data |

Foundry v14 documents, application classes, and canvas groups are documented in the [v14 API](https://foundryvtt.com/api/v14/). Phase 2c uses documented Foundry v14 Canvas coordinate conversion and ready/teardown hooks; the GM-owned PIXI road overlay and canvas pointer capture require acceptance testing inside the actual Foundry v14 client.

## 3. Architectural boundaries

Long-term functional modules (illustrative structure; the current incremental JavaScript implementation lives directly under `scripts/`):

- `src/domain/` — point/segment types, unit conversion, topology validation, graph construction, shortest-path algorithm; **no Foundry globals**.
- `src/persistence/` — serialization, schema versioning, migrations, and atomic Scene-flag updates.
- `src/foundry/` — Scene/Note/Journal/Region adapters, permissions, lifecycle hooks, settings.
- `src/canvas/` — cached road graphics, picked junctions, route highlight; cleanup on Scene changes.
- `src/ui/` — GM road editor, atlas inspector, route selection, error and distance display.
- `src/index.*` — initialization and registration.

Dependencies point inward: UI/canvas and Foundry adapters call the domain layer. The domain layer must not import Foundry APIs. This allows unit testing with ordinary geometry fixtures.

**Earlier Phase 2c implementation (v0.2.4), extended in v0.2.5/v0.2.6:** `scripts/road-model.js` implements pure network add/rename/remove with stable IDs and 14px endpoint snap; `scripts/road-storage.js` handles GM permissions, optimistic revision validation, and Scene flags; `scripts/road-canvas.js` manages GM overlay and click-to-place draft, with teardown hooks; `scripts/scene-config.js` mounts Roads [+] and list controls in the native Atlas tab; `scripts/main.js` wires hooks and dialogs. Older `atlas-storage.js` setup persistence remains for backwards compatibility but has no exposed activation UI. No independent distance source was added.

## 4. Road-network model

A **junction** has an immutable ID and an (x, y) Scene coordinate. In schema v3, a logical **road** (`roads[]`) owns its name and ID; each **segment** (`segments[]`) stores a `roadId` reference to the owning road. One road can contain multiple graph sections after splits or deliberate merges, preventing duplicate named rows. A **segment** references two junction IDs and optionally contains an ordered list of interior polyline points. In v1 every segment is bidirectional; one-way travel is deferred.

Key rules:

1. A segment must reference two existing, distinct junctions.
2. Coordinates are finite Scene-space pixels. Interior points are ordered from `from` to `to`.
3. A visible road crossing is **not** a graph connection unless the GM creates/joins a junction.
4. Roads are not Foundry Drawings or Walls; the module draws and edits them using its own non-colliding overlay.
5. Edited junction coordinates change connected geometry consistently.
6. Saved IDs are stable through edits, import/export, and migration.

The exact JSON contract is in [DATA_MODEL.md](DATA_MODEL.md). Documented examples are proposals to validate during the first coding milestone.

### Geometry and calibration

Scene screen zoom/pan must not change stored coordinates. Render by transforming Scene coordinates through Foundry's canvas mechanism.

**Implemented Phase 2b policy:** use native Scene Grid (`grid.distance`, `grid.size`, `grid.units`) **exclusively**, shown read-only in Atlas. There is no manual Atlas scale. Preserve existing v1 manual calibration objects as inert historical data and never apply or edit them. **Future Phase 3 road distances:** use Foundry's public `canvas.grid.measurePath(waypoints).distance` against the matching active Scene, not a linear pixel ratio; verify square/hex/gridless ruler parity and multisegment path semantics.

### Routing

Construct an adjacency list from valid segments. Use Euclidean pixel lengths only to validate nondegenerate geometry. Delegate authoritative Scene distance calculation to a Foundry v14 Grid adapter via `canvas.grid.measurePath`. **Before choosing Dijkstra edge weights**, verify whether native distances are additive across segments (e.g. alternating diagonal rules); otherwise model accumulated measurement state or compare full paths. Define deterministic tie-breaking.

Initial endpoints are selected network junctions. Later, support snapping a chosen Note/point to a nearby road by inserting temporary in-memory nodes/edges. Do not mutate the saved network when snapping a route request.

Handle absent endpoints, no connecting route, degenerate geometry, duplicate IDs, missing native Grid measurement, and stale Scene selection with explicit user feedback. A disconnected network is normal, not an exception.

Shortest-distance computation is Phase 3a. **Phase 3b**, requiring separate runtime approval, may use Foundry's existing token-aware Region terrain movement costs to compare candidate routes; conversion to overland travel time needs explicit party speed. Keep geometric distance, native movement cost, travel time, and display animation conceptually distinct.

## 5. Rendering and interaction

Use separate conceptual layers:

- **Persistent road network:** view of saved junctions/segments, including edit affordances for GMs.
- **Active computed route:** clear highlight derived from a route result, not a second saved road.
- **Optional cinematic playback:** independently controlled transient animation, deferred until routing works.

Lifecycle: initialize services, show overlays when a Scene becomes ready, refresh on changes, and fully detach listeners/graphics when canvas changes or module deactivates. Throttle/reuse hit testing and graphics for large road collections. Never make core graph behavior depend on the presence of a rendered canvas.

Revised planned GM workflow: open Scene Configuration → Atlas tab/section → inspect native Grid measurement → create a road/waypoint from the list → author its actual geometry via Atlas canvas tools → optionally link existing native Regions as terrain → save → (Phase 3) choose endpoints and calculate the route. The Atlas entry should appear on every Scene without creating flags merely by opening it.

Native map Notes should still open their permitted linked journals as Foundry expects. The module must not replace the Journal permission system with a custom duplicate.

### Native Scene Regions and travel difficulty

Use a **Scene's existing Regions** for shapes, holes, levels/elevations, **and already configured movement Behaviors**. The GM links a Region to Atlas with minimal namespaced metadata; Atlas never stores a duplicate speed or difficulty value. A free-text Region name or optional Atlas organizational label has no movement-rule meaning.

- The Atlas tab lists linked Regions, their native names and active movement-related Behaviors, and provides a shortcut to each native Region editor. The GM uses core Region tools for geometry and behaviors.
- Linked Regions indicate the GM wants them considered for **Atlas route previews**, not that Atlas owns their effects. Unlinking does not disable actual token terrain effects.
- Region crossings never create graph junctions; road connectivity remains explicit IDs.
- In a separately approved Phase 3b, use Foundry's **public token movement-path pipeline**: `Token#createTerrainMovementPath` resolves Region terrain effects along a proposed path, and `Token#measureMovementPath` measures costs for a selected party token and movement action. Do not call `move`; route previews must not move tokens.
- The token, movement action, size, level/elevation, active Behaviors, and overlaps can affect native cost. Core `Modify Movement Cost` stacks overlapping modifiers multiplicatively, per native behavior settings; Atlas imposes no separate slowest-wins or multiply-on-its-own policy. Other game systems may register additional behaviors.
- Validate whether an unmodified native calculation can safely ignore unlinked Regions. If not, disclose that all native Regions affect cost or defer filtering, rather than inventing a cost that doesn't match real token movement.
- Geometric distance stays independent of movement cost. Interpreting cost as **hours/days of overland travel** requires an explicit travel speed/time model; do not assume combat action values are world-map speed.
- Changes to Region shapes/Behaviors, Scene Grid, Atlas links, roads, party token, or movement action invalidate derived previews; never mutate authored road geometry.

See [revised Phase 2 design](PHASE2_DESIGN.md) for UI sketches, scope gates, and proposed metadata. The current v1 atlas schema remains unchanged until a versioned migration is implemented.

## 6. Player visibility and trust

**Decision for MVP:** only GMs author, read, and calculate the module network. Do not assume a Scene flag is GM-secret just because the module does not draw it for players.

Proposed later policy:

1. Use Journal ownership and existing Note behavior for lore visibility.
2. Give the GM simple reveal/hide actions for map-facing elements.
3. Prove through a logged-in GM + ordinary player two-client test what Foundry actually transmits about Scene flags and Notes.
4. If network or unrevealed annotations must remain secret, send only a filtered, authorized projection/result, with explicit server/GM authority checks. No generic blanket sharing of raw Scene flags.
5. Document the chosen semantics and test hidden → revealed → hidden, reconnect, and Scene switching.

Security review is not needed to draw a GM-only road, but it **is** required before calling a player-facing feature safe.

## 7. LegendKeeper / Indy Route reference boundaries

LegendKeeper's [developer portal](https://www.legendkeeper.com/developers/) documents map features, pins linked to pages, and content organization. This informs the intended **experience**: coherent map navigation connected to useful lore. No LegendKeeper account, API key, server, SDK, or synchronization is part of the MVP.

[Indy Route](https://github.com/jwrpalmer99/indy-route) illustrates scene-flag route storage, route drawing and styling, playback, GM tools, and optional shared animations. Its published README targets v13. It is not a substitute for a persistent road **graph**, and it is not a v14 compatibility guarantee. Study its ideas, then independently implement where practical; honor the repository license if code is copied.

## 8. Decisions, risks, and open questions

**Proposed decisions**

- Scene-based atlas, namespaced flags, explicit graph junctions/segments, GM-only first.
- Pure routing engine, shortest path by geometric length, temporary route output.
- No mandatory libraries or system dependencies.
- No early automatic token movement, complex fog, or cross-Scene routing.
- Native Scene Grid as measurement source; native Region shapes and Behaviors as terrain/movement source; use namespaced flags only for Atlas Region associations.

**Review before implementation**

- Validate native `canvas.grid.measurePath` on square, hexagonal, and gridless Scenes, compare with ruler, test multisegment additivity, and keep legacy v1 calibration dormant until an explicit future migration.
- Exact v14 canvas overlay registration point, ordering, hit-testing, and cleanup.
- Whether native Notes sufficiently cover POIs without additional marker metadata.
- Editing UX for joining/cutting roads, deleting junctions, and undo/redo.
- Stable v14 Atlas tab/section injection without private SceneConfig overrides, and native Region movement-cost API interoperability with both core and system-supplied Behaviors.
- How player-safe network visibility should be represented and transmitted when that phase starts.
- Size/performance threshold at which Scene flags need reconsideration.
- JS vs TypeScript and bundler choice (prefer the smallest maintainable setup).

## 9. Primary technical references

- [Foundry: Introduction to Module Development](https://foundryvtt.com/article/module-development/) — manifest, lifecycle, package shape, ES modules.
- [Foundry v14 API index](https://foundryvtt.com/api/v14/) — Scenes, Notes, Journals, Regions, ApplicationV2, canvas APIs.
- [Native Foundry Scene Regions guide](https://foundryvtt.com/article/scene-regions/) — Regions, shapes/holes, Behaviors, and token movement-cost boundaries.
- [Foundry v14 Token API](https://foundryvtt.com/api/v14/classes/foundry.canvas.placeables.Token.html) — native terrain-aware movement path and cost preview methods.
- [LegendKeeper developer guide](https://www.legendkeeper.com/developers/) and [style guide](https://www.legendkeeper.com/developers/style/) — map/pin/page interaction patterns.
- [Indy Route README](https://github.com/jwrpalmer99/indy-route) — route presentation and per-Scene storage reference.
