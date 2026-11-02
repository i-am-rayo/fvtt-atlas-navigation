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
| `createSettingsIconButton` / `createSettingsActionButton` | World checkpoint presets, Road Settings, Checkpoint Settings and Scene Atlas road/checkpoint/Region actions | Shared icon-only controls, accessible labels, hover tooltips and red destructive actions; delegated handlers preserve existing GM confirmations |
| `createCheckpointIconGlyph` | Shared icon picker and World preset list | Same bundled Atlas Font Awesome font faces |
| `checkpoint-field-definitions` | Checkpoint Settings and World preset editor | Canonical marker, label, discovery choices and Region radius constraints |
| `checkpoint-form-controls` | Checkpoint Settings, World preset editor and Scene Region generator | Identical elevation sliders with optional numeric input, marker-size sliders, colors, checkboxes, discovery selects, reveal-radius inputs and bounded Region width/radius sliders |
| `settings-layout` | Checkpoint, preset, Road Settings and Scene Region generator | Single field-row construction with explicit responsive layout variants; never clones or rewrites live input values |

The travel selector preserves stable IDs while grouping Land, Water body and Air consistently. Every native-dialog dropdown must express the persisted choice in **HTML-serializable form** (for example, `option.defaultSelected`, plus the live `select.value`), because Foundry v14 DialogV2 can recreate inputs from serialized markup. Save, close/reopen, and refresh tests must assert the *rendered* selected option, not only the stored ID. The icon picker owns category tabs, style filter, search, preview and paging; both editors use its selected value. A control may be re-rendered, but its source of choices and behavior must not be copied into an editor.

Built-in checkpoint presets provide category-appropriate Font Awesome glyphs and colors as defaults. The normalized World catalog only fills these into the original built-in templates when appearance is unset; user-customized appearances and custom preset templates are preserved. This is a presentation/defaults evolution, not a new Scene schema.

Checkpoint preset **identity** is persisted separately in Scene metadata (`checkpointPresetAssignments`). This is not inferred from checkpoint category, appearance or matching values: several distinct presets may use the same category, and changing a checkpoint's appearance must not silently select another preset.

Icon-only actions preserve native save/delete dispatch. The Road Settings DialogV2 save control uses the public v14 `icon` and `tooltip` button options. Checkpoint Settings uses the same shared icon control; its Delete action delegates to the existing checkpoint-and-dependent-Region confirmation flow and is unavailable while creating a checkpoint. Scene Atlas icon actions retain explicit tooltips for keyboard and hover discovery.

## Intended next migrations

- **v0.3.5-beta.5 priority:** Replace the flat, mode-prefixed **Generate Terrain Region → Travel preset** options in `scripts/scene-config.js` with `createTravelPresetSelect`. Match Road Settings' Land/Water-body/Air optgroups and default-selected behavior. Retain the generator's explicit selection-change effects (preview invalidation, native movement-cost opt-in reset, movement action reset); shared controls never directly edit native Regions.
- Centralize checkpoint-type selection and remaining nested Region-row variants; the main field rows, elevation, marker, color, label, discovery and Region geometry controls now share factories.
- Replace remaining one-off road and Region selectors with the shared travel selector after confirming those dialogs' native Behavior semantics.
- Add UI-level tests with Foundry v14 DOM events for selection, cancellation, cloning, reopening and re-rendering, including persisted option attributes.

## Compatibility requirements

- No schema migration is needed for presentation-only UI refactors.
- World presets are snapshots, not live bindings: changing a preset never updates existing checkpoints.
- Native Foundry Region Behaviors, geometry and Journal permissions are never changed merely by choosing a preset.
- An invalid or removed preset must be rejected at save time by the owning editor.
- All controls must be usable by keyboard and have accessible labels; hidden panels must not silently capture a save.
