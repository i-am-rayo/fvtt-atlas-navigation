# v0.3.9-beta.8.10 — Territory visibility and native grid test

**Status:** Owner-authorized **draft test build**, stacked on the confirmed
beta.8.9.1.5 native polygon-coordinate hotfix. This is not a stable release or
authorization to merge. Foundry v14 GM/non-GM acceptance is still required.

Manifest:
`https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.10-territory-views/module.json`

Branch ZIP:
`https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.9-beta.8.10-territory-views.zip`

## Safe setup

1. Back up the World or test on a duplicate Paedor Scene; do not first convert
   a campaign-critical Region. Confirm the module shows `0.3.9-beta.8.10`.
2. Use Foundry **v14.370** for native grid/hex testing. Confirm the Scene grid
   is square or hex. Older v14 builds and gridless Scenes must retain polygon
   authoring; there is no automatic conversion of existing Regions.
3. Record the original native Shapes, Color, Behaviors, Levels, visibility,
   and public labels of Hearth's Heart, Dirwest and Valecor for comparison.

## Gate A — Authoring clarity and grid capability

- [ ] Open a native polygon Territory for Atlas editing. Control nodes and
  edge halos stay clearly visible *over Atlas fog* while zooming.
- [ ] Drag a polygon node; Undo and Cancel leave the native Region unchanged.
  Editing a single node does not offset the entire Region.
- [ ] On v14.370 square/hex Scene, create a test Territory: **Paint Native
  Hex/Grid Spaces** is the suggested method. Paint distinct cell clusters,
  Preview & Save, then inspect Foundry's native Shapes tab for `Grid Spaces`.
- [ ] Reopen the saved grid Territory and paint/erase grid cells; confirm its
  native position, color and Behaviors remain intact.
- [ ] On an older v14 test instance or gridless Scene, the unsupported Grid
  Spaces authoring method is unavailable; polygon/Blank Wall methods remain.

## Gate B — GM-only read-only Territory views

- [ ] In **Atlas Scene Workspace → Territories**, choose **Combined**. Broad
  geography (Continent/Area) is outlined below cities/towns/villages; smaller
  Regions are listed first, with native-color swatches.
- [ ] Switch to **Continents**, then **Settlements**. The visible map outlines
  and directory follow the selected tier; return to Combined to access any
  native-only or unclassified Region.
- [ ] Toggle **Show Region names**. Names are readable above fog, and a
  disconnected grid archipelago has only one name anchored on its main island.
- [ ] Click **Locate** for a settlement inside a continent. The canvas pans
  to the settlement; native selection/configuration remains accessible without
  changing the continent Shape or its native z-order.
- [ ] Edit an existing native polygon or grid Region, then use Workspace
  Refresh. Correct boundaries and labels reappear without permanent overlays.
- [ ] Leave Territories, switch Scenes, rebuild/reload the canvas, and close
  the Workspace; the GM preview does not linger, multiply, or cause flicker.
- [ ] On a **separate non-GM client**, confirm no Atlas Territory preview,
  secret native names, or authoring actions become visible.
- [ ] Check ordinary Road/Checkpoint overlays, Atlas fog, and active Journey
  time/Journal state for regressions; no new writes should be caused by a view.

## Intentionally **not** in beta.8.10

- Existing polygon Regions are **not** converted to Grid Spaces automatically.
  Foundry `Highlight Mode` is visual only and is not a Shape conversion.
- Peer/same-tier ownership transfer and tier-aware native geometry override
  are deferred to the separately reviewed Gate C. Parent continent cells and
  native Region Behaviors are never subtracted/overwritten by these views.
- Native Region colors are not re-randomized: Foundry supplies the native
  default. Atlas displays the current color as a matching outline and swatch.

Report the Foundry build, Scene grid type, GM/non-GM result, any screenshots or
console error, and whether the native Shape changed unexpectedly. Leave the
draft PR open pending the Product Owner's live acceptance.
