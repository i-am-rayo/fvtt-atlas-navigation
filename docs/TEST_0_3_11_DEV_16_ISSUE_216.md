# Atlas 0.3.11-dev.16 — Token and Group form accessibility

**Milestone 01 / Issue #216.** Cumulative with owner-accepted `0.3.11-dev.15`; these are presentation-only changes. Requires Foundry v14 GM and non-GM live acceptance. Not a published release.

**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/fix/0.3.11-m01-216-token-group-a11y/module.json

**ZIP:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/fix/0.3.11-m01-216-token-group-a11y.zip

## GM acceptance

1. Open an existing placed Token's native configuration. Under **Atlas — Party Exploration**, verify the checkbox, current assignment message, and separate **Save Atlas Party Settings** button. Assign the explorer and Save once. Reopen to verify Scene assignment. With a screen reader, verify the status announcement. Opening or closing without Atlas Save must not write.
2. In an Actor's prototype Token configuration, set the prototype explorer default. Save once and verify no Scene Token was automatically assigned by the prototype-only Save.
3. In a D&D5e Group Actor sheet, inspect the horse icon beside Travel Pace. The shortcut must use Atlas's normal 2rem target, visible keyboard focus and **Manage Party Transportation** accessible name/tooltip. Opening it must not change native Group, World assignments or Journey.
4. With multiple NPCs/vehicles, verify that each Actor has its own named fieldset/legend, contextualizing repeated Role/Number available/Riders per unit/Transportation profile fields. Check keyboard order and layout at 100% and 200% zoom across Vehicles/NPC/Player Characters.
5. Stage quantity, capacity, profile, and cost overrides. Save and reopen; compare World-owned assignments. Save sequentially from two different Group editors; same-Group stale saves must still refuse. Group membership and native Actor data must remain unchanged.
6. In a non-GM client, ensure Token Explorer and Group transportation authoring controls are not exposed. Confirm no Scene Roads, Map Markers, native Region Shapes/Behaviors, Fog, Token position, Actor resources, World time, or Journey Journal updates result from preview or keyboard navigation.

## Automated acceptance

DOM regressions check Token status semantics, shared icon reuse, actor-named fieldsets, GM-only gating and zero writes on render. Run `npm run check`, `npm run architecture:check`, syntax, whitespace and `git diff --check` when a local checkout is available. CI success is not owner live acceptance.
