# v0.3.9-beta.8.23 — Paint staging and Territory–Checkpoint associations

Status: stacked draft for Foundry v14 owner acceptance. No PR merge is authorized.

## What changed

- **Paint batch editor:** Once a GM chooses 2–4 same-tier Hex/Grid Territories in Atlas Workspace, the batch Paint editor has just **Stage** and **Cancel**. The Territory selector stages the current changes **locally** and immediately opens another destination. **Stage** opens the next unfinished destination (if any), or opens the final guarded batch review when all targets have drafts. Choosing **No** at final approval retains drafts and returns to Paint. The experimental **Review Shared Cells** action is removed; existing native preflight overlap, geometry validation and recovery still apply.
- **Native Territory → Checkpoint:** A map-pin action on an Atlas-linked, manually authored native Territory row in Workspace → Territories lets a GM select one existing Checkpoint or remove the association. This is an explicit, versioned native **Region flag** holding only the stable Checkpoint ID, not a copy of its name or Journal. Checkpoint Settings → Terrain Region shows a read-only geographic Territory association.
- **Safety:** Unique one-to-one associations for manual geographic Territories, Scene/Region permission checks, stale Atlas revisions, native name and prior-link preflight, and deletion guards for linked Checkpoints. Unlink the association before deleting its Checkpoint or unlinking the Region from Atlas. Generated Road/Checkpoint Terrain Regions retain their independent behavior and are not eligible for manual geographic association.
- **Deferred:** Geometry synchronization, auto-generating/checking Region boundaries around Checkpoints, public visibility/discovery propagation, Journal synchronization, and polygon-boundary batch edits. These are **not** implicit consequences of an identity association.

## Live acceptance checklist (GM + player)

**Before testing:** Back up the entire World. Resolve any pending native Territory transfer recovery first. Test in a staging World with the updated branch manifest; keep another player session open for visibility checks.

1. From Workspace → Territories, start a batch with three same-tier Hex/Grid destinations and open Paint. Verify only **Stage** and **Cancel** are buttons, with no **Review Shared Cells** button.
2. Paint an unclaimed cell, change the Territory dropdown, and confirm the next Paint editor opens immediately **without** a Workspace detour. Return to the earlier destination and verify its local draft was retained. Before approval, verify native Region cells are unchanged.
3. Press **Stage** to traverse unfinished targets. On the last destination, press **Stage** and verify one clear summary of added/removed/transferred cells. Press **No**, verify Paint reopens with intact drafts. Finally approve a small non-overlapping batch and verify exact cell totals, no unintended source edits, and no stranded recovery banner. For an overlapping case, test only after backing up the World and explicitly reviewing source ownership.
4. Open Workspace → Territories, locate an Atlas-linked **manual geographic Region** (e.g. Dirwest City), click its map-pin icon, choose the existing **Dirwest** Checkpoint, review, then confirm. Verify the association name appears in the Region row and in the Checkpoint Settings → Terrain Region page.
5. Rename the Checkpoint (e.g. Dirwest → Dirwest North) and check that the Territory association resolves to the new name. Confirm the Checkpoint’s position and linked Journal, native Region ID/Shapes/Behaviors/Levels, Road graph, Fog and time are unchanged.
6. Try deleting the linked Checkpoint (and a Road deletion that would remove it): both must fail with guidance to unlink the Territory first. Remove the association via the map-pin and verify normal deletion policy resumes. Try to link the same Checkpoint to a second manual Territory: the module must refuse it.
7. Verify a player cannot access GM linking controls, and neither the association nor batch editing changes player-visible Territory grids, Checkpoint discovery, Journal permissions or Exploration state. Test reopening and a canvas refresh.

## Automated checks

`npm run check` and `npm run architecture:check` validate JavaScript, the module's existing subsystems, the new link guards and editor/workspace behaviors. Live Foundry v14 validation and install smoke tests remain the owner's acceptance gate.
