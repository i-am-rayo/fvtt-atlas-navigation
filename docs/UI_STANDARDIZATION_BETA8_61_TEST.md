# Atlas beta.8.61 — PR #376 remaining UI work and owner acceptance

**Baseline:** Owner reports **beta.8.60 successfully tested** in Foundry v14. Beta.8.61 adds three focused draft PRs; it has **not** been owner-tested. Preserve that distinction. Use a backed-up Sandbox World, not production.

## New code since owner-tested beta.8.60

| Draft PR | PR #376 annotation | What changes |
|---|---|---|
| #398 — Directory section Plus | #5 | Shared accessible Plus actions in populated geographic, Road and Map Marker group headings, including Road-associated Map Markers. Each delegates to the **existing** GM-authorized Create Territory / Draw Road / Place Map Marker workflow. Grouping implies **no automatic Road, parent Territory, or native Region attachment**. Disabled during active Road/Map Marker draft or pending Territory transfer. Click/keyboard activation does not toggle disclosure. |
| #399 — Clear canvas-editor instructions | #16 | Compact native `<kbd>` + gesture descriptions in the Road and Map Marker dock, verified against actual Road point and Map Marker canvas controls. Clarifies unconnected Road end; places Save/Cancel/confirmation wording within current authority. No shortcuts/controls altered. |
| #400 — Restoration guard and Road edit regression | #12 / #15 / #17 | Prevent a late editor refresh from re-rendering a GM-closed/minimized Atlas Workspace; keeps explicit opening/restoration as separate actions. Real Road geometry tests cover multi-step Undo, Redo, new-operation branch invalidation, Cancel history disposal and no Scene writes before Save. Existing checked Save remains unchanged. |

**No data migration or schema changes.** No changes to authored Road/Map Marker IDs, native Region geometry/elevation/priority/Behaviors, Actor/Token documents, Journal, Journey approvals/recovery, World clock or player read models. The code stays GM-authorized and system-neutral.

## Completion against PR #376 — 27 items

- Items **1–4, 6–11, 13–14, 18–22, 25–26**: functionality from beta.8.59/.60, reported owner-successful for beta.8.60; do not confuse this with exhaustive per-path checks on all maps.
- Item **5**: context Plus added in #398 **only to present nonempty sections** and nested Road marker groups. A global Create toolbar still covers empty maps; do not manufacture empty native Territory/Region records or automatically attach to a parent. This avoids a fake relationship implied by a directory grouping.
- Items **12, 15, 17**: existing editor sessions, Road/marker dock, native approval path, focus lease and restoration architecture retained. #400 closes a late-Workspace-refresh defect and adds multi-step draft regressions. The actual GM manual-minimize, dirty-close and multi-editor handoff matrix requires live Foundry v14 acceptance.
- Item **16**: #399 replaces Road/Marker gesture text with keycaps, while Paint Territory retains its existing verified shortcuts. Special-purpose editors retain task-specific help; don't introduce a competing shortcut subsystem.
- Items **24, 27**: related Road and Map Marker color controls and applicable native ApplicationV2 footers are standardized. **Intentional exceptions**: native Territory Settings operates through independently authorized action rows with no single global Save; World travel rules have explicit scoped Save actions. Never add a fake global Save or regroup unrelated native Region colors solely for cosmetic parity.
- Item **23**: **design proposal only** in `docs/ROAD_TERRITORY_BANNER_DESIGN_BETA8_59.md` / draft PR #384. Product Owner approval for dynamic-versus-explicit Territory selection, audience and hover/Always behavior is still required **before** implementing new Road subtitle metadata. No hidden Region name may be exposed to players or written as a derived Road field. This remains the sole explicit feature-design decision, not silently included in beta.8.61.

The original requirement specification is `docs/UI_STANDARDIZATION_BETA8_58_HANDOFF.md`, and the existing full 27-item baseline matrix is `docs/UI_STANDARDIZATION_BETA8_60_COVERAGE.md`.

## Owner Foundry v14 GM acceptance checklist

1. Confirm installed module **0.3.9-beta.8.61** (not only manifest URL). Confirm beta.8.60 Road Settings, SVG Road name preview, World Map Marker preset layout and Map Directory still work; no console errors.
2. Open Workshop → Map Directory → By territory. Inspect **Continents, Settlements, Other territories, Roads, Map Markers** sections populated by test data. Their Plus buttons should have an accessible descriptive tooltip, sit with the group heading/count and open the existing creation flow. Expand/collapse with mouse and keyboard. Clicking Plus must **not** toggle the group.
3. Use a Road with associated Map Markers; click its nested Map Markers Plus. Confirm the new Map Marker is **not silently attached to that Road**: choose location/snap/attachment using the existing explicit confirmation. Cancel/Escape; verify no new marker was saved. Repeat Road Plus and Territory Plus using disposable data, confirming no implicit new Region parent, Road or graph connection.
4. While an editor draft or Territory transfer is pending, confirm contextual Plus cannot start a competing authoring workflow. Verify other Directory search, sort, unique counts, filter, selected view and player visibility logic remain unchanged.
5. Open Road Editor and Map Marker move dock; confirm gesture descriptions and `kbd` shortcuts are readable at 100%/200% text zoom and narrow window. Test actual Drag, Double-click, Shift-click, Alt/Option-click, Undo/Redo, Escape, Enter as applicable; shortcuts must not steal text-input native undo.
6. In Road point-edit mode on a disposable Road: make two or more bends; Undo twice, Redo once, add a new edit; confirm Redo is cleared. Cancel: saved graph unchanged. Repeat Save after a known good draft: exactly one authorized, revision-checked Scene commit; after another GM's intervening revision, reject stale edits without overwriting.
7. Open Map Marker movement dock or Road canvas editor from Workspace. Manually minimize Workspace, then Cancel editor; avoid unexpected reopening while manually minimized. Close Workspace deliberately during a modeless editor and then Cancel/close the editor: Workspace **must remain closed**. Explicitly opening Workspace afterwards should still work.
8. Non-GM: no GM canvas authoring or newly exposed group Plus controls; hidden Road, Map Marker, Territory, Journal, native Region or discovery metadata must not leak through search, counts, preview or tooltips. Check Fog and canvas redraw integrity.
9. Confirm Road topology, native Region priority/Behaviors, Token positions, Actor resources, World time and Journey Journal are unaffected by open/preview/undo/cancel. Stop on any write, authority, lifecycle or hidden-data regression. Supply full red console stack, Foundry build and exact action.

## Test artifact

Manifest:
https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.61-pr376-stabilization/module.json

Archive:
https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.9-beta.8.61-pr376-stabilization.zip

Known owner-tested rollback build:
https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.60-pr376-ui-audit/module.json

**Release discipline:** all stacked PRs remain draft/unmerged; no force-push, merge, production release or migration without explicit owner authorization. Automated CI success is not the GM/non-GM Foundry acceptance.
