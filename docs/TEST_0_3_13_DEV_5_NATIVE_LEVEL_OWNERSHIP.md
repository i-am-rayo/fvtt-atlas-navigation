# Atlas 0.3.13-dev.5 — Native Scene Level Territory ownership correction

## Owner evidence / root cause

In **Paedor**, **Underdark** is assigned to native **Underground** Level while **Kharak Menzor Stronghold** is assigned to **Surface**. Their Foundry Region Placement sheets show explicit native Levels even when Region elevation Bottom/Top are unbounded. On dev.4, the shared-boundary shortcut excluded five adjacent cells, but Save Preview incorrectly proposed transferring one **Surface** native grid cell into **Underdark**. The owner did **not** report confirming a native transfer.

Foundry v14 `Region.levels` (Scene Level identity) is distinct from `Region.elevation`. The old review/planner used only 2D native grid offsets and geographic tier, so a cross-Level overlap could be interpreted as a native ownership transfer.

## Fix contract

- **Verified disjoint native Level IDs, or non-overlapping native elevation intervals:** two Territories may coexist at the same X/Y without transferring or removing the other Region's cells. Saving uses the existing one-Region native Shape update, not a two-Region recovery transaction.
- **Identical native Level/elevation scope:** existing same-tier ownership/transfer safeguards remain. Explicit native transfer still requires separate GM confirmation.
- **Partially overlapping, invalid, unresolved or all-Level scopes:** do not infer separation or automatically transfer cells. Native direct Save still rejects conflicting peer ownership.
- Read-only shared-seam picker and Save preview use the same native scope classifier. Off-scope overlaps are called out as preserved rather than reported as peer cell transfers.
- Existing open Paint Territory drafts check native scope changes. Single and multi-destination reviewed transfer plans bind the native Region scopes and reject changed assignments **before any Scene ledger or native Region write**.
- No changes to native Region Levels, Behaviors, ownership/publication, Region IDs, Road graph, Fog, Token movement, World time, Journals, fare pricing, or the v1/v2/v3 recovery writer.

## Backed-up Foundry v14 GM test

1. **Native Level baseline:** Scene `Paedor` has Underground and Surface Level documents. Region Placement → Levels: Underdark = only Underground; Kharak Menzor Stronghold = only Surface. Distinct ID selections matter; region Bottom/Top elevation can remain unbounded.
2. Open **Paint Territory → Underdark** and add **one grid/hex cell** whose X/Y is inside the Kharak Stronghold Surface Region. **Preview & Save** must report **one cell unclaimed in Underdark's native scope**, **one overlap on a different Level**, and **no proposed Kharak → Underdark transfer**.
3. In a backed-up test World, explicitly save that one-cell addition. Verify **Underdark +1** native grid cell, Kharak **unchanged** native Shape/cell count/Level selection/Behaviors, and no multi-Region recovery ledger. Reload and recheck both Regions.
4. In a separate safe test pair, set two peer Territories to the **same** native Level. An XY claim must still be identified as a same-scope conflict; no silent Save or transfer. Cancel any destructive transfer confirmation.
5. In another separate safe test, assign one peer **all Levels** (blank selection) and the other **Surface only**. If their XY overlaps, Atlas must refuse an automatic destructive transfer; it cannot discard claims from the unrelated Levels.
6. While a native Paint Territory draft is open, modify that Region's Level selection using Foundry's own editor (on a backup). Atlas must reject the stale draft instead of saving under an unreviewed Level. Reopen for a new draft.
7. Confirm native square and hex adjacency, existing dev.4 seam shortcut, no preview writes, cancel/focus/200% zoom, and the previously PO-tested dev.3 A–Z dropdown and Road Settings.
8. Use a **separate non-GM client** to verify no authoring privilege or hidden Region/Journal metadata appears.

**Safety STOP:** If the Scene still has a blocked v3 multi-Territory recovery intent under #265, DO NOT edit affected Regions, retry native transfers, delete the ledger or force Resume/Roll Back. Preserve Scene/World backups and collect diagnostic details. This hotfix does not resolve #265.

## Release and acceptance

- **Version:** `0.3.13-dev.5`
- **Draft:** [PR #525](https://github.com/i-am-rayo/fvtt-atlas-navigation/pull/525), stacked onto dev.4
- **Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/fix/0.3.13-dev5-native-level-overlap/module.json
- **ZIP:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/fix/0.3.13-dev5-native-level-overlap.zip

Automated tests and architecture checks are required after the final commit. **No Foundry live acceptance or merge/release is implied by green CI.**
