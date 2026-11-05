# Atlas milestone rebaseline — November 5, 2026

**Planning status:** owner review. Milestone names are dependencies, not an
authorization to implement later feature stages or merge existing draft PRs.
The active development baseline is `v0.3.8-beta.7.17`; the owner has now
completed two successful multi-leg Foundry v14 GM Journeys with hired Cart,
Wagon, owned Warship, Riding Horse, continuous hired ship, forced march and
four non-continuous eight-hour rests. GM success is not non-GM acceptance.

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
| **A2 — lifecycle safety** | `v0.3.8-beta.7.18` | Extract pure terminal/pause/teardown policy from the controller, add native-coordinate rest test, maintain current retry/approval behavior. No transport, rules, schema, calendar or UI behavior changes. |
| **A3 — compatibility and performance audit** | `v0.3.8-beta.7.19+` (provisional) | Reproduce R-01 inactive-GM/player animation problem; compare TokenDocument, World clock and Journal under canvas redraw and background/minimized clients; audit native Scene Grid/Levels/Region measurements and refresh handling. Fixes require evidence and their own regression slices. |
| **B — Journey UX and Journal** | `v0.3.9` (candidate) | Align the completed Journey Journal with Atlas Navigation styling; improve journey status, leg readability, rest transition and accessible controls. A separate saved-planned-itinerary action and permission-filtered player read model may follow after contracts are tested. No Actor rest, currency, or automatic player travel in this UI phase. |
| **C — topology/Region data** | `v0.4` (candidate) | Independent checkpoint IDs, Atlas-authored native Region boundaries and spatial containment, road slicing, and versioned Scene migration/rollback. Design the export payload early, but do not ship import/export with the migration. |
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
