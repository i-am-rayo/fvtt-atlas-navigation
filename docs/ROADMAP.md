# Roadmap and acceptance criteria — v0.1

**Status:** proposed milestones for project-owner review, not an approved implementation schedule. **Target:** Foundry VTT v14, system agnostic. Milestone scope may change based on verified APIs and user feedback.

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

## Phase 2 — Atlas calibration and road editing

**Deliverables**

- Toggle/mark a Scene as an atlas; explicit calibration when needed.
- GM authoring workflow: add/move junctions, draw/edit segments with interior points, connect/disconnect, delete with safe confirmation.
- Persist and validate versioned Scene-flag data.
- Network overlay renders faithfully across zoom, pan, Scene switch, and reload.

**Acceptance**

- [ ] Sample topology with a branch and an intentional non-connected crossing is editable.
- [ ] Roads share junctions only when explicitly connected.
- [ ] Saving/reloading preserves stable IDs, coordinates, and calibration.
- [ ] Invalid references and zero-length segments cannot be saved.
- [ ] A deleted junction cannot leave dangling segments.
- [ ] Separate Scenes maintain independent networks.
- [ ] Scope of concurrent GM editing is explicit and tested.

## Phase 3 — Real routing (core GM MVP)

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

**Phase 3 is the initial functional GM-only milestone.**

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

- Region-driven terrain modifiers, route closures, alternative fastest/shortest modes.
- Travel speed/time/cost estimates based on system-neutral, configurable units.
- Saved itineraries, animated travel playback, and optional token-follow movement.
- Cross-Scene/world atlas navigation, performance indexes, richer categorization.
- Fog/exploration interplay and accessibility/localization polish.

Each optional feature gets its own data-model revision, risks, and tests. Do not bundle these into the minimum viable module.

## Cross-cutting verification

### Unit tests (pure domain)

- Schema validity, missing/duplicate IDs, nonfinite coordinates, degenerate polylines.
- Junction connectivity including bridges/non-connected intersections.
- Distance sum with scale conversion, zero/missing calibration behavior.
- Dijkstra correctness: branches, cycles, ties, disconnected components, one-node routes.
- Serialization round-trip and migration fixtures once schemas change.

### Manual Foundry v14 smoke tests

- Install/enable/disable; blank/large Scene; switching and reloading Scenes.
- Native Note/Journal interaction and ownership checks.
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
