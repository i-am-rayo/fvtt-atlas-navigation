# beta.8.56 — Checkpoint UI standardization owner-test candidate

## Scope and lineage
Stacked on draft PRs #362–365 from the owner's beta.8.55 live-verified base. The implementation includes shared numeric input width, centered Workspace navigation labels, Banner Off dependency disabling, and Checkpoint Customization grouping. This build additionally hides Road-name banner choice for graph-disconnected checkpoints and resolves a connected preview Road through actual incident segments rather than only checkpoint.roadId.

The other #362 annotations are not claimed complete. Source data ownership and persistence schemas are unchanged. No automatic migration, native Region mutation, Token movement, Journal or World-time operation is added.

## Integrity and regression checks
- Connect/disconnect Road topology remains owned by existing Road workflows. The banner only reads Scene Atlas segments, never mutates them.
- Road-name preferences survive an independent Checkpoint and can be restored after linking; hidden controls do not write.
- When Banner display is Off, type/elevation/Road/Territory/text-color controls are disabled while their draft state is preserved; switching On restores.
- Existing player-visible Road and Territory filtering remains authoritative. A GM preview is not a player-security filter.
- The editor still enforces GM Scene update permission, revision checks, explicit Save, dirty-close handling and preset portability.
- Automated tests and CI must pass before owner installation. Owner GM/non-GM live acceptance is still required.

## Owner Foundry v14 checklist
1. Install the test manifest in a backed-up **Sandbox** World and confirm the module reports 0.3.9-beta.8.56.
2. Open existing Checkpoint Settings from the Scene canvas and Atlas Map Directory. Confirm no render exception.
3. Visit **Customization**: Checkpoint settings, Banner information, Map preview. Confirm icon picker, marker size, colors, borders and preview remain usable; resize the editor and check normal/narrow/200% zoom.
4. Change Banner display Off → On hover → Always. Verify dependent controls are disabled only while Off, without clearing their values. Compare map preview and GM canvas.
5. On a Checkpoint attached to a Road, Road name remains available. On a disconnected independent Checkpoint, Road name choice is hidden. Test a junction with multiple connected Roads; no fabricated name.
6. Apply a World preset, Cancel without saving, reopen; then Save and reload. Confirm preset, Territory selection and appearance persist only on Save, and no Scene-specific Region ID enters a World preset.
7. Check a non-GM player with visible/discovered and hidden Checkpoints, a hidden Road and hidden Territory. Confirm no unauthorized Road/Territory metadata or linked Journal details leak.
8. Confirm map markers, Roads, Region priorities and existing Journey progress remain unchanged; do not run a Journey during UI verification.
9. Report successes, errors and screenshots with installed version and World/Scene IDs. No production install or merge until accepted.

Manifest: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.56-checkpoint-ui/module.json
Archive: https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.9-beta.8.56-checkpoint-ui.zip
