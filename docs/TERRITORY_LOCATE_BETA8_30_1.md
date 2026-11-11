# v0.3.9-beta.8.30.1 — Territory Locate and action-button hotfix

**Status:** stacked draft; live Foundry v14 GM/player smoke test pending.

## Symptoms addressed

- Clicking a Territory Settings action could make every button on the active tab grey and noninteractive until the GM switched to a different tab and back. The action callback re-rendered while `busy` was still true; newly created buttons inherited the transient lock. Reset the lock before any re-render, and do not force a minimized settings window open again.
- **Locate on map** previously centered on a native Region without guaranteeing its entire shape fitted in view or making its boundary obvious. The action now minimizes the Settings and Workspace windows, computes a native bounds-fit camera target with a margin, animates the native Foundry pan for 750 ms, and displays the selected native Region's polygon outline and optional native triangulated fill.
- A single gold outline pulses for **30 seconds**. The GM-only temporary canvas overlay is independent of the saved Atlas Layers Regions mode, including **Hidden**. It never switches on other Territories and never changes saved layer modes, native Region settings, Fog or player permissions.

The highlight self-cleans on expiry, a second Locate, a Scene change, replacement/deletion of the native Region, or closing the Workspace. It is a client-side visual aid only. The pulse respects `prefers-reduced-motion`.

## GM Foundry v14 acceptance

1. Open **Atlas Workspace → Territories → Genasi Village → Settings**. Click **Locate on map**. Both relevant settings/windows should minimize without closing, and the full native Region including disjoint pieces should be centered and fit within the viewport. Restore Settings and verify draft/tab state remains intact.
2. On each of the four Territory Settings tabs, click an allowed action and return to Settings. All other enabled actions remain clickable immediately, **without switching tabs**. Confirm deliberately permission-disabled actions remain disabled. Test a cancel path and a failed confirmation path.
3. In Atlas Layers set **Regions → Hidden**. Locate one Territory. Only that Territory's transient highlighted boundary should appear, pulse and disappear after about 30 seconds. Reopen Atlas Layers: **Hidden** must still be selected. No other Territory silhouette should appear because of Locate.
4. Repeat with **Continents**, **Settlements** and **All Regions** modes, and at different canvas zooms/resolutions. The transient outline should follow native Region geometry rather than the parent Territory's bounding box.
5. Locate a very large Territory and one with separated components. Verify all parts are fitted with margin, no wrong-region fill appears, and one or more native Regions' polygon holes are respected by the fill.
6. Locate Territory A then B before 30 seconds; A's pulse disappears. Switch Scenes, delete/replace the native Region (in a test Scene), or close Workspace; the pulse is immediately or promptly removed and timers do not continue indefinitely.
7. Verify a separate player client sees **no** GM locator overlay or layer preference changes. Fog behavior, native Region Shapes and Behaviors, checkpoint links, Journals, movement, World time and current Journeys remain unchanged.

## Evidence and limitations

Automated coverage exercises button re-render state, camera bounds including large Regions, 30-second timer and pulse, temporary single-Region rendering with hidden settings, Scene cleanup and GM authorization. Automated tests do **not** substitute for native Foundry v14 visual acceptance; this draft should remain unmerged until the GM/player checks pass.

## Related open work

Issue [#293](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/293) (consolidated Territory Settings) remains open pending the full workflow acceptance. Broad minimizable-window parity [#301](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/301) remains open pending draft preservation, concurrent editor and native Foundry checks. The current issue inventory is in [the November 11 audit](GITHUB_ISSUE_AUDIT_2026_11_11.md).
