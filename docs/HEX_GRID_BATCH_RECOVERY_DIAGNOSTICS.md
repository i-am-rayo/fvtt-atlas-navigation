# Hex/Grid batch Next button and blocked-recovery diagnostics

## Owner live incident

The owner staged **Hearth's Heart** (145 → 147 cells), **Neo Lustrum**
(38 → 40), and **Millstone** (67 → 68) in one batch. The GM preview correctly
reported five unclaimed additions and no peer-owned transfers. Atlas then
left the v3 Scene recovery ledger in place: Neo Lustrum and Millstone were
already applied, while Hearth's Heart matched **neither** its original nor
planned full Region snapshot. Both Resume and Roll Back were blocked.

The attached browser console shows the resulting guard error, but no concrete
field-level difference or underlying native write failure. The generic error
could reflect a real outside edit or Foundry serialization/normalization of
Shape or Atlas authoring metadata. **Do not infer the cause from the log alone.**

## Safety instructions for the affected World

1. **Preserve the current World and a known-good World/Scene backup.**
2. Do not edit the three native Regions or their flags, discard the recovery
   ledger, use an older Restore flow, or click any additional batch Save.
3. With the World backed up, this focused diagnostic build may be installed.
   Open Workspace → **Resume / Roll Back Transfer** to collect **read-only**
   field differences for Hearth's Heart. Do not perform a recovery write.
4. Share the new blocked-recovery dialog result for review. If it reports
   only Atlas boundary-control drift with native Shapes matching the planned
   state, a separately reviewed recovery/migration repair may be possible.
   If native Shape differs, preserve the current evidence and investigate
   expected/actual geometry against a backup first.

**This build never changes a recovery decision to allowed.** Exact original or
planned snapshot matching is still required. No automatic rollback, snapshot
overwrite, or direct native Region mutation was added. Pending native recovery
also disables **Discard Staged Batch**, preventing an accidental loss of the
local review queue during investigation.

## Batch navigation fix

When a batch editor has another selected but unstaged destination it offers:

- **Stage & Next: [Territory]** — stage this draft, fully close this editor,
  await release of Workspace window focus, and open the next selection.
- **Stage & Return to Workspace** — stage, fully close, restore and expand the
  Workspace; the GM can choose a target from the staged list.

The final destination offers Return to Workspace to review the batch. Neither
staging button changes native Regions.

## Regression checks

- [ ] Backup the World before installing. Avoid native editing on the active
      pending recovery ledger.
- [ ] Blocked recovery dialog explicitly identifies which of **native Shape**,
      **Atlas boundary controls**, **geography**, or **name** differs from each
      snapshot, without writing anything.
- [ ] A stale native Shape, or a changed Atlas boundary-control flag, still
      blocks Resume and Roll Back even if another field matches.
- [ ] With native recovery pending, **Discard Staged Batch** and the ordinary
      combined commit are disabled; the GM can only open the recovery review.
- [ ] In a separate clean test World, confirm both Stage & Next and Stage &
      Return work; the former opens the next editor without manual navigation.
- [ ] Cancel or Escape still closes Paint and restores the Workspace.
- [ ] Existing one-target and v1/v2/v3 recovery tests remain green.

GitHub: #265 (native Region transfer and recovery), #271 (Hex/Grid roadmap).
