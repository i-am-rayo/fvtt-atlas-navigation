# Checkpoint Settings visual polish — v0.3.9-beta.8.52 (draft)

## Source and scope
- Stacked on PR #356 / `codex/checkpoint-party-ux` beta.8.51; does not replace, rewrite, or merge the parallel Navigation PR stack.
- Visual Checkpoint editor only: preset alignment, native Scene-based elevation units, staged visibility action relocation, compact footer icons, and accurate map sample.
- No edits to stored Checkpoint schema, elevationMeters, Road geometry, connections, Region Behaviors, native Foundry movement, Discovery behavior, Journal access or Scene permissions.

## Behavior
1. **Checkpoint preset** controls align to the right edge of the General field row; selected preset, editor/cancel, and World preset safety checks are unchanged.
2. **Elevation units:** use recognized `Scene.grid.units` (metric or imperial native Scene measurements), otherwise the shared Atlas/system resolver. Display value converts from canonical meters; editing still saves meters. Saving an untouched field keeps the original exact stored elevation.
3. **Player visibility:** keep one existing staged Show/Hide button and discovery-state input, but move both into the persistent footer. The label reflects Show/Hide, remains keyboard-accessible, and saves only on Save Checkpoint. No separate immediate Scene write or change in discovery semantics.
4. **Move and visibility icons:** visually compact to 2rem buttons in the Checkpoint footer, retaining native focus indicators and the existing unsaved-change guard for Move. Delete remains separate/full-size.
5. **Map preview:** match `road-canvas.js` label composition: Checkpoint name on a bold first line, authored Road name as italic smaller second line only when enabled. Preview glyph size uses the same `checkpointCanvasSize` zoom-clamp as Scene canvas, not the icon gallery's larger selection sample. Font Awesome and classic image silhouettes use appropriate shadow approximations. Preview is still HTML, so PIXI stroke rendering and actual anti-aliasing can differ slightly; no canvas image is edited.

## Regression checks
- Unit: recognized native ft/km/m Scene units and fallback to World/system.
- DOM: preset row alignment, footer visibility staged until Save, two-line authored Road name, 24px marker at 1× canvas zoom, compact action classes, unchanged save/footer order and original Checkpoint revision behavior.
- Run `npm run check`, `npm run architecture:check`, JS syntax checks, `git diff --check`; compare diff only to base PR #356.

## Foundry v14 GM/non-GM acceptance
1. Test on a backed-up Sandbox with beta.8.51 baseline and beta.8.52 candidate. Confirm right-aligned preset row at normal and narrow window widths.
2. On a Scene configured in ft, check elevation label ft, value and Save round-trip. On a metric Scene (m/km), check label m and unchanged canonical stored elevation. Do not assume swapping visual units changes stored geometry.
3. Toggle Show/Hide from footer, then Cancel: player visibility must remain unchanged. Toggle and Save: only authorized Scene and Knowledge flags update, exactly once. Refresh and confirm.
4. Move button should stay compact and invoke the existing guard that asks to save/discard unsaved form edits. Check keyboard focus and delete action unchanged.
5. Pick a City icon (e.g. Dirwest), set marker size 24px, enable Show Road Name and Always; the Map Preview should show the Checkpoint name over the exact authored Road name (separate italic line), and marker should not jump to the large icon-selector size. Change size, colors, zoom, label mode, and hovered state; compare with actual GM canvas.
6. Non-GM players must not see hidden labels, reveal extra Journals, or gain editing access. Confirm actual canvas render remains unchanged by merely opening the editor.

## Links
Manifest: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.52-checkpoint-settings-footer/module.json

Archive: https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.9-beta.8.52-checkpoint-settings-footer.zip

Draft/unmerged pending owner live acceptance. The incomplete fifth item from the owner's annotated message is intentionally not inferred.
