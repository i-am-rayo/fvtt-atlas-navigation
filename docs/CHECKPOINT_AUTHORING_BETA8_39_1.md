# v0.3.9-beta.8.39.1 — Checkpoint creation and graph connection recovery

**Status:** Test build for Foundry VTT v14 GM and non-GM acceptance. Previous v0.3.9-beta.8.39 owner test **failed** six criteria. This build is a hotfix + topology extension, not a stable release.

**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.39.1-checkpoint-authoring-recovery/module.json

**Source drafts:** [#325 — dialog/full Checkpoint settings/Workspace focus](https://github.com/i-am-rayo/fvtt-atlas-navigation/pull/325), [#326 — relocation and Road-edit connection review](https://github.com/i-am-rayo/fvtt-atlas-navigation/pull/326), stacked on previous beta.8.39 draft #324. All drafts unmerged. The published branch packages the exact #326 code with version/docs.

## Six owner findings, implementation and test status

1. **Road start at independent Checkpoint crashed** with `config.content must be element` (owner console `road-canvas.js:1283`). Foundry v14 DialogV2 requires plain `div` content. New `road-checkpoint-review-dialog.js` supplies the plain root and reads selection from the **rendered** form; original nodes are not authoritative because Foundry serializes content. A regression test models cloned rendered HTML and Select All/None.
2. **Move standalone Checkpoint onto Road:** GM gets **Move & Connect / Move Only / Cancel** when destination is near an eligible existing Road interior, preserving existing Checkpoint/Node IDs. A coincident/near existing Road Node cannot be automatically merged: **Move Only / Cancel**. The GM-confirmed connection splits only the chosen Road section in one revision-checked Scene write.
3. **Road point edits approaching standalone Checkpoints:** Compare pre-edit graph and edited preview; offer newly eligible independent Checkpoints for GM selection. Select all/some/none or cancel. Exact selected topology commits with geometry edits in one guarded Scene write; cancellation preserves unsaved draft.
4. **Workspace minimize:** Checkpoints [+] minimizes the existing Scene Workspace so canvas placement is unobstructed; editing draft persists client-locally. No Scene mutation.
5. **Complete Checkpoint Settings:** Standalone creation now opens the same Checkpoint Settings editor as Road-based creation, supporting name, elevation, category/presets, Marker & Labels, discovery, Journal UUID, player visibility, transportation and its settings; appearance/visibility commit with new Node+Checkpoint, and optional metadata writes follow in explicit order. Independent native Terrain generation must be separately approved later: no automatic Region creation.
6. **Toolbar restore:** Re-clicking the GM Atlas Workspace scene-control tool maximizes the existing ApplicationV2 instance (not a new one), preserving its active section, without a premature forced re-render that interferes with minimized state.

## Automated verification

The source branch tests reported **1012/1012 PASS** and **architecture PASS** in GitHub Actions (commit `c08efa570c3fea19d60f8f44a8ea9d5509e7d65f`). Added mock Foundry v14 cloned-Dialog tests, Workspace lifecycle, new CP primary commit, one-write Move & Connect, multiple Road cuts, ambiguous cases, Point Editor cancel/retry and IDs. Packaged manifest/version/docs run CI separately; live Foundry v14 GM + player acceptance remains PENDING.

## GM test checklist — backed-up world

1. Install manifest with a backup; confirm version `0.3.9-beta.8.39.1`. Check Paedor existing Road, Checkpoint, Region and Journal counts/IDs before editing.
2. **Create new Road starting on independent Checkpoint Node.** Finish Road: the “Connect independent Checkpoints?” dialog must open without any `config.content` error. Uncheck one candidate, Select None, Select All, connect selected, cancel and save without connecting. Confirm checkbox choices match the final actual graph. Test Road starting at existing Road endpoint too.
3. **Checkpoint [+] Workspace flow:** Click [+] from Checkpoints tab. Existing Workspace minimizes. Click empty map area: the complete Checkpoint Settings opens (General, Marker/Labels, Terrain guidance, Transportation). Check name, elevation, type, preset, marker, visible/discovery, Journal UUID and optional offers. Cancel without graph write, then confirm; inspect saved CP/Journals and refreshed marker. Road-click creation should retain the same full editor.
4. Click the GM **Atlas Scene Workspace** side tool while Workspace minimized. It should maximize that same window and preserve Checkpoints tab, list/active state. Canvas placement remains cancelable by Escape.
5. Move isolated independent CP to an existing Road **interior**: offer Move Only, Move & Connect, Cancel; test all, verify stable CP ID and Node ID. Confirm connected graph shares saved Node and the preexisting Road's upstream segment ID stays stable. Moving to an existing Road graph **Node** must fail closed for merge—Move Only/Cancel.
6. Edit existing Road points/bends so the edited shape approaches 1–2 independent CPs. **Save Points** opens eligible CP selection. Cancel remains an unsaved draft. Save Selected commits one revision; Save None edits only Road geometry. Test stale Scene revision and an ambiguous near-two-CP case; no graph corruption.
7. Separate non-GM client: unpublished CP/Journal/private metadata remain private, player-visible items resolve correctly. Smoke-test Road route, native Regions, Fog, overlays, approved Journey/Journal/World time and refresh/reload/reconnect. Do not edit while an authoritative Journey is active.
8. Native Foundry export/import through the user-proven Scene JSON route to a separate backed-up World; verify shared compendium journal UUIDs and map assets, Shapes/Behaviors and original IDs. Do not bypass pending native Region recovery ledger (#265).

## Limits / safety

- This only handles isolated, unshared independent CP nodes and sufficiently separated unambiguous Road interior cuts. No auto merge into existing graph endpoint/junction, arbitrary multi-way topology, retroactive migration or post-commit Undo.
- Pure previews make no authoritative writes. GM-revision-checked Road/Checkpoint Scene flags own saved changes; native Scene Region shapes and Behaviors, Token, Actor, Fog, Journey, Journal documents and World time are not modified by geometric operations.
- Secondary metadata writes (Journal/discovery/transportation) occur after the primary new CP Scene graph commit. A failure is reported without silently rolling the graph back; test with a backup.
- The final P0 Sunday task remains **all Atlas-owned Scene controls moved to Workspace**. This build does not claim that parity completed. Await owner GM/non-GM live acceptance before closing issues or merging a PR.

**Rollback:** Keep an independent World backup. If any regression occurs, stop editing, preserve full console stack and Scene revision, and restore the backed-up World; do not overwrite newer v10 Scene flags with legacy v9 editors.
