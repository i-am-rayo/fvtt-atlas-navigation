# v0.3.9-beta.8.31 — Linked Checkpoint Journal in Territory directory

**Status:** stacked draft, native Foundry v14 GM/player acceptance pending. Addresses the directory/linked-Journal slice of [issue #291](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/291).

## Behavior

- Atlas Workspace → **Territories** now shows a compact **📖 Journal** status control beside a Territory name **only if** that native Territory links to an existing Atlas Checkpoint, the Checkpoint links to a native Journal Entry or individual Journal Page, and the current GM can resolve that document.
- Uses the Checkpoint's existing Scene Journal association and stable IDs. Never copies a Journal into a native Region flag, changes a Checkpoint link, creates a new Journal, or writes any Scene data merely by showing the directory.
- The badge follows the existing Checkpoint/Road Journal status convention: **✓** = all configured non-GM users have Observer access; **◐** = some; **🔒** = none; **—** = no player accounts configured. The tooltip states access counts, not private Journal titles/content. Clicking uses the existing Foundry permission-aware Journal opener (Entry or Page).
- No icon appears for no Checkpoint, no Journal, malformed/stale association, deleted/inaccessible native Journal, non-GM viewers, or invalid association metadata. The panel revalidates the current link and active Scene before opening; a stale action refuses to open an out-of-date association.
- One asynchronous permission query per distinct Journal UUID per render avoids duplicate lookups for Territories sharing the same Checkpoint. The final icon survives Foundry's normal off-DOM panel construction. No player Atlas Layers or map-label Journal icon is added in this phase; those would need separate discovery/privacy review.

## GM live acceptance checklist

1. Link **Genasi Village** Territory to a Genasi Village Checkpoint with a valid Journal Entry. Reopen Atlas Workspace → Territories. Verify a compact 📖 status beside the Territory and a click opening the existing Journal, without adding another document or link.
2. Change the Checkpoint Journal link to an individual **Journal Page**. Verify the same icon opens the correct Page in its parent Entry. Change to another Entry and verify the indicator refreshes.
3. With two player accounts, give both **Observer** permission: 📖 ✓. Give only one: 📖 ◐. Give neither: 📖 🔒. With no player accounts configured, 📖 —. No tooltip may reveal private Journal titles or Page contents.
4. Unlink the Checkpoint, clear the Checkpoint Journal, delete the referenced Journal in a backed-up test World, or introduce a stale association. On refresh, the 📖 control disappears; malformed data must fail closed without breaking the Territory list.
5. Test a Journal lookup while the Workspace is opening, minimizing/restoring, and after switching Scenes. A stale action must not open a previously linked Journal.
6. Join with a separate player account (Observer and non-Observer). The GM's Territory Settings/Journal icon must not be exposed in player Atlas Layers or the map label; published Territory boundaries still remain under Fog, and Journal/Checkpoint discovery rules remain unchanged.
7. Verify Region Shape/Behavior/Level IDs, Checkpoint IDs, Journey state, native Fog and Atlas manual Fog remain unchanged.

## Automated evidence

Tests cover native Entry/Page UUID projection, invalid/stale/unlinked associations, per-player Observer status, non-GM exclusion, direct Page opening and off-DOM render race. Run `npm test`; native v14 two-client verification remains required before closing #291.

## Next roadmap gates

- Stage 1 #264/#265: guarded shared-cell Hex/Grid editing and multi-Region recovery/undo.
- Stage 3 #204/#268: derived native spatial membership and hierarchy policy.
- Appearance #294/#295: optional Territory icon prefix and typography; both deliberately remain deferred to avoid exposing unpublished Checkpoint information.
