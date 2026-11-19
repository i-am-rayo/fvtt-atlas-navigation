# Atlas 0.3.11-dev.2 — Map Directory names and counts

**Issue:** [#408](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/408) · **Milestone 01:** Atlas Workspace & UI/UX Stabilization · **Platform:** Foundry v14.

**Test manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/fix/0.3.11-m01-408-directory-count-placement/module.json

**Archive:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/fix/0.3.11-m01-408-directory-count-placement.zip

**Stacked baseline:** owner-accepted 0.3.11-dev.1 (#406 / draft PR #428) based on 0.3.10 main. This dev.2 build includes dev.1; a new development version is not a production merge or release.

## Scope

The Map Directory summary now groups its name, optional type and read-only unique Road/Map Marker counts into one wrapping identity area, before applicable Add, Locate, visibility, Settings and Edit/Delete actions. The action group stays right aligned. The directory's existing unique-ID projections, filters, sorting, nesting and native details/summary disclosure are unchanged.

**Not changed:** Atlas Scene flags, native Region geometry/Behaviors, Road graph/IDs, Map Marker records, party discovery, World presets, permission checks or Journey persistence. No write occurs on render, filter, expansion or layout changes. #407 draggable canvas editors and other milestone work are separate.

## Owner's Foundry v14 test (backed-up World)

1. Install this test build. In **Atlas Workshop → Map Directory**, inspect the **Continents** heading: `Continents (N) · Map Markers (M) | Roads (R)` is grouped on the left, with Add at the right. Verify the displayed counts against authored records. The numbers shown here are placeholders, never hard-coded.
2. Expand a continent and inspect nested cities, towns and territory rows. Name/type/counts remain adjacent before their actions; nested Roads and Map Markers still use their existing unique-ID membership. An item linked in more than one place must not inflate a single parent's distinct-ID count.
3. Inspect **Other / unclassified** records, a long name, a fully empty grouping and a search/filter result. Counts are unchanged from the preceding build and no controls overlap names.
4. Collapse/reopen groups, change sorting/search, refresh the Workspace, and check that expanded state and filters persist as before. Verify keyboard navigation and focus at normal and **200%** text zoom and with a narrow window.
5. Test Add/Locate/Settings on a permitted item. The actions remain aligned at the right and do not accidentally expand/collapse the row. Confirm standard non-GM authoring restrictions remain intact.
6. Verify no Scene/Region/World writes are caused merely by opening, filtering, expanding or resizing the directory. Do not create or transfer native Territories during this presentation test.

## Automated gates

- Targeted `atlas-scene-workspace` DOM regressions: identity/counts before shortcuts/actions, long-name wrapping CSS, read-only render and native disclosure state after refresh.
- `npm run check`, `npm run architecture:check`, syntax, and `git diff --check` must pass on the implementation branch.
- GitHub CI success (if available) is automation only; GM and non-GM v14 acceptance remains outstanding.

**Stop condition:** If the directory still separates counts from titles, counts differ for shared/nested/filtered records, or a keyboard/action interaction regresses, retain this PR as draft and provide screenshots/logs before proceeding with integration.
