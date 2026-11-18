# Atlas 0.3.10-dev.3 — GM terminology and menu labels

**Issue:** [#410](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/410) · **Milestone:** [01 — Workspace & UI/UX](https://github.com/i-am-rayo/fvtt-atlas-navigation/milestone/1) · Foundry VTT v14.

**Test manifest:** `https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feature/0.3.10-m01-410-gm-terminology/module.json`

**Archive:** `https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/feature/0.3.10-m01-410-gm-terminology.zip`

**Build scope:** Standalone branch from released `main` 0.3.9. It does **not** yet incorporate separately accepted draft #424/dev.1 or pending draft #426/dev.2. These are separate reviewable implementations until the Product Owner authorizes merges.

## Changes and invariants

- Atlas Workspace creation actions: **Add Territory**, **Add Road**, **Add Map Marker**; directory navigation: **By Territory**, **All Roads**, **All Map Markers**.
- Road surface subtitle and type filter display **Land**, **Water**, and **Air**. Internal persisted `land`, `water`, `air` values remain exactly the same.
- The World catalog and module launcher use **Map Marker Presets** instead of generic Checkpoint Presets; in-world types such as **Security Checkpoint** remain valid and unchanged. Bulk apply confirmations now use Map Marker wording and text-safe native v14 `DialogV2.confirm` content.
- Module menus offer task-focused **Transportation Presets**, **Surface Presets**, **Road Appearance**, and **Announcement Previews** with scope-aware descriptions. Preview does not send a player announcement; editing preset catalog does not trigger travel or overwrite existing native Behaviors.
- No file/API names, registration **keys**, flag names, stable IDs, schemas, route math, Scene/Region/Token/Journal writes, or permission boundaries were renamed.

## Owner Foundry v14 acceptance

1. Open **Atlas Scene Workspace** with a GM. Verify title-cased creation buttons and the three Map Directory views. Use each to open its existing authoring path and Cancel; confirm no unintended write.
2. Inspect Roads on the Map Directory: **Land / Water / Air** must display as human labels, while changing display filters must not rewrite the Road travel-surface preset, persisted mode or graph.
3. Under Foundry **Module Settings**, confirm four distinct launchers: **Map Marker Presets**, **Transportation Presets**, **Surface Presets**, **Road Appearance**; the **Announcement Previews** launcher is explicitly preview-only.
4. Open World Map Marker Presets. Verify ordinary help and Add/Apply/Delete commands use **Map Marker**, without changing the name of an authored marker or a genuine category such as **Security Checkpoint**.
5. With a backed-up disposable Scene, open Bulk Apply and cancel. Verify target selection, field list, warning and permission behavior unchanged; no Scene write on Cancel. Enter a preset name with punctuation or angle brackets and confirm it renders as text only.
6. Compare a non-GM client: World preset editors and Atlas authoring remain restricted. No changes to player-facing visibility/Fog/Journal access should occur from this wording-only pass.
7. Test narrow and 200% zoom: navigation and menu labels remain readable. Check unchanged World settings IDs are still recognized by an existing World.

**Stop condition:** If a label change implies existing presets are auto-applied, a bulk update is saved without explicit confirmation, original preset data disappears, or any versioned Scene/World key is renamed, keep the draft PR open and provide logs.

## Automated gates

`npm run check`, `npm run architecture:check`, syntax checks, `git diff --check`, and a separate Foundry v14 GM/non-GM live check. Node and CI evidence is not a substitute for live verification.
