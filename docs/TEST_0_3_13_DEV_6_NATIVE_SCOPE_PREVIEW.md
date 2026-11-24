# 0.3.13-dev.6 — Native Territory scope preview / fail-closed Save

## What the PO actually observed (Foundry 14.370)

In **Paedor**, a GM painted two hexes for **Kharak Menzor Stronghold** (originally 86 native cells), including one geometrically empty hex and one XY hex in **Underdark**. Earlier Region Placement screenshots showed Kharak assigned **Surface** and Underdark assigned **Underground**. However, those screenshots alone do not prove their native Level selections were persisted: a Region configuration may contain unsaved selections.

Dev.5 displayed: **86 → 88 (+2, −0); 1 unclaimed; 1 claimed by same-tier peers**, an **Underdark → Kharak** transfer suggestion, and a long list of apparently mixed-scope Territories unrelated to the two painted hexes. Console logged two rejected transfer attempts: `Overlapping native Level/elevation scopes cannot transfer cells safely. Review the Region Levels.`. The same console later logged `Native Territory boundary updated; Behaviors retained`; its target/cell identity is not evident. **No transfer or absence of transfer can be inferred solely from that message.** Third-party World CLI local-helper failure is unrelated to this native Region check.

## Dev.6 correction contract

1. Only native Regions whose Shapes contain **one of the newly painted Hex/Grid cells** may appear as owners or conflicting Level scopes. Peers at other XY locations no longer pollute a GM review.
2. Distinct, verified native `Region.levels` IDs allow cross-Level XY overlap. If **Kharak = Surface** and **Underdark = Underground** are persisted and resolvable, **two additions are unclaimed within Surface**; one may report a separate-Level XY overlap **but must not propose cell transfer**.
3. A native Region assigned **all Levels**, **unknown Level IDs**, a partially shared Level set, or overlapping incompatible native elevation ranges is **not proven separate**. Such an actual same-XY claim is reported as **blocked**, with the target and source's native Level/elevation summaries—not as a transferable peer. The Save action is disabled and no write may proceed, including if a confirmation handler erroneously resolves truthy.
4. Exact same native Level and elevation scopes retain existing reviewed peer-transfer rules. A multi-owner or stale Region remains blocked. No preview writes, no direct Region mutation, no recovery-ledger reset, no bypass of #265.
5. The single native Region and batch transfer planners remain authoritative and recheck native scope and permissions at commit. The UI's read-only preview is never a commit authority.

## Live GM acceptance on a backup

1. In Foundry's native **Region Settings → Placement → Levels**, review each Region's selected chip, press **Update Region**, close and **reopen** the native settings window. Confirm Kharak's stored selection is only **Surface** and Underdark's stored selection is only **Underground**. Don't rely on unsaved chips. These are distinct native Level IDs, independent of Region elevation Bottom/Top.
2. Open Atlas Paint for Kharak: stage two hexes—one empty, one at the same XY as a cell in Underdark Underground. Preview should show **86 → 88**, two unclaimed in Kharak's effective Surface scope, one preserved separate-Level XY overlap, **zero transferable and zero blocked native Level claims**, **no native ownership transfer offer**.
3. On a backed-up clone, Save. Kharak must gain exactly two cells; **Underdark's cell count, native Shapes, Level assignment and Behaviors must not change**. Reload and inspect both.
4. In a separate backup-only test, deliberately set Underdark to **all Levels** (empty selection) while Kharak remains Surface. The shared XY addition should be **blocked**, with compact native Level diagnostics. The dialog's Save button must be disabled; the draft preserved. No other faraway Territory names should appear in that conflict message.
5. For two Regions with exactly the **same native Level/elevation scope**, a shared native grid cell remains an explicitly reviewed transfer with no silent source loss. Multi-owner and stale native Level changes must still block.
6. Repeat on both native hex and square Scene grids, check GM and a separate non-GM client, Cancel/Undo, browser zoom, World backup, native scene walls and unrelated effects. Verify #265 recovery condition separately if present (no attempt to repair it in dev.6).

If step 2 still shows **mixed/blocked** rather than two Surface-unclaimed cells **after** native Level settings are saved and reopened, do not click Save. Read the compact Level assignment diagnostics in the preview. The native API's effective scope has not yet been confirmed by live inspection; preserve evidence and investigate before accepting or widening transfer eligibility.

## Deliverable status

- **Branch:** `fix/0.3.13-dev6-native-scope-preview`
- **Draft PR:** https://github.com/i-am-rayo/fvtt-atlas-navigation/pull/526
- **Issue:** https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/524
- **Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/fix/0.3.13-dev6-native-scope-preview/module.json
- **Archive:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/fix/0.3.13-dev6-native-scope-preview.zip

CI is required after the final commit. Green automated tests **do not** signify PO Foundry live acceptance. Do not merge, tag, promote or release without PO approval.
