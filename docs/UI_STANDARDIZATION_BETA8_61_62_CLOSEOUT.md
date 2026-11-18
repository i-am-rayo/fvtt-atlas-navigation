# Atlas beta.8.61–beta.8.62.1 — final consolidation and owner acceptance

**Milestone PR:** [#403](https://github.com/i-am-rayo/fvtt-atlas-navigation/pull/403), draft and unmerged.
**Review base:** `test/v0.3.9-beta.8.60-pr376-ui-audit` (owner-accepted beta.8.60); **candidate:** `0.3.9-beta.8.62.1`.
**Owner evidence:** beta.8.62 was reported successful except the local+continent subtitle, and beta.8.62.1 was subsequently reported successful. Do not infer that every older edge-case scenario was individually exercised.
**Scope:** PR #376's 27 UI annotations, completed through focused PRs #398–#400 and #402, versioned wrappers #401/#403, and hotfix #404. Earlier beta.8.59/.60 work is inherited from the accepted baseline; it is not reimplemented here.

## Consolidation audit

- The full candidate is a **fast-forward** descendant of both test builds (no cherry-pick, rebasing, force push or dropped commits). Its cumulative comparison against beta.8.60 must remain ahead with zero divergence.
- #403 is the one *cumulative* review PR against beta.8.60. It includes Directory contextual Plus (#398), actual verified Road/Marker keycaps (#399), Workspace closed/minimized and Road Undo/Redo regression (#400), GM-only Road/native-Territory hover (#402), and the approved `Local, Continent` composition hotfix (#404).
- All runtime code, test files and previous documents remain on the consolidated branch. No gameplay-authoritative files, native Region/Scene document schemas, migrations, Journeys, Tokens, Actors, Journals or World clock were changed as part of consolidation.
- Retain #403 as **draft**. Do not merge to `main`: this repository's `main` manifest is still at its early module-shell baseline, while beta.8 builds are layered on earlier unmerged milestones.

## PR #376 acceptance ledger (original item numbers)

| Items | Outcome / evidence | Acceptance remaining |
|---|---|---|
| 1–4 | Implemented in beta.8.59/.60: centered Workspace navigation, deduplicated management, disclosure/count hierarchy, anchored parent row actions | Visual/keyboard/narrow-zoom cross-check if not already owner-tested |
| 5 | Contextual Directory Plus actions delivered by #398; no implicit parent/Region/Road association | Test on nonempty and empty groups, active editor and transfer |
| 6–11 | Search, sorting/filtering, Road/Map Marker children, meaningful selector groups, shared type categories and Settings/Move vocabulary inherited from beta.8.60 | Verify filters/counts on nested, shared and unclassified data |
| 12 | Workspace focus/return lease retained; #400 prevents late reopen after user close/minimize | Test GM manual minimize, dirty-close, nested editor handoffs and explicit reopen |
| 13–14 | Shared icon Save and Locate on applicable windows; native Territory action rows deliberately retain named actions | Confirm keyboard, permission and exact Save/Cancel boundary |
| 15 | Road draft Undo/Redo plus branch invalidation/Cancel/no-early-save regression in #400 | Test multi-step and native text-input shortcut exemption in live Foundry |
| 16 | #399 uses verified Road/Map Marker keycaps; specialized editor help remains task-specific | Inspect 200% zoom and no invented shortcuts |
| 17 | Existing Map Marker movement dock and native confirmation preserved | Exercise independent/linked movements, snap refusal and Cancel |
| 18–22 | Transport add glyph, GM Scene tool, compact Layers, Road border/color controls, corrected Road-name SVG preview in beta.8.60 | Visual zoom/pan and narrow-window smoke check |
| 23 | #402 implements GM-only opt-in point-accurate Road Territory subtitle; #404 composes unique local Area/Settlement + Continent | Owner reports beta.8.62.1 successful; verify non-GM/player preview, unrelated overlaps and near-Map Marker suppression before release |
| 24–27 | Paired related colors, bordered linked Map Marker/Region panels and stable footers for applicable editors in beta.8.60 | Whole-form 200%-zoom inspection; no fake global Save in native Territory Settings or World travel controls |

**Implementation disposition:** No remaining approved new runtime feature has been identified in this 27-item UI milestone. Exceptional behavior in #13/#16/#24/#27 is deliberate native ownership and accessibility scope, not a missing generic Save/shortcut/field. The above acceptance gaps are **verification**, not license to alter gameplay.

## Final Foundry v14 acceptance (backed-up Sandbox)

1. GM: Map Directory nested continents/settlements/unclassified Roads/Map Markers, counts, sort/filter, group Plus; confirm cancel creates nothing and existing membership is never silently assigned.
2. GM: Open Road, Map Marker and Territory Settings, verify preview/name, paired color swatches, non-scrolling footer, keyboard focus at 100% and 200% zoom; dirty-close and Cancel must not save.
3. GM: Edit a Road through two bends, Undo twice, Redo once, make a new edit and confirm redo invalidation; cancel/reopen, then verify one authorized revision-checked Save and stale-write refusal.
4. GM: Launch movement dock, manually minimize or close Workspace and exit child editor; no unexpected restoration. Explicit Workspace reopen still works. Move independent/linked Marker with native approval/refusal.
5. GM: Hover across continent-only, local Area/Settlement + continent and explicit nested Continent → Area → Settlement: expect single continent or `Local, Continent`, not inferred persisted parent data. Check competing overlapping sibling/continent failure, surface subtitle separation, Map Marker suppression, pan/zoom, reload.
6. Non-GM and GM Player Preview: no GM-only Road native Region hover, no authoring tools or hidden Region/Road/Marker/Journal disclosures; verify native/Atlas Fog unchanged.
7. State integrity: no Region Shapes/Behaviors/priority, Atlas Road graph, Token/Actor, World time, or Journey Journal mutations from hovering, previewing, opening, undoing or canceling UI.

If any step fails, **stop** the consolidation: reproduce the actual failing state transition, add targeted regression and prepare a new owner-tested candidate. Passing GitHub Actions alone is not live Foundry acceptance.

## PR and GitHub hygiene — next authorized phase, *not* executed by this audit

- After the owner accepts this cumulative #403 and the final checks pass, keep **#403 open as the one milestone PR for beta.8.61–8.62.1**, then close **#398, #399, #400, #401, #402 and #404 as superseded (not merged)**, with a comment linking #403 and preserving historical branch/commit references. Do not delete branches or force-update refs.
- Keep beta.8.60 #397 and earlier release-chain PRs for a separately audited closeout. They cannot be mass-closed merely because #403 contains their descendant commits; `main` is not yet an accepted merged baseline.
- A future owner-approved merge needs its **own** reviewed base integration sequence. Closing old reviews is not equivalent to merging code.
- GitHub **Milestone** proposal: `Atlas v0.3.9 — Beta 8 UI Stabilization` (no speculative due date); use to group the cumulative master PR and any remaining independent issues. Do not create a milestone per hotfix.
- Minimal label taxonomy: use existing GitHub `bug` / `enhancement` / `documentation` when available, plus at most `area:ui` and `status:owner-accepted` if truly useful. GitHub native Draft/Open/Closed state and Milestone already cover most workflow state; do not recreate them as many labels.
- New workflow: one cumulative draft **milestone PR** per owner-test build; focused coding PRs can be temporary and closed as superseded only after the candidate is validated. Keep branch-specific manifest/download URLs and the acceptance ledger on the milestone PR.

## Install and review

Consolidated manifest:
https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.62-road-territory-hover/module.json

Consolidated archive:
https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.9-beta.8.62-road-territory-hover.zip

Prior focused hotfix: [#404](https://github.com/i-am-rayo/fvtt-atlas-navigation/pull/404).
Previous owner-tested beta.8.60 baseline: [#397](https://github.com/i-am-rayo/fvtt-atlas-navigation/pull/397).
