# Atlas goal-driven GitHub Milestones — successor to issue #271

**Roadmap status:** Open-issue audit reconciled 2026-11-18; Milestone definitions ready for GitHub-native creation; GitHub Milestone records are **not yet created**. The connected GitHub action supports issue/PR edits and assignment to *existing* Milestones but cannot create Milestones. Do not mark this migration complete or close #271 until every native Milestone and issue assignment is verified.

**Sources:** [original issue #271](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/271), its owner result comments and 14 historical stages; current repository issues; accepted `0.3.9-beta.8.62.1`; [baseline integration PR #405](https://github.com/i-am-rayo/fvtt-atlas-navigation/pull/405). Earlier Sunday November 15, 2026 target was a **historical deadline**, not an ongoing due date.

## Model: one milestone = one outcome, not one version or one PR

- Milestones below have fixed **ordinal order and dependency gates**, not speculative calendar deadlines. Future beta versions belong to implementation PRs within the **current goal milestone**, never create another Milestone just to bump a package version.
- Use existing issues as discrete implementation/verification contracts; assign each primary issue to **one** goal milestone. Cross-cutting dependencies are links, not duplicate issues. Keep an issue open until its own acceptance criteria pass.
- Use PRs as short-lived **review deltas** for a goal. Prefer branches from current merged `main`; keep draft PRs until owner acceptance; do not build permanent chains of per-test-build PRs. A milestone can remain active through many tests, then close when its linked issues and acceptance gates pass.
- Every milestone requires `npm run check`, `npm run architecture:check`, `git diff --check`, focused regression coverage, and real Foundry v14 GM/non-GM owner acceptance for affected behavior. No PR merges/releases without explicit owner approval.
- Prerequisites here are **feature ordering**, not permission to silently implement or publish; the owner still approves scope.

## Ordered goals, primary issue assignments, and completion gates

### 01 — Baseline Integration & Authoring Acceptance
**Outcome:** One audited Foundry v14 Atlas baseline on `main`, no orphaned draft chains. Preserve and verify accepted authoring, Workspace and independent Map Marker contracts. **Integration PR:** [#405](https://github.com/i-am-rayo/fvtt-atlas-navigation/pull/405) (draft; not merge-authorized).

**Primary open issues:** [#206](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/206) independent Checkpoint/Map Marker full contract. This has substantial implemented code; remaining full independent-Checkpoint acceptance is not automatically complete. Editor parity #301 was closed completed after the beta.8.30.1 owner report.

**Exit:** reviewed/owner-authorized main integration, matching version/manifest, GM/non-GM authoring/reload/Save/Cancel/permissions checks, known unresolved defects retained in their own issues. No claim of automatic native recovery, cross-World Journal portability, or blanket Journey safety.

### 02 — Native Territory Integrity & Recoverable Editing
**Depends on:** 01. **Outcome:** No unsafe native Region overwrite, complete safe Hex/Grid edit/recovery decisions.

**Primary open issues:** [#265](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/265) multi-source transfer and blocked recovery; [#264](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/264) shared-cell seam editing; [#268](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/268) spatial membership; [#204](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/204) native containment/authoring; the opt-in one-cell creation #292 is already completed, while broader containment and recovery remain here.

**Exit:** explicit diagnostic/root-cause and recovery for the documented v3 multi-Region intent; no bypassed stale/GM guards; native shapes, Behaviors, elevation and player views preserved; polygon/mixed ownership cases documented. **Do not** treat historical green CI as recovery acceptance.

### 03 — Journey Authority, Resume & Canvas Resilience
**Depends on:** 01; recovery is safety-critical before broad private beta. **Outcome:** confirmed movement and saved Journey/World-time/Journal state recover idempotently after lifecycle disruptions.

**Primary open issues:** [#189](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/189) weather-triggered canvas rebuild; [#135](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/135) active canvas rebuild; [#224](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/224) checkpoint-boundary target mismatch; [#218](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/218) background/inactive GM behavior.

**Exit:** failure-injection + live GM/non-GM redraw/reconnect/inactive-GM/multi-leg smoke; no duplicate fares/rests/movement/Journal entries/World-time advancement; unknown state is preserved and reported, never guessed.

### 04 — Native Scene Portability & Private Beta Handoff
**Depends on:** 01, 02 safety gate and 03 essential Journey smoke. **Outcome:** safely move an authored Atlas Scene between backed-up Worlds using native Foundry JSON where sufficient.

**Primary open issues:** [#205](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/205) portable schema/ID contracts; [#217](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/217) Scene import/export preflight, conflict/dependency preview and recovery.

**Exit:** exact native Region Shape/Behavior, roads, checkpoint IDs, hierarchy, Fog, Journal/Page UUID, image/icon asset paths and permission checks in the destination World, semantic re-export comparison, recovery-ledger preflight, explicit owner/private tester authorization. Never claim Scene JSON itself embeds external Journals/assets.

### 05 — Road, Map Marker & Surface Topology Refinement
**Depends on:** 01–02. **Outcome:** extensible, consistent map topology and measured surfaces without competing Foundry movement rules.

**Primary open issues:** [#187](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/187) relocation, [#195](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/195) editor merge parity, [#200](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/200) graph-safe slicing, [#196](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/196) native measured Road lengths, [#267](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/267) surface/corridor cost audit, [#221](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/221) bounded curvature, [#222](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/222) optional irregularity.

**Exit:** stable IDs, graph conservation, measured native Scene distances, no unapproved native Region Behavior changes or silent Road-node attachment; GM/Player canvas/zoom acceptance.

### 06 — Player Atlas, Visibility, Fog & Discovery
**Depends on:** 01, 02 and safe read models. **Outcome:** explicitly permissioned player Atlas discovery without hidden native metadata leaks.

**Primary open issues:** [#269](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/269) Territory Layers publication and client toggles, [#266](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/266) Lore/Seen/Explored contract, [#198](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/198) GM player preview, [#191](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/191) Lore camera, [#214](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/214) Token Settings exploration UX.

**Exit:** actual two-client published/revoked/undiscovered data and Fog/Journal/Region visibility across reload/reconnect and Scenes; GM preview is *not* a substitute for non-GM privacy testing.

### 07 — Navigation & Player Journey Experience
**Depends on:** 03 Journey safety and 06 visibility. **Outcome:** clear approved routes and meaningful player follow/progress without changing authoritative movement.

**Primary open issues:** [#192](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/192) player progress bar; [#193](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/193) local camera follow; [#194](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/194) GM visual speed; [#212](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/212) stable A/B/C lettering; [#213](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/213) authorized fast travel; [#215](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/215) completed Journal presentation.

**Exit:** originals/legs preserved, all actual committed movement native, player visibility safe, no animation-based recovery authority.

### 08 — Transportation, Services, Rest & Economy
**Depends on:** 03, 05, 07. **Outcome:** coherent opt-in services and state transitions with stable money/time and Actor resource ownership.

**Primary open issues:** [#136](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/136) schedule/on-call services, [#197](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/197) owned party vehicles, [#203](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/203) player pamphlet, [#201](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/201) player rest requests, [#202](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/202) interrupted/programmed rest, [#207](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/207) Inn, [#199](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/199) Toll, [#209](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/209) Bridge.

**Exit:** explicit GM authorizations, World-calendar semantics, deterministic fare/time accounting, cancellation and recovery/Journal idempotency.

### 09 — Announcements, Narration & Territory Appearance
**Depends on:** 06 and 07; optionally 08 event sources. **Outcome:** safe, accessible, consistent GM/player announcements and optional styling.

**Primary open issues:** [#228](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/228) modular events, [#233](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/233) themes/Region banners, [#294](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/294) linked icon prefix, [#295](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/295) geography typography.

**Exit:** player-safe names, no repeated announcements on reconnect, reduced-motion/readability, no native Region/name or Journey state mutation.

### 10 — Advanced Traversal & Optional Geometry
**Depends on:** 03, 05, 07, 08. **Outcome:** typed interconnected air/water/land/teleport travel with native level/slope handling.

**Primary open issues:** [#211](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/211) network types, [#208](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/208) elevation, [#210](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/210) teleport gates, [#270](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/270) *deferred* polygon-only transfer enhancement.

**Exit:** native Foundry v14 movement and Regions remain authoritative, no speculative portability fields or silent teleport/time commits. Polygon extension remains optional/deferred until separately approved.

### 11 — Product UX, Performance & Release Readiness
**Depends on:** required work above; not a mandate to implement every optional P3 idea before a private beta. **Outcome:** understandable, accessible, measured multi-system Foundry v14 release.

**Primary open issues:** [#216](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/216) consistent accessible forms and [#289](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/289) contextual titles / external-rename freshness. Region generator #186 and unified Territory Settings #293 were completed in earlier accepted UI slices.

**Exit:** multi-World and GM/non-GM regression, large-hex Scene performance, native API compatibility, accessible controls, staged-save ownership, documented migrations/rollback and owner-authorized release.

## Historical outcomes and carry-over

- Historical #271 records partial GM successes for independent Checkpoint topology, nested Territory Layers, Scene Workspace and native Scene JSON. **Do not reopen closed feature issues** [#288](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/288), [#290](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/290) or [#291](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/291) merely because the older roadmap left checkboxes unchecked.
- Retain existing individual issue acceptance evidence and labels. Use **GitHub native Milestone** to express current goal and its completion fraction. Use existing `area: ...`, `priority: P0–P3`, `bug`/`New Feature` labels; do not create a second parallel status field.
- Preserve original #271 and comments as historical source with a final migration link. Close it as **superseded**, not `completed`, *only after all 11 native Milestones exist and the issue assignments above are verified*. Closing #271 must not close its linked active defects.
- If a priority changes, update the assigned issue/milestone and dependency description, not historical beta-version PRs. A new feature gets one issue in the earliest milestone whose prerequisites it genuinely requires; avoid renumbering completed milestones.

## GitHub-native setup gate (currently pending)

1. Repository **Issues → Milestones → New milestone**: create these **11 names with 01–11 prefixes**, use each section's Outcome/Depends/Exit as description, leave due date blank.
2. Assign each primary open issue to its specified milestone. Keep #405 in Milestone 01 if GitHub allows the PR to be assigned; it is a draft integration review, not the milestone itself.
3. Confirm issue counts and goals, then add a migration comment on #271 linking the Milestones and this document; close #271 as superseded. If any Milestone is missing, keep #271 open.
