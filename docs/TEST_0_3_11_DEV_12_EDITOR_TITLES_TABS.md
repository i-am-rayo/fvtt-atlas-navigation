# Atlas 0.3.11-dev.12 — Contextual editor titles and keyboard/form parity

**Milestone 01** · [#289](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/289) contextual titles · [#216](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/216) broader editor UI consistency (scoped keyboard subset). Foundry **v14 GM/non-GM** live acceptance required.

**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/fix/0.3.11-m01-289-216-editor-titles-keyboard/module.json

**Archive:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/fix/0.3.11-m01-289-216-editor-titles-keyboard.zip

**Cumulative parent:** owner-accepted dev.11 / [PR #440](https://github.com/i-am-rayo/fvtt-atlas-navigation/pull/440), plus all previous dev.1–dev.10 changes. Parent draft PRs remain unmerged; this is a test build, not a public release.

## Focused change

Most context titles already existed through the pure `atlasSettingsTitle` helper. This patch repairs the **remaining stale-header and editor-identity gaps**, without introducing another custom title framework:

- **Map Marker Settings:** distinct stable Foundry ApplicationV2 window IDs for different saved markers in the same Scene; on a subsequent render, an authoritative Map Marker rename updates the native window header through Foundry's public `app.window.title.textContent`. Unsaved draft names do **not** become authoritative title names; opening, previewing and tabbing never persist a rename.
- **Territory Settings:** after an external native Region rename, a normal editor render/reopen updates the existing public header element from `RegionDocument.name`; the Scene-native Region remains the name owner. Tab buttons now use the tablist/tab/aria-selected/roving-tabindex pattern, support Left/Right/Home/End navigation and focus the selected tab after a render.
- **Road Settings:** the already-installed `updateScene` watcher refreshes the open Road Settings header from the **current committed Road record**. The existing Road Save/Cancel/stale-revision guard, draft and dialog lifecycle remain authoritative. The watcher is removed through the same existing close cleanup.
- **Party-owned Group Transportation:** delete the duplicate hand-written tabs and reuse the already-tested `createSettingsCategoryTabs` component used by World preset editors; keyboard Left/Right/Home/End now works with roving focus and unchanged mounted draft controls. Its World-owned transportation assignments remain write-only on explicit GM Save.

**Intentionally excluded:** global font restyling, native Token/Actor sheet replacement, replacing Foundry Region sheets, broad #216 closure, auto-saving titles while typing, Scene/Region migrations, Journey/Token movement changes or new UI dependencies.

## Owner Foundry v14 live acceptance (backed-up World)

1. As GM open **two different saved Map Marker Settings** windows in one Scene. Titles must identify each named marker, windows must not steal each other's IDs or tabs, and each Save/Cancel must affect only its selected marker. Test long names, quotes and markup-like text; they must display as plain text.
2. With a Map Marker editor open, rename that marker using another authorized GM action in a disposable World (or another client), then re-render/reopen the editor. The header must show the newly **committed** name, without applying unsaved fields or writing extra Scene flags. Test stale edit validation and cancellation. Repeat with native Territory Region settings.
3. With Road Settings open, rename the same Road from another authorized GM session and verify that the subscribed Scene update refreshes the header; current unsaved name fields remain drafts. The existing revision guard must refuse stale Save. Confirm no listener remains when the Road window closes.
4. Territory Settings: use Tab into the four-tab navigation, then Left/Right/Home/End. Exactly one tab is selected, Arrow navigation moves keyboard focus and re-renders the correct section, and no action executes accidentally. Minimize/restore, switch tabs, and verify the authoritative title stays consistent after a native Region rename.
5. D&D5e Group Actor: open **Party-owned Transportation**. Test Vehicles / NPC / Player Characters tab switching with mouse and Left/Right/Home/End keyboard; controls should retain unsaved quantity, speed/cost and role drafts. Save only when explicitly requested, and confirm same Group Actor/World IDs and original server writes.
6. Non-GM users must not enter GM-only editors or see new private Atlas metadata. Verify native Region Shapes/Behaviors, Player Atlas visibility, discovery, token positions, fog, Journal/World time and approved Journeys are unchanged.
7. At normal and 200% zoom, inspect Focus outlines, keyboard tab order, layout wrapping, accessibility/ARIA and native Foundry window title updates, including two concurrently open editors. Capture any console errors.

## Automated gates

- `tests/atlas-settings-title.test.mjs`: title normalization and native sheet getter
- `tests/checkpoint-appearance.test.mjs`: simultaneous editor IDs, header refresh after authoritative external rename, unchanged revision
- `tests/atlas-territory-settings.test.mjs`: keyboard tab selection, native name header refresh, zero native writes
- `tests/navigation-group-transport-settings.test.mjs`: shared tabs, keyboard focus, draft retention and zero World writes before Save
- Existing Road Settings Save/Cancel/revision and native Region suites must continue passing.

Run `npm run check`, `npm run architecture:check`, syntax and `git diff --check`. Automated success is **not** actual Foundry v14 GM/non-GM acceptance.

**Stop if** tab switching writes saved data, another marker's settings window is reused, title updates reflect only unsaved data, a native sheet is replaced, player-only data is leaked, or a stale Road/Map Marker Save succeeds.
