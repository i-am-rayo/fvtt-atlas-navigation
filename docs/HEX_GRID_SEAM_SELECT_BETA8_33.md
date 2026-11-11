# v0.3.9-beta.8.33 — GM shared-boundary selection brush

**Status:** stacked draft, Foundry v14 owner test pending. Extends the
owner-accepted beta.8.32 read-only Hex/Grid seam inspection (#264). It does
not complete #264 or the native multi-Region transaction/Undo work in #265.

## What changed

- In **Atlas Workspace → Territories → Territory Settings → Boundary & Native →
  Paint**, a GM editing an existing single-grid-Shape Territory sees **Shared
  boundary**. The default **Free paint — all cells** preserves the old brush.
- Choose a directly adjacent, same-geographic-tier linked native Region from
  the selector. Unclaimed cells, other neighbors and your current Territory
  cannot be staged by this filtered brush. Eligible cells from the selected
  neighbor appear **gold**; Click/drag stages them, Shift+click/drag erases
  those *staged* cells, and Cmd/Ctrl+Z reverts the previous stroke.
- The native v14 `canvas.grid.getAdjacentOffsets` API determines square/hex
  neighbors; Atlas never treats diagonal hex neighbors as square topology.
  Existing Continent/settlement nesting is not conflated with same-tier seams.
- Exclude multiply owned frontier cells, peers the GM cannot edit, peers
  requiring generated-Region protection, and a peer's lone remaining cell.
  Large scenes fail closed at 8,000 target / 60,000 inspected peer cells;
  individual candidate seams above 500 cells are listed but unselectable.
  The picker never silently shows a clipped subset as the full seam.
- **No native write on selection or paint.** The existing Preview & Save
  displays recalculated counts, source → destination ownership deltas and
  native seam edges. A separate approval is still required for actual source
  removal/target addition. Source and target Shapes, geographic tier, Scene
  Grid, permissions and prior transfer ledger are checked again by the
  established recoverable writer.
- This does not automatically take a whole neighboring boundary, complete
  the peer's last cell, expose Region geometry to players, add a new recovery
  format or implement native post-commit Undo. Batch edits retain their
  independent Stage/review workflow.

## Backed-up World / Foundry v14 GM and player test

1. In a **disposable backed-up Hex/Grid Scene**, arrange two linked manual
   Villages touching along a cell boundary, with no pending recovery ledger.
   Open the receiving Village's **Paint** editor. The selector should list
   the source Village with its eligible frontier cell count.
2. Select the source Village. Expect **gold** outlines only on its native
   touching cells. Click one gold cell, attempt to click a different free
   cell, and verify only the gold cell was staged. Use Shift+click to undo
   that addition and Cmd/Ctrl+Z to restore the staged draft. Cancel without
   saving and confirm neither native Region changed.
3. Reopen and stage one or two source cells without emptying that source.
   Preview & Save should state **Source → Destination (N cells)** and retain
   accurate unclaimed, claimed, conflicted and seam counts. Cancel the first
   preview to verify the draft remains intact; then approve both separate
   confirmations on the backup. Validate Region IDs, neighboring native
   Shapes, colors, Levels, Behaviors, Journal associations and Fog.
4. Switch to **Free paint — all cells** without closing. Confirm unclaimed
   cell additions and normal Shift erase still work. No extra Review Shared
   Cells button or duplicate transfer dialog should appear.
5. Check hex diagonal neighbors and square orthogonal neighbors separately.
   Arrange two peers to claim a candidate cell in a **copy** of the Scene:
   that cell must not be selectable. Also test a generated Region, a Region
   with no editable permissions, a one-cell source and a nested Continent:
   none should be offered as an unsafe same-tier cell transfer.
6. Check that switching Scenes, Cancel, and a native Region edit between
   selection and Preview/Save never silently commit or bypass stale checks.
   The GM must resolve any recorded interrupted transfer before editing.
7. Join as a non-GM. Player clients must have **no** shared-boundary picker,
   gold diagnostic cells or GM ownership metadata. Player Fog, Journey,
   native Region display and Atlas Layers permissions must remain unchanged.

**Automated checks:** `tests/territory-grid-transfer.test.mjs`,
`tests/territory-authoring-canvas.test.mjs`, and the full test suite.

**Still deferred:** full multi-cell shared-edge drag selection spanning
multiple peers, automatic whole-seam repaint, direct target swaps/cycles,
committed-native Undo, deliberate grid split/merge and polygon-only seams.
