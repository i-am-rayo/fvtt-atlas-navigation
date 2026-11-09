**v0.3.9-beta.6 visual rest boundary:** `navigation-rest-playback.js` is pure playback timing/cancellation; it owns neither TokenDocument nor Journal/World state. Only a successfully written World-time and Journey Journal break grants a non-continuous daily-decision visual hold in `navigation-controller.js`. The token does not move until the configured real-time rest display finishes. No fractional World-clock writes are introduced. End Journey or canvas teardown cancels the timer; native movement resumes only through the existing Journal-validated continuation gate. Break Started and delayed Break Ended remain two public-safe projections of the same approved Journal event, not gameplay transactions. Paused manual rests and continuous moving-vessel passenger rests are unchanged.

**v0.3.9-beta.8 public Region projection boundary:** A separate schema-1 Region flag, `publicTerritory`, stores only an explicitly GM-approved public display label (default private); the namespaced Region adapter checks native Scene/Region update permissions and a snapshot before a single flag write. Native Region names/shapes/holes/elevation/Behaviors stay native and are never changed. The readonly `atlas-announcement-region.js` adapter converts the *original saved image-local Point B* through the active canvas origin and asks public v14 `RegionDocument.testPoint({x,y,elevation})` using the saved Journey token's native finite elevation. A Region must not be hidden and must have valid public opt-in. Overlapping approved names are ambiguous and yield generic text. The confirmed-Journal GM announcer prioritizes beta.7 player-safe checkpoint names, then this Region fallback, and publishes only its sanitized label through the existing v2 pulse; absent/invalid scene/canvas/flag/permission produces no new name and cannot fail a committed Journey. No new Actor/Token/Journal/Scene topology/World-time migration. [Beta.8 test design](ANNOUNCEMENT_BETA8_REGION_FALLBACK.md); native border transition event persistence and display themes still future [#233](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/233).

**v0.3.9-beta.7 announcement display boundary:** The pure `atlas-announcement-destination.js` names a checkpoint only when its authored node matches the original Journal-saved Point B and its name is present in the existing `playerAtlasOverlay` projection for current exploration/visibility. Ambiguity rejects names unless an approved matching final route target identifies the checkpoint. The GM announcement adapter validates the persisted Journal transition, saved route and Atlas revision, active GM and Scene permission, and current Atlas/Exploration flags before publishing. World pulse schema 2 permits an optional sanitized `publicSubject` exclusively for journey.started and destination.reached; schema-1 generic pulses remain compatible. Other banner events never transmit authored names. This one-slot, best-effort display channel does not write Scene/Token/Journal/Region data or authorize travel. Unknown/hidden/mid-road targets use generic text. Player projection is not raw Scene-flag confidentiality. Native Region boundary and theme UX are deferred under [#233](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/233); see [beta.7 test matrix](ANNOUNCEMENT_BETA7_NAMED_DESTINATIONS.md).

> **v0.3.8-beta.7.23 Fog and player projection isolation:** The pure `player-overlay-model.js` restricts display data to explicitly authorized Road, segment, Node, Checkpoint and appearance fields; the old `player-visibility.js` exports remain compatible and GM-authored visibility writes remain separate. It is still a visual-only client projection, **not** strong security against raw Scene flag access. The pure `atlas-manual-fog-projection.js` computes covered native Grid cells; the Foundry/PIXI renderer retains native shape ownership and renders an opaque full-image fail-closed mask for invalid flags/grid geometry, without auto-repair. No Journey/Token/Region/native Fog writes. Checkpoint-transfer recovery bug #189 is deferred separately behind the native-token and Journal safety checks. See [beta.7.23 checklist](FOG_PLAYER_READ_BETA7_23_TESTING.md).

> **v0.3.8-beta.7.22 Road overlay observability and cleanup:** `RoadOverlayObservability` is a pure in-memory, read-only observer of overlay refresh count/duration, redraw requests, Graphics instances, and latest derived hit/label sizes. The existing canvas controller owns all PIXI/DOM resources and records metrics; Trace-level, GM-gated logging occurs at `canvasTearDown` in the Foundry adapter. The controller now invalidates Locate Road pulse and scheduled pan/fog callbacks, plus async icon/font/Journal-read refreshes, on teardown. No rendering cache or change to authoritative Road/Checkpoint Scene data, native Regions, Fog, or Journey. Measurements do not establish causation for Canvas rebuild #135 or GM-inactive R-01. See [beta.7.22 checklist](OVERLAY_BETA7_22_TESTING.md).

> **v0.3.8-beta.7.21 native Region / Surface read isolation:** `region-native-read.js` observes current native Region documents and Atlas provenance/association flags for the generated-Region listing and visual Road surface styling. `region-surface-model.js` chooses validated preset-backed overlay candidates and their priority/order without Foundry globals or writes. Existing entrypoints in `generated-region.js` and `road-surface-overlay.js` re-export the reader; mutations remain in their established GM-authorized adapters. Native Region shapes, elevation, Behaviors and Levels remain authoritative. Overlay-derived color and spatial sampling are presentation aids, **not** native terrain-cost calculations or a future standalone Checkpoint membership API. The owner-approved beta.7.20.1 Checkpoint/Node separation remains a design contract only.

> **v0.3.8-beta.7.15.1 Scene-native Levels and checkpoint continuation (draft):** World setting availability defaults on, while each Scene's Atlas Level editor remains an explicit GM opt-in (`nativeLevelSetupEnabled`). Pure preset conversion respects native Scene measurement units; native Level documents remain authoritative. Explicit preview and confirmation may adopt/update an existing Level **by its ID**, including Foundry's initial Level, without deleting the last native Level, breaking its identity or editing Region/Token data. Distinct `flags["fvtt-atlas-navigation"].environment` labels distinguish underwater from underground even with overlapping elevation; roads do not yet auto-bind Level IDs, and altitude alone never infers medium. Journey B→C continuation on a single water/air surface is eligible for the existing checkpoint-choice workflow **only** when a confirmed paused A/B/C record's next target matches the route's authored arrival checkpoint and endpoint. No route previews cause movement, World-time, Journal, or payment writes; manual stops and recovery mismatch fail closed. Existing Journal and Scene data are not migrated on read. Live Foundry v14 GM/non-GM acceptance remains required.

> **v0.2.26 manual fog architecture (draft):** Dedicated `atlas-manual-fog-model` (validated cell overrides), `atlas-manual-fog-geometry` (native square/hex cell projection), `atlas-manual-fog-storage` (GM-only queued Scene updates), and `atlas-manual-fog-renderer` (player PrimaryCanvas opaque undiscovered cells, GM preview and pointer brush). The road controller no longer creates or manages fog graphics. Fog rendering reads only persisted manual cell overrides, independent of moving tokens and travel discs. Previous mapFog records retained read-only for explicit import. Live v14 validation required.

> **v0.2.25.4.7.4 exploration architecture (draft):** Atlas is square/hex-only for persistent map fog at this milestone. The GM movement writer atomically stores `mapFog` history and a bounded image-local native-cell materialization in the same Scene flag update. The non-GM PrimaryCanvas renderer projects saved cells onto current native grid offsets, then adds ephemeral current-explorer and known-checkpoint coverage. Do not reconstruct saved travel corridors as moving live vision each redraw. Saved Scene coordinates survive padding changes. Gridless exploration is deferred, with existing data retained and fail-closed display. No new native fog dependency, third-party module dependency, or changes to Regions.\n\n> **v0.2.19 existing generated corridor update:** Native Regions remain unique per checkpoint interval and keep stable IDs. A GM explicitly assigns a new surface preset, optionally applies its native Region color, and may separately confirm refreshing ONE unchanged, enabled, Atlas-provenance Modify Movement Cost Behavior in place. Previously selected modes dropped by the new preset are set to neutral ×1. The update rejects manual/disabled/duplicated or altered cost Behaviors and stale confirmation snapshots, never changes Region shapes, Levels, visibility, or other Behaviors; preset edits/assignment alone remain metadata-only. No Phase 3 token previews/routing.

> **v0.2.21 GM-only checkpoint presentation:** Per-checkpoint marker/icon/label settings are Scene-v8 metadata, independent of road line appearance and all native Region colors, geometry, Levels and Behaviors. The searchable twelve-icon Font Awesome Free subset is bundled locally with attribution; Foundry's native File Picker supplies optional local images. Pixi Text and sprites are rendered on the GM overlay, with asynchronous textures cached and a dot fallback; transient labels/sprites are cleaned on teardown. Old checkpoint records are not migrated on read. **Visibility/reveal request is a later privacy-gated feature:** a client-side overlay filter cannot keep secret roads safe if raw Scene flags reach players. First design a player-safe data projection and run a two-client v14 data-exposure/permissions review; do not broadcast hidden road names, points or checkpoint IDs.

> **v0.2.18 native surface colors and Region status:** Global preset catalog v3 includes a validated hex color, in-memory v1/v2 compatibility and no write merely on read. New generated corridors set Foundry v14 `Region.color` directly from their assigned preset. A separately confirmed recolor of an existing generated corridor may update ONLY `color`; World preset edits, preset assignment and geometry regeneration leave existing colors, Behaviors, Levels, geometry and visibility untouched. Scene display filters extend to generated and linked Regions by owning road, while unassociated manual Regions appear in All Scene. Cost status inspects existing native Behavior/provenance without changing or stacking anything. No token movement/routing or automatic synchronization.\n\n> **v0.2.17 native multi-mode bridge:** Preset catalog v2 stores selected independent system movement actions with individual suggested costs, but does not infer them from Land/Air/Water. Read old catalog v1 into memory without a write. A checked GM opt-in validates one native `modifyMovementCost` DataModel containing all configured `difficulties`; any unsupported or coerced action rejects the entire operation before documents are changed. Older presets continue the explicit single-action picker. No override is not a prohibition. Native Behavior provenance v2 snapshots the authored per-action costs, with v1 retained for legacy. Regeneration, assigning a preset or editing World settings never update Behaviors.

> **v0.2.16 opt-in native cost adapter:** `scripts/native-movement-cost.js` reads `CONFIG.Token.movement.actions` and the active `CONFIG.RegionBehavior.dataModels.modifyMovementCost` schema at the time of the GM action; Land/Air/Water is not automatically mapped onto movement action IDs. A GM explicitly chooses a non-derived system movement action and previews the preset multiplier. The native type's `difficulties` field must exist and validate/roundtrip the exact intended multiplier before persistence; unsupported systems fail closed. v0.2.16.1 tests a non-neutral sample on each candidate action *before displaying it*, rejects fixed (`terrainAction: null`) or derived movement modes and actions stripped by the system's Behavior DataModel; a registered Token action alone is not evidence of editable native cost. A read-only model probe never writes a Region. New generated corridors may include one native Behavior on the Region's initial creation only when opted in; existing generated corridors use `RegionDocument.createEmbeddedDocuments("RegionBehavior", ...)` after a separate confirmation. The adapter refuses if any existing native Modify Movement Cost Behavior is present, disabled or active, even if Atlas-tagged; never stacks or overwrites manual rules. The new Behavior alone has `flags["fvtt-atlas-navigation"].nativeMovementCost` provenance; Region travel-preset metadata and shape-only signature are unchanged. World preset edits, reassignment and regeneration are deliberately inert for native Behaviors. Checkpoint Regions, manual Regions, Levels, native Grid and road data are untouched. Live v14 GM/non-GM and movement verification is the release gate.

> **v0.2.15 world travel presets and source references:** A bounded, validated world setting (via v14 `game.settings.register` and a restricted `registerMenu` ApplicationV2 submenu) is the authoritative catalog of Land/Air/Water named travel conditions and suggested **native movement-cost multipliers**. All built-ins start at ×1; their numbers carry no system-specific assumptions. An *explicit* GM action upgrades Scene Atlas road metadata to schema v5 with nullable `road.travelPresetId`, retaining v4 checkpoints and all v3 road graph IDs. On generated native Regions, an independent `flags["fvtt-atlas-navigation"].travelPreset = {schemaVersion:1,presetId}` associates a corridor-specific override without changing generated shape-integrity provenance or any native Region geometry, Levels or Behaviors. World presets are shared by Scenes in one World (not across Worlds); deletions with recorded references are refused. Preset edit updates its catalog definition but never updates existing native Region cost Behaviors. No Behavior automation or routing in v0.2.15.
 
> **v0.2.14 explicit generated native Regions:** Checkpoints remain lightweight Scene Atlas metadata; Regions remain embedded native `RegionDocument` geometry. A pure planner validates a unique path between two checkpoints on one named road and produces a bounded union of native rectangle-like polygons along polyline edges plus round ellipse joins, or one ellipse per checkpoint Region. The GM chooses a half-width in native grid spaces, sees an ephemeral canvas preview, and confirms creation. Existing Regions do not get Behaviors; a new generated Region gets a minimal `flags["fvtt-atlas-navigation"].generatedRegion` versioned provenance record with road/checkpoint IDs, width, grid size and a shape-only integrity signature, plus the existing opt-in `atlas` association flag. Duplicate generations are rejected; regeneration is an explicit GM action and refuses if native shapes were edited since prior generation, preserving native Behaviors, labels, Levels and visibility. Road updates never auto-regenerate; explicit regen is needed after changed grid/padding/geometry. No slope/elevation semantics or pathfinding are inferred. Phase 3 remains gated.\n\n> **v0.2.13 named road checkpoints (new Phase 2e slice):** A named **Checkpoint** is optional semantic metadata attached to a stable graph `nodeId` and logical `roadId`. It is not a shaping `via[]` bend, a routing junction (which still requires graph degree ≥3 or shared road ownership), a native Region, or a Journal Note. Schema-v4 `checkpoints[]` is created only on explicit GM creation and keeps v3 roads intact. An interior checkpoint splits only its own road section in the same revision-checked Scene-flag update; metadata follows node movement, confirmed detach, reconnect and deliberate named-road merge. Protected checkpoint nodes cannot be demoted or their named road deleted without first removing the semantic checkpoint. Elevation is an optional finite height **in meters**, not Foundry's native Region elevation applicability range nor proof of steep grade. A later **v0.2.14** will propose GM-opt-in corridor/checkpoint Region generation; no such native Regions, behaviors, slopes, journals or terrain costs are created by v0.2.13. Phase 2d Regions are owner-verified, Phase 3 still unapproved.

> **Phase 2d v0.2.12 native Region adapter:** Existing Scene `RegionDocument` instances remain canonical for shapes/holes, levels, names, visibility, and native/system Behaviors. Atlas records **only** `flags.fvtt-atlas-navigation.atlas = {schemaVersion:1,linked:true}` on a linked Region. `scripts/region-atlas.js` validates/listens to native document data on demand and wraps GM-checked `setFlag`/`unsetFlag` calls; `scripts/scene-config.js` presents link/unlink, Behavior status and a native `RegionConfig` shortcut. Region flags do not affect Scene road schema v3, native Grid, or token movement. Refresh is manual after changing a Region in its native editor; no automatic terrain-cost calculations. Owner's live Foundry v14 acceptance pending; Phase 3 not authorized.\n\n> **v0.2.11 same-road branch recovery:** Old explicit named-road merges can leave degree-3+ junctions whose incident segments all share one logical `roadId`. Demotion rightly refuses them, and detaching an *entire named road* cannot split its own arms. A new GM-confirmed `detach-branch` edit requires choosing one specific incident `segmentId`: it clones only that section's endpoint at the same coordinates, rewires only that section, and preserves every road/segment name, ID, shape and unrelated connection. The detached endpoint can be dragged independently; afterward the remaining two-edge pass-through can be demoted separately. The operation participates in Undo/Cancel/revision-checked Save and does not alter schema v3 or native Grid. **Pending owner v14 acceptance.**

> **v0.2.10 semantic split:** Road `via[]` points only shape the polyline; graph `nodes[]` and `segments[]` preserve routing structure. A routable **junction** in the inspector is a node with 3+ incident segments or edges owned by more than one named `roadId`; ordinary endpoints and degree-2 same-road subdivisions remain in the graph but are hidden from that list. **Waypoint** will mean an optional named place/event attached to a road or junction and, when authorized, a native Note/Journal reference; no waypoint schema or player-visible feature is introduced in v0.2.10. Explicit `demote-junction` may fold exactly two incident segments of one named road into one, reinsert the node coordinate as a `via[]` bend and remove the unused segment/node, retaining the first segment's ID and the exact physical path. Shared/branch/terminal/loop nodes are not silently collapsed. Scene-wide junction filtering is bounded, with selected-road and one-hop directly connected-road scopes. Stored schema stays v3.

> **v0.2.9 topology addendum:** Promote an existing `via[]` bend or insert a junction on a road edge only by explicit GM action. Both operations create one stable node ID, split the selected segment into two edges owned by the *same* logical `roadId`, preserve the first edge ID, and stage a reversible point-editor operation. Separate named roads intersecting geometrically do not join; a later drag-to-connect requires confirmation. Waypoints are existing Scene graph nodes, not new Foundry documents or duplicated Region geometry. The Atlas list renders a bounded window of up to 25 active junctions; lookups occur on deliberate editor actions, not every animation frame. No schema migration or new scene measurement rules are necessary.

## v0.3.8-beta.7.16.2.1 — Native checkpoint-reconciliation hotfix (live v14 retest pending)

The owner's beta.7.16.2 GM test confirmed land checkpoint arrival but failed before the first sea-movement Journal credit with `Foundry movement does not match the approved native checkpoint`. The coordinator's one-pixel origin guard assumed that Atlas's computed route start and the actual TokenDocument start coincide. That assumption is incompatible with the existing allowed same-hex departure offset. The pure native planner now anchors the submitted path to the current TokenDocument and preserves the short approach to the approved route, with matching native and Journal distance accounting. The native `move(waypoints)` receives destinations only, not a duplicate origin. Public v14 `movement.passed.waypoints` can corroborate an origin expressed as an entire continuation path **only** when it proves the expected intermediate route interval and the committed destination matches exactly; redirected paths still fail closed.

GM-only structured diagnostics show the native operation/movement IDs, generated checkpoint key and index, nearest Atlas road/segment IDs, authored final checkpoint ID, expected origin/destination, Foundry-reported origin/destination, committed TokenDocument x/y, deviations and whether a verified native passed-path reconciliation applied. A mismatch warns even when verbose logging is off. These labels are derived read-only from the approved geometry and are **not** permission, payment, time, or persisted movement authority. No new schema or migration; no previously interrupted Journey is auto-credited. PR #171's native movement remains unmerged. See `docs/NAVIGATION_BETA7_16_2_1_TESTING.md`.

## v0.3.8-beta.7.16.2 — Native movement coordinator (authorized test build, live v14 acceptance pending)

Foundry v14 supports full-path `TokenDocument.move()` waypoints with native `checkpoint:true`, public `pauseMovement`/`resumeMovement`, and `moveToken` update events. `navigation-native-movement-coordinator.js` is a Foundry adapter for one native, identity-checked movement path with a pause barrier at each acknowledged checkpoint. The controller enables it **only for continuous checkpoint-bound vessels**, while walking, mounted travel, and GM rest-dependent journeys retain their existing loop. The pure planner supplies bounded five-real-second checkpoint intervals and native integer coordinates. Each interval persists a versioned pending intent in the existing Journey Journal **before** native movement; verified endpoints and animations trigger World time and Journal confirmation before movement resumes. The final native dock records `paused` with transfer metadata before native `move()` resolves, so Canvas redraw does not downgrade an already confirmed arrival. The schema-1 optional pending intent remains readable without migration; unresolved pending movement always blocks automatic recovery pending GM review. Full movement-history-based automatic reconciliation and native Foundry v14 GM/non-GM live testing remain outstanding; never credit unproved distance. No new Scene/Token flags or private APIs. See `docs/NAVIGATION_BETA7_16_2_NATIVE_MOVEMENT_DESIGN.md`.

The Product Owner approved the branch-backed `0.3.8-beta.7.16.2` **test manifest only**; PR #171 remains draft pending GM/non-GM live checks. See `docs/NAVIGATION_BETA7_16_2_TEST_CHECKLIST.md` for install and recovery acceptance. This is not authorization to merge or publish a final release.

## v0.3.8-beta.7.16.1 — Interrupted voyage recovery safeguards (draft hotfix)

Interrupted approved transportation remains Journal-owned. `navigation-transport-recovery.js` validates the saved method, destination checkpoint ID, distance still unconfirmed by the Journal, and the newly projected native route; a terminal off-road connector is tolerated **only** when it is extremely short (at most 2% of one native Scene grid distance, at most one-quarter grid space in pixels), has a direct two-point shape, and terminates at the **exact authored saved arrival checkpoint** with no intervening checkpoint. This exception applies only to recovering an approved water/air leg and does not change normal route classification or authorize new service, time, rest, movement, or fare writes. The controller retains a saved hired/owned method in an unavailable-service preview, shows a recoverable error, and never silently presents Walking or an unapproved owned method. Automatic Canvas recovery refuses road-only token anchor matches; manually requested recovery still requires the verified approved route, so a token that moved ahead of its last committed Journey point cannot use a tiny remaining route to credit unconfirmed miles. Unresolved mismatches remain in the Journal for explicit GM investigation. No persistence schema or native documents are migrated. Foundry v14 GM/non-GM live acceptance remains pending.

## v0.3.8-beta.7.16 — Navigation stage architecture (draft)

A single GM-owned ApplicationV2 Navigation shell derives its visible screen from authoritative state using pure `navigation-stage-model.js`, with independent DOM-only `navigation-stage-view.js` components for destination planning, active travel, confirmed checkpoint decisions, and completed Journal review. Stage selection is **not** a new persisted state machine and rendering cannot authorize native token movement, World-time advance, booking, or Journal writes. The completed checkpoint handler keeps a validated, in-memory record and existing Journal reference after clearing the old route. Existing Journal schema, recovery anchors, Scene flags, native Regions, Levels, and TokenDocument positions are unchanged. Checkpoint directory search grouped by Regions, cosmetic Journal redesign, and Scene scale settings remain separate milestones. Foundry v14 GM and non-GM live acceptance is required before merge or final release.

**v0.3.9-beta.8.1 native Region boundary:** The pure `region-boundary-model.js` rounds a bounded single polygon, rejecting holes, multiple shapes, and self-intersections. Its `region-boundary.js` adapter enforces edit permissions and exact source-shape stale guards; Scene Atlas lists all native Regions and the Road canvas previews old/new outlines transiently. Only an explicit confirmed native `RegionDocument.update({shapes})` modifies geometry. It does not overwrite Behaviors, flags, Region IDs, native Levels, or generated road integrity signatures. Shared seams and geographic hierarchy remain later independent work. [Checklist](REGION_BOUNDARY_ASSIST_BETA8_1.md).

**v0.3.9-beta.8.2 Scene Atlas presentation separation:** Road-generated Regions are identified only through validated provenance and stay in Road tools; manually authored Regions, including public-name management, stay in the territory manager. Existing public-name flags are neither migrated nor duplicated, and generated Road Regions retain their own public label action. Smooth-boundary proposals remain bounded at 256 vertices, with an increased 128-vertex input allowance for safe repeat Gentle passes. The future GM-only Atlas Scene Workspace should be an ApplicationV2 Scene-scoped presentation shell with no new authoritative document data or reimplementation of native Region Behaviors; see [beta.8.2 assessment](REGION_MANAGER_BETA8_2.md).

# Architecture — revised Phase 2 boundaries

> **v0.2.20.1 road-versus-Region UI / Pixi adapter:** Drawn road overlay text is passed to the Foundry Pixi runtime as a literal string, avoiding `[object Object]` on the older positional constructor. World road appearance is a v2 in-memory-compatible, strictly validated category catalog (Land/Air/Water) resolved from a road's chosen travel-preset category, while the native Region preset color and native movement costs stay independent. Name color and category fallback are display-only. World menu labels and Scene Atlas panel hints explicitly identify overlay roads versus native Regions. Existing Scene v6 styles remain readable without silent writes; explicit new saves migrate to v7.

> **v0.2.20 display-only road appearance:** World-wide default settings and optional named-road v6 appearance overrides are resolved only in the GM canvas presentation adapter. Stroke dashes/dots use the saved polyline (not approximated travel geometry), one label per named road uses a longest-section placement, and hover is passive with event cleanup on canvas teardown. Region color continues to belong to the separate Land/Air/Water surface preset/native Region layer. No player-visible markers, native Region changes or Phase 3 navigation.

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

### v0.3.8-beta.7.16.3.2 — checkpoint-hired overland travel (draft)

A GM may explicitly approve a **land-only** guided route using a vehicle/mount offered for hire at the departure checkpoint, including a final leg to a non-checkpoint Point B. Eligibility checks authored road surfaces, the assigned party token, and the current Scene checkpoint offer; a GM confirmation rechecks the offer and method terms before any Journal or native TokenDocument movement. A hired service does not become party-owned. Existing Journey `travelMethod` metadata retains the hired arrangement and approved speed for interrupted-leg recovery even after the token has left the original offer radius. During that recovery, the read-only method selector is locked and may not silently fall back to another Group method. Booking, payment, Actor changes and automatic hiring of draft animals are not implemented. The normal native movement, World-time/Journal, interruption and permissions safeguards remain unchanged. No Scene/Journal schema migration. See `docs/NAVIGATION_BETA7_16_3_2_TESTING.md`.

### v0.3.8-beta.7.16.3.1 — confirmed checkpoint recovery boundary (draft)

After an involuntary Foundry canvas rebuild, automatic recovery validates the same approved Journey and may restart movement **only** if the last saved leg remains unfinished. A recovered, durably confirmed checkpoint with a `pendingTransfer` instead restores its existing checkpoint-decision UI and stops; recovering a Journey does not imply the GM authorized the **next** transportation method. A completed final leg with no transfer also cannot be replayed. Manual Pause/End and unresolved native intents retain their existing fail-closed behavior. No persistence migration or native APIs change. See `docs/NAVIGATION_BETA7_16_3_1_TESTING.md`.

### v0.3.8-beta.7.16.3 — Pause and Journey terminal-state safety (draft)

A confirmed `completed` or `ended` Journey Journal cannot be downgraded by a late canvas teardown or stale checkpoint callback. The old pending native movement and clock/Journal promises settle before a same-Scene canvas rebuild reopens the GM Navigation window. A fully confirmed manual pause can restore only its route **preview**, subject to the strict token-anchor check; it does not restart native movement. An unresolved native checkpoint remains locked for GM review. The earlier five-second continuous-vessel durability intervals are reduced to **two nominal real seconds** for responsive Pause, without inventing intermediate authoritative positions. This does not suppress Foundry canvas redraw or change native Token, Scene, Region or Journal schemas. Journal layout and aboard-rest display stay deferred; see `docs/NAVIGATION_BETA7_16_3_TESTING.md`.

### v0.3.8-beta.7.15.2 — confirmed recovery anchor and approved transport view (draft)

Each native TokenDocument `move` must finish, its Canvas animation settle, and its expected endpoint match before Atlas captures a new image-relative Journey recovery anchor. The cached anchor retains stable road/segment/checkpoint IDs and native elevation/Level ID when available. It is written with credited movement progress to the single versioned Journey Journal even if canvas teardown makes live document sampling unavailable. A stopped or incomplete move never promotes the current TokenDocument position to confirmed progress, and the existing positional/topological recovery guard remains strict. Active Navigation reads the saved approved ship/mount method, speed, and travel hours; rendering never recommits transportation. No Scene/Region/Level ownership changes, Journal migration, or speculative auto-snap of unsafe positions. GM and non-GM Foundry v14 live acceptance is required.

## 9. Primary technical references

- [Foundry: Introduction to Module Development](https://foundryvtt.com/article/module-development/) — manifest, lifecycle, package shape, ES modules.
- [Foundry v14 API index](https://foundryvtt.com/api/v14/) — Scenes, Notes, Journals, Regions, ApplicationV2, canvas APIs.
- [Native Foundry Scene Regions guide](https://foundryvtt.com/article/scene-regions/) — Regions, shapes/holes, Behaviors, and token movement-cost boundaries.
- [Foundry v14 Token API](https://foundryvtt.com/api/v14/classes/foundry.canvas.placeables.Token.html) — native terrain-aware movement path and cost preview methods.
- [LegendKeeper developer guide](https://www.legendkeeper.com/developers/) and [style guide](https://www.legendkeeper.com/developers/style/) — map/pin/page interaction patterns.
- [Indy Route README](https://github.com/jwrpalmer99/indy-route) — route presentation and per-Scene storage reference.

## v0.3.9-beta.3 — Authorized announcement projection

The GM Navigation controller requests live announcements only **after** a Journey Journal creation or update has resolved. Pure `atlas-announcement-commit.js` checks the permitted status transition, native pending-movement absence, confirmed anchor, and checkpoint identity/target; the Foundry adapter in `atlas-announcement-runtime.js` compares the just-committed record to a fresh `journal.getFlag` receipt. Display and broadcasting are best-effort, never part of movement/clock/Journal transaction correctness.

Native World setting `atlasAnnouncementPulse` stores one bounded **public presentation pointer** (`schemaVersion`, opaque `id`, whitelisted `type`) after an active-GM-only write. Unlike an unauthenticated module socket, the server enforces the World setting's write permissions. The one-slot pointer is **not** the Journey ledger and is not replayed on startup; a browser only displays fresh onChange records, deduplicates IDs, and has no gameplay authority. Players see only fixed, non-sensitive subjects; the local GM may see the verified authored name. No Journal identity, private Scene/Checkpoint data, routes, coordinates, free-text names, or TokenDocument movement is distributed. No changes to persisted Journey schema, Scene/Fog/Region/Actor schemas, or native canvas movement. See [beta.3 design review and acceptance checklist](ANNOUNCEMENT_BETA3_DELIVERY.md).

## v0.3.9-beta.3.1 — Local FIFO presentation lifecycle

The announcement renderer owns a **browser-local, bounded, ephemeral** queue of immutable display specs. Committed public announcements use `enqueue`, preserving arrival order and showing each event for a five-second cycle. GM settings previews still use `show`, replacing a prior sample immediately. Only the renderer controls timers, DOM and animation; no sender, Journal, native World setting or Canvas contract changes. Generation checks reject stale queued timer callbacks, and `destroy()` cancels the timer and drops pending displays. The default native Window timer wrappers retain the required host invocation context to prevent the beta.3 `Illegal invocation` and invisible stale overlays. Timing is a local constant for now; a future explicit setting may customize it after owner acceptance.

## v0.3.9-beta.4 — Source-owned discovery and rest event projections

The **Scene-owned** automatic explorer path (`atlas-token-exploration` → `party-exploration-storage`) is the only automatic-checkpoint source. Its adapter reads before/after `partyExploration` and verifies a completed native Scene update before invoking the announcement runtime. Pure eligibility (`atlas-announcement-discovery`) requires Unknown→Visited with Automatic method and an existing checkpoint. Legacy/lore/manual/revisited markers do not announce. The **Road** producer lives after explicit GM `saveRoadSettings`/`saveRoadPlayerVisibility` in the UI adapter, with pure false→true visibility plus revision verification; it is not movement-derived. Runtime re-reads the saved Scene graph, discovery method and state before projecting. No persistence module imports presentation/Canvas code.

The **Journey-owned** manual pause path supplies explicit `manualPause` only after the Journal checkpoint. New rest event count/type and positive duration in the saved Journal govern `break.started` and `break.ended`, with additional rest-event receipt comparison; both display after the full World-time/Journal transaction and never invoke Actor rest. Existing non-rest Journey receipt acceptance remains unchanged. The broadcaster emits only the validated type and opaque pulse ID over the GM-authorized World setting, serializing server writes for closely spaced events. Local GM real names and a bounded, in-memory diagnostic ring never enter the public pulse. Neither Canvas redraw nor player reconnect replays stored pulses; no new persistence schema.

## v0.3.9-beta.5 — Canvas review announcement boundary

Native canvas destruction may interrupt an approved movement, yet the existing recovery controller can safely resume the remaining distance after the old movement/clock/Journal promises settle. A canvas hook is therefore **not** a `journey.paused` event and never directly broadcasts. On `canvasTearDown`, the GM controller retains only an ephemeral `{Scene, token, Journal, createdAt, original phase}` candidate and reuses the pre-existing recovery sequence: reconcile native writes, try the same approved leg when safe, restore the GM window/decision. A new pure `navigation-canvas-announcement.js` policy discriminates an explicitly pending GM decision from continuation, manual pause, terminal state, and mere Canvas lifecycle noise.

Only after the prior promises settle does the controller re-read and validate the *existing* versioned Journey flag from the original Journal, match the Scene/token/creation ID, and require the active GM's Scene update permission. The authoritative saved state decides between **paused awaiting GM** (`journey.awaiting-gm`, no pending native move) and **interrupted pending review** (`journey.interrupted`); a pending native intent may be *labelled interrupted* but never *approved or completed*. These two types require explicit canvas recovery/GM-review eligibility proof in the pure `atlas-announcement-commit.js` policy. The existing runtime verifies the matching Journal receipt, including a strict pending-intent comparison solely for interrupted notices, before GM display and public dispatch. In-flight or automatically continued travel, mismatched/unsettled Journal writes, repeated CanvasReady, inactive/non-GM or other-Scene clients emit nothing. No replay of old World pulses, and banner delivery remains best-effort/ephemeral; no movement, World time, fare, Actor, native Region, Fog or Journal schema changes. See [beta.5 acceptance](ANNOUNCEMENT_BETA5_CANVAS_RECOVERY.md).

## v0.3.9-beta.8.7 — Native Territory authoring and Verbose diagnostics

The pure native border assistant now selects bounded Chaikin smoothing or
vertex-preserving smoothing based on polygon density (up to 2,048 vertices),
rejecting unsafe intersections and excessive area changes before preview.
The GM-only Foundry adapter rechecks permissions and the native shape snapshot
before a single explicitly confirmed `shapes` update. The Territory Workspace
`[+]` uses public v14 `RegionLayer.placeRegion` for a native polygon starter;
Atlas does not invent a Region link, public label or Behavior on creation.
New feature slices should instrument categorized, compact GM-only Verbose
decision/validation/commit diagnostics without revealing shapes or hidden
names. See [design and live checklist](TERRITORY_AUTHORING_BETA8_7.md).

## v0.3.9-beta.8.8 — Read-only geographic parent inference

The GM Territory/Road presentation and local GM Journey-name resolver share
one read-only native Region overlap adapter. For an Atlas-linked City, Town or
Village without a stored parent, it compares the 2D area of its single native
polygon against each linked Continent's native polygon tree. Only a strict
majority with a clear margin over competitors becomes an *effective* parent;
the region flag remains unchanged and explicit saved parents always win.
Complex or ambiguous geometry fails closed to manual selection, and expensive
projections have a fixed comparison budget. This derived hierarchy affects
directory nesting and public-name ambiguity only, never native Shapes,
Behaviors, permissions, or Journey authority. See [inference design and live
checklist](TERRITORY_PARENT_INFERENCE_BETA8_8.md).

## v0.3.9-beta.8.9 — Bounded peer Territory boundary reconciliation

Atlas uses public native Region polygon-tree intersections to distinguish
same-tier territorial overlap from valid Continent/settlement nesting. Its
read-only GM analysis computes supported intersection area and proximity
hints without writing any data. The first explicitly reviewed correction is
one-sided: the GM chooses a protected peer, previews the native polygon
difference and can approve exactly one `RegionDocument.update({shapes})`
after validating geometry, area loss, permission, generated provenance,
geography and both source Shapes against stale changes. Split/hole/large-loss
results and unverifiable native clipping fail closed. There is no speculative
multi-Region write, shared political-border database, native Wall change or
Region Behavior/Level/Atlas graph mutation. Full paired-edge synchronization
and gap filling remain a separately designed follow-up. See [beta.8.9
scope and acceptance](TERRITORY_BORDER_RECONCILIATION_BETA8_9.md).
