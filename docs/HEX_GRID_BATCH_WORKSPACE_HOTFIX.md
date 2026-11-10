# Hex/Grid batch editor: independent edits and Workspace return

## Why this slice exists

The owner selected several batch destinations, painted previously unclaimed
cells (without taking ownership from another Region), and received **"No batch
destination takes cells from a peer Territory."** The Paint Territory editor
also left **Atlas — Scene Workspace** showing only its minimized title bar after
staging. Both are addressed here. The owner's logs also contain unrelated
third-party module initialization warnings and a Foundry effective viewport
warning (909 x 1058, under Foundry's 1024 px width requirement); none of these
are evidence of an Atlas native Region write failure.

## The workflow

1. Open Atlas Scene Workspace → **Territories** → **Start Batch Edit**.
2. Check **2–4 same-tier native Hex/Grid Territories** to edit. They are
   *destinations*, not necessarily recipients of other Regions' cells.
3. Atlas opens the first Paint Territory editor. Use the existing brush controls
   to add previously unclaimed cells, remove cells, or paint onto cells owned
   by **unselected** same-tier source Territories.
4. Choose **Stage & Return to Workspace**. It stores a client-local draft only,
   closes Paint Territory, waits for window focus to be restored, and expands
   the existing Workspace to its Territories section. Select the next unfinished
   destination in the Workspace list, and repeat.
5. Choose **Review & Apply Batch** to see all destination additions/removals,
   unclaimed additions, and any ownership transfers from unselected peers.
   Confirm to write **one guarded batch** with a persisted Scene recovery intent.
   Cancel/discard leaves all native Region geometry unchanged.

### What this batch does *not* do

- It is not a travel itinerary or a sequential set of independent native saves.
  All changes are staged locally first and committed under one explicit approval.
- It does not yet swap ownership **between two selected destinations**. Atlas
  refuses these moves even if the first selected destination also erased that
  cell in its draft. Choose the one-destination transfer workflow for that move
  or wait for the explicit guarded cross-destination swap phase.
- It does not combine polygon and Hex/Grid edits, disclose hidden player
  geometry, change native Behaviors/Levels/Region IDs, or write at preview time.
- Native multi-document updates are **recoverable but not database-atomic**.
  An interrupted batch must be resolved explicitly with Resume or Roll Back.

## Live Foundry v14 test checklist

Use a backed-up World. Validate a separate player client and the map before/after.

- [ ] Choose two same-tier Territories, add one *unclaimed* cell to each, stage
      sequentially, and verify Workspace expands after **each** stage.
- [ ] Verify the other selected Territory can be opened from the Workspace and
      the staged counts remain visible; revisiting a staged draft keeps edits.
- [ ] Review reports **0 transferred, 2 unclaimed added** (for the above case).
- [ ] Cancel the review; native Region geometry remains unchanged.
- [ ] Reopen **Review & Apply Batch**, confirm; both Regions receive their cells,
      native IDs/Behaviors/Levels remain intact, and no recovery intent remains.
- [ ] Test an added cell owned by an **unselected** same-tier Region alongside
      an unclaimed addition: review reports both categories correctly.
- [ ] Test erasing cells, staging both without additions, and confirm safe save.
- [ ] Test an unchanged batch: review reports no edits and writes nothing.
- [ ] Test one staged destination taking a cell from another staged destination:
      review refuses with a clear swap-specific error, no native edits.
- [ ] Test a simulated interrupted write in a backup World; explicit Resume
      and Roll Back remain possible with a **zero-source** batch intent.
- [ ] Check Escape/Cancel and reopening Workspace from its toolbar always
      restore a usable, fully expanded Workspace, not only the title bar.
- [ ] Ensure standard one-Region transfer, Roads, Journeys, Fog, native Region
      Behaviors, Layers and player permissions are unaffected.

GitHub: #265 (Hex/Grid batch and transfer), #271 (master implementation roadmap).
