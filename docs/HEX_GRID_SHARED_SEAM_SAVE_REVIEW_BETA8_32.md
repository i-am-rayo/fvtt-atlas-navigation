# v0.3.9-beta.8.32 — Hex/Grid shared-seam Preview & Save

**Status:** draft, owner Foundry v14 acceptance pending. Read-only GM
inspection slice of #264, stacked on accepted beta.8.31.1. Does not complete
the interactive seam editor (#264) or multi-Region transaction scope (#265).

## Behavior

- In **Atlas Workspace → Territory Settings → Boundary & Native → Paint**,
  editing an existing manually authored Hex/Grid Region retains the single
  **Preview & Save** button. The extra **Review Shared Cells** button remains
  absent, as previously requested.
- The confirmation now reports native target cell count before/after, added
  and removed counts, exact unclaimed vs same-tier peer-owned additions,
  multiple-claim conflicts, affected same-tier peer names, **existing shared
  seam edge count** and adjacent Territory edge counts.
- Adjacency follows Foundry v14 `canvas.grid.getAdjacentOffsets`. This accepts
  both square and hex grids rather than guessing from row/column differences.
  Same-tier containment only is compared: native Continent–Village nesting is
  not treated as a same-tier conflict.
- If adjacency cannot be inspected, or more than 8,000 target cells / 60,000
  inspected same-tier peer cells would be needed, it explicitly reports the
  seam as unavailable instead of showing a misleading partial count. Exact
  ownership/addition/removal totals remain available.
- The report is recalculated from the **current unsaved draft** each time
  Preview & Save is invoked. Cancel preserves the draft. A multiply claimed
  proposed addition cannot proceed to native write. On confirmation Atlas
  still revalidates all permissions, geometry, stale versions and recovery
  state at the existing Save/transfer boundary.
- No Atlas flag/Region/World/Journal/Token/Fog update occurs while reading
  the preview. The existing two-stage explicit transfer approval and v1/v2/v3
  interrupted recovery ledgers are unchanged. The batch-paint editor still
  uses its independent Stage/final-batch approval workflow.

## GM and player Foundry v14 acceptance

1. Back up a disposable test World/Scene first. Ensure no recovery ledger is
   pending. Open a Hex/Grid Territory near two other **same-kind** Territories.
2. Paint one unclaimed cell and one owned by a peer, then select **Preview &
   Save**. Expect accurate count changes, peer name, and exact native shared
   seam edges. Choose **No**; nothing should write and the draft stays open.
3. Paint or erase another cell and reselect **Preview & Save**. Expect all
   counts to refresh, including removed cells. The earlier report is not reused.
4. On a hex map, inspect a diagonal neighbor; on a square map, inspect a
   horizontal/vertical neighbor. No square-grid adjacency must be inferred
   on the hex map. Test disconnected islands and a nested Continent with a
   Village (different tier) to ensure intentional nesting is not warned as
   same-tier collision.
5. Create a deliberately conflicting draft on a copied test Scene where two
   same-tier Regions already own the same proposed cell. Preview must flag
   it and prohibit Save. Do not manipulate a live campaign Region to test.
6. With a backup, approve a normal single-target transfer. The existing
   second explicit native transfer confirmation, progress and recovery
   behavior must remain unchanged. Check stable Region IDs, Shapes outside
   the edited cells, Behaviors, Levels, Journal associations and Fog.
7. Confirm a non-GM sees no authoring/ownership report. Switching Scenes or
   canceling a preview must leave no stale editor, pending update or leaked
   GM-only Territory details.

**Automated checks:** `tests/territory-grid-transfer.test.mjs` and
`tests/territory-authoring-canvas.test.mjs`, plus the entire module test suite.

**Deferred:** interactive drag-select of entire shared seams, multi-destination
swaps, post-commit native Undo/Redo, multi-Region failure recovery acceptance,
and polygon-only paired-edge editing. Keep #264/#265 open.
