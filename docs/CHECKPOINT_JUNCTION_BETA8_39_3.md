# v0.3.9-beta.8.39.3 — Checkpoint merge at saved multi-Road junctions

**Status:** Foundry v14 GM/non-GM test build, NOT accepted by the owner; keep PRs draft/unmerged.

**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.39.3-junction-checkpoint-merge/module.json

**Archive:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.9-beta.8.39.3-junction-checkpoint-merge.zip

## Owner finding

Khar-Dûramel Temple could not be moved onto a saved Road Node even after v0.3.9-beta.8.39.2. The on-screen explanation was: `Only a terminal Node on the selected Road is eligible for exact merge.` The authoritative Scene graph can contain two or more Road sections or two distinct Roads incident to the same valid junction. The existing terminal-only eligibility condition incorrectly blocked these valid connected Nodes.

## Implemented

- On moving an **isolated, unshared** independent Checkpoint into the 14-image-pixel snap radius of a saved Road Node, identify **all incident Roads**. GM chooses **Move Only**, **Cancel**, or an explicit Road association; when multiple Roads meet, present a separate labeled option for each Road (no silent Road selection).
- After confirmation, update Checkpoint `nodeId` to the **existing canonical graph Node** and `roadId` to the GM-selected incident Road in **one revision-checked GM-only Scene Atlas flag write**. Retire the Checkpoint's former isolated Node ID. Preserve Checkpoint ID, Journals, discovery, transportation, Territory links, existing Road/section/node IDs, exact graph geometry, Fog, native Region Shape/Behavior, and Journey state.
- Existing single-Road terminal connection calls remain compatible. Fail closed if the destination Road has no segment incident to that exact Node, source Node is already connected/shared, or destination Node already owns another Checkpoint.
- The previously implemented exact-centerline interior Road connection remains unchanged.

## Verification

Source draft [PR #330](https://github.com/i-am-rayo/fvtt-atlas-navigation/pull/330), commit `5120f5e36c8386e4d2a50c4a0b3eaf25ff8a8580`: GitHub CI **1,020/1,020 Node tests PASS**, architecture checks PASS. Targeted tests cover a two-Road junction with explicit `roadId` selection, graph preservation, unauthorized fabricated Road ID, existing Checkpoint occupancy, old single-terminal backward compatibility, one GM-authorized persistence write and stale revisions. Packaging CI runs separately.

## Owner Foundry acceptance — test on a backed-up World

1. Install the test manifest and confirm `0.3.9-beta.8.39.3`. Inspect original Paedor Road, native Region, Checkpoint and Journey states.
2. In Atlas Workspace → Checkpoints, select independent **Khar-Dûramel Temple** → Move. Click the previously blocked existing Road junction and verify Road connection option(s) are present. At a junction with **multiple named Roads**, verify each appears as an explicit choice.
3. Choose one Road; verify the Checkpoint retains its ID and metadata, now uses the exact existing Road Node ID and selected Road ID, and its retired isolated Node ID is absent. Existing Road segments, IDs, connectivity, positions and native Regions must not change. The Checkpoint should be routable through every Road incident to the shared graph Node.
4. Repeat on a single-Road junction with multiple sections and a genuine Road terminal. Test Move Only and Cancel (no graph attachment/no write on Cancel).
5. Attempt a junction already occupied by another Checkpoint; do NOT offer an unsafe Connect. Attempt stale or deleted Road association; fail safely without altering the Scene.
6. Refresh/reload/reconnect the canvas. Compare original Road/Journal/Region data. Verify separate player permission behavior and a short safe Journey/Journal/World-time regression without duplicating authoritative state.
7. Keep current Scene backup; do not perform authoring writes while an approved Journey or unresolved native Region recovery ledger is active.

## Remaining Sunday work

Pending owner GM+non-GM live acceptance and the separate **Atlas Workspace Surface, Exploration and Navigation migration** plus final cross-World handoff. Do not close #187/#200/#206 or merge drafts on automated CI alone.
