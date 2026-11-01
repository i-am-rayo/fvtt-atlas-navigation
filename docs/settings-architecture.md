# Atlas settings UI architecture (v0.3.5)

## Contract

Atlas settings are split into three layers:

1. **Models** define persisted data, stable IDs, defaults and validation. They must not depend on the DOM or a Foundry Application window.
2. **Controls** in `scripts/settings-controls.js` and `scripts/checkpoint-icon-control.js` render UI and report selected values. They must not write World settings, Scene flags, Region documents or Journal permissions.
3. **Editors** own permissions, user confirmation, save/cancel, persistence, concurrency checks and post-save refresh. Closing a dialog without saving must not write anything.

## Shared controls

| Control | Call sites | Canonical data |
| --- | --- | --- |
| `createTravelPresetSelect` | Road creation, Road/Region preset assignment, World checkpoint preset terrain | `travelPresetDisplayGroup`, World travel presets |
| `createCheckpointIconPicker` | Checkpoint Settings, World checkpoint preset editor | `checkpoint-appearance` icon catalog |
| `createCheckpointPresetSelect` | Checkpoint creation and editing | Full World checkpoint preset catalog, grouped by checkpoint type |
| `createSettingsActionButton` | World checkpoint preset management (and future compact settings rows) | Accessible label + Font Awesome action icon |
| `createCheckpointIconGlyph` | Shared icon picker and World preset list | Same bundled Atlas Font Awesome font faces |
| `checkpoint-field-definitions` | Checkpoint Settings and World preset editor | Canonical marker, label, discovery choices and Region radius constraints |
| `checkpoint-form-controls` | Checkpoint Settings, World preset editor and Scene Region generator | Identical elevation sliders with optional numeric input, marker-size sliders, colors, checkboxes, discovery selects, reveal-radius inputs and bounded Region width/radius sliders |

The travel selector preserves stable IDs while grouping Land, Water body and Air consistently. The icon picker owns category tabs, style filter, search, preview and paging; both editors use its selected value. A control may be re-rendered, but its source of choices and behavior must not be copied into an editor.

Built-in checkpoint presets provide category-appropriate Font Awesome glyphs and colors as defaults. The normalized World catalog only fills these into the original built-in templates when appearance is unset; user-customized appearances and custom preset templates are preserved. This is a presentation/defaults evolution, not a new Scene schema.

Checkpoint preset **identity** is persisted separately in Scene metadata (`checkpointPresetAssignments`). This is not inferred from checkpoint category, appearance or matching values: several distinct presets may use the same category, and changing a checkpoint's appearance must not silently select another preset.

## Intended next migrations

- Centralize remaining layout/field-row composition and checkpoint-type selection; the underlying elevation, marker, color, label, discovery and Region geometry controls now share factories.
- Replace remaining one-off road and Region selectors with the shared travel selector after confirming those dialogs' native Behavior semantics.
- Add UI-level tests with Foundry v14 DOM events for selection, cancellation and re-rendering.

## Compatibility requirements

- No schema migration is needed for presentation-only UI refactors.
- World presets are snapshots, not live bindings: changing a preset never updates existing checkpoints.
- Native Foundry Region Behaviors, geometry and Journal permissions are never changed merely by choosing a preset.
- An invalid or removed preset must be rejected at save time by the owning editor.
- All controls must be usable by keyboard and have accessible labels; hidden panels must not silently capture a save.
