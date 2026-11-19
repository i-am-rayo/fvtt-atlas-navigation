# Atlas 0.3.11-dev.10 — Map Marker border enable & cumulative native-tools test

**Milestone 01** · #413 Map Marker Border Enabled · **Includes #418 native tools navigation** in parent dev.9. Foundry VTT **v14 GM/non-GM acceptance required**. This is a development test build, not a public release.

**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/fix/0.3.11-m01-413-marker-border-enabled/module.json

**Archive:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/fix/0.3.11-m01-413-marker-border-enabled.zip

**Cumulative base:** owner-approved dev.8 (#420 / PR #435), dev.9 native tools (#418 / PR #437) and all accepted earlier UI slices. Native tools dev.9 is automated-verified but **not yet owner live-accepted**. Source PRs remain draft and unmerged. Integration attempt #436 was closed without merge because the release-manifest check prohibits a dev version pointing at main. Do not bypass that check.

## #413 compatibility and authority

Optional `appearance.borderEnabled` is a strict Boolean in both Scene Map Marker and World portable preset appearances. **Existing appearance objects without this field resolve as enabled** to preserve historical borders on dot, SVG Font Awesome and image markers, without any write-on-read migration. A disabled border does not clear `borderColor`, change the icon fill, hide the marker, alter discovered status, modify native Region or Journey authority, or remove an independent GM selection highlight.

Both placed and World Map Marker Customization now pair **Map Marker border** and **Map Marker border color** on one wrapping accessible row. Off disables only the color picker and artwork border, retaining the color; On restores the original value. Scene and World preview use their own unsaved drafts. The GM/player canvas drawing path shares the border toggle for dot outlines, Font Awesome text strokes, bundled icon shadows and custom image shadows. Player projection expressly whitelists the boolean without widening unrelated metadata. World preset upsert and explicit selective Apply to Scene accept the new property, with the same existing Save/permission/revision/confirmation boundaries.

## Owner Foundry v14 acceptance — backed-up test World

1. **Legacy stability:** Open a Scene with previously saved Map Markers that have a border color but no `borderEnabled` flag. Before any Save, all marker types must look **exactly as before**. Opening Settings, entering preview, canceling, reloading, or player login must not migrate or write the flag.
2. **Placed Map Marker:** In Settings → Customization confirm Border + Border Color are adjacent, separately labeled/focusable, and wrap at narrow width and 200% zoom. Toggle Off/On, verify the color remains stored in the draft, and Cancel: the saved Scene remains unchanged.
3. **Canvas dot:** Turn Border Off and save. The dot retains its primary fill, has no border stroke, and can still be selected/located. Turn Border On and restore the originally selected border color.
4. **Bundled and Font Awesome icon:** Choose one original bundled SVG and one Free Font Awesome glyph. Off removes only the colored silhouette/stroke, never the original glyph, size, position, player visibility, hover name or separate selection highlight. On restores silhouette/stroke.
5. **Custom image:** Use a valid Foundry FilePicker local image. Off removes image drop-shadow, not the image itself or its position. Invalid paths must continue to fail validation (no external data loading).
6. **World preset:** Edit an existing reusable World Map Marker preset; toggle Border Off, verify the preview, switch tabs, cancel and reopen to confirm no World change. Save a valid Off preset: it changes **only the World preset** and retains stable ID; placed Map Markers remain untouched. Test a preset with a missing legacy field and a malformed explicit non-Boolean: missing is treated enabled, malformed is rejected, no World write.
7. **Explicit bulk Apply to Scene:** On a disposable set of World-matching Map Markers, choose **Border enabled** alone and confirm the selected targets change under the existing permission/revision confirmation without overwriting unrelated icon color, border color, Road, native Region, Journal, discovery, travel offers or graph IDs. Verify skipped targets remain unchanged.
8. **Player parity:** As GM and non-GM, compare revealed Map Markers across dot/icon/image, Border Off/On and native/manual fog. The player must receive the permitted border switch but no new private Scene metadata, and hidden Map Markers must remain hidden. Native Regions/Behaviors, Token movement, World time and Journey Journal must remain unchanged.
9. **Cumulative #418:** Test Map Directory → Territory tools/Road tools/Map Marker tools, and an already valid interrupted native transfer ledger to ensure Resume / Roll Back remains reachable. Settings no longer contains Advanced Map Operations. Follow [dev.9 matrix](TEST_0_3_11_DEV_9_ISSUE_418.md).

## Automated gates

Targeted regressions cover validator strictness and legacy default/no mutation; placed and World draft toggles; textured icon shadow suppression; player projection whitelist; native tool navigation. Existing dot/font glyph, World preset, import/export, bulk-update, GM and player rendering suites must stay green. Run `npm run check`, `npm run architecture:check`, syntax checks, and `git diff --check`. Automated success is **not** actual Foundry GM/non-GM acceptance.

**Stop if:** Any old marker appearance changes on load, Off changes fill/visibility instead of border only, selected border color disappears, invalid flags save, bulk Apply overwrites unrelated fields, player projection leaks metadata, or interrupted native Region recovery becomes unreachable. Keep PRs draft; capture failed mode, screenshot, stored appearance, and console.
