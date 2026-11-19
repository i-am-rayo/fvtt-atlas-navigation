# Atlas 0.3.11-dev.15 — Road and Transportation keyboard tab parity

**Milestone 01** · Scoped part of [#216 — editor consistency](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/216). **Cumulative** with owner-accepted dev.14, including the dev.13 multi-editor/Map Marker hover corrections. Actual Foundry **v14 GM and non-GM live testing required**. This is a development test build, **not a public release**.

**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/fix/0.3.11-m01-216-road-transport-keyboard/module.json

**ZIP:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/fix/0.3.11-m01-216-road-transport-keyboard.zip

## Scope

- **Road Settings:** reuse the existing `createSettingsCategoryTabs` controller for **General / Customization / Map Markers / Terrain Regions**. Roving keyboard focus via Left/Right/Home/End; accessible tablist/tab/tabpanel and selected states. Keep every section's existing form inputs mounted, preserving unsaved names, visibility, travel preset, appearance and Journal UUID. Tab activation is presentation-only; native Road ApplicationV2 Save/Cancel/close and Road revision guards remain the single persistence boundary.
- **World Transportation method editor:** Foundry DialogV2 rehydrates a cloned form. Its existing post-render wiring now reconnects keyboard tab handling (General / Services / Ownership), roving focus and `hidden` states for inactive panels. Switching tabs must never change World catalog, Scene, Group, Map Marker or Journey records.

## Owner acceptance — v14 GM

1. In a backed-up Scene, open **Road Settings** for an existing Road. Navigate its tabs using click, then Right/Left arrows, Home and End. Selection is visually clear; focus lands on the chosen tab, and hidden tabs are not active. Verify four tabs and no duplicate tab handler activation.
2. Stage a **Road name**, travel preset choice, appearance field, player visibility and Journal UUID change without saving. Switch back and forth across all tabs using keyboard; staged values must remain unchanged. **Cancel/X** must use the existing unsaved-draft guard, and **Save** must commit once through existing Road validation.
3. With two different Road Settings windows open, independently stage and Save A then B. Both must persist after Scene refresh/reload, with no stale unrelated-record errors; edits to the same Road must still reject appropriately.
4. Open a **World Transportation Preset**, visit General, Services and Ownership using Arrow, Home and End keys, then click. Inspect using keyboard and screen reader where possible. The selected tab must receive focus; inactive sections should not be exposed by keyboard navigation.
5. Stage cost, capacity, hire/services, crew and purchase fields in a Transportation method; tab-switch repeatedly. No reset, price write, Actor update or Journey effect occurs. Save once and verify catalog; cancel another edit and verify no changes.
6. Verify cloned DialogV2 contents (including after reopening), repeated editor opening/closing, and keyboard navigation without double listeners.
7. Verify GM permissions, native Region Shapes/Behaviors, road graph/IDs, Map Marker icon and Journal link, fog, World time, TokenDocument position and Journey journal remain unchanged by tab navigation.
8. In a **non-GM** client, confirm no GM-only settings editor becomes accessible due to these UI changes and no player-private data is exposed. Use a normal browser keyboard without scripting.
9. At narrower widths and increased Foundry UI scale, selected labels must remain legible and keyboard focus clearly visible. Confirm Road Settings footer Save/Delete and move/locate controls are unchanged.

## Automated acceptance

Targeted DOM tests exercise shared four-tab Road logic, rehydrated Transportation DialogV2 tab interactions, arrow/Home/End focus, mounted draft preservation, and zero tab-navigation writes. Existing editor and native Foundry adapter tests plus full `npm run check` / `npm run architecture:check` / syntax/patch whitespace checks must pass. Local `git diff --check` only when a local checkout is available.

This scoped change **does not close all of #216**; complete Token/Scene icon/form parity and GM/non-GM high-zoom review remain outstanding. Do not merge or release unaccepted work.
