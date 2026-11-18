# Atlas Territory — beta.8.21.4 guarded recovery and GM fog preview

Draft hotfix for the existing v0.3.9-beta.8.21.3 test branch. Do not merge until
the owner validates on Foundry v14 with a GM and player connection.

## Diagnostic and exact recovery boundary

The Paedor three-destination batch targeted Hearth's Heart (145 → 147),
Neo Lustrum (38 → 40) and Millstone (67 → 68), all with unclaimed additions.
The GM's read-only console comparison of Hearth's Heart with the durable
`territoryGridTransferIntent` AFTER snapshot reported all expected fields and
147 cell offsets equal, except for an additional `nodes` array (184 entries)
in the live `territoryBoundarySource` flag.

Foundry v14 performs partial merges of nested document objects unless an
explicit `foundry.data.operators.ForcedReplacement` is used. Updating the
grid source without replacing the previous flag can retain polygon controls.

- New transfers replace the boundary source as a whole. Region Shapes,
  Behaviors, geography, name, visibility and unrelated flags are not replaced.
- Read-only recovery may recognize the **already applied** snapshot when the
  exact native geometry and all other metadata match the AFTER snapshot and
  the sole extra `nodes` field exactly equals the BEFORE snapshot's nodes.
- On a GM-confirmed Resume, Atlas removes that stale field by replacing only
  its own boundary source and verifies every document before clearing the
  recovery intent. A permitted Roll Back still restores the original snapshot.
- A new/altered node, any other flag mismatch, changed geometry or changed
  scene grid **must continue to block both recovery choices**. The Scene ledger
  is not silently discarded. No recovery is automatically invoked on load.

## GM-only editing visibility

While **Paint Territory**, **Paint [batch destination]**, or **Edit Territory
Nodes** is open, the active GM client hides the Foundry v14 CanvasVisibility
group and suppresses Atlas's separate manual exploration mask. Native
FogExploration documents, exploration flags, Scene vision configuration,
player view, and Fog preview preference are unmodified. Save, Cancel, Esc,
Stage & Return, Stage & Next and canvas teardown release this temporary view
and restore the originally visible (or already hidden) state. Foundry's zoom,
brush modifier and Node shortcuts are unchanged.

## Owner acceptance steps

1. **Create and verify a full World/Scene backup before installing.** Do not
   manually edit Hearth's Heart, Neo Lustrum or Millstone Shapes/flags.
2. Open the same Paedor Scene as the GM. Choose **Resume / Roll Back Transfer**.
   Its **read-only** review should report all three Regions as Already applied
   and allow both choices only if the legacy `nodes` were unchanged since the
   recorded BEFORE snapshot. If recovery is still blocked, stop and share the
   displayed difference; do not force or clear the ledger.
3. After checking the World backup and current native geometry, explicitly
   choose **Resume** to retain the approved five added cells. Confirm the
   recovery ledger disappears and all three Regions retain their original IDs,
   Behaviors, hierarchy and the intended counts 147/40/68.
4. Paint a separate test Territory as GM (also test polygon nodes and a batch
   destination). With native vision enabled and/or Atlas manual fog enabled,
   the GM should temporarily see the map without fog. Check a connected player
   simultaneously: their visible map/fog must not change.
5. Test Cancel, Esc, Stage & Next, Stage & Return, successful Save and Scene
   change during editing. The GM's previous fog (including a previously hidden
   manual preview) must return, with no exploration data changes.
6. Run an independent two-destination unclaimed-cell batch; it should commit
   without an interrupted recovery ledger. Do not use live campaign Regions
   for this destructive test: use a duplicated test Scene.

The `canvas.visibility.visible` GM-only rendering toggle is intentionally
reversible and needs live Foundry v14 visual acceptance. If a native GM scene
does not show full map details while editing, report its Foundry build and
native Token Vision settings; do not change Scene fog or vision settings as a
workaround.
