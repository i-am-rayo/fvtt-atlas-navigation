# v0.3.9-beta.8.38.1 — Checkpoints Workspace authoring/UX regression hotfix

## Source, installation and status

- Source draft: [PR #320](https://github.com/i-am-rayo/fvtt-atlas-navigation/pull/320), stacked on [v8.38 draft test build #319](https://github.com/i-am-rayo/fvtt-atlas-navigation/pull/319).
- This build's manifest: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.38.1-checkpoint-workspace/module.json
- This build's archive: https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.9-beta.8.38.1-checkpoint-workspace.zip
- Source implementation commit: `e5c734fa0e74383495b83b48bab066b7e12ea2b5`
- Automated verification: GitHub Actions Stabilization checks **988/988 tests PASS**, architecture PASS, **Foundry v14 owner GM/non-GM retest pending**.
- No merge, production release, native Region regeneration, or unauthorized gameplay change.

## Root cause fixed

In v8.38, the independent Checkpoint draft did not have Road draft `points`. `RoadCanvasController.#renderOverlay` called `draft.points.map` without checking its draft kind, throwing `Cannot read properties of undefined (reading 'map')`. The overlay and draft summary now tolerate non-Road draft objects. A shared Checkpoints [+] editor eliminates the conflicting two-button authoring workflow.

## Expected user workflow

1. Back up your active and destination Worlds. Install the manifest in a test World, verify the module reports `0.3.9-beta.8.38.1`, and open Paedor as GM.
2. Atlas Workspace → Checkpoints shows exactly one **[+]** beside Checkpoints. Click it and click away from a Road; the *Independent Checkpoint* confirmation opens. Cancel once and verify no Scene write; confirm once and verify a standalone Checkpoint, no fake Road or Region, and its appearance in the list.
3. Click [+] again and click on/near a Road segment or Node (within Atlas's existing bounded snap radius). The existing Road-linked Checkpoint editor opens. Confirm and verify that the Checkpoint is attached to the chosen Road and retains valid graph topology.
4. Start placement and use Escape. Verify the listener and placement indicator clear, and that [+] can be clicked again without needing reload.
5. Check the directory: compact rows, name, Road/Independent, elevation, discovery; Locate, Edit, Settings, Road link/unlink, Journal (when present), and visibility actions are grouped horizontally. The search input filters by Checkpoint or Road name. Expand 'Discovery, reveal radius & removal' for advanced controls.
6. Test one Road-attachment and disconnection (only a standalone Node to a terminal Road endpoint), and test Road deletion using a disposable duplicate Scene. Original Checkpoint ID, Node ID, Journal and discovery must survive.
7. Reload the canvas, switch Scenes, reconnect a non-GM client, verify hidden Checkpoints remain hidden; check existing native Region Shapes/Behaviors, Fog/Atlas Layers, Journal permissions, and a short approved Journey. **Do not change native Regions while any #265 recovery ledger is unresolved.**
8. For portability, native Scene JSON remains the supported transfer route; external map media and Journal Entries are provided separately through your shared compendium. Verify UUID and media resolution in the destination World.

## Known limitations and safe rollback

- The bounded nearest-Road snap operates in image-relative Atlas coordinates, not an automatic connection to arbitrary visual Road curvature. If a click selects an unexpected type, cancel rather than commit.
- Multi-way junction rewiring, arbitrary Road interiors beyond supported direct Road splitting and automatic coordinate merges remain explicitly excluded. Road-independent Checkpoints remain unroutable until connected.
- The legacy Scene → Atlas settings remain available while Workspace parity is completed. The user's successful Region/Terrain authoring acceptance is not reopened by this UI hotfix.
- Roll back by restoring the pre-test World backup and previous tested manifest. Never downgrade a World after creating schema v10 content without a verified compatibility reader/backup.
