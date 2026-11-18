# v0.3.9-beta.8.25.1 — Player Territory outlines under exploration fog

Status: targeted stacked hotfix on beta.8.25; **live Foundry v14 GM + player acceptance required**.

## Regression and intended behavior

Beta.8.25 placed every Territory overlay in `canvas.interface`. The Foundry v14 Interface group renders above vision and Fog of War, so the player could see the complete silhouette of an otherwise unexplored, GM-shared Territory. The owner reproduced this at Hearth's Heart.

This hotfix keeps sharing permissions independent but changes **how the player's granted geometry is displayed**:

| State | Player view | GM view |
|---|---|---|
| Territory not shared | No Territory geometry or label | Existing Atlas Layers display |
| Shared, area unexplored | Border/fill/name occluded by Fog | Existing above-fog edit preview |
| Shared, partially explored | Only fog-exposed portions of border, fill and label appear | Existing above-fog edit preview |
| Shared, fully explored | Full border, optional fill, and separately public label appear | Existing above-fog edit preview |

- Player Territory graphics mount into `canvas.primary`, using native `PrimaryCanvasGroup.SORT_LAYERS.TILES + 1` and `sort=1e90`. Atlas's existing manual Fog uses the same sort layer and `sort=1e100`, so its opaque unexplored-cell masks cover Territory borders, fills and labels. Foundry's vision/fog effects also render over Primary. A missing native Primary/sort contract **disables** the player Territory overlay rather than falling back to `canvas.interface`.
- GM Territory graphics remain in the higher Interface group so GMs can still inspect/edit boundaries.
- An invisible Territory label must not remain an invisible clickable Journal target. For non-GMs, a double-click performs a fresh read-only visibility test at the label's position, using Foundry's `canvas.fog.isPointExplored` when native fog is active, or Atlas's manual Reveal/Hide/checkpoint-discovery cell projection when Atlas manual fog is enabled. Invalid or missing exploration data fails closed.
- The GM's boundary-sharing flag and separate public-name flag are unchanged. Foundry-native Region Shapes, Behaviors, Scene FogExploration and Atlas manual Fog state are **never written** by this change.
- This is visual fog occlusion, **not confidentiality**: Foundry may still send native Region/flag data to player clients. Do not store secrets in client-readable flags.

## Two-client acceptance checklist

1. Back up the World; install the hotfix branch in Foundry v14. Open the same Scene in a GM and player client and enable the player's Atlas Layers → Regions → All Regions, Show Region names, and nonzero fills.
2. Native Fog test: turn on native Token Vision and Fog Exploration. Share one large Town/City Territory whose boundary extends into unexplored areas. Confirm its hidden border, dark outline, translucent fill and name are **not** visible beyond the native explored mask, including before any exploration. The GM must still see the full boundary.
3. Move the explorer Token across that shared boundary and refresh native exploration. Only the newly explored portions should appear; no dark-color halo, labels or border should outline unexplored cells. Pan, zoom, refresh browser, and switch Scenes to check layering persists.
4. Atlas manual Fog test: follow the existing module workflow (native Token Vision off, Atlas manual Fog on), with a large shared Territory over both revealed and hidden grid cells. Confirm the opaque manual Fog covers the Territory consistently. A manual Hide brush stroke over previously visible cells must hide the corresponding Territory display; an explicit Reveal must restore it.
5. Double-click the Territory label **while hidden by fog**, first under native fog and then manual fog: the associated Journal must **not** open. After revealing the label location, a player with native Journal permission can open it; a player without permission cannot.
6. Revoke the boundary grant or public name and verify the previous permission rules. With sharing off there must be no player border; with the public name off there must be no player Territory label, regardless of fog.
7. Disable and re-enable native fog / Atlas manual Fog in separate supported configurations. Verify Region, Scene, FogExploration and Atlas manual Fog documents were not modified merely by switching Atlas Layers settings.
8. Test a missing/uninitialized native Primary group (e.g. before `canvasReady`) and a Scene swap. Player Territory graphics must skip drawing; no fallback to Interface, stale graphics or leaked Journal handlers.

## Automated verification

`tests/territory-view-overlay.test.mjs` covers GM Interface mounting, player Primary mounting and sort order beneath Atlas manual Fog, missing-Primary fail-closed behavior, and native/manual explored-cell Journal guards. Full regression/architecture command results should be reported with the hotfix PR.

No embedded Foundry v14 client is available in the test harness; mock sorting is **not** a substitute for the live two-client rendering checks above.
