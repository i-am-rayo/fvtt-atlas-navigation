# Atlas Hex/Grid batch — beta.8.22 Paint-first workflow

After selecting two to four editable, same-tier Hex/Grid Territories under
**Workspace → Territories → Start Batch Edit**, all routine batch interactions
are now available directly from **Atlas · Paint [Territory]**. The Workspace
remains available as a fallback; it is not required between targets or for the
final approval.

## Paint controls

- **Stage & Next: [Territory]**: stage the current draft locally and open the
  next un-staged receiving Territory automatically.
- **Switch batch destination → Stage & Switch Territory**: select any other
  destination in the batch, including previously staged destinations, to
  revisit its saved local draft. The current draft is staged before switching.
- **Stage & Review Batch**: appears when every *other* selected destination has
  already been staged. Stages the current one and opens the existing guarded
  Review & Apply dialog directly, without navigating through Workspace.
- **Stage & Return to Workspace**: optional fallback; preserves the current
  local draft but performs no native Region write.
- **Cancel / Esc**: closes the editor and restores the Workspace without
  staging current unsaved changes. Other staged local drafts remain available.

The Workspace should not flash open between **Stage & Next**, **Stage & Switch**
or **Stage & Review**. Its original window state is restored at the end.

## Safeguards

Staging and switching never write Region Shapes. Approval still requires the
existing fresh validation, durable recovery ledger, source-owner trimming,
geometry verification and explicit GM confirmation. Canceling the final
approval reopens the last Paint editor with the staged drafts unchanged.
Interrupted native writes still require explicit recovery in Workspace.

The previous `config.content` recovery confirmation fix and GM-only fog-free
Paint editing remain part of this stacked build. Do not start a new batch if a
previous native transfer has an unresolved recovery record.

## GM acceptance test

1. Back up the World, ensure any old transfer recovery is resolved, and open
   the test Paedor Scene as GM.
2. In Workspace select three same-tier destinations and start painting.
3. Paint a cell in first destination → **Stage & Next**. Verify Workspace does
   not reopen and the second Paint editor is active.
4. Use **Stage & Switch** to revisit the first destination, confirm the local
   draft is present, then switch to a remaining destination.
5. Stage the others and verify **Stage & Review Batch** appears on the final
   destination. Click it and inspect totals/sources. Choose **No**; confirm
   Paint reopens, all staged drafts remain and native counts did not change.
6. With a verified backup and correct totals, repeat **Stage & Review Batch**
   and explicitly approve. Verify all targeted native Regions and their cell
   counts, Behaviors, Levels and metadata, and check player-visible boundaries.
7. In a separate fresh batch, test **Stage & Return to Workspace** and Esc.

Stop and preserve the recovery ledger if a native transfer is interrupted.
