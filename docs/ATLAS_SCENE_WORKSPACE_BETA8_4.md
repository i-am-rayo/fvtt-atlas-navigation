# Atlas Scene Workspace — v0.3.9-beta.8.4

## Owner acceptance and request

The owner live-tested beta.8.3.1 in Foundry v14. Territory actions were
functioning, but their horizontal row **beneath** each Region name/status
still consumed too much vertical space. The requested placement is **far right**
in the same row. The next scheduled migration slice is Roads/Topology.

## Implemented

- Territory action controls remain four uniform, accessible buttons, now on
  the far right of the Region name and status, in a compact two-column layout.
  Narrow windows fall back to stacked, wrapped controls rather than overflow.
- Added **Roads & Topology** as a navigable section of the GM Atlas Scene
  Workspace. It renders the **same existing Scene Road/Topology editor** via a
  narrowly focused mode that exits before constructing the unrelated fog and
  territory management views. There is no parallel write pipeline.
- The Road view includes current named-road filtering, create/edit/save/cancel,
  road settings, player visibility, locate, path editing, connection editing,
  merge, checkpoint shortcuts, travel presets, generated corridor Region
  controls, and delete with their established action guards and confirmations.
- Existing road drafts and expanded per-Scene Road UI state remain under the
  same controller/maps; switching Workspace sections does not save or discard.
- Added a direct GM + Scene update permission check on the focused Road panel
  in addition to the Workspace's existing render/open guard. Authority checks
  on actual write actions remain unchanged.
- Original Scene Configuration → Atlas controls stay functional as a fallback
  during owner acceptance. The workspace launcher itself remains only on the
  GM Atlas canvas toolbar (gear icon).

## Data ownership and migration

This is a **presentation migration**, not Scene flag/data migration.
Scene Atlas continues to own authored graph/road/checkpoint records; Foundry
owns native Region geometry/Behaviors, Scene Grid and Token position. No
automated Region geometry edits, schema upgrades, Journal or World-time writes,
or canvas rebuild workaround are introduced.

The focused `roadsOnly` rendering path shares existing road UI source rather
than duplicating it, and returns immediately after the Road controls are
built. Future migrations can extract these controls into smaller presentation
modules before retiring the legacy Scene Atlas tab; do not create a second
road editor state machine.

## Automated verification

- Focused Road/Topology render test checks existing action targets and ensures
  fog/territory controls are not built.
- Existing Scene Atlas Road/Region behavior tests remain unchanged and green.
- Workspace Road navigation and permissions are tested; Territory right-side
  layout is covered by a scoped CSS contract test.
- `npm run check`, `npm run architecture:check`, explicit syntax checks and
  `git diff --check` are required before publishing. Tests are not live v14.

## Live owner checklist — Foundry v14 GM and non-GM

1. Install beta.8.4; open Workspace (Atlas sidebar gear) on a Scene with
   dozens of roads and manual/native Regions.
2. In Territories, verify **name/status on the left** and **four buttons at far
   right on the same row** with no excessive row height. Resize narrowly to
   ensure no clipping or overlay.
3. Open Roads & Topology: confirm named-road filter, selected Road expansion,
   Road settings, visibility, locate, path editing, connections, merge and
   travel preset actions target the correct named road.
4. Begin editing points or connections from Workspace; verify the floating
   Road Editor retains its Save/Cancel/Undo and Locate behaviors. Close the
   Workspace without accidentally committing a draft; resume and cancel safely.
5. Inspect per-road checkpoint shortcuts and generated native corridor Regions.
   Verify native Shapes/Behaviors and existing Road-connected Region IDs remain
   unchanged when merely viewing/refreshing.
6. Switch to Scene Configuration → Atlas. Its legacy Road and checkpoint tools
   should still work; no new duplicate data or unexpected writes.
7. Test Scene change, canvas redraw and reopen; only the correct Scene's roads
   should be shown, and no duplicate Road editing or Journal/world-time events
   may occur.
8. Confirm non-GM clients cannot open authoring Workspace or see GM-only
   controls, and existing player road/checkpoint visibility and Journey banners
   remain unaffected.

## Deferred

Dedicated Checkpoint, Surface and Exploration workspace views remain next.
The Scene Atlas tab will be retired only after those views are owner-tested.
Geographic tier/priority overlap precedence, shared-edge snapping/seam repair,
and 20 km coastal/ocean generation remain separate, deferred designs.
