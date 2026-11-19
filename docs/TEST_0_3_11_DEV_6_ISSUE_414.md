# Atlas 0.3.11-dev.6 — Map Marker banner row (#414)

**Milestone 01 — Atlas Workspace & UI/UX Stabilization** · [Issue #414](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/414) · Foundry VTT **v14**.

**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/fix/0.3.11-m01-414-banner-mode-color-row/module.json

**Archive:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/fix/0.3.11-m01-414-banner-mode-color-row.zip

**Stack:** includes owner-accepted dev.5.1 (PR #432, #411), dev.4 (PR #431, #415), dev.3 (PR #430, #407), dev.2 (PR #429, #408) and dev.1 (PR #428, #406). The cumulative development chain remains draft and unmerged. This build is **not** a public production release.

## Focus and invariants

The placed Map Marker Settings → **Customization → Banner information** section now places **Banner display** and **Banner text color** on **one responsive horizontal row**, mirroring the existing Road Settings and World Map Marker Preset pairing. The controls retain **independent labels and keyboard focus**, and wrap rather than overlap in narrow Foundry windows or high text zoom. Only an existing DOM node moves into a wrapper; **the same mode select and color input stay authoritative**. Color retains the existing `Map Marker banner text color` accessible name.

Turning Banner Display **Off** still disables the banner's subordinate controls, including the text-color swatch, but does **not** erase the selected draft color. Switching it back on re-enables the same input and preview; Cancel still abandons changes and Save still uses the existing revision-checked Map Marker writer.

**Explicit exclusions:** no banner field or schema changes, new presets, automatic discovery, visibility, Territory filtering, native Region/Token/Actor/Journal/World-time changes, Journey effects, migration, permission change, or duplicate state.

## Owner live acceptance (backed-up Foundry v14 World)

1. As GM open an existing **Map Marker → Settings → Customization**. Confirm **Banner display** selector and **Banner text color** swatch appear **side by side** within Banner information; there must not be a second independent color row. Do not confuse banner text color with the **Map Marker color** or **border color** controls.
2. At normal and narrow window widths, and 200% browser/text zoom, the two labeled controls remain readable and, when necessary, wrap cleanly. Tab navigation reaches the mode and color controls independently, and the text-color input announces its accessible purpose.
3. Set Banner Display to **Always**, choose a new text color and verify **Map preview** updates without saving the Scene. Toggle **Off**: the swatch and dependent options disable, preview hides its banner, and the chosen color is retained.
4. Toggle Banner Display back to **Always** / **Hover**: the original selected color returns, the swatch is enabled, and preview reflects that color. Check hover/focus access at normal and high zoom.
5. Cancel/close with an unsaved color change; reopen and confirm the original color remains. Change the color again and **Save Map Marker**; verify **one** guarded save and correct stored color/mode after reopen. Verify draft edits to marker icon, size, discovery and native Territory selection are unaffected.
6. Test the same Customization screen for a **new Map Marker** draft and an existing standalone marker. Confirm no early Scene write and no new control enabling unauthorized native Region access.
7. As non-GM, confirm the existing Map Marker Settings authoring access guards remain enforced; player-visible banners reflect only permitted saved content. Inspect browser console for new Atlas errors.

## Automation

Existing `tests/checkpoint-appearance.test.mjs` now asserts actual DOM row ordering, independent labels and inputs, responsive CSS and Off/On color preservation with live preview. Existing Save/permission/revision/World-preset/Journey regressions remain required. Run `npm run check`, `npm run architecture:check`, syntax checks and `git diff --check`. CI is **not** Foundry v14 owner live acceptance.

**Stop condition:** If changing Banner Display loses the staged color, the row overlaps controls at high zoom, a save fires during render/selection, or player-visible data changes unexpectedly, leave the PR draft and capture a screenshot plus the failing action/console logs.
