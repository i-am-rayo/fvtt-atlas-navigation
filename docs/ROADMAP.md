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

**In progress:** Phase 2a v0.2.1 offers a GM-only atlas flag editor, manual calibration, and validated Scene-flag persistence. **Revised design:** use a native-looking **Atlas** section/tab in Scene Configuration, consume the Scene's Grid measurements by default, create graph geometry using GM canvas tools, and link native Foundry **Regions** for optional terrain semantics. The temporary control above the core Scene tabs is not the final UX. See [Phase 2 design](PHASE2_DESIGN.md).

**Reviewable slices**

- **2b — Native Scene integration and scale:** Replace the awkward above-form banner with an Atlas tab/section or safely integrated sheet entry; display Grid scale/units as the default, retain explicit per-Scene override and all prior manual calibration records. Optionally show a later global display-unit preference; do not require duplicate unit entry.
- **2c — Roads and waypoints:** Add `+` controls for road and waypoint lists, with naming/selection/deletion inside the Scene Atlas management UI; add/move/draw/connect polyline junctions with a separate GM canvas toolset. Persist and validate stable IDs in Scene flags.
- **2d — Native Region linking:** Select existing Scene `RegionDocument` areas instead of recreating their geometry. Associate optional Atlas terrain tags and explicit speed multipliers through namespaced metadata; display linked native Regions in the tab and provide access to native Region editing. **No travel-time effects are calculated in Phase 2.**

**Acceptance**

- [ ] Any Scene offers an Atlas management entry without requiring a premature enabling step; opening it never writes defaults. Existing `enabled` and manual scale flags remain intact until deliberate migration.
- [ ] Grid `size`, `distance`, and `units` are read correctly; explicit overrides do not silently replace old or core measurements; hex/gridless behavior is tested.
- [ ] A sample road topology with a branch and an intentional non-connected crossing is editable on the canvas.
- [ ] Roads share junctions only when explicitly connected; saving/reloading preserves stable IDs, coordinates, and scale provenance.
- [ ] Invalid references, zero-length segments, and dangling links are prevented; deletion requires clear confirmation or prevents destructive cascades.
- [ ] Native Regions can be linked/unlinked without replacing native shapes, holes, Behaviors, permissions, or levels.
- [ ] The Region list and terrain metadata persist, while unlinked Regions have no Atlas effect; deleted/renamed Regions create recoverable reference updates/warnings.
- [ ] Region test fixtures cover multiple shapes, holes, overlapping areas, and levels; actual road–Region intersection calculations are staged for Phase 3b.
- [ ] Distinct Scenes maintain independent networks and Region associations; single-GM editing limits are documented and tested.

## Phase 3 — Real routing (core GM MVP)

**Phase 3a** delivers shortest-distance routing as originally scoped; **Phase 3b**, requiring its own implementation approval, adds Region-aware travel-time calculations and fastest-route selection. Terrain-aware planning must not be confused with Foundry's token movement-cost Region behavior.

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

**Phase 3a is the initial functional GM-only milestone.** Phase 3b will split road polylines by linked Region polygon geometry, apply explicit speed multipliers to intersecting lengths, and compare shortest versus fastest routes. It needs base travel speed and tests for holes, overlaps, levels, closures, and changing Region geometry.

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

- Additional travel modes, advanced terrain stacking/priority policies, road closures, and system-neutral travel-cost models beyond the approved Phase 3b proposal.
- Saved itineraries, animated travel playback, and optional token-follow movement.
- Cross-Scene/world atlas navigation, performance indexes, richer categorization.
- Fog/exploration interplay and accessibility/localization polish.

Each optional feature gets its own data-model revision, risks, and tests. Do not bundle these into the minimum viable module.

## Cross-cutting verification

### Unit tests (pure domain)

- Schema validity, missing/duplicate IDs, nonfinite coordinates, degenerate polylines.
- Junction connectivity including bridges/non-connected intersections.
- Distance sum with Scene Grid scale or explicit override, zero/missing calibration behavior.
- Linked Region reference validation and geometry fixtures: multiple shapes, holes, overlap, level, road polyline clipping, and invalidated caches.
- Once Phase 3b is approved: travel time on partially affected segments, shortest-vs-fastest route divergence, and no double-counting in overlapping Regions.
- Dijkstra correctness: branches, cycles, ties, disconnected components, one-node routes.
- Serialization round-trip and migration fixtures once schemas change.

### Manual Foundry v14 smoke tests

- Install/enable/disable; blank/large Scene; switching and reloading Scenes.
- Native Note/Journal interaction and ownership checks.
- Native Region interactions, module metadata isolation, Region deletion/edits, and interoperability with built-in Modify Movement Cost behaviors.
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
