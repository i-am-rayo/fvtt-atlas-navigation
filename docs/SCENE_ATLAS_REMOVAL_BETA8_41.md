# v0.3.9-beta.8.41 — Atlas Workspace-only Scene authoring

**Status:** Foundry v14 GM/private-beta test build; Product Owner explicitly authorized removing the native `Scene Settings → Atlas` tab. Automated verification PASS; Foundry GM/non-GM acceptance PENDING.

**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.41-workspace-only/module.json

**Archive:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.9-beta.8.41-workspace-only.zip

## Scope and ownership

- Native Foundry `SceneConfig.TABS` / `PARTS` are no longer modified by Atlas on `ready`. Removed Atlas startup tab registration, `renderSceneConfig` in-sheet injection and `closeSceneConfig` editor teardown listener.
- GM Atlas Scene Workspace is the only active Scene authoring UI. Its available views remain Overview, Roads, Checkpoints, Territories, Surfaces, Exploration, Navigation, Topology & Levels, and Import / Export (the last is read-only native Scene portability preflight).
- Road/Checkpoint/Region edits use unchanged Atlas Scene graph and native Foundry adapters. Authoring callbacks now refresh Workspace directly. Existing Road editor dock Save/Cancel/Undo owns its pending draft independently of closing native Scene Configuration.
- **No data/schema migration:** Native Scene Grid/background/dimensions and native Region Shapes, Behaviors and Level setup stay with Foundry; existing Atlas Scene flags, IDs, Journal associations, Fog/visibility state and saved Journey progress are preserved.
- Reusable legacy rendering/test helpers remain dormant in `scene-config.js` for regression coverage; no module lifecycle hook or runtime code registers them in native Scene Settings. Historical `templates/scene-atlas-tab.hbs` is unreferenced. No public legacy tab is exposed after a full Foundry reload.
- Source commit `c43356e35f4402367e123e0f71c9955d232f430a`, draft [#336](https://github.com/i-am-rayo/fvtt-atlas-navigation/pull/336). **1024/1024 automated tests PASS** and architecture PASS. The packaging branch has independent CI.

## GM Foundry v14 acceptance (back up the World)

1. Install this version and **reload Foundry fully** (including browser tab). Open Scene Configuration → confirm **Atlas tab is absent** while native Basics, Grid, Levels, Lighting and other native tabs remain intact. Scene settings save normally.
2. Open the Scene on canvas, click GM `Atlas Scene Workspace` toolbar icon. Verify all nine views, current Paedor Roads and independent Checkpoints, Territory hierarchy, native Region counts, native Surfaces generator and Exploration controls.
3. Create/edit a Road and Checkpoint from Workspace. Verify editors minimize Workspace for canvas selection; Save, Cancel, Undo and Locate remain operable. Closing Scene Configuration while an Atlas Road editor is active must **not** discard a draft. Scene Configuration no longer hosts Atlas editing controls or authoring state.
4. Open Surfaces and Exploration; inspect native Region Link/Unlink, corridor generator preview, manual Fog brush and other existing authoring controls. Confirm read/refresh does **not** write Scene flags, change native Regions or alter native Foundry Fog.
5. Open Navigation: read-only preview does not move a Token, rest an Actor, charge money, write Journey Journal or advance World time. Existing Journey controls still require GM approval, and approved state survives reload.
6. Test Workspace minimization/restore, Scene changes, and canvas redraw. Verify atlas toolbar reopens the same modeless window; editing remains Scene-scoped and preserves staged drafts.
7. Join with a **separate non-GM client**. Confirm Atlas Workspace authoring remains GM-only, hidden Road/Checkpoint/Region metadata and private Journals do not leak. Public Territory and Atlas Layers remain restricted to previously approved visibility and native permissions.
8. Check Import / Export dependency preflight, existing shared Journal UUIDs, external background/icon assets and native Region transfer recovery warning. Do not import over an existing Scene or bypass a pending recovery ledger.

## Sunday private-beta gate

The separate-World transfer of native Scene JSON remains the authorized path based on the owner's prior successful smoke test; assets and shared-compendium Journal UUIDs are external dependencies. No custom importer or automatic UUID rewriting. Keep all PRs draft/unmerged until Product Owner signs off on this live Foundry v14 build and confirms rollback/backups.
