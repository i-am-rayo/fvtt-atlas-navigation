# Atlas settings UI architecture (v0.3.5)

## Contract

Atlas settings are split into three layers:

1. **Models** define persisted data, stable IDs, defaults and validation. They must not depend on the DOM or a Foundry Application window.
2. **Controls** in `scripts/settings-select.js`, `scripts/settings-input.js`, `scripts/settings-controls.js`, and domain-specific control modules render UI and report selected values. They must not write World settings, Scene flags, Region documents or Journal permissions.
3. **Editors** own permissions, user confirmation, save/cancel, persistence, concurrency checks and post-save refresh. Closing a dialog without saving must not write anything.

## Shared controls

| Control | Call sites | Canonical data |
| --- | --- | --- |
| `createSettingsSelect` / `createSettingsGroupedSelect` | Checkpoint category/type, native movement actions, road/Region dialogs, road overlay styling, World presets and icon filters | One plain DOM selector factory; stable IDs, optgroups, accessible labels, HTML-reflected selection both initially and after changes |
| `createSettingsInput` / `settingsFormValues` | Checkpoint controls, World Road Appearance, Scene checkpoint radius and placed Party Token settings | Native number/range/color/checkbox controls with numeric constraints and HTML-reflected defaults; checkbox values read from `checked` |
| `createTravelPresetSelect` | Road creation, Road/Region preset assignment, World checkpoint preset terrain, Generate Terrain Region | `travelPresetDisplayGroup`, World travel presets |
| `createCheckpointIconPicker` | Checkpoint Settings, World checkpoint preset editor | `checkpoint-appearance` icon catalog |
| `createCheckpointPresetSelect` | Checkpoint creation and editing | Full World checkpoint preset catalog, grouped by checkpoint type |
| `createSettingsIconButton` / `createSettingsActionButton` | World checkpoint presets, Road Settings, Checkpoint Settings and Scene Atlas road/checkpoint/Region actions | Shared icon-only controls, accessible labels, hover tooltips and red destructive actions; delegated handlers preserve existing GM confirmations |
| `createCheckpointIconGlyph` | Shared icon picker and World preset list | Same bundled Atlas Font Awesome font faces |
| `checkpoint-field-definitions` | Checkpoint Settings and World preset editor | Canonical marker, label, discovery choices and Region radius constraints |
| `checkpoint-form-controls` | Checkpoint Settings, World preset editor and Scene Region generator | Identical elevation sliders with optional numeric input, marker-size sliders, colors, checkboxes, discovery selects, reveal-radius inputs and bounded Region width/radius sliders |
| `settings-layout` | Checkpoint, preset, Road Settings and Scene Region generator | Single field-row construction with explicit responsive layout variants; never clones or rewrites live input values |
| `createTerrainRegionTravelPresetControl` | Generate Terrain Region staged editor | The same travel catalog as Road Settings, plus generator-specific preview/native-cost/action reset on selection change |
| `promptNativeMovementAction` | Native cost apply and native cost refresh | One registered-action chooser; validation and confirmation still belong to the invoking GM-only flow |

The travel selector preserves stable IDs while grouping Land, Water body and Air consistently. The **Generate Terrain Region** selector now uses precisely that grouped control and keeps the generator's staged reset behavior outside the selector factory. Every native-dialog dropdown must express the persisted choice in **HTML-serializable form** (`option.defaultSelected`, plus the live `select.value`), because Foundry v14 DialogV2 can recreate inputs from serialized markup. The generic factory also updates the reflected option on a real `change` event. The generic input factory similarly reflects updated values/checkbox states during input. Save, close/reopen, and refresh tests must assert the *rendered* selected option, not only the stored ID. The icon picker owns category tabs, style filter, search, preview and paging; both editors use its selected value. A control may be re-rendered, but its source of choices and behavior must not be copied into an editor.

The World Road Appearance editor now reads checkbox state as a Boolean rather than the checkbox's fixed `value` attribute. Changing road border visibility therefore persists the GM's choice when saving the World profiles. Checkpoint field definitions remain domain-specific: a generic numeric primitive does not impose checkpoint-specific bounds on unrelated settings.

Built-in checkpoint presets provide category-appropriate Font Awesome glyphs and colors as defaults. The normalized World catalog only fills these into the original built-in templates when appearance is unset; user-customized appearances and custom preset templates are preserved. This is a presentation/defaults evolution, not a new Scene schema.

Checkpoint preset **identity** is persisted separately in Scene metadata (`checkpointPresetAssignments`). This is not inferred from checkpoint category, appearance or matching values: several distinct presets may use the same category, and changing a checkpoint's appearance must not silently select another preset.

Icon-only actions preserve native save/delete dispatch. The Road Settings DialogV2 save control uses the public v14 `icon` and `tooltip` button options. Checkpoint Settings uses the same shared icon control; its Delete action delegates to the existing checkpoint-and-dependent-Region confirmation flow and is unavailable while creating a checkpoint. Scene Atlas icon actions retain explicit tooltips for keyboard and hover discovery.

## Remaining extension points after beta.5

- Keep specialized editors and native Foundry controls independent when they have different authorization, validation, or behavior semantics. Do not turn unrelated UI into one all-purpose form class.
- Future dialogs should use the same low-level selection, numeric and field-row factories and add only the domain-specific choices, bounds and safe save handler.
- Validate Foundry v14 live DOM cloning/re-rendering, unsaved-close prompts, Region generation previews and per-Scene authorization as a release gate; Node tests are not a substitute for the GM/player smoke test.

## Compatibility requirements

- No schema migration is needed for presentation-only UI refactors.
- World presets are snapshots, not live bindings: changing a preset never updates existing checkpoints.
- Native Foundry Region Behaviors, geometry and Journal permissions are never changed merely by choosing a preset.
- An invalid or removed preset must be rejected at save time by the owning editor.
- All controls must be usable by keyboard and have accessible labels; hidden panels must not silently capture a save.
