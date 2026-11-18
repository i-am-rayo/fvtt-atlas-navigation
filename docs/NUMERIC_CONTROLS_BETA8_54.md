# Atlas numeric control audit — v0.3.9-beta.8.54

Source: PR #358 handoff, annotation 9. Stacked on visual-only PR #359. No additional gameplay authority or Scene write-on-read.

## Shared contract
`scripts/settings-number-range.js` validates finite bounded values and steps. It renders a slider and an editable number, synchronizes on user input without synthetic events or recursion, reports invalid drafts visibly, and requires the caller to read `getValue()` at an authoritative Save. `setValue()` synchronizes both for preset application; no hidden slider fallback is permitted on Save. Input callbacks are preview-only unless the preexisting surface already committed client-local or explicit GM-authorized settings on Change.

## Inventory / disposition
| Existing range | Disposition and authority |
| --- | --- |
| Checkpoint marker (12–64px) | **Added number**, integer step 1. Both Checkpoint Save and World preset Save validate it before writes |
| Checkpoint elevation (ft/m) | **Already slider+number**; number may be empty for optional elevation and accept fractional values, slider maintains its existing coarse 10-unit movement |
| Checkpoint reveal radius (0–100 cells) | **Already paired**, now uses validated `getValue()` at Save and synchronizes both on preset application |
| Checkpoint generated Region radius/width (.25–3 cells) | **Added number**, step .25; invalid preview marks transient selected width nonfinite and rejects native generation |
| Party discovery radius | **Already paired**; explicit Save now validates numeric draft |
| Atlas Layers Continent/Settlement fill opacity (0–50%) | **Added numbers**; client-local preference commits only after valid Change |
| Manual Exploration brush radius (0–20 cells) | **Already paired**; invalid numeric changes do not update client setting |
| Territory grid paint brush radius (0–4 rings) | **Added number**; preview-only until explicitly saved native Region geometry, with original wheel/keyboard bounds preserved |
| Checkpoint/World transportation numeric attributes and hire costs | **Already paired** in `navigation-transport-form-controls.js`, preserve larger keyboard numeric bounds where deliberately greater than coarse slider's range; validation remains with method/catalog editor |
| Navigation playback seconds/hour (0.5–30) and real target minutes | **Added numbers**; proposal uses existing `onChange` visual-speed callback and approved Journey safety guards, not a World-time or token movement action |
| Native Foundry v14/system range-picker controls | **Intentional exception**: do not override native range-picker widgets that already provide browser/direct numeric controls; native settings and Region Behaviors remain owned by Foundry |
| Ordinary unbounded text/number form fields | **Not converted to sliders**; no meaningful bounded domain |

## Automated tests and safety
- Linked update in both directions (direct number→slider and slider→number), including step rounding tolerance.
- Empty, nonfinite, out-of-range and wrong-step input cannot make a saved value silently revert to a previous slider position.
- Tests cover Checkpoint marker/Region pair, Atlas Layers opacity valid/invalid updates and Navigation playback 20s/hour and 5-real-minute controls.
- Run `npm run check`, `npm run architecture:check`, Node tests, JS syntax and `git diff --check`. No new cycles/target misses.

## GM Foundry v14 checklist
In a backed-up Sandbox, open Checkpoint General/Marker, World Checkpoint Preset, native Region generator, Atlas Layers, Manual Fog, Territory Paint, Transportation and Navigation Playback. Verify each paired number and slider round-trips on typing, stepping, clicking and keyboard arrows; invalid drafts remain rejected, never auto-clamped into stored values; buttons retain correct disabled state, focus and responsive layout; World presets stage until Save; atlas client-local opacity remains client-only; painting and Journey controls do not save on input or change gameplay time. Non-GM must not gain controls or hidden data. Real Scene/Region writes require an explicitly approved fixture.

Manifest: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.54-numeric-range-entry/module.json

Keep draft/unmerged until owner approval.
