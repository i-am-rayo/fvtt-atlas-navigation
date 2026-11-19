# Atlas 0.3.11-dev.3 — Territory editor dock and help (#407)

**Milestone 01:** Atlas Workspace & UI/UX Stabilization · **Foundry:** v14 · **Status:** draft, pending owner live GM/non-GM acceptance.

**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/fix/0.3.11-m01-407-territory-editor-dock/module.json

**Archive:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/fix/0.3.11-m01-407-territory-editor-dock.zip

**Stack:** based on owner-accepted **0.3.11-dev.2** (#408 / PR #429), which includes **0.3.11-dev.1** (#406 / PR #428). No prior PR has been merged; this test build is cumulative.

## Scope / diagnosis

The Road and Map Marker creation/movement editors already use the movable `AtlasRoadEditorDock` native ApplicationV2. The Territory grid and polygon editor alone uses a fixed, transient DOM panel. To avoid a second authoring lifecycle, this patch keeps that existing session and adds bounded **title-only pointer dragging**, focusable **arrow-key moving** (Shift+arrow accelerates), and viewport-resize clamping. It does not use canvas drawing input for dock movement. The existing Escape/Cancel/session teardown removes all handlers, releases canvas focus and restores the prior Workspace through its existing lease.

Territory guidance is now a single short purpose sentence at the top and an existing gesture/key table. Its live status reports counts/hover/seam context, not a duplicate list of gestures. Shared-border detail stays near its selector; the explicit long batch destination/ownership warning stays next to Stage actions. Existing Preview & Save, Stage, native Region preflight, revision guard and recovery intent remain authoritative.

**Exclusions:** no new polygon/Hex algorithms, shared-border or transfer semantics, global editor/dragging framework, alternate persistence, Road/Map Marker dock rewrite, or Atlas Manual Fog changes.

## Owner Foundry v14 checklist — backed-up, disposable World

1. Open **Atlas Workshop → Territory boundary painting (grid)**. Confirm a compact, titled dock with a short purpose sentence, one shortcuts table, brush controls and Cancel/Preview & Save actions at the bottom.
2. Drag the **title** to a new location; the native map must not paint or erase any cell. Release and paint on the Scene normally, including Shift-erase, brush size and Undo.
3. Focus the title with Tab and press arrow keys (Shift+arrow for larger moves). Check that the dock moves without adding/erasing cells, changing the current draft, or moving the Scene. Test normal and 200% text zoom, a narrow window, and browser resize: the title remains reachable.
4. Test **polygon node editor**: dragging the title must not move selected nodes or insert points; drag a real node on the map afterwards; confirm right-click deletion and draft Undo still work.
5. Test **shared-boundary assistance** with an eligible neighbor: selector, eligible-cell preview, rejection of conflicting cells, and native ownership review remain in place. No geometry/Region writes should happen from moving the dock.
6. Test a multi-destination **Hex/Grid batch**: verify destination/ownership warnings remain adjacent to Stage, switching destinations preserves staged drafts, and interrupted/native transfer recovery remains unchanged. Do not bypass recovery ledger checks or force a transfer just to test the UI.
7. Test Cancel, Escape, closing/teardown, Scene change, and editor reopening; the same previously minimized Workspace should return when appropriate. Browser developer tools should show no accumulated drag/resize handlers. Verify GM-only authoring and no new controls for a non-GM.
8. Confirm existing **Road create / Road points / Map Marker movement** already use their native movable dock, and that the independent **Atlas Manual Fog** palette still works. This patch intentionally leaves their lifecycle/controls unchanged.

## Automation

- `tests/territory-authoring-canvas.test.mjs` covers grid/polygon drag and keyboard movement, boundary clamping, zero draft/native writes, Escape and handler teardown; existing polygon/grid/stage/Undo/native-Region tests remain required.
- Run `npm run check`, `npm run architecture:check`, syntax and `git diff --check`. Green CI is not live Foundry acceptance.

**Stop condition:** If dragging modifies a draft, steals actual painting input, lets the title disappear after resizing, breaks Stage/Cancel/recovery, or leaves listeners after close, keep the PR in draft and collect the failing action, console evidence and a screenshot.
