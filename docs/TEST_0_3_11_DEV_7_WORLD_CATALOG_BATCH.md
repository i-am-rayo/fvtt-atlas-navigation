# Atlas 0.3.11-dev.7 — World preset editor UI batch

**Milestone 01 — Atlas Workspace & UI/UX Stabilization** · [#419](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/419) · [#421](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/421) · [#422](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/422) · [#423](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/423) · **Foundry v14**.

**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/fix/0.3.11-m01-421-423-world-category-tabs/module.json

**Archive:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/fix/0.3.11-m01-421-423-world-category-tabs.zip

**Stack:** contains owner-approved dev.1–dev.6 (#406, #408, #407, #415, #411, #414; prior draft PRs #428–#433). The parent PRs remain unmerged. This is a cumulative **test build**, not a production release.

## Scope: one coordinated World-settings presentation batch

- **#419 Workspace → Settings → Presets:** four clearly labeled shortcuts to the existing registered GM-only **Map Marker Presets**, **Transportation Presets**, **Surface Presets** and **Road Appearance** ApplicationV2 editors. The original Exploration & travel Transportation shortcut uses the same launcher, reusing an already open window. The Workspace retains its current Presets view; editing a World catalog never writes Scene flags.
- **#421 World Road Appearance:** Land | Water | Air tabs each show their current preview and complete form. All three forms are created **once**. The single existing explicit Save validates **all three categories**, including hidden panels; invalid values select the category with the error. Category selection never persists or discards drafts, and Save remains outside the scrolling area.
- **#422 Transportation Presets:** Land | Water | Air tabs group the same current methods by their existing `surface` values. The existing edit/reset/delete actions, per-rules-profile settings, and child General/Services/Ownership tabs remain unchanged. Water is still one stored surface category; existing service names distinguish boat/ship routes without inventing new persistent water subclasses.
- **#423 Surface Presets:** Land | Water | Air tabs preserve each preset and the existing Water subgroups (River, Lake, Sea, Ocean, Canal, Marsh/Swamp). Each active bordered section has its own **plus icon in the legend**, creating a preset for that surface. Existing add-missing Land/Water commands, in-use deletion restrictions, and native Region cost/Behavior protections are unchanged.

A tiny shared DOM tab helper supports click, Left/Right/Home/End keyboard navigation, `aria-selected`, label-to-panel associations, and remembering the chosen category across catalog rerenders. It **does not** write, serialize or clone draft controls; each editor maintains its own versioned World catalog and explicit save/confirm boundary.

## Owner acceptance — backed-up Foundry v14 GM & non-GM

1. In the **Atlas Workshop → Settings**, open **Presets**. Confirm all four shortcuts are visible/readable at normal, narrow and 200% zoom. Click each and compare its window title/contents with the corresponding **Module Settings** menu. Confirm it is the **same current editor class**, not a second copied form; the Workshop stays on Presets and remains usable when the editor closes. Repeated shortcut clicks should bring its already-open editor forward rather than spawn copies.
2. With non-GM credentials, confirm Workspace authoring is denied and no World catalog can be edited. The registered menu's original `restricted` protection remains active.
3. **Road Appearance:** modify unsaved Land color, switch Water then Air, and return to Land; the draft must be unchanged and there must be **no World write** from switching. Check preview. Make one invalid input in a currently hidden tab, click Save, and confirm the offending tab becomes visible, an actionable error is shown, and no World setting is saved. Correct it and Save once: all three modes persist in **one** World write. Reopen and validate legacy flat appearance values still read without migration on open.
4. **Transportation:** confirm each existing method appears exactly once under Land/Water/Air; verify Water ship and rowboat remain distinct methods and speed/cost labels are unchanged. Open an edit dialog, switch its **General / Services / Ownership** tabs, then Cancel: no World/Actor/Journey writes. Edit, Reset or Delete a safe test fixture, then verify the selected top-level category persists across the parent window's rerender.
5. **Surface Presets:** confirm Water's six subgroups remain intact; click Water legend **+** and verify the New Surface dialog's mode is Water. Cancel with no write. Repeat Land/Air. Confirm adding missing Water conditions and Land terrain uses the same existing explicit confirmations, no automatic Region mutations, and the chosen tab remains active after edit/add/delete rerender.
6. Test Tab and Left/Right/Home/End keyboard navigation, visible focus ring, screen reader selected tab/panel semantics, browser resizing and high zoom. Only one panel should be visibly shown at a time; switching must not delete/recreate the other field controls.
7. Validate World catalog persistence and Scene/Region/Actor/Token/Journal/Journey invariants on a copied World: opening, switching and cancelling are read-only. A deleted World preset in use remains blocked by its existing guards; native Region movement Behaviors and Shape data remain unchanged.

**Stop condition:** Any tab navigation that mutates settings, clears a draft, hides the active pane, loses a native recovery operation, duplicates editor windows, or breaks any GM/non-GM permission boundary. Keep the PR draft and provide screenshot, active tab, affected mode, and console log.

## Automated coverage

- `tests/settings-category-tabs.test.mjs`: actual click and keyboard tab focus; DOM panels kept mounted; no write.
- `tests/road-appearance-settings.test.mjs`: three categories in intended order, unsaved Land edit persists across tabs, one World save.
- `tests/navigation-transport-settings.test.mjs`: all original methods present, Water tab and rerender active selection, no early write.
- `tests/travel-preset-settings.test.js`: all modes, Water subgroup preservation, legend Add route and selected tab persistence.
- `tests/atlas-scene-workspace.test.mjs`: four shortcuts, correct delegation, no Scene write, no Workspace section loss.

Run `npm run check`, `npm run architecture:check`, syntax, `git diff --check`. Passing CI **does not** establish Foundry v14 live GM/non-GM acceptance.

**Deferred for separate safety review:** #418 (removing the Advanced Operations entry may strand native recovery), #413 (additive border-enabled appearance schema and player rendering), #420 (World Map Marker editor/preview parity), #289/#216 (broad title/icon/form consistency). These are not silently declared complete by this batch.
