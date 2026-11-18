# v0.3.9-beta.8.30 — Consolidated Territory Settings and generator lifecycle

**Status:** stacked draft, awaiting live Foundry v14 GM and player acceptance. No changes to persisted schemas or native Region Behaviors.

## What changed

- **Atlas Workspace → Territories** keeps a compact **Settings** gear and optional **Locate** shortcut per geographic/native Territory. The previous many-button row is now a single modeless, resizable, minimizable **Atlas — {Territory Name} — Territory Settings** window.
- Four tabs retain the previous operations and their original GM gates: **General** (native sheet, kind/parent/Road associations, Atlas link and Locate), **Checkpoint & Journal** (bidirectional Checkpoint association and access to the linked Checkpoint's existing Journal/editor), **Map & Visibility** (independent public Journey name and player boundary permissions), **Boundary & Native** (canvas editing, polygon→grid conversion, grid→polygon recovery, native-boundary adoption and previewed smoothing). No Region, Scene, Checkpoint or Journal change happens merely from opening or switching tabs.
- One window per Scene and native Region is reused; switching tabs preserves the selected section. Canvas editors may minimize it, as with Checkpoint and Road Settings.
- After a newly created settlement Checkpoint is **successfully** linked to an existing geographic Territory, or its optional matching one-cell Territory is created, Atlas closes only the matching automatic **Generate Terrain Region** window. Cancelling the picker or choosing Skip leaves it alone.
- The legacy generator itself is minimizable; native Region **Preview & Confirm** minimizes it for canvas inspection, restores it on Cancel, and closes it only after a successful native Region creation.
- The completed, owner-tested GitHub issues [#288](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/288) and [#290](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/290) are closed. This milestone's [#293](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/293), [#301](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/301) and generator UX [#186](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/186) stay open until verified in Foundry.

## Live acceptance checklist

1. With two Territories, open both Settings windows, change tabs, minimize/restore, and confirm the correct **name** remains in each title. Close/reopen one window and confirm it does not affect the other.
2. Open the General tab of a classified linked City/Town/Settlement; launch native Region settings, Classification, and Atlas association. Confirm they still show their review gates and do not change native Shapes or Behaviors without a separately approved action.
3. From Checkpoint & Journal, link a same-kind Checkpoint, inspect the linked Journal, and change/remove the Checkpoint link. Confirm a missing Journal shows a useful message and a cancelled link does not change anything.
4. In Map & Visibility, toggle the public Journey name and player boundary independently. Use a separate player client to verify unrevealed Territory silhouettes remain **under both native and Atlas manual fog**.
5. In Boundary & Native, check polygon conversion/restore, adoption of externally modified Shapes, smoothing preview/cancel, and Paint editor. Confirm transfer recovery and staged batch restrictions are still honored. No movement cost or Region Behavior is changed.
6. Create a new **Town** Checkpoint, select **Link Existing**, approve a matching Territory, and confirm the legacy **Generate Terrain Region** window closes. Repeat with **Cancel** and **Skip**; neither may incorrectly create a native Region or alter an existing link.
7. Independently open the legacy generator, click **Preview & Confirm**, and verify it minimizes for preview. Cancel should restore it; successful native creation should close it. Refresh and switch Scenes to check for orphaned windows.
8. Verify a non-GM has no Territory authoring Settings window or write actions. Verify native/Journey fog and long guided travel remain unchanged.

## Automated evidence

`npm test`: 946/946 passing, including new Territory window/tab/permission and generator isolation tests. Native Foundry v14 and two-client tests remain outstanding.

## Deferred

Typography/defaults [#295](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/295), label icon prefix [#294](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/294), cross-boundary polygon tools [#264](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/264), privacy hardening [#269](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/269) and full Checkpoint-Journal association behavior [#291](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/291) remain separately tracked. The Settings UI reuses existing editors rather than merging their native write logic.
