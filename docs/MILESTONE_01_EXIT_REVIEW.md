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
