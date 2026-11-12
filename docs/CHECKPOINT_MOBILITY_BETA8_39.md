# v0.3.9-beta.8.39 — Checkpoint Mobility & Smart Road Connections — test build

**Source:** Draft [PR #322](https://github.com/i-am-rayo/fvtt-atlas-navigation/pull/322) (guarded isolated relocation), stacked [PR #323](https://github.com/i-am-rayo/fvtt-atlas-navigation/pull/323) (new Road attachment review). Both depend on prior v0.3.9-beta.8.38.1 test branch. All PRs remain draft and unmerged.

**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.39-checkpoint-mobility/module.json

**Branch archive:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.9-beta.8.39-checkpoint-mobility.zip

## Implemented
- Existing standalone Checkpoint with an **isolated, unshared Node** can use **Move** from Atlas Workspace → Checkpoints. Click new map position, preview selected point and old/new image-relative coordinates, confirm Save or Cancel. One GM-authorized, revision-checked Scene Atlas flag write moves only the **existing** Node; Checkpoint/Node IDs, Journals, discovery, transportation, Territory association, permissions and Road geometry remain.
- Creating a **new Road** can detect standalone Checkpoints within **14 image-relative pixels** of any section of its draft path. GM gets a candidate list, Select All/None, individual toggles, explicit Connect Selected / Create Without / Cancel Save actions. Selected Nodes become genuine new Road graph junctions; the new Road is split into sections in **one** revision-checked Scene write. Unselected Checkpoints stay independent.
- Existing Road segments and IDs remain unchanged; selected Checkpoint IDs/Node IDs remain unchanged. Duplicate/repeated-route candidates and collisions fail closed; an existing Road endpoint snap cannot silently be replaced by a different independent Node. To intentionally detach from the old network, use the existing Alt endpoint behavior and re-review.

## Automated verification
Latest source commit `1fb63d4dfa8b1fdd26db11ab24aa2ae45f3443cd`: GitHub Actions Stabilization **999/999 tests PASS**, architecture PASS. Release packaging changes are manifest, package version, README note, and this checklist only. **GM and non-GM Foundry v14 live acceptance is still pending.**

## Owner acceptance checklist (test World and backup required)
1. Install this manifest into a **backed-up** Foundry v14 test World. Confirm exact module version.
2. Open Paedor in GM Atlas Workspace → Checkpoints. Ensure existing names, Roads, Checkpoints, Territories and Journals remain. Find a standalone Checkpoint and choose **Move**. Click a free point on map, **Cancel**; ensure no saved position or Scene revision change. Repeat **Save**, refresh canvas and reconnect; verify the same Node ID and Checkpoint ID with new coordinates, all metadata unchanged.
3. With an attached Road Checkpoint or shared Node, ensure **Move** is not offered (or safely refuses). Test Scene switch and stale revision while placement is pending; no write to incorrect Scene.
4. Create a new Road whose **first point** coincides with a standalone Checkpoint and whose path goes through a second and third independent Checkpoint. On Save, inspect the new **Connect independent Checkpoints?** review. Confirm Select All, individual deselection and Select None work. Check exact persisted graph connectivity at the selected Nodes, and confirm no synthetic duplicate Checkpoints or Road nodes are used.
5. Repeat with a new Road passing **near** but not exactly on an independent Checkpoint (within 14 image pixels). The Road may bend slightly to the chosen saved Node; confirm the deviation visually before committing. Try an eligible Checkpoint outside this radius; it must remain independent.
6. Cancel the review; the draft must remain unsaved. Save with no connections; the new Road must be created normally without retroactive links.
7. Try a looping new Road passing twice through the same Checkpoint, two effectively coincident standalone Nodes, and a candidate whose new Road start also snaps to an existing Road. Ambiguous cases must not silently attach or overwrite an existing network connection.
8. Delete a connected new Road in a disposable Scene copy; Checkpoint and Node must persist. Check route availability only where actual graph incidence exists. Smoke-test an existing approved Journey, canvas refresh, Fog, player visibility, Journal permissions and GM/non-GM access. Player client must not see private Checkpoints merely due to new graph topology.
9. Use native Foundry Scene JSON export/import into a second backed-up World with the shared Journal/asset compendium. Verify stable IDs and links. **Stop if #265 native Region recovery is pending; do not bypass its ledger.**

## Explicitly excluded / limitations
- Retroactive automatic attachment to already existing Roads, manual Road reshapes and multi-branch node rewiring.
- Relocating a shared or Road-connected Checkpoint Node (requires explicit detach/graph edit workflow under #187).
- Zero-length, collocated, looping/ambiguous candidates; such overlaps are blocked, not silently merged.
- No new native Region Shape/Behavior, Fog, Scene time, Actor, Journey or Journal writes; the only authoritative writes are the GM-approved Atlas Scene graph and Node moves.
- The active Journey state must be checked in live regression; do not undertake map-authoring edits while an approved Journey is in progress.

If the test fails, preserve the saved Scene revision and console stack. Restore the backed-up World rather than forcing older schema writers onto v10 data. Update #206/#187/#200/#271 with confirmed success or reproducible failure before closing acceptance criteria.
