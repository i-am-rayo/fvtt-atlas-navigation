> **October 23, 2026 — Phase 2d verified; next authorized v0.2.13:** The owner verified native Region linking/unlinking and two Behavior configurations in Foundry v14. The owner approved this sequence before shortest-path routing: **v0.2.13 checkpoint names/elevation → v0.2.14 GM opt-in native Regions generated around checkpoint points and between checkpoint intervals → Phase 3a only upon separate approval**. v0.2.13 adds a per-Scene schema-v4 `checkpoints[]` list (explicit, no silent migration), one checkpoint per named-road graph point; road-interior placement, label/height editing, filters and safe lifecycle protection. No terrain cost, elevation-derived difficult terrain, auto-generating native Regions, Journal events, native Grid remeasurement or player view yet. Test v14 UI, map padding, node moves/merges/detaches, old v3 loading, and non-GM access before accepting.

> **October 23, 2026 — Phase 2d v0.2.12 draft:** The owner verified v0.2.11 junction repair and approved the next milestone. Deliver a GM-only native Scene Region picker, versioned opt-in association flag per Region, linked list with native Behavior active/inactive readout, native Region editor shortcut, explicit unlink and refresh. Preserve Region shapes/holes/levels/Behaviors, native token movement, native Grid and road graph v3. Automated mocked association tests pass; manual Foundry v14 GM/non-GM acceptance is pending. No terrain-cost previews, road routing or player features yet; Phase 3 is not approved.\n\n> **October 23, 2026 — Phase 2c v0.2.11 targeted repair (pending owner test):** All v0.2.10 improvements were reported working except same-road branch junctions inherited from earlier deliberate merges. Unlike a shared junction between differently named roads, those could not be detached; unlike a two-segment pass-through, they could not be safely converted to a bend. v0.2.11 adds **explicit per-section same-road branch detachment**, preserving all named roads and the rest of the graph, followed by optional safe Shift-click demotion if only two sections remain. Requires a GM section choice; staged Undo/Cancel/Save and schema v3 unchanged. Regions and routing remain deferred.

> **October 23, 2026 — Phase 2c v0.2.10 proposed owner test:** The owner confirmed v0.2.9 graph-node placement and road connections worked, but correctly identified that graph endpoints/subdivisions were mistakenly presented as meaningful junctions in the Waypoints list. The revised design distinguishes **shaping bends**, **true routing junctions** and future **descriptive Waypoints/Notes**. v0.2.10 keeps schema v3 and all saved graph data, relabels the junction tool, filters branching/shared junctions per selected road/direct neighbors/Scene (25 visible max), and adds reversible Shift-click demotion of eligible two-section single-road nodes into shaping bends. Dangerous demotions are rejected. Descriptive Waypoints, native Notes, Regions and routing are still deferred; draft PR #3 stays unmerged until live v14 confirmation.

> **October 23, 2026 — Phase 2c v0.2.9 checkpoint (owner live test pending):** v0.2.8 detached junctions and reattachment passed GM testing. Waypoints [+] now stages a real junction at the clicked interior of a saved road using existing Save Points/Undo/Cancel; Shift-clicking a white road bend converts it to a gold graph node without joining other roads. Dragging that node near another road offers the existing confirmation dialog. Visual crossings remain disconnected by default, while named road groups survive segment splits. The Waypoints list shows at most 25 recent active junctions for responsive Scene Configuration rendering. Labelled POIs/native Notes, advanced road styling/context menu and native Regions are separate work; Phase 2d still needs approval to begin.

> **October 23, 2026 — v0.2.6 checkpoint:** Phase 2c now includes a GM-only logical-road grouping schema v3, explicit lossless v2 organization, explicit merge of connected road groups, and reversible draggable bend and shared-junction editing. Pending owner's live Foundry v14 test. Dedicated Waypoints [+] and style/label/hover controls are not yet implemented; Phase 2d Regions and Phase 3 routing remain future milestones.

# Roadmap and acceptance criteria — revised Phase 2 design

## Phase 2c v0.2.5 implementation (October 23, 2026)

This next **development test build**, following the owner's v0.2.4 tests, adds image-local schema v2 roads with an explicit one-time GM anchoring action for existing v1 maps; nearest-interior road splitting when a new road endpoint joins an existing path; bend redrawing with fixed junction endpoints; and automatic temporary highlight/draft cleanup on closing Scene Configuration. The underlying graph remains per Scene and Foundry-native Grid distance remains untouched. Unit tests do not replace in-client Foundry v14 testing.

The next gate is owner testing of v0.2.5 in a backed-up world against `docs/PHASE2_TESTING.md`. After passing, proposed follow-on work includes Waypoints and UX (style/label/hover/context menu), then native Region association in Phase 2d. **Phase 3 route calculation is not yet authorized.** PR #3 remains draft and unmerged.


**Status:** Phase 1 complete; Phase 2 authorized and its design revised October 23, 2026 after GM testing. Phase 3+ implementations still require approval. **Target:** Foundry VTT v14, system agnostic. See [PHASE2_DESIGN.md](PHASE2_DESIGN.md) for the Region and Scene UI design.

## Definition of the first deliverable

A GM can load a Scene atlas, author a **connected road network**, save it, calculate a shortest-distance road route between junctions, and see the route and distance. It works in a neutral Foundry v14 world and survives reloads. It does not require a specific tabletop game system, LegendKeeper, or Indy Route.

The first deliverable is **GM-only**. Player reveal/hide comes later, after testing the actual data-exposure behavior.

## Phase 0 — Agree on the foundation (this PR)

**Deliverables**

- Clear README, architecture, proposed data model, milestones, and `AGENTS.md` instructions.
- Recorded module identity: `fvtt-atlas-navigation`.
- Decision review: calibration, editor interaction basics, v14 renderer registration, MVP privacy scope.
- No `module.json` or executable code before the owner approves implementation.

**Gate**

- [ ] Owner reviews/approves the proposed document contracts and phase priorities.
- [ ] Open questions are captured as concrete follow-up tasks, not silently assumed.

## Phase 1 — Minimal Foundry v14 module shell

**Deliverables**

- Valid `module.json` with ID matching the eventual module folder and v14 support declaration that reflects testing.
- A minimal entrypoint, module initialization, and local/manual installation instructions.
- Tiny GM-only control or settings surface proving it is loaded.
- Build/test tooling only if justified by the approved language choice.

**Acceptance**

- [ ] The module loads without console errors in a Foundry v14 test world.
- [ ] It works with at least two unrelated game systems or a demonstrably system-neutral test harness (no D&D-specific APIs).
- [ ] Disabling/re-enabling does not leave persistent handlers, overlays, or settings corruption.
- [ ] Source/dev instructions describe how to install and reproduce checks.

## Phase 2 — Scene Atlas management, road editing, and Region associations

**In progress:** The owner verified Phase 2b native Grid updates and tested Phase 2c **v0.2.4** in Foundry v14 on October 23, 2026: road add/rename/delete, reload persistence, per-Scene isolation, and highlight passed. Padding/image anchoring and mid-segment connection did not pass; they are the immediate Phase 2c follow-ups before broader editing. Native Region linking and routing remain future slices. See [Phase 2 design](PHASE2_DESIGN.md).

**Reviewable slices**

- **2b — Native Scene integration and scale (owner verified in Foundry v14):** v0.2.3 provides a public-TABS/PARTS native Atlas tab (Misc/Grid in-sheet fallback); displays Scene Grid settings as the **only** measurement source. Existing manual calibration remains stored but inert; no duplicate global or per-Scene scale setting.
- **2c — Roads and waypoints (v0.2.4 owner-tested, not accepted as complete):** Roads [+] creates polylines; list/select/highlight/rename/delete, persistence, and Scene isolation are confirmed. **Fix next:** (1) road anchoring across Scene padding/shift/dimension changes with safe v1 coordinate migration, (2) join an interior point of an existing road by splitting it into connected segments, rather than endpoint-only snapping, and (3) clear temporary highlight when closing Scene Configuration/leaving Atlas. **Then:** Waypoints [+], moving/inserting/removing saved bends/junctions, safe undo, explicit join/nonjoin, and direct road selection/right-click edit actions. Show a visible snapping/connection preview so the GM knows when nodes actually join. The old enabled toggle stays removed.
- **2d — Native Region linking:** Select existing Scene `RegionDocument` areas instead of recreating their geometry. Persist only minimal Atlas link metadata, display native Region names and active movement-related Behaviors, and open the existing Region editor for all terrain configuration. Optional Atlas labels are visual only; **no parallel speed multipliers, stacking rules, or travel-time calculation in Phase 2.**

**Acceptance**

- [ ] Any Scene offers an Atlas management entry without requiring a premature enabling step; opening it never writes defaults. Existing `enabled` and legacy manual flags remain intact; manual values must not affect distances or UI.
- [ ] Grid `size`, `distance`, and `units` are read correctly; no overrides are offered; native path results match native ruler for square, hex, gridless, and multiwaypoint roads (when routing begins).
- [ ] A sample road topology with a branch and an intentional non-connected crossing is editable on the canvas.
- [ ] Roads share junctions only when explicitly connected, including an explicitly selected interior segment point (split with stable shared junction); visual crossings remain unconnected by default. Saving/reloading preserves IDs; only native Scene Grid determines measured distance.
- [ ] **Padding regression:** draw a road on padding 0.00, change to 0.05 and back, confirm road remains aligned to the same background locations at each value. Also verify Scene shift, dimensions, grid change, pan/zoom, reloaded/migrated v1 roads, and a second Scene. Do not silently migrate unknown legacy coordinate anchors.
- [ ] **Selection cleanup:** road highlight clears when Scene Configuration is closed, Atlas editing ends, or another Scene is viewed, without changing the persisted road or its visibility.
- [ ] Invalid references, zero-length segments, and dangling links are prevented; deletion requires clear confirmation or prevents destructive cascades.
- [ ] Native Regions can be linked/unlinked without replacing native shapes, holes, Behaviors, permissions, or levels.
- [ ] Region link associations persist without copying or modifying native Behaviors. Unlinked Regions are excluded from **Atlas terrain-aware planning**, but can still affect actual tokens in Foundry. Deleted/renamed Regions create recoverable reference updates/warnings.
- [ ] Region test fixtures cover multiple shapes, holes, overlaps, levels, and native enabled/disabled Behaviors; actual terrain-aware movement cost preview is staged for Phase 3b.
- [ ] Distinct Scenes maintain independent networks and Region associations; single-GM editing limits are documented and tested.

## Phase 3 — Real routing (core GM MVP)

**Phase 3a** delivers shortest-distance routing as originally scoped; **Phase 3b**, requiring its own implementation approval, explores native token-aware Region movement costs and optional fastest-cost route selection. Atlas must use Foundry's movement mechanics rather than invent separate terrain multipliers. Estimating overland time is a separate travel-speed concern.

**Deliverables**

- Pure graph construction and Dijkstra shortest-distance routing.
- GM route selection between two network junctions.
- Visually distinct active-route overlay, clear/reset, and measured distance.
- Friendly errors for unavailable native Scene measurement, bad endpoints, and unreachable networks.

**Acceptance**

- [ ] Correct shortest path is chosen on fixture networks where the visually direct route is longer.
- [ ] Foundry native `canvas.grid.measurePath` on ordered road waypoints (not endpoint-only distance or pixel ratio) drives route measurements. Validate native multi-segment/diagonal additivity before choosing edge-weight aggregation.
- [ ] Disconnected endpoints show "no route" instead of a direct line.
- [ ] Equal-distance ties are deterministic.
- [ ] Route queries never mutate or duplicate authored road data.
- [ ] Route remains visible/accurate when zooming and recalculates after edits.

**Phase 3a is the initial functional GM-only milestone.** Proposed Phase 3b will evaluate road paths with Foundry v14's token-specific terrain movement API (`Token#createTerrainMovementPath` and `Token#measureMovementPath`), including existing Region Behaviors. This requires a selected party token/movement action, verification of whether native path calculations can filter to Atlas-linked Regions safely, and tests for mixed systems, overlapping costs, levels, and Region changes. Distances stay geometric; conversion from movement cost to hours/days requires explicit party travel speed.

## Phase 4 — Maps, places, and usability polish

**Deliverables**

- Intuitive sidebar/editor controls and keyboard/pointer interactions.
- Connection to native Scene Notes and linked Journals without copying lore records.
- Optional snap-to-road point selection after the basic junction query is sound.
- Road labels with Off / On hover / Always settings; road-level color and stroke styles (solid/dashed/dotted, width) with optional module defaults.
- Optional controlled curve smoothing without silently changing canonical graph geometry or measured travel distance.
- Focus on a full road (pan/zoom to bounds), GM display hide/show, road hover name and native-measured length once distance is implemented.
- Direct right-click road context menu for common edit/focus/style/hide/delete actions with safe hit testing and confirmations.
- Basic import/export if justified.

**Acceptance**

- [ ] A GM can go from blank atlas to first computed route without console commands.
- [ ] Road labels/hover, per-road style, optional smoothing, focus and display hide/show survive supported save/reload operations and do not alter graph connectivity.
- [ ] Hover length uses the same native measured geometry as the route engine; smoothing as a display option never fabricates a different authoritative distance.
- [ ] Right-click editing does not break native Foundry canvas tools, road drawing, Scene controls or other modules.
- [ ] Existing Note/Journal behavior and native permissions continue to work.
- [ ] Misclicks and destructive edits are reversible or explicitly confirmed.
- [ ] A small internal test world documents the complete manual flow.

## Phase 5 — Player presentation, reveal/hide, and security

**Deliverables**

- Documented player interaction policy based on journal-style visibility.
- Verified permission and data-distribution strategy for any hidden roads/locations.
- Read-only player map/route projection only where authorized.
- Optional GM "present route" action after safe filtering is proven.

**Hard acceptance gate**

- [ ] Inspect an ordinary player's actual accessible documents, flags, messages, and network-visible payloads in a **two-client** test.
- [ ] Unrevealed content cannot be reconstructed merely by inspecting hidden UI state.
- [ ] Reveal, hide-again, Scene switch, and reconnect behave as documented.
- [ ] Player actions cannot modify roads, permissions, or GM settings.
- [ ] Journal/Note native ownership is respected.
- [ ] If filtered transport cannot be made robust, keep those features GM-only rather than presenting UI hiding as confidentiality.

## Phase 6 — Optional expansion (separate approval)

Consider only after a stable base:

- Optional travel profiles, road closures, cross-system cost presentation, and broader terrain-rule integration **without duplicating native Foundry Region Behavior logic**.
- Saved itineraries, animated travel playback, and optional token-follow movement.
- Cross-Scene/world atlas navigation, performance indexes, richer categorization.
- Fog/exploration interplay and accessibility/localization polish.

Each optional feature gets its own data-model revision, risks, and tests. Do not bundle these into the minimum viable module.

## Cross-cutting verification

### Unit tests (pure domain)

- Schema validity, missing/duplicate IDs, nonfinite coordinates, degenerate polylines.
- Junction connectivity including bridges/non-connected intersections.
- Native Grid path distance for square/hex/gridless and multiwaypoint routes; legacy manual values ignored; unavailable Grid behavior.
- Linked Region reference validation and fixtures: multiple shapes, holes, overlaps, levels, Behavior state changes, and invalidated native cost previews.
- Once Phase 3b is approved: selected-token movement-cost previews with native movement modes, system-specific Behaviors, overlaps (including native multiplicative stacking), region/level boundaries, and fallback when no token context exists.
- Dijkstra correctness: branches, cycles, ties, disconnected components, one-node routes.
- Serialization round-trip and migration fixtures once schemas change.

### Manual Foundry v14 smoke tests

- Install/enable/disable; blank/large Scene; switching and reloading Scenes.
- Native Note/Journal interaction and ownership checks.
- Native Region interactions, module link-metadata isolation, Region deletion/edits, and native token movement-cost behavior interoperability (plus system-provided behaviors where present).
- Canvas pan/zoom, padding (0.00 ↔ 0.05), Scene image shift/dimensions, route overlay stacking, road hover/context-menu hit testing, transient highlight cleanup, and native tool compatibility.
- Two browser clients (GM and player), especially before Phase 5.
- Multiple game systems; small and comparatively dense road networks.
- Two GM sessions or a clear single-editor restriction.

### PR quality gate

Every implementation PR should state **what works**, **what was actually tested**, **known limitations**, **screenshot/video evidence if relevant**, and **migration/visibility impact**. Keep docs synced with decisions. Do not claim v14 compatibility based only on static inspection.

## External reference documentation

- [Foundry module development](https://foundryvtt.com/article/module-development/)
- [Foundry v14 API](https://foundryvtt.com/api/v14/)
- [LegendKeeper developers](https://www.legendkeeper.com/developers/)
- [Indy Route](https://github.com/jwrpalmer99/indy-route)
