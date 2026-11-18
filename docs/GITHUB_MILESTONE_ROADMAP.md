# Atlas — GitHub-native goal milestone roadmap

**Active canonical roadmap (verified November 18, 2026).** This document replaces the earlier **11-stage proposed milestone plan**. All **10 native GitHub Milestones have been created by the Product Owner** and their GitHub numbers/titles verified through the GitHub issue API. **All 47 active feature/defect issues plus draft baseline integration PR #405 have been assigned and individually verified**. Legacy issue [#271](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/271) is retained in Git history as the old Sunday private-beta roadmap and may now be closed *superseded*, not completed.

## How to use these goals

- **Milestone = durable target outcome**, not module version, weekly sprint, PR or test build. Multiple implementation PRs and beta test builds may serve one goal.
- **One primary milestone per issue.** A dependency across goals should link issues rather than duplicating them. Keep unfinished, unsafe or deferred issues open; owner-approved scoped work does not automatically complete a broad contract.
- **Each milestone gets its own acceptance gates:** targeted regressions, `npm run check`, `npm run architecture:check`, syntax checks, `git diff --check`, and actual Foundry v14 GM/non-GM testing for affected behavior. No merge/release without explicit owner authorization.
- **Safety over chronology:** 02 and 03 can advance in parallel, but no unsafe downstream feature should bypass unresolved native Region recovery or Journey authority. Optional P3 refinements must not hold up unrelated private-beta acceptance.
- **Baseline:** The owner authorized promoting the large beta history in [integration PR #405](https://github.com/i-am-rayo/fvtt-atlas-navigation/pull/405) into `main` as **v0.3.9**. Verify GitHub live merge/manifest status before treating the promotion as complete; new feature branches start from the resulting mainline commit. Release checklist and known risks: [docs/RELEASE_0_3_9.md](RELEASE_0_3_9.md).

## Native milestones and issue assignments

### [01 — Atlas Workspace & UI/UX Stabilization](https://github.com/i-am-rayo/fvtt-atlas-navigation/milestone/1)

**Outcome:** Complete consistent Foundry v14 editor forms and contextual titles, keyboard/focus/Workspace restoration; preserve a single reviewed integration path into main.

**Dependencies:** Accepted beta.8.62.1 test baseline; native review of PR #405 remains separately gated.

**Acceptance / exit:** All relevant UI controls pass GM/non-GM focus, unsaved-draft, 200%-zoom and permissions checks; PR #405 is thoroughly reviewed before any separately authorized integration merge.

**Open issues (2):** [#216](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/216), [#289](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/289); plus [draft PR #405](https://github.com/i-am-rayo/fvtt-atlas-navigation/pull/405).

### [02 — Native Map Authoring & Territory Integrity](https://github.com/i-am-rayo/fvtt-atlas-navigation/milestone/2)

**Outcome:** Finish independent Map Markers, native Region containment/links, Hex/Grid shared-cell editing and recoverable multi-Territory transfer.

**Dependencies:** 01 authoring foundation; native recovery safety must be resolved before any risky transfer.

**Acceptance / exit:** Correct the documented #265 v3 recovery blocker without bypassing stale/GM guards; prove native Shapes, Behaviors, elevation, ownership and graph/IDs survive multi-Region edits and reload.

**Open issues (5):** [#204](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/204), [#206](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/206), [#264](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/264), [#265](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/265), [#268](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/268).

### [03 — Journey Reliability & Recovery](https://github.com/i-am-rayo/fvtt-atlas-navigation/milestone/3)

**Outcome:** Idempotent guided travel across canvas redraw, weather/world-time updates, checkpoint boundaries and inactive/returning GM.

**Dependencies:** 01 integration baseline; can be investigated in parallel with native Region work.

**Acceptance / exit:** Reproduce and resolve documented failed transitions in backed-up Foundry v14 World; prove durable TokenDocument/Journal/World-time authority, no double movement, fares or rest, and safe interruption diagnostics.

**Open issues (4):** [#135](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/135), [#189](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/189), [#218](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/218), [#224](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/224).

### [04 — Scene Portability & World Handoff](https://github.com/i-am-rayo/fvtt-atlas-navigation/milestone/4)

**Outcome:** Cross-World portability of authored Atlas Scenes using public native Foundry transfer with explicit preflight and dependency preservation.

**Dependencies:** 01 integration and safety gates in 02 and 03.

**Acceptance / exit:** Verify native Region Shapes/Behaviors, roads, Map Marker identities, linked Journals/pages, assets, Fog, permissions, imported Scene and semantic re-export; refuse unresolved recovery ledgers.

**Open issues (2):** [#205](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/205), [#217](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/217).

### [05 — Road Networks, Map Markers & Surface Refinement](https://github.com/i-am-rayo/fvtt-atlas-navigation/milestone/5)

**Outcome:** Safe relocation and graph slicing/merge parity, accurate native Scene distances, surface classification, Road curves and optional irregularity.

**Dependencies:** 01–02 map identity/authoring invariants.

**Acceptance / exit:** Graph ID connectivity, shared-node warnings, explicit GM approvals, native measurement, terrain conflict/Behavior policy and live v14 regression acceptance.

**Open issues (7):** [#187](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/187), [#195](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/195), [#196](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/196), [#200](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/200), [#221](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/221), [#222](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/222), [#267](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/267).

### [06 — Player Atlas, Fog & Discovery](https://github.com/i-am-rayo/fvtt-atlas-navigation/milestone/6)

**Outcome:** Secure player-visible Atlas Layers, exploration/discovery semantics, GM preview, token controls and optional discovery camera presentation.

**Dependencies:** 02 map/geography model and explicit permissioned player read projections.

**Acceptance / exit:** Real GM plus non-GM clients: discovered/unseen/revoked data, native and Atlas Fog, Journal privacy, reconnect, Scene transitions, elevation and sanitized payload checks.

**Open issues (5):** [#191](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/191), [#198](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/198), [#214](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/214), [#266](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/266), [#269](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/269).

### [07 — Journey Planning & Player Navigation](https://github.com/i-am-rayo/fvtt-atlas-navigation/milestone/7)

**Outcome:** Improved player Journey progress, camera-follow, visual speed, stable waypoints, GM-approved fast travel and completed Journey Journal.

**Dependencies:** 03 Journey authority and 05 topology; 06 for any player-visible details.

**Acceptance / exit:** Original Point B and approved legs preserved, route previews never commit, all movement remains native and explicit GM-authoritative; new alternative-route/dragging/branch-decision ideas must be scoped as separate issues.

**Open issues (6):** [#192](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/192), [#193](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/193), [#194](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/194), [#212](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/212), [#213](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/213), [#215](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/215).

### [08 — Transportation, Rest & Checkpoint Services](https://github.com/i-am-rayo/fvtt-atlas-navigation/milestone/8)

**Outcome:** Scheduled/on-call transport, party vehicles, player pamphlets, rest requests, inns, tolls, bridges and services.

**Dependencies:** 03 safe Journey transitions, 05 graph, 07 Journey UX.

**Acceptance / exit:** Correct World-calendar semantics, explicit GM authorization and no repeated fare/time/Actor resources/Journal events after retries, redraw or reconnect.

**Open issues (8):** [#136](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/136), [#197](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/197), [#199](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/199), [#201](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/201), [#202](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/202), [#203](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/203), [#207](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/207), [#209](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/209).

### [09 — Cinematic Announcements & Atlas Appearance](https://github.com/i-am-rayo/fvtt-atlas-navigation/milestone/9)

**Outcome:** Complete event announcement catalogue, player-safe geographic banners, label/icon styling and reduced-motion presentation.

**Dependencies:** 06 privacy and 07 Journey events; some optional service events from 08.

**Acceptance / exit:** Whitelisted player-safe payloads, deduplicated confirmed event display, no gameplay writes from banners, accessible presentation at normal and high zoom.

**Open issues (4):** [#228](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/228), [#233](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/233), [#294](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/294), [#295](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/295).

### [10 — Advanced Traversal & Geographic Systems](https://github.com/i-am-rayo/fvtt-atlas-navigation/milestone/10)

**Outcome:** Distinct land/water/air networks, native slope/elevation rules, typed teleport transfers and optional advanced polygon boundary operations.

**Dependencies:** 03 safety, 05 graph, 07 navigation and 08 transportation semantics.

**Acceptance / exit:** System-neutral, Foundry-native movement and Regions remain authoritative, reversible stable topology edits, permissioned transfers and safe recoverability.

**Open issues (4):** [#208](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/208), [#210](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/210), [#211](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/211), [#270](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/270).

## Reconciliation and safeguards

- **GitHub assignment audit:** 47 open feature/defect issues assigned across Milestones 01–10 exactly once; draft PR #405 assigned to Milestone 01. No other open development issue was left unassigned. Historical issue #271 was deliberately excluded before its archival closeout.
- Previously completed narrower features (for example #186 generator lifecycle, #226 checkpoint arrival, #292 one-cell Territory, #293 Territory Settings, #301 modeless windows) remain closed. The still-open broader recovery, permissions and UI issues retain their original acceptance criteria.
- **Explicit remaining risks:** #265 native Region interrupted transfer; #135/#189/#218/#224 Journey recovery; #205/#217 external dependency portability; #269 player confidentiality; #289 external-rename title synchronization; #194 GM playback-speed life cycle. Do not close by assumption.
- Reconcile the original historical tracking document [GITHUB_ISSUE_AUDIT_2026_11_18.md](GITHUB_ISSUE_AUDIT_2026_11_18.md) as a **pre-milestone audit snapshot**, not the current assignment authority. [Issue #271](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/271) retains its historical comments and archived deadline.
- For future approved features (such as dragging route previews and branch-route decisions), create scoped issues in the earliest milestone with the required invariants. Avoid renumbering or reclassifying old completed milestones merely because a new beta is built.
