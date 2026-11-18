# Atlas 0.3.11-dev.5.1 — Road travel preset field presentation (#411)

**Milestone:** 01 — Atlas Workspace & UI/UX Stabilization · **Issue:** [#411](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/411) · **Target:** Foundry VTT v14.

**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/fix/0.3.11-m01-411-road-travel-preset-order/module.json

**Archive:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/fix/0.3.11-m01-411-road-travel-preset-order.zip

**Owner Foundry v14 correction:** The original dev.5 visual test was rejected: Road Settings stacked the selected preset below the label and showed a pencil-only button. This revised build **0.3.11-dev.5.1** corrects the actual form row layout and action label; it is not yet owner-accepted. Regression covers row structure, visible button text and CSS row alignment.\n\n**Stack:** based on owner-accepted 0.3.11-dev.4 (#415 / draft PR #431), which includes accepted dev.1–dev.3. No parent PR is merged into `main`; this build is cumulative and not a production release.

## Implementation boundary

Road Settings → General now places its existing **Travel preset** field immediately above **Road name**, mirroring Map Marker Settings. The same World travel-preset select and the same `createRoadPresetStage` continue to drive the existing guarded `saveRoadSettings` transaction; the display wrapper alone now shows the selected preset name and a visibly labeled **Change preset…** button on the same horizontal row as **Travel preset** (matching placed Map Marker Settings), or an open selector when None is chosen. A missing/removed World preset is explicitly marked unavailable and cannot be silently interpreted as the Land fallback. An explanatory hint distinguishes a per-Road assignment from modifying World preset definitions or native Region Behaviors.

No change to Road identity, stable IDs, names, topology, Scene flags/schema, native Region geometry/Behaviors, the World catalog, Journey authority, or save/cancel/dirty-close permission checks. The new `road-settings-preset-view.js` owns only a small DOM representation; the existing `road-settings-preset.js` remains a pure draft-state model.

## GM live test in backed-up Foundry v14 World

1. Open a saved Road → Settings → General. **Travel preset is above Road name**. Confirm **Travel preset** is at left, with the current preset name and full **Change preset…** text button adjacent on the right **on the same line**, exactly like the Map Marker preset row; the action must remain keyboard-accessible.
2. Click **Change preset…**. Focus moves to the actual selector. Choose an eligible Land, Water or Air World preset. Verify the selected label updates, the picker returns to read-only display, and focus returns to Change. No World preset, native Region cost, Scene or Journey writes occur until Road Settings Save.
3. Enter a draft name change, switch to Customization, Map Markers and Terrain Regions and return. Name, preset choice, visibility and journal fields must survive tabs/scroll changes. Close/Cancel with unsaved edits; reopen and confirm original Road assignment is unchanged.
4. Repeat with **None (Land fallback)**. The picker remains available; Save writes a nullable Road preset assignment, and the existing display mode remains Land fallback.
5. Save a new valid choice. It must commit in the **single existing revision-checked Road Settings Scene write**, preserve graph IDs, Road appearance, visibility, linked Map Markers and native Regions. Try a second stale editor and verify expected revision protections still reject outdated saves.
6. Remove a selected World travel preset through an explicitly authorized test fixture or open a Road that references a missing preset. Its form must communicate **Unavailable travel preset — choose another**, and Save without valid re-selection must fail closed without changing Scene/World state. Existing World preset in-use deletion restrictions remain in force.
7. Verify a wide window, narrow layout, 200% text zoom, Tab focus and a non-GM client. Road Settings remains GM-only; no control overlap or accidental Save.
8. Verify Road and Map Marker settings remain visually consistent but retain **different owners**: Road default selects a travel/surface preset; Map Marker preset editor saves marker defaults in the World.

## Automated acceptance gates

Run `npm run check`, `npm run architecture:check`, syntax and `git diff --check`. `tests/road-settings-preset.test.mjs` exercises actual DOM selector state and keyboard focus, native stage value, None and removed-ID display, and no write-on-change. Existing `saveRoadSettings` storage test covers the single revisioned Scene write. Passing CI is not Foundry GM/non-GM live acceptance.

**Stop condition:** If a picker change writes early, a World preset changes, an invalid/missing selection is silently applied, or a Road/Region/Checkpoint graph attribute changes unexpectedly, retain the draft PR and provide console logs plus the original Road preset ID and Scene revision.
