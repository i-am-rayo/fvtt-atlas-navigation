# Atlas 0.3.11-dev.13 — Multiple Map Marker editors / opt-in Road hover hotfix

**Milestone 01** · Issue [#442](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/442) · Foundry **v14 GM and non-GM live acceptance required**. Scoped hotfix of two user-confirmed defects on otherwise owner-accepted dev.12. This is a cumulative development test build, **not a public release**.

**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/fix/0.3.11-m01-442-multi-marker-edit-hover/module.json

**Archive:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/fix/0.3.11-m01-442-multi-marker-edit-hover.zip

**Parent:** dev.12 / draft PR #441, plus all accepted preceding development slices. Dev.12's other features were owner-tested successfully in the reported Paedor World. Do not merge unreleased development manifests to `main` (the repository correctly enforces its release-manifest policy).

## Scope / recovery contract

An existing Map Marker Settings editor retains the committed snapshot of its own marker (name, elevation, graph identity, appearance, visibility), plus its own category, World preset assignment, terrain suggestion, transportation offers, selected Journal, knowledge, discovery method and reveal radius. On Save, Atlas re-reads the latest validated Scene and related flags; **if those target values and global party explorer configuration are unchanged**, it uses the latest Scene revision with the **existing** authorized revision-checked writer, not a bypass. Unrelated Map Marker updates and unrelated discovery/Journal records are preserved. If *this* marker changed, the old editor refuses Save **before any Scene write** and retains the unsaved form. Other Scene data ownership, stable IDs and public player projection remain unchanged. Native Foundry Scene flags are not an atomic multi-GM CAS, so this patch does not claim simultaneous multi-GM conflict merging.

The legacy Road line in Map Marker hover-only quick info is removed. The **Include Road name in Map Marker banner** checkbox remains the single opt-in that controls Road names. Other configured banner details (elevation, type, Territory), non-duplicated hover elevation and authorized Journal cue remain unchanged.

## Owner Foundry v14 acceptance — disposable backed-up Paedor scene

1. Open **The Eyrie** and **Dirwest** Map Marker Settings *simultaneously*. Leave Dirwest open while modifying The Eyrie (e.g., name, icon, color, elevation, visibility). Save The Eyrie; confirm its window closes and native Scene Atlas revision increments once.
2. Still in the original Dirwest window, make a different valid change and **Save without closing or reopening**. It must succeed; both changes, all unrelated Map Marker IDs, Road associations, native Regions, Fog, and Journal links must survive refresh/reload. Repeat in reverse order and across three different markers.
3. Exercise independently configured **Map Marker Type, assigned World preset, selected Journal, discovery method/lore/reveal radius, transportation offers and terrain suggestion** on A then B. Unrelated markers' sidecar flags must be preserved; no preset should auto-reapply, and no unexpected "Scene Atlas changed" / unrelated-flag error should occur.
4. **Same-marker safety:** open two Settings windows/views for the same Map Marker via separate GM sessions or another authorized action, edit the first and Save. Attempt to Save the stale second without refreshing: it must report a marker-specific stale error **and not overwrite** the first changes, remove an edited link, or clear the unsaved second draft. Check same-marker graph relocation/delete also refuses unsafe Save.
5. **Other operations:** while a Map Marker window is open, safely edit a different Road or Region (no touched marker). Saving the marker must preserve the committed Road/Region changes. A changed native Scene dimension, unexpected graph migration or unavailable target should stop safely instead of force-writing.
6. **Road hover Off:** for The Eyrie select **Include Road name in Map Marker banner = Off**. Hover its icon at low and high zoom, with Banner Display = Always / Hover / Off. Its name, permitted elevation, Territory and Journal cue remain; **no extra `Road: …` line** anywhere.
7. **Road hover On:** turn **Include Road name** back On, save, hover and verify the Road name appears **once** via banner composition, never a second older quick-info line. Recheck labels in GM and separate non-GM players under visible/discovered/hidden Road policies; hidden Road names must never leak.
8. Verify existing Map Marker Settings Save/Cancel/close guard, native Region Shapes/Behaviors, player permissions, Journal references, Scene Atlas stable graph IDs, fog, TokenDocument position, World time and Journey Journal are unaffected. Capture any console errors and observed stored revision before/after.

## Automated checks

- DOM editor regression: sequential A/B Save using two open windows, latest Scene revision update preserving A, and stale same-target Save refusing writes while retaining draft.
- Canvas quick-info regression: no legacy Road name when Off, preserving elevation, no write on hover.
- Existing checkpoint banner model regression: opt-in Road line exactly once; player-safe Road names remain filtered by projection.
- Existing Scene revision, Journal/Discovery and Road storage tests must continue to pass; `npm run check`, `npm run architecture:check`, syntax checks, and `git diff --check`.

**Stop** if unrelated saves still collide, a stale same-record Save succeeds, a marker's sidecar data is overwritten, a Road name leaks via a player tooltip, or the World/Scene revision model is weakened.
