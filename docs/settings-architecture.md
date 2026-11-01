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

The travel selector preserves stable IDs while grouping Land, Water body and Air consistently. The icon picker owns category tabs, style filter, search, preview and paging; both editors use its selected value. A control may be re-rendered, but its source of choices and behavior must not be copied into an editor.

## Intended next migrations

- Centralize marker size, color, border, label mode and road-name field definitions.
- Centralize checkpoint type, discovery method, reveal radius and status controls.
- Replace remaining one-off road and Region selectors with the shared travel selector after confirming those dialogs' native Behavior semantics.
- Add UI-level tests with Foundry v14 DOM events for selection, cancellation and re-rendering.

## Compatibility requirements

- No schema migration is needed for presentation-only UI refactors.
- World presets are snapshots, not live bindings: changing a preset never updates existing checkpoints.
- Native Foundry Region Behaviors, geometry and Journal permissions are never changed merely by choosing a preset.
- An invalid or removed preset must be rejected at save time by the owning editor.
- All controls must be usable by keyboard and have accessible labels; hidden panels must not silently capture a save.
