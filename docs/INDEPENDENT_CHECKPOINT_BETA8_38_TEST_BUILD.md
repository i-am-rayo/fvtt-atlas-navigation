# v0.3.9-beta.8.38 — independent Checkpoints / terminal Road links — GM test build

**Build branch:** `test/v0.3.9-beta.8.38-independent-checkpoints`  
**Source:** draft PR #318 stacked on #317, #316, #315 and #314. No PR has been merged.  
**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.38-independent-checkpoints/module.json  
**Archive:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.9-beta.8.38-independent-checkpoints.zip

## Scope
- Schema v10 durable, standalone Node-anchored Checkpoints, with guarded GM canvas placement and Workspace management.
- Explicit isolated Checkpoint → saved terminal Road endpoint connection, and terminal-link disconnection without altering original Checkpoint/Node identity.
- Road removal preserves v10 standalone Checkpoints; legacy v9 compatibility readers remain.
- Existing Scene → Atlas controls intentionally remain available pending complete Workspace parity.
- The Scene transport path remains **native Foundry Scene JSON**; referenced Journals and map assets must be separately verified and transferred (the archive is not a standalone World-content bundle).

## Verification status
The parent implementation reported **986/986 Node tests passing**, architecture zero cycles/missing targets and clean diff. This packaging commit only changes version, manifest/download links, package version and this checklist. **Foundry v14 GM and separate non-GM acceptance is still pending.** No assertion of live validation or imported asset/Journal resolution is made.

## Owner acceptance — use a backed-up test World
1. Install this manifest in Foundry v14 (minimum v14), enable in a backed-up World, and confirm module version `0.3.9-beta.8.38`.
2. On Paedor check existing 44 Roads and 38 Checkpoints plus 26 custom Territories and 4 generated Regions still present. Verify native Region Shapes and Behaviors unchanged.
3. Open Atlas Workspace → Checkpoints. Create a standalone Checkpoint, cancel once (no write), then save another. Verify no fake Road, new stable Node/Checkpoint ID, placement under Scene image coordinates and no player disclosure by default.
4. Edit, locate and Journal-link the saved Checkpoint. Refresh canvas and reconnect; preserve ID, data, Region association and player visibility/discovery policy.
5. Connect it to a saved terminal Road endpoint, check exactly one new section and unchanged pre-existing Road section IDs. Cancel disconnect, then confirm disconnect and verify original Checkpoint and Node persist.
6. Test Road deletion after connecting in a disposable World: its Checkpoint must remain independent. Check ambiguous/collocated nodes and stale dialogs fail without a write.
7. Confirm legacy Road-bound Checkpoint editors still work. Verify Fog, native Region geometry/Behaviors and non-GM permissions; smoke-test a short approved Journey, Journal, World time and refresh/resume. **Do not run against an unresolved #265 Region recovery ledger.**
8. Separately use native Scene JSON export/import in a second backed-up World. Verify map image files, exact Journal Entry/Page UUID resolution, Scene grid, Region Behaviors, Road/Checkpoint counts, Fog/privacy; re-export for semantic comparison.

## Safety/known limitations
- Only isolated Checkpoint → terminal Road linking. Interior splitting, multi-branch rewiring and snapped merges are **not** included.
- Schema v9 duplicate Checkpoint identities sharing one Node fail closed on v10 migration; do not force a rewrite.
- Full Scene→Atlas Workspace parity and independent Checkpoint live acceptance are incomplete. Preserve the original World backup and revert to prior test manifest if a regression appears.
- No authorized production merge, release, World migration, Region recovery override or Journey authority change.

See [expanded Checkpoint GM checklist](CHECKPOINT_WORKSPACE_BETA8_38_TESTING.md), [master roadmap](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/271) and [checkpoint issue](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/206).
