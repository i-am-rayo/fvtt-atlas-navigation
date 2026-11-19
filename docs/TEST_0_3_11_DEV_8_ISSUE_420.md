# Atlas 0.3.11-dev.8 — World Map Marker Preset editor parity (#420)

**Milestone 01** · [Issue #420](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/420) · Foundry **v14** GM / non-GM acceptance required.

**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/fix/0.3.11-m01-420-marker-preset-editor-parity/module.json

**Archive:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/fix/0.3.11-m01-420-marker-preset-editor-parity.zip

**Cumulative base:** owner-accepted `0.3.11-dev.7` (PR #434), including accepted dev.1–dev.6 (PRs #428–#433). Parent PRs remain unmerged; this is a test build, not a production release.

## Implemented

The **World Map Marker Preset** editor now uses the same compact icon-trigger/popover as placed Map Marker Settings rather than a permanently expanded icon browser. Both are the existing `createCheckpointIconPicker` with `compact:true`, not two different pickers. The Customization page follows the placed editor's three visible sections: **Map Marker settings**, **Banner information**, and **Map preview**. Standardized labels include **Map Marker color**, **Banner display**, and **Include Map Marker type in banner**. Existing shared marker-size and color controls remain unchanged.

The new Map preview is ephemeral DOM, using the preset's **current unsaved** icon, dot, validated image path, size, primary color, border color, banner display mode, text color, World preset name, type, and optional default elevation. It updates when draft controls change, including selected icons and the native Foundry FilePicker callback. It never reads a Scene, Region, Road, Territory, Map Marker ID, Journal, World time, Token or Actor. There is no image path loading for invalid drafts.

The same original World catalog Save action remains below the scrolling form. It writes **only the selected World Map Marker preset** through the existing `upsertCheckpointPreset` validator, preserving stable IDs and portable fields. Cancel/dirty-close and World-only GM access remain unchanged. Banner Off disables subordinate preview options without erasing the color draft; no planted Map Marker changes until the separate explicitly approved bulk-apply flow.

**Intentionally outside this patch:** #413's new border-enabled boolean (validator, legacy compatibility and runtime render scope), native Region ownership, new bulk apply, Scene Locate/Road connections, persistent Scene IDs, geographic filtering, new preset schemas or data migrations. The existing border color field remains visible and behaves as before. The broader #216 editor consistency issue remains open.

## Owner Foundry v14 acceptance in a backed-up World

1. Open **Atlas Workshop → Settings → Presets → Map Marker Presets** (or the same restricted Module Settings menu). Edit an existing preset. Confirm the existing **General, Customization, Terrain Region, Transportation** tabs and fixed bottom Save are unchanged.
2. In Customization confirm one **compact icon button beside the marker type**, exactly like placed Map Marker Settings. The icon browser should open as a searchable popover, be keyboard operable, close when a choice is made, and return focus to its trigger. Try built-in RPG and Font Awesome icons; changing icon should update the draft preview without saving.
3. Confirm the three visible groups **Map Marker settings**, **Banner information**, and **Map preview** with readable labels and no duplicated/missing icon or image row. The preview shows the preset's own sample name, not a placed Scene marker or its geographic metadata.
4. Change size, dot/icon color, border color, optional image path and the preset name. Confirm the preview changes immediately and remains draft-only. Test valid/invalid image paths and return from native FilePicker. Compare a known existing marker appearance against the visual rendering of the sample (note canvas zoom can change actual marker screen dimensions).
5. Set **Banner display = Always**, choose a text color, toggle type/elevation options; confirm banner preview follows. Set **Off**: text-color editing disables but its value remains retained. Toggle **Hover**: color and draft return and hovering/focusing the sample shows the banner. Test high zoom, 200% text zoom and narrow window with no overlap.
6. Switch to General/Terrain Region/Transportation and back. Verify every draft survives, numeric/metric labels remain correct, and the World presets still contain only suggestions, not actual native Regions or Journey events. The Transportation tab's existing service editor remains fully functional.
7. Cancel/dirty-close without saving, reopen and verify the original World preset and placed markers have not changed. Save a valid changed preset and confirm the same stable World preset ID with one World setting write. Existing placed Map Markers must remain unchanged until an independently authorized Apply to Scene operation.
8. With a non-GM user verify both entry points deny editing. Verify no new player-visible Scene metadata leakage, native Region write, Journey advance, or malformed save.
9. Check concise native console errors and focus navigation, including Left/Right/Home/End tab keys.

## Automated coverage

`tests/checkpoint-preset-editor.test.mjs` asserts the real mock DOM for compact picker, focusable/selected tabs, section order, live draft icon/color/banner preview, Off/On retention and zero writes. The existing World preset validator, Save/Cancel, icon picker, placement, bulk apply, permission and Scene regression suites must stay green. Run `npm run check`, `npm run architecture:check`, syntax checks and `git diff --check`. Green CI is not actual Foundry GM and non-GM acceptance.

**Block acceptance** if icon selection writes to the World early, UI draft values disappear on tab switch, the preview uses Scene data or displays a dangerous invalid image, Save changes any existing placed marker without explicit Apply to Scene, or preset editing can be reached without GM permission.
