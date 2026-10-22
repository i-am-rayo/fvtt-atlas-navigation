# Architecture proposal — v0.1

**Status:** review draft, not an implementation specification or an assertion that every API call is verified.  
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
| Geographic terrain polygons | `RegionDocument` | Later phase; not needed to draw a road |
| Authored roads and junctions | `flags.fvtt-atlas-navigation.atlas` on each Scene | Module-managed, versioned data |
| Searchable adjacency graph | Pure in-memory projection of road data | Derived, not an independently persisted document |
| Highlighted route | Temporary route result + canvas overlay | Does not modify the authored roads |
| Controls / side panel | Foundry `ApplicationV2` or supported v14 UI conventions | GM editing and route query |
| Visual road/network overlay | Module-owned canvas overlay/layer | Registration, ordering, teardown verified against v14 |
| UI/session preferences | Foundry module settings / client preferences as appropriate | Not core road data |

Foundry v14 documents, application classes, and canvas groups are documented in the [v14 API](https://foundryvtt.com/api/v14/). The final overlay registration and lifecycle hooks must be confirmed against that exact version before coding.

## 3. Architectural boundaries

Planned functional modules (illustrative paths; choose a build tool only after approval):

- `src/domain/` — point/segment types, unit conversion, topology validation, graph construction, shortest-path algorithm; **no Foundry globals**.
- `src/persistence/` — serialization, schema versioning, migrations, and atomic Scene-flag updates.
- `src/foundry/` — Scene/Note/Journal/Region adapters, permissions, lifecycle hooks, settings.
- `src/canvas/` — cached road graphics, picked junctions, route highlight; cleanup on Scene changes.
- `src/ui/` — GM road editor, atlas inspector, route selection, error and distance display.
- `src/index.*` — initialization and registration.

Dependencies point inward: UI/canvas and Foundry adapters call the domain layer. The domain layer must not import Foundry APIs. This allows unit testing with ordinary geometry fixtures.

## 4. Road-network model

A **junction** has an immutable ID and an (x, y) Scene coordinate. A **segment** references two junction IDs and optionally contains an ordered list of interior polyline points. In v1 every segment is bidirectional; one-way travel is deferred.

Key rules:

1. A segment must reference two existing, distinct junctions.
2. Coordinates are finite Scene-space pixels. Interior points are ordered from `from` to `to`.
3. A visible road crossing is **not** a graph connection unless the GM creates/joins a junction.
4. Roads are not Foundry Drawings; the module draws them using its own overlay.
5. Edited junction coordinates change connected geometry consistently.
6. Saved IDs are stable through edits, import/export, and migration.

The exact JSON contract is in [DATA_MODEL.md](DATA_MODEL.md). Documented examples are proposals to validate during the first coding milestone.

### Geometry and calibration

Scene screen zoom/pan must not change stored coordinates. Render by transforming Scene coordinates through Foundry's canvas mechanism.

A scene-specific calibration converts polyline pixel lengths to a travel unit such as miles or kilometers. Default to a map-derived or explicitly entered scale; never silently infer real distance from image pixels. Record calibration provenance when feasible, and show uncalibrated pixel distance or an explicit "calibration required" state until set. Avoid a second conflicting measurement model alongside Foundry's own grid settings; investigate whether the Scene grid distance is sufficient before adding a custom value.

### Routing

Construct an adjacency list from valid segments. For each segment, edge weight is the sum of Euclidean lengths between `from`, interior points, and `to`; convert to calibrated units for display. Run **Dijkstra** for the shortest-distance route in v1. For equal weights, define deterministic tie-breaking in tests.

Initial endpoints are selected network junctions. Later, support snapping a chosen Note/point to a nearby road by inserting temporary in-memory nodes/edges. Do not mutate the saved network when snapping a route request.

Handle absent endpoints, no connecting route, degenerate geometry, duplicate IDs, bad calibration, and stale Scene selection with explicit user feedback. A disconnected network is normal, not an exception.

Shortest travel **time** and terrain/weather weights are future algorithm options. Keep distance, time, money, and display animation conceptually distinct.

## 5. Rendering and interaction

Use separate conceptual layers:

- **Persistent road network:** view of saved junctions/segments, including edit affordances for GMs.
- **Active computed route:** clear highlight derived from a route result, not a second saved road.
- **Optional cinematic playback:** independently controlled transient animation, deferred until routing works.

Lifecycle: initialize services, show overlays when a Scene becomes ready, refresh on changes, and fully detach listeners/graphics when canvas changes or module deactivates. Throttle/reuse hit testing and graphics for large road collections. Never make core graph behavior depend on the presence of a rendered canvas.

Initial GM workflow: enable atlas Scene → calibrate scale → add/connect roads → save → choose start/end junction → calculate → display route/distance → edit/recalculate.

Native map Notes should still open their permitted linked journals as Foundry expects. The module must not replace the Journal permission system with a custom duplicate.

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

**Review before implementation**

- Whether Foundry Scene grid distance can be the primary calibration source for most atlas images.
- Exact v14 canvas overlay registration point, ordering, hit-testing, and cleanup.
- Whether native Notes sufficiently cover POIs without additional marker metadata.
- Editing UX for joining/cutting roads, deleting junctions, and undo/redo.
- How player-safe network visibility should be represented and transmitted when that phase starts.
- Size/performance threshold at which Scene flags need reconsideration.
- JS vs TypeScript and bundler choice (prefer the smallest maintainable setup).

## 9. Primary technical references

- [Foundry: Introduction to Module Development](https://foundryvtt.com/article/module-development/) — manifest, lifecycle, package shape, ES modules.
- [Foundry v14 API index](https://foundryvtt.com/api/v14/) — Scenes, Notes, Journals, Regions, ApplicationV2, canvas APIs.
- [LegendKeeper developer guide](https://www.legendkeeper.com/developers/) and [style guide](https://www.legendkeeper.com/developers/style/) — map/pin/page interaction patterns.
- [Indy Route README](https://github.com/jwrpalmer99/indy-route) — route presentation and per-Scene storage reference.
