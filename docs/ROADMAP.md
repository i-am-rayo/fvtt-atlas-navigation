# Roadmap and acceptance criteria — revised Phase 2 design

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

**In progress:** Phase 2b **v0.2.2** implements a GM-only native **Atlas** tab in Scene Configuration with a read-only Scene Grid summary and explicit Grid/manual measurement choice, preserving the v1 Scene atlas flag. Awaiting visual Foundry v14 testing. Phase 2c road/waypoint drawing and Phase 2d native Region associations are still planned. See [Phase 2 design](PHASE2_DESIGN.md).

**Reviewable slices**

- **2b — Native Scene integration and scale (implemented, awaiting acceptance):** v0.2.2 replaces the banner with a public-TABS/PARTS native Atlas tab (Misc/Grid in-sheet fallback); displays Scene Grid scale/units by default and retains old manual calibration until explicit GM source selection. No duplicate global unit setting.
- **2c — Roads and waypoints:** Add `+` controls for road and waypoint lists, with naming/selection/deletion inside the Scene Atlas management UI; add/move/draw/connect polyline junctions with a separate GM canvas toolset. Persist and validate stable IDs in Scene flags.
- **2d — Native Region linking:** Select existing Scene `RegionDocument` areas instead of recreating their geometry. Persist only minimal Atlas link metadata, display native Region names and active movement-related Behaviors, and open the existing Region editor for all terrain configuration. Optional Atlas labels are visual only; **no parallel speed multipliers, stacking rules, or travel-time calculation in Phase 2.**

**Acceptance**

- [ ] Any Scene offers an Atlas management entry without requiring a premature enabling step; opening it never writes defaults. Existing `enabled` and manual scale flags remain intact until deliberate migration.
- [ ] Grid `size`, `distance`, and `units` are read correctly; explicit overrides do not silently replace old or core measurements; hex/gridless behavior is tested.
- [ ] A sample road topology with a branch and an intentional non-connected crossing is editable on the canvas.
- [ ] Roads share junctions only when explicitly connected; saving/reloading preserves stable IDs, coordinates, and scale provenance.
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
- Friendly errors for missing calibration, bad endpoints, and unreachable networks.

**Acceptance**

- [ ] Correct shortest path is chosen on fixture networks where the visually direct route is longer.
- [ ] Curved/polyline distance, not endpoint-only distance, drives route weight.
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
- Road labels, visual styles, saved setting defaults, basic import/export if justified.

**Acceptance**

- [ ] A GM can go from blank atlas to first computed route without console commands.
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
- Distance sum with Scene Grid scale or explicit override, zero/missing calibration behavior.
- Linked Region reference validation and fixtures: multiple shapes, holes, overlaps, levels, Behavior state changes, and invalidated native cost previews.
- Once Phase 3b is approved: selected-token movement-cost previews with native movement modes, system-specific Behaviors, overlaps (including native multiplicative stacking), region/level boundaries, and fallback when no token context exists.
- Dijkstra correctness: branches, cycles, ties, disconnected components, one-node routes.
- Serialization round-trip and migration fixtures once schemas change.

### Manual Foundry v14 smoke tests

- Install/enable/disable; blank/large Scene; switching and reloading Scenes.
- Native Note/Journal interaction and ownership checks.
- Native Region interactions, module link-metadata isolation, Region deletion/edits, and native token movement-cost behavior interoperability (plus system-provided behaviors where present).
- Canvas pan/zoom, route overlay stacking, hit testing, and cleanup.
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
