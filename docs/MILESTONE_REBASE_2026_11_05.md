# Atlas milestone rebaseline — November 5, 2026

**Planning status:** owner review. Milestone names are dependencies, not an
authorization to implement later feature stages or merge existing draft PRs.
The latest owner-tested GM Journey baseline is `v0.3.8-beta.7.18`;
beta.7.19 is a **documentation-only assessment**; beta.7.20's focused
Road/Checkpoint extraction passed the owner's seven GM/non-GM live smoke checks.
Beta.7.20.1 is the subsequent **design-only** independent-Checkpoint contract.
Earlier beta.7.17 GM tests covered hired Cart, Wagon, owned Warship, Riding Horse,
continuous ship and ordinary Long Rests. The beta.7.18 five-leg GM journey
confirmed two automatic canvas rebuild recoveries. None of these GM tests
substitute for non-GM or cross-subsystem acceptance.

## What changed in the architecture

- Journey recovery state and the readable Journal page have separate adapters,
  but share **one native Journey Journal**. The namespaced flag is the durable
  checkpoint ledger; the managed page is published at completed leg boundaries
  and terminal decisions. Journal flag writes still trigger normal Foundry
  document hooks at each confirmed native movement checkpoint.
- Normal travel persists verified TokenDocument anchors after each movement
  chunk; continuous native voyage uses a pending-intent checkpoint protocol.
  The native token, World clock and Journal cannot be committed atomically.
- Automatic canvas recovery is permitted for a validated incomplete, previously
  approved leg. It cannot approve a new transport leg or replay an ambiguous
  native move. Manual pauses remain manual.
- The 3,000+ line Navigation controller still coordinates many responsibilities.
  Small presentation slices already extracted should not be put back into it.

## Revised milestone order and scope gates

| Gate | Candidate version | Ownership and exit criteria |
| --- | --- | --- |
| **A1 — current foundation** | `v0.3.8-beta.7.17` | Retain the authoritative Journey state/Journal projection separation and confirmed native anchors. Owner GM journeys are positive; non-GM, repeated teardown and ambiguous in-flight recovery checks remain required. |
| **A2 — lifecycle safety** | `v0.3.8-beta.7.18` | Pure terminal/pause/teardown policy and native-coordinate rest regression. **Owner GM five-leg Journey successful**, including two automatic recoveries; non-GM test outstanding. No transport, rules, schema, calendar or UI behavior changes. |
| **A3a — module-wide architecture assessment** | `v0.3.8-beta.7.19` | Audit existing Roads, Checkpoints, native Regions/Surfaces, Overlays and Fog/Exploration, in addition to Navigation R-01. Document source evidence, ownership, boundary risks, permissions/migrations and future acceptance. **Assessment documentation only; no runtime refactor.** See [full assessment](ARCHITECTURE_AUDIT_BETA7_19.md). |
| **A3b — focused subsystem stabilization** | `v0.3.8-beta.7.20–7.24` (provisional) | **beta.7.20:** Road/Checkpoint graph-first creation workflow extraction; seven owner-reported Foundry GM/non-GM checks passed. **beta.7.20.1:** design-only independent-Checkpoint [contract](INDEPENDENT_CHECKPOINT_CONTRACT_BETA7_20_1.md), with migration explicitly deferred. Later separate draft gates cover native Region/Surface integration, Overlay lifecycle/performance, Fog/player-safe read boundaries and integration testing. Continue R-01 investigation. |
| **B — Journey UX and Journal** | `v0.3.9` (candidate) | Align the completed Journey Journal with Atlas Navigation styling; improve journey status, leg readability, rest transition and accessible controls. A separate saved-planned-itinerary action and permission-filtered player read model may follow after contracts are tested. No Actor rest, currency, or automatic player travel in this UI phase. |
| **C — topology/Region data** | `v0.4` (candidate) | Stable Checkpoint identities anchored to independent persistent Nodes, with Road connections derived from incident segments; Atlas-authored native Region boundaries and derived spatial containment; road slicing and GM-approved versioned Scene migration/rollback. Follow [beta.7.20.1 design contract](INDEPENDENT_CHECKPOINT_CONTRACT_BETA7_20_1.md) after owner review. Design export early, but do not ship import/export with the migration. |
| **D — scheduled services** | `v0.4.x` (candidate) | System-neutral World-calendar adapter; deterministic departures/on-call windows and explicit GM-approved wait/booking/fare. Player pamphlet requires separate filtered permissions. |
| **E — rest and Journey events** | `v0.5` (candidate) | Requested and interrupted rests, optional system-specific Actor effects, inns, tolls, bridges, and event transitions; enforce single World-clock/accounting authority. |
| **F — advanced networks** | `v0.6` (candidate) | Land/water/air network edges, elevation/grade, optional Levels adapter and typed teleport edges, all without altering native Region Behaviors silently. |
| **G — portability** | `v0.7` (candidate) | Scene-only dry-run import/export, stable IDs and collision remapping, rollback, compatibility and final visual parity. Journal appearance is **moved forward to B**, not deferred until G. |

## Release / testing boundaries

1. Every beta.7.x slice remains stacked on its predecessor and draft until the
   Product Owner accepts live Foundry v14 tests. A green Node suite is not
   evidence of a GM/non-GM two-client run.
2. No new storage system or write-on-read migration. If reducing the volume of
   JournalEntry flag writes becomes necessary, first prove their role in canvas
   redraw or a performance problem and design an equally durable source of truth.
3. R-01 (inactive GM) and issue #135 (canvas rebuild) remain **investigations**;
   do not monkey-patch native Foundry canvas behavior to mask the problem.
4. Continue tracking exact native token coordinates at pre-rest, post-rest,
   post-resume checkpoints. Non-continuous downtime advances World time but
   does not authorize movement; continuous-vessel passenger rest overlaps
   approved sailing and adds no second clock interval.
5. Treat current milestones as a **rolling plan**. Re-scope after each owner
   live-test report rather than carrying historical beta promises into a
   new architecture stage by accident.
