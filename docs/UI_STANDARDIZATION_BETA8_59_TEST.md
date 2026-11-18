# Atlas v0.3.9-beta.8.59 — Map Marker UI owner-test candidate

**Status:** draft, unmerged, not a stable release. This is a **partial implementation** of PR #376's 27 requirements, not a claim that all items are accepted. The owner-live-accepted base is beta.8.57; beta.8.58 was automatically checked but is not independently owner-live-accepted. Test in a backed-up Foundry **v14 Sandbox World**, not production.

## Stacked source and change boundaries

- #377: generic UI Map Marker terminology, unchanged internal `checkpoint` schema/API keys and literal Security Checkpoint category, centered Workspace navigation.
- #378: geographic display grouping, stable-ID counting, accessible search/sort/category filters, actionable Road marker relationships and retained unique advanced operations.
- #379: existing Road-point session redo and modeless Map Marker placement/movement dock with existing confirmation and native window focus ownership.
- #380: compact client-only Atlas Layers, Road/Terrain/Corridor explanations, CSS samples, shared transportation action icons.
- #381: inline retained Road border/name-color inputs and SVG Road preview name 18 units above its illustrated path; DOM-only update even for DialogV2-cloned New Road form.
- #382: bordered Map Markers/Regions lists with stable count legends, honest empty states and the existing priority order; Road/Map Marker tab content scrolls separately from bottom footers.
- #383: GM-only **Add Atlas Map Marker** Scene-control tool delegates to the exact existing confirmed creation workflow.
- #384: annotation 23 Road/Territory subtitle design proposal **only**; no runtime metadata or player projection change.

All changes retain native Foundry v14 Scene/Grid/Region/Token/Actor/Journal ownership; Journey preview/approval/commit and World time/resource logic are untouched. Road graph/topology and Map Marker internal IDs are not migrated.

## Owner live acceptance — GM, then non-GM

1. Verify installed module reports **0.3.9-beta.8.59** and Foundry **v14**. Keep beta.8.57 manifest as recovery baseline.
2. Open Atlas Workspace at normal/200% text zoom and narrow width. Labels center vertically, focus outlines remain visible, existing Scene Settings, Road Settings and Map Marker Settings open correctly; no exceptions.
3. Check **Map Directory** for multi-continent/nested/overlapping geography, independent Map Markers, unclassified Roads, zero-items and shared Road/Marker references. Expand/collapse by pointer and keyboard; parent actions stay attached. A–Z/Z–A sorts display only; filter/search/selection survive view changes. Unique counts agree with displayed subsets; no Region priority changes.
4. In **All Map Markers**, verify Security Checkpoint is a legitimate *category* but the generic entity is called Map Marker throughout editor, tooltips and banners. Gear changes name/settings; pencil starts Move on map. Confirm no duplicate name-edit workflow.
5. Start Road point editing; inspect help, Locate, Save icon and Undo/Redo (including keyboard shortcuts outside inputs). Verify edit→Undo→Redo, multiple steps, and new edit after Undo clears Redo. Cancel discards; an explicit Save commits once and stale revisions fail safely. Try cancel, Escape and header close. Check Workspace restoration without resurrecting a user-closed window.
6. Start standalone Map Marker creation and movement. Check compact dock, optional Locate, explicit confirmation and Cancel/Escape; moving near/on a Road offers only authorized attach choices, never silently connects or moves shared graph nodes. Use an owner-approved disposable marker for persistence tests only.
7. Use the new GM Scene-control **Add Atlas Map Marker** next to Draw Atlas Road. Verify it enters the *same* creation workflow as Workspace, with no extra authoring owner; cancel on empty Scene and Road snap; non-GM must not see this control.
8. Open **Atlas Layers** GM and player. Confirm compact spacing, explanations for Road/Terrain/Corridor, readable decorative samples, keyboard selection, no native Region modifications. Player visibility/hidden Region controls remain permission filtered. Test 200% zoom/narrow window. In World transportation settings, check Add Land/Water/Air plus icons match other 2rem targets and remain accessible.
9. Existing Road **Customization**: the border enable checkbox and its color swatch share one row; swatch remains visible/changeable when Off. Turn On and confirm the chosen swatch restores. Road name mode and color are grouped. Compare the SVG name *above* the sample Road to the actual Scene label at 1× zoom and other zooms; test Off/Hover/Always, opacity 10%/35%/100%, fractional width, pattern, border and explicit Save/Cancel. New Road DialogV2 cloned controls should also update its preview.
10. Road Settings **Map Markers (count) [+]** and **Regions (count) [+]** are bordered; headers remain above their lists, empty sections have text, Map Markers sort by name only in UI, native generated Regions stay in authored priority sequence and drag reorder remains explicit GM action with its existing guards. Locate/Settings/Delete/Regenerate actions preserve existing confirmation and native Behaviors.
11. Resize Road and Map Marker Settings at normal/200% zoom; change between short and long tabs. Confirm footer remains at the **window bottom** (not desktop bottom), and content scrolls without covering Save/Cancel/Delete. Check dirty header X/Continue editing/Discard, invalid Save, GM stale revision conflicts and keyboard focus; no duplicate writes. Other Atlas editor footer standardization is not claimed complete.
12. Non-GM verification: invisible Roads/Map Markers, unpublished/native-hidden Territories and linked Journal details do not appear through new directory counts, search, tools, preview or labels. Existing published data remains visible only under its existing permissions. Fog, native Region priority, Journey/Token/Actor/World time/recovery must stay unchanged.

## Evidence to return

Provide successful/failed outcomes for each numbered check, screenshots of: Workspace navigation at 200%, directory collapsed/expanded and search/sort, Road-point editor Undo/Redo and marker movement dock, new GM Scene tool, Layers, Road preview beside Scene canvas, and the **full Road/Map Marker windows** with short and long tab content. Include Foundry build, installed module version and relevant console stack trace if a check fails.

**Failure rule:** If Save/Cancel, lifecycle, Scene data integrity, hidden metadata, or native Region priority fails, stop dependent UI stabilization and diagnose the actual path before a new test manifest.

## Explicitly incomplete or approval-gated

- PR #376 **annotation 23** Road territory subtitle is a separate proposal in `docs/ROAD_TERRITORY_BANNER_DESIGN_BETA8_59.md`. No dynamic Region label metadata has been implemented. Owner must select point/explicit/list semantics, GM vs player audience and hover rules before this can proceed.
- Full Atlas-wide inventory of every search, selector, inherited color group, footer, empty state and obsolete literal remains open. The current changes cover the audited Workspace, main Road/Map Marker editors, Layers and transport controls.
- Real Foundry v14 verification is still required for any new editor/dock focus or footer behavior; automated tests are not live acceptance.
- A production install, merge, release or data migration requires a new explicit owner authorization.

## Manifest / rollback

New manifest:
https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.59-map-markers-ui/module.json

New source archive:
https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.9-beta.8.59-map-markers-ui.zip

Previous **owner-accepted** beta.8.57 manifest:
https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.57-footer-ui/module.json
