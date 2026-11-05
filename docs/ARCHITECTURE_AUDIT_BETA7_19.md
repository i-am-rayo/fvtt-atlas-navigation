# v0.3.8-beta.7.19 — Atlas-wide architecture assessment

**Status:** assessment-only draft on top of beta.7.18; source inspected, initial risks
triaged, implementation proposals **not authorized or implemented** by this
document. No Foundry runtime, settings, flags, migrations, or gameplay behavior
changes. The Product Owner decides the priority and acceptance of later slices.

## Baseline and evidence

- Base: draft PR #180, `refactor/v0.3.8-beta.7.18-journey-lifecycle`;
  beta.7.17 Journal state/publication separation remains in the stack.
- Static dependency check: **135 JS source files, 401 literal relative ESM import
  relationships, zero import cycles, zero missing targets**. This establishes
  import integrity, **not** healthy responsibility boundaries or Foundry API
  compatibility.
- Owner **GM live success** on beta.7.18: Hearth's Heart → Dirwest, five
  confirmed legs, 2d 19h 38m moving + 16h downtime = 3d 11h 38m elapsed.
  Submitted console logs show **two** `canvasTearDown` interruptions followed
  by saved-anchor checks, automatic continuation and arrival. These are
  positive recovery observations, not proof that rebuilds are harmless or
  that inactive-GM travel works.
- **Not owner-verified by these results:** simultaneous GM/non-GM visibility,
  inactive/minimized GM R-01, square/hex/gridless measurements, manual native
  Region edits, Levels, weather, migration, and the other subsystems' end-to-end
  persistence. The release remains draft pending applicable live checks.

## Authority and responsibility inventory

| Area | Authoritative owner | Existing boundaries | Must not become authoritative |
| --- | --- | --- | --- |
| Roads | `Scene.flags.fvtt-atlas-navigation.atlas` versioned graph; native Scene Grid measures | `atlas-model.js`, `road-model.js`, `road-storage.js`, `road-coordinates.js` | Smoothed PIXI paths, hit-test samples, preview routes |
| Checkpoints | Stable checkpoint IDs and road/node references in the Scene Atlas flag; additional namespaced Scene offer/preset/discovery flags | `checkpoint-model.js`, `checkpoint-preset-model.js`, `checkpoint-preset-store.js`, `checkpoint-transportation.js` | Preset templates, rendered markers, selected checkpoint controls |
| Regions & Surfaces | Native `RegionDocument` shapes, elevation applicability, Levels, and native/system Behaviors; explicit namespaced Region association/provenance flags | `generated-region-model.js`, `generated-region.js`, `region-atlas.js`, `native-movement-cost.js`, `travel-preset-model.js` | Surface color samples, catalog suggestions, computed traversal previews |
| Overlays | No authoritative data; PIXI/DOM only | `road-canvas.js`, `road-appearance.js`, `road-surface-overlay.js`, `road-hit.js`, `navigation-graphics.js` | Movement state, route connectivity, persisted visibility |
| Fog & exploration | Validated Scene manual/map fog and party-exploration flags for Atlas-specific discovery; native Foundry fog remains separate | `atlas-manual-fog-{model,geometry,storage,renderer}.js`, `atlas-map-fog-*`, `party-exploration-*`, `atlas-fog-readers.js` | Transient mask polygons, token sprites, GM-only overlay filtering as a security boundary |
| Journey integration | Journal flag + committed `TokenDocument` anchors; separately published readable Journal page | beta.7.17 state/writer split, beta.7.18 lifecycle policy | Animation frames, road drawing buffers, Scene flags as a second Journey ledger |

## Evidence-backed findings and proposed work

Priority marks assessment urgency, not a confirmed defect. Every proposed
refactor needs its own contract review and targeted tests. **No bulk rewrites.**

| ID | Priority | Evidence and existing safeguards | Recommended investigation / decision gate |
| --- | --- | --- | --- |
| **A19-R1: mixed road canvas responsibilities** | High | `road-canvas.js` is approximately 2,004 lines, imports road mutations, checkpoint metadata, exploration/fog, appearance, and hit testing; it owns drafts, GM/player pointer handlers, labels and PIXI graphics. It already cleans timers/listeners/graphics in `tearDown()`. | Define distinct authoring workflow, canvas drawing/hit testing, and read-only GM/player projection interfaces. Before extraction, capture pan/zoom, drafts, hovered labels, clusters, Scene switch and cleanup behavior. Keep controllers small without duplicating the graph. |
| **A19-R2: authoring transactions and cross-flag references** | High | `checkpoint-model.js` creates checkpoint + road-node split in one validated graph revision. `road-canvas.finish()` can save a road and then attempt a Journal link separately; errors deliberately report a partial success. Checkpoint offers, preset assignments and discovery use additional Scene flags. | Inventory create/edit/remove/merge/undo paths and dependent IDs; specify recoverable partial outcomes and deletion policy. Do **not** merge flags or invent an atomic cross-document transaction merely for convenience. Prepare the v0.4 independent-checkpoint migration separately. |
| **A19-R3: single-GM optimistic writes** | High | `road-storage.js` checks a Scene revision before `setFlag`, but explicitly states it is **not atomic compare-and-swap**; single-GM editing is the current supported contract. | Characterize stale edits and two-GM races before promising multi-GM authoring. Preserve rejection and drafts; no silent last-writer-wins, new lock service, or schema rewrite in this audit. |
| **A19-S1: native Region / surface semantics** | High | Pure generated-geometry planning is distinct from `generated-region.js` native writes. Cost changes require explicit GM approval, provenance checks and native DataModel validation. `road-surface-overlay.js` samples Region geometry for *color presentation*, not native movement-cost authority. | Verify holes, overlap ordering, elevation/Levels, manually changed native shapes/Behaviors and invalid/disabled movement actions. Clarify any visual-vs-native-cost mismatch in UI; do not silently reconcile or replace native Behaviors. |
| **A19-O1: redraw and lifecycle cost** | High | `road-canvas.refresh()` clears/rebuilds visible drawing data, and canvas zoom/fog refresh hooks schedule redraws. Beta.7.22 adds in-memory count/timing and Graphics lifecycle measurements, and fixes a proven Locate Road timer cleanup gap plus queued/async stale redraws after teardown. | **Partial mitigation, not resolved:** collect v14 trace samples and GM/non-GM visual parity. Native listener counts, GPU allocations and canvas rebuild causation still need targeted evidence before caching or splitting. R-01 and issue #135 stay diagnostic; avoid undocumented canvas suppression/monkey patches. |
| **A19-F1: manual fog regeneration cost** | High | Manual fog uses a queued GM Scene writer with no-op suppression and an independent `PrimaryCanvas` renderer. The renderer rebuilds an opaque polygon mask from native cells and replaces it only after construction; geometry validation fails closed. `nativeFogCells` caps at 40,000 cells. | Benchmark square/hex Scenes, exploration update bursts, Scene padding changes and canvas refresh; test no flashes/leaks, bounded memory and recovery after exceptions. Never expose previously hidden cells as a performance shortcut. |
| **A19-P1: player data projection / privacy** | **Blocking before new player read features** | `player-visibility.js` is documented as **visual-only** and does not guarantee confidentiality of raw Scene flags. `playerAtlasOverlay()` filters roads/checkpoints but spreads remaining Atlas data into its returned object. The owner previously accepted visual-only hiding for the existing overlay. | Design narrowly whitelisted, permission-checked read models before adding a player Journey panel, transport pamphlet or hidden-POI APIs. Run two-client payload and raw-document exposure checks; do not claim current UI filtering is server-side privacy. |
| **A19-X1: shared lifecycle and Journey regression** | High | beta.7.18 GM test confirms successful automatic continuation through two Foundry canvas rebuilds. GM-inactive/player animation R-01 remains unproven. The console also shows another module reacting to Journal updates; this alone does not establish Atlas page-render frequency or redraw causation. | Compare persisted TokenDocument coordinates, Journal flag, World time and both canvases through background/minimized GM, connection loss, reload, simultaneous Region/fog updates and repeated teardown. Attribute failures before remediation. |

### Existing features not being rewritten in this phase

- Road connectivity, curved appearance, measurement via native Grid, and
  published Scene flags remain as authored.
- Checkpoint road association is still required; free-standing checkpoint
  identities and Region containment belong to the versioned v0.4 schema phase.
- Native Regions retain their IDs, shapes, elevations, Levels and Behaviors;
  Atlas provenance and preset references are not rewritten on read.
- Atlas manual exploration and native Foundry `FogExploration` remain separate;
  no assumption that Token Vision can be disabled safely.
- No player authoring, payment, Actor rest, movement or World clock change.

## Proposed prioritized implementation gates after assessment

| Candidate | Conditional scope | Exit gate |
| --- | --- | --- |
| **beta.7.20** | Road / Checkpoint application and authoring boundary only | Staged Save/Cancel/Undo, IDs, revisions, linked metadata, old Scene schemas and GM-only writes unchanged in automated + live tests |
| **beta.7.21** | Native Region / Surface adapters and read projections | No modified manual Region geometry, Levels or Behaviors; native movement action and overlap tests on v14 |
| **beta.7.22** | Overlay performance/lifecycle isolation | Reproduced performance measurements first; no changed hit tests, fog, visuals or PIXI/leaked hooks in two clients |
| **beta.7.23** | Fog / exploration and player-safe read boundaries | Preserved exploration and native fog, fail-closed invalid grids, no new player disclosure; large-Scene and recovery tests |
| **beta.7.24** | Cross-subsystem regression and compatibility gate | GM/non-GM Foundry v14 acceptance across Scene switch, padding, Levels, Region edits, road/checkpoint edits, weather, fog and Journey recovery |

**Sequencing is provisional.** An audit may conclude that a subsystem needs
tests/documentation only, or reveal a blocking defect that must be fixed before
the planned order. Do not combine these slices into one high-risk rewrite.

## Review, acceptance and evidence collection

1. Keep each actual change in a focused **stacked draft PR**. Classify each
   line item as implemented, automated-tested, owner-tested, proposed or
   deferred; do not upgrade a status based solely on this assessment.
2. Capture source-level ownership/import boundaries, baseline behavior and
   failure reproduction before modifying that subsystem. Use pure-domain
   tests, adapter-mock tests and Foundry v14 two-client tests appropriate to
   the changed boundary.
3. Check schema/permission/migration contracts before any write change.
   Preserve unchanged World, Scene, Region, Token, Actor and Journal data;
   no write-on-read upgrades.
4. Validate `npm run check`, `npm run architecture:check`, relevant tests,
   syntax checks and `git diff --check` for each patch. Full Node success is
   not live Foundry acceptance.
5. Publish any future player-facing data only after explicit authorization
   and the separate permission/data-exposure gate.

The immediate owner review checklist for this assessment is
[ARCHITECTURE_BETA7_19_TESTING.md](ARCHITECTURE_BETA7_19_TESTING.md).

**Subsequent design note (beta.7.20.1):** The accepted beta.7.20
Road/Checkpoint authoring extraction does not alter the mandatory
`roadId/nodeId` checkpoint schema. The proposed separate Checkpoint identity
referencing a persistent Node, graph-derived Road connectivity, native Region
containment and versioned v0.4 migration
contract is documented separately in
[INDEPENDENT_CHECKPOINT_CONTRACT_BETA7_20_1.md](INDEPENDENT_CHECKPOINT_CONTRACT_BETA7_20_1.md).
It is design-only and does not retroactively change this audit's findings.

**Subsequent beta.7.21 boundary:** Owner approved the beta.7.20.1 design,
but not the proposed v10 migration. Generated native Region listing and
visual Region surface observation now share a read-only Foundry adapter,
while surface-preset ordering/color selection is a pure projection.
Native Region writes, geometry, elevation, Levels and Behaviors stay with
existing public API adapters. The remaining A19-S1 native-overlap, elevation,
manual-geometry and real-v14 checks are not declared resolved by extraction.
