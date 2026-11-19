# Milestone 01 — Atlas Workspace & UI/UX Stabilization: exit audit

Status as of 2026-11-19: **implementation candidate, not yet closed or merged**. Product Owner accepted cumulative `0.3.11-dev.18`. The final `0.3.11-dev.19` CSS/keyboard/title batch awaits live Foundry v14 acceptance. Passing automated tests is not a substitute for GM/non-GM live verification.

## Issue-to-implementation traceability

| GitHub issue | Implemented slice / current cumulative evidence | Status for exit |
| --- | --- | --- |
| #406 — shared plus actions | #428; dev.19 removes competing Workspace icon-size overrides | Dev.19 live visual check required |
| #407 — modeless canvas editors/help | #430 and later editor parity through dev.18 | Earlier cumulative owner acceptance |
| #408 — directory count placement | #429 | Earlier cumulative owner acceptance |
| #409 — Show/Hide confirmation | Previously closed; staged visibility remains draft until Save | Verify no extra prompt/double commit |
| #410 — user terminology | Previously closed; Map Marker is display terminology; internal keys remain checkpoint | Verify menu/Workspace labels |
| #411 — Road preset row | #432 | Earlier cumulative owner acceptance |
| #412 — type/preset independence | Previously closed; type must not overwrite chosen preset | Verify identity preservation |
| #413 — Map Marker border enabled | #438 | Earlier cumulative owner acceptance |
| #414 — banner display/text color | #433 | Earlier cumulative owner acceptance |
| #415 — Locate/Save/Delete footer | #431 | Earlier cumulative owner acceptance |
| #418 — Advanced tools/recovery reachability | #437; native tools retained contextually in Map Directory | Confirm recovery entry still reachable |
| #419 — World catalog shortcuts | #434 | Earlier cumulative owner acceptance |
| #420 — Map Marker World preset parity | #435 | Earlier cumulative owner acceptance |
| #421–#423 — World catalog category tabs | #434 | Earlier cumulative owner acceptance |
| #216 — editor icon/form and keyboard parity | #441, #446–#449; final dev.19 styles and Road point context | Dev.19 live visual/keyboard check required |
| #289 — dynamic contextual editor titles | #441, #449; final dev.19 Road point-editor title | Dev.19 live test required |
| #439 — Map Directory contextual views | #440 | Earlier cumulative owner acceptance |
| #442 — Map Marker parallel window hotfix | #443 | Earlier cumulative owner acceptance |
| #444 — record-scoped sequential saves | #445 | Earlier cumulative owner acceptance |

The above list is *traceability*, not proof of a merged implementation on `main`. Issue closure is conditional on the final accepted integration state and each issue's original acceptance criteria. Explicitly retain open issues with unverified requirements.

## Final consolidated Foundry v14 acceptance (GM and non-GM)

1. GM: open **Dirwest** and **The Eyrie** Territory/Map Marker settings concurrently, stage changes, save one then the other; same-record conflicting edits must still be rejected, unrelated records must not conflict. Cancel/Escape/X must not persist; reopen and verify approved records.
2. GM: open Road Settings, Map Marker Settings, native Territory Settings and Geography dialogs together. Verify independently named titles, including the **Road Editor** when editing existing Road control points; native Region rename refreshes only the relevant Territory header. Test minimize/restore and long or special-character names.
3. GM: keyboard navigate **four Territory Settings tabs** and all Map Marker/Workspace/World preset tab families using arrows/Home/End; selected state and visual highlight agree, focus remains visible, unsaved drafts are preserved. Check **200% Foundry UI scale** with modeless Territory windows narrowed and re-expanded: tabs and actions wrap without clipping, and shared icon-only buttons remain 2rem.
4. GM: click Locate, visibility, Settings, Edit, Save and Delete in representative Road/Map Marker/Territory forms. Verify left/right DOM focus order and confirmation scope, including canceled manual Show/Hide and separate World preset Save. Test generated Region geometry actions using disposable fixtures only; no modified-native-Region override.
5. GM: from Atlas Workspace → Map Directory, confirm contextual Territory batch recovery, native Road legacy controls, Map Marker discovery/connection tools, World preset shortcuts and no obsolete Advanced Map Operations disclosure. Opening these controls must not mutate Region Behaviors/Shapes, Scene flags, Actor/Token, Fog, Journal or World time.
6. Non-GM separate client: verify no GM-only editors/actions or hidden Atlas record metadata are exposed; native permission and player-visible announcement/marker projections remain unchanged. Confirm keyboard navigability of permitted player controls.
7. Smoke-test previously accepted dev.18/17, especially user edits to two independent settings windows, no unintended Journey movement/time/Journal history, and no leaked hooks or duplicate action after reopen.

## Integration and release gate

- `npm run check`, `npm run architecture:check`, syntax, PR patch whitespace, `git diff --check` on an actual checkout, and source-ref/manifest/version parity.
- Create one **draft**, release-manifest-safe integration PR targeting `main` only after checking the cumulative diff against current `main`. Preserve prior draft PRs and branch history; **never** bypass the release manifest test or claim all earlier draft PRs were merged.
- Do not merge into `main`, publish a release, tag a version or close Milestone 01 until dev.19 GM/non-GM live acceptance and the owner explicitly authorizes the final release/integration. Issues #265 (native Region recovery) and #135/#189/#224 (Journey recovery) are separate safety contracts and are not declared fixed by this UI milestone.

## Final owner visual feedback (2026-11-19) — dev.20 required before integration

The Product Owner's four screenshot annotations rejected the framed Road Editor appearance as inconsistent with **Atlas · Paint Territory**. Follow-up dev.20 replaces the canvas editor's frame/format while retaining the existing controller and adds a mode-specific independent **Map Marker Editor** presentation. This supersedes any dev.19 styling sign-off assumptions. Live GM and non-GM dev.20 acceptance is required before Milestone 01 integration PR #451 may merge. No native state or Journey scope was expanded; tracked under broad #216 unless a separate issue is later required. Explicit owner approval to merge and release remains mandatory.

## Dev.20 failed owner visual acceptance — corrective dev.21

Live screenshots on November 19 show that opening the dev.20 Road Editor displaced the Foundry settings/right-side panel and leaked editor instructions across the top. Owner also requested removing redundant instructional info notifications now that shortcuts are inside the canvas editor. Corrective `0.3.11-dev.21` retains the native framed ApplicationV2 positioning (hiding only visible title chrome), removes only duplicated startup tips, and includes the promoted/demoted and detached graph-node gestures in the dock. **Dev.20 is not accepted. Dev.21 requires real GM/non-GM Foundry v14 verification before PR #451 may be updated or merged.** Issue #453's intermittent install-time JS request failure remains separately open pending network evidence.

## Owner final acceptance and v0.3.11 integration, 2026-11-19

The Product Owner explicitly confirmed cumulative **0.3.11-dev.21** as working in Foundry v14 after the dev.20 canvas-editor layout regression. This constitutes owner live visual acceptance, separate from the automated **1,139/1,139** tests and architecture **4/4**. No separate non-GM screenshot/log report was provided for the final build, and therefore that specific coverage must not be claimed.

v0.3.11 is the release-formatted **mainline integration** of all cumulative, approved Milestone 01 UI improvements through dev.21. Prior stacked draft PRs may be administratively closed after a successful squash/merge, with a reference to the mainline integration; no unrelated Road/Region/Journey work may be inferred as fixed. Startup issue **#453** is a known *unresolved* intermittent after-update resource-loading failure. Performance review **#455** is a separate open follow-up: successful warm browser-cache reloads were approximately 3.5 seconds to page onLoad, not proof of fully usable Canvas. A release-safe mainline manifest does not repair the first-boot failure, and its issue must remain open.
