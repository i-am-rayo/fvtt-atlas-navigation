# v0.3.9-beta.8.10 — Territory grid/layer work plan (owner-approved staged design)

## Evidence and compatibility

The owner passed the beta.8.9.1.5 coordinate regression on Foundry **v14.370**. Foundry v14.370 introduced native Region **Grid Space Shapes** (release 14.370, issue 14924):
https://foundryvtt.com/releases/14.370

The official native `RegionData` API documents both the Region `color` (random by default) and `highlightMode` (either `shapes` or `coverage`):
https://foundryvtt.com/api/interfaces/foundry.documents.types.RegionData.html

The `highlightMode` flag changes *visual presentation only*. It does not convert a polygon's native `shapes` to a `type:"grid"` Shape with editable `offsets`. Native `color` already defaults to random; Atlas should not replace or reseed existing native colors.

Keep `module.json` compatible with v14 generally. At runtime, offer native Grid Space authoring as the preferred creation method only on a square/hex Scene when the public `foundry.data.GridShapeData` capability is present (first available in v14.370). Earlier v14 builds and gridless Scenes retain node/polygon authoring and selected Blank Wall import. **Do not automatically alter authored Regions based on version.**

## Scoped first implementation (owner-authorized test candidate; Foundry live test pending)

1. The disposable **GM-only** authoring graphics now mount in `canvas.interface`, the same canvas group used by Atlas roads/checkpoints, *above* Atlas's PrimaryCanvas fog; outlines have contrast halos and brighter strokes, while nodes have larger zoom-adjusted, high-contrast centers/halos. Keep pointer hit testing, Undo/Cancel/Save and teardown unchanged.
2. On supported square/hex v14.370+ Scenes, `Create Atlas Territory` defaults to **Paint Native Hex/Grid Spaces**. The GM may still select polygon nodes or selected Blank Walls. On older builds/gridless Scenes, only supported methods appear, with an explanation. Use capability detection, not a hardcoded version comparison.
3. Native random `RegionData.color` remains untouched. Existing styles/Behaviors are never changed by opening or editing Atlas drafts.

## Gate B implementation (owner-authorized test candidate; Foundry live test pending)

- The Scene Workspace now has **Combined**, **Continents** (including Area), and
  **Settlements** (City, Town, Village) views. The Region directory is sorted
  settlements-first in Combined so small geography stays reachable; native-only,
  unclassified, and unsupported records stay accessible in Combined.
- A disposable GM-only overlay renders outlines from native
  `RegionDocument.polygons` in the `canvas.interface` group, above Atlas fog.
  Continental/Area boundaries render before settlement boundaries. This is
  display order **only**, not a change in native Region order, saved Shape data,
  occupancy, visibility, Highlight Mode, or Behavior priority. Large/invalid
  native polygons fail closed under capped draw budgets.
- Optional native Region names are rendered once per Region on the GM canvas;
  zoom adjusts label size. On navigation away from Territories, closure,
  canvas teardown or role loss, temporary graphics are removed. Foundry
  Region and canvas Hooks refresh/cleanup the transient preview.
- A **Locate** button pans to each native Region by its documented native
  bounds; **Configure** still opens native Region settings. This provides
  reliable selection of a settlement obscured by a continent without mutating
  native z-order. Native color swatches distinguish directory rows and matching
  map outlines. Directory and overlay never write on read.
- The legacy Atlas Scene Configuration panel retains its original native
  Region controls. README deliberately remains unchanged. The authorized
  beta.8.10 test build updates package/manifest URLs only on its own branch.

## Remaining requested functionality (separate authoring and presentation gates)

| Owner request | Recommended contract and safe gate |
| --- | --- |
| Migrate drawn Regions to native grid/hex | **Opt-in, GM-confirmed conversion** of one native polygon Shape to one native Grid Shape. Preview original outline over candidate exact grid spaces and report changed area/cell count, coverage threshold and containment conflicts; preserve Region ID, Behaviors, Levels, appearance, links and public names. No batch or read-time migration. Refuse holes/multiple shapes until supported. |
| Override by geography tier | Separate **view precedence** from native gameplay geometry. Continent + its City/Town/Village may overlap intentionally and remain physically contained. Peer conflicts within the same tier are detected; changes to peer ownership require an explicit reviewed cell-transfer plan with stale checks and recovery, never automatic subtraction from another Region. |
| Continent/settlement/combined views | Provide a **GM-only Atlas Territory overlay/read model** with `Continents`, `Settlements`, `Combined`; native Region geometry remains authoritative and native visibility settings/player data remain unchanged. Combined displays settlements over continents. Filtering must be local, reversible and cleaned up on canvas rebuild/Scene change. |
| Region names | Optional accessible labels centered or anchored to visible territory coverage; bound label density and avoid duplicate labels for disconnected islands. Player-visible labels require explicit publication/permission and cannot leak private Region names. |
| Native selection / z-order | The Atlas editor should offer **Select/Locate Region** from its own directory, regardless of native canvas overlap. Do not reorder native Region documents or alter native collision/Behavior priority to solve appearance; use Atlas overlay z-order and clear selection paths. |
| Disconnected landmasses | Multiple disjoint native Grid offsets are a valid Atlas grid-draft model; preserve one Region ID. Authoring must tolerate painting separate cell clusters. The existing node editor is intentionally one simple polygon ring, so native multi-shape polygons are **not yet** editable via Atlas; preserve them and explain their limitation. |

## Proposed release gates

### Gate A — Safe authoring default and visual control clarity

- Test supported .370 square and hex Scenes: grid method selected by default, native grid shape saved at correct offsets, polygon selectable, Cancel no writes.
- Test pre-.370 native feature absent and gridless Scene: no unsupported grid method; polygon and Blank Wall creation remain available.
- Confirm node/line layer visible over Atlas GM fog, especially zoomed-out; Road/Checkpoint overlays unaffected; pointer capture and window restoration unchanged.
- Confirm no native shape/color/Behavior changes when viewing or cancelling.
- Non-GM never opens the editor; cleanup after Scene refresh/closure.

### Gate B — Non-destructive visualization and hierarchy (automated PASS; live pending)

- GM-only three-view outline overlay + optional region-name labels; combined render order = continent under settlements. Native visibility and opacity remain unchanged; private native names are never distributed to players.
- Native color swatches and optional labels identify peers; same-tier geometry conflicts are **not** resolved by these read-only views. Older v14 polygon Regions remain supported, and every Region is available through Atlas directory Locate even if native geometry overlaps.

**Owner live acceptance for Gate B:** On v14.370, classify one broad Region
and two settlements including a disjoint grid/island Shape. Open the Atlas
Workspace and confirm Combined / Continents / Settlements list and canvas
outlines, contrast over fog, optional names, and Locate. Confirm a continent
does not prevent selecting a settlement through Atlas. Test a v14 polygon
Region, native-only/unclassified Region accessibility in Combined, native
Region edit then Workspace Refresh, canvas rebuild and scene switch, Workspace
close, and a separate non-GM client. Verify native Shapes, Behaviors, colors,
visibility, Levels and Journey data remain exactly unchanged.

### Gate C — Conversion and transfers (requires a separate approval of conversion semantics)

- Preview grid conversion using native Scene Grid geometry, an explicit, consistent inclusion rule (e.g. cell center covered vs majority of cell area), and a maximum cell-budget/area-error report.
- An *individual* GM-approved single-Region save may replace Shape geometry and update versioned Atlas provenance only after validating current native Shape digest, Scene grid identity, geography, permissions and Region Behaviors preservation; keep a World backup/export recovery path.
- A settlement may visually supersede its parent Continent without destroying any parent cells. To change two same-tier Regions, stage an explicit **multi-document transfer with recoverable intent**; do not treat canvas previews as atomic native writes.
- Unsupported feature versions or grid changes fail closed without any native edits.

### beta.8.12 — Gate C inspection-only slice (automated and owner live tested)

- The reported Reshara native green `#4d972b` must remain green in Atlas. Atlas
  now resolves the native Region's public Appearance color for hex strings and
  Foundry number-backed Color values; unknown values never silently render as
  the old amber fallback. The GM palette shows the resolved native color or an
  explicit unavailable message. Atlas does not write/change native colors.
- A selected, linked, classified native Region with **one ordinary polygon
  Shape** offers `Preview converting this selected native polygon Region to
  grid/hex (no changes)` in the Territory directory. This calls native
  `BaseGrid#getOffsetRange`, `getCenterPoint` and `PolygonTree#testPoint` with
  an explicit **cell-center inclusion rule**, bounded to 6,000 candidate cells
  and 30,000 inspected cells. The cyan candidate cells and original orange
  contour render transiently in `canvas.interface` above fog; they are removed
  when the dialog closes or the canvas tears down.
- The preview reports the candidate cell count, **net** native pixel area
  change (not a symmetric-difference error), and candidate-center conflicts
  with peers of the **same tier**. Nested parent Continent + settlement overlap
  remains intentional. Candidate-center checks are only informative: before a
  later Save, actual native cell/peer intersections and parent containment
  still need exact validation and reviewed transfer decisions.
- No conversion writes or peer transfers occur in this candidate. Native
  Region IDs, Shapes, Levels, Behaviors, colors, flags, Atlas journey state and
  stored Roads/Checkpoints are not modified. Multi-shape Regions, holes,
  gridless Scenes, older v14 without GridShapeData and excessive candidates
  are refused explicitly.

**Owner live checklist for beta.8.12:**

1. Open native Region Reshara with green `#4d972b`; verify both Atlas Region
   color swatch and map outline/fill show the same green. Change its native
   Appearance color; verify Atlas updates without requiring a Scene reload.
2. Select the existing drawn/polygon Region in the Territory directory and
   use its hexagon conversion-preview action. Cyan native cells should follow
   center coverage; orange lines should trace original shape; close the dialog
   and verify no cyan cells remain and no native Shape has changed.
3. Preview a Continent containing a Town, then a same-tier overlapping peer:
   Town/Continent nesting must remain allowed; same-tier candidate-center
   conflicts should be reported rather than transferred.
4. Confirm the feature is unavailable/refuses gracefully on older v14,
   gridless Scenes, holes, multiple native Shapes and oversized candidates.
   Test canvas refresh/switch and non-GM; check that native Behaviors, fog,
   roads and Journeys remain unaffected.

**Owner feedback for beta.8.12:** Native Region colors, candidate coverage and
the grid preview passed live inspection. The first startup reported an Atlas
resource request `net::ERR_FAILED` and separate `simple-quest`/`betterroofs`
errors; restart succeeded. Reproduce/diagnose the Atlas request before making
changes to its startup lifecycle. The Workspace obscured the conversion preview;
the preview intentionally offered no Save in beta.8.12.

### beta.8.13 — Gate C single-Region conversion commit (automated and owner live tested)

- The conversion preview now uses Atlas's shared ApplicationV2 canvas-editor
  focus helper to **minimize the Workspace and other visible windows**. It
  restores only windows Atlas minimized when the preview/save flow closes;
  pre-minimized windows stay minimized. The cyan/orange preview remains
  transient and read-only until the GM explicitly confirms conversion in a
  second dialog.
- The **Convert Selected Region** action rechecks GM Scene/Region write
  permissions, active Scene grid identity, original native Shape, original
  Atlas boundary source, linked geography, candidate cells and name. The
  existing native coverage validator checks **full cell geometry** against
  same-tier peers and containment within a parent Region. A center-only
  conflict preview is never enough to authorize a Save.
- If all checks pass, one `RegionDocument.update` replaces only the selected
  native polygon with a native Grid Shape and stores a schema-versioned backup
  of the original polygon and Atlas boundary controls **in the same update**.
  The native Region ID, appearance/color, opacity, Levels, Behaviors, parent
  association, label and all other Region documents are left intact. Because
  native geometry changes, Foundry may legitimately re-evaluate native Region
  Behaviors/token membership after conversion.
- A converted Region gains a **Restore backed-up native polygon** action. It
  requires another GM confirmation, the same Scene grid identity, the unchanged
  native converted Shape/source, and current exact peer/parent validations.
  One native document update restores the original polygon/source and clears
  the backup. A changed grid, post-conversion manual geometry/source edit,
  conflicting peer, invalid backup, missing permission or unsupported version
  **blocks restoration rather than overwriting later work**.
- Intentionally **not implemented**: same-tier cell transfers, automatic peer
  subtraction, multi-Region edits, conversions of Shapes with holes/multiple
  Shapes, a World export archive, or automatic conversion of a whole Scene.
  These need an independently approved recoverable multi-document transaction
  design. A per-Region backup is not a substitute for external World backups.

**Owner live checklist for beta.8.13 (Foundry v14.370+):**

1. Open the Atlas Workspace, Territories, then a drawn/polygon Region such as
   Hearth's Heart. Click the hexagon. Confirm Atlas Workspace minimizes,
   cyan cells and orange original contour are visible, and closing the preview
   restores exactly the windows that Atlas minimized. Cancelling must not edit
   anything.
2. Repeat and explicitly approve both dialogs. Confirm the selected native
   Foundry Region now contains a Grid Shape (not its old Polygon Shape); compare
   count and contour with the preview. Native ID, color, Behaviors, Levels,
   visibility and geography remain unchanged. Confirm nested settlement and
   continent Regions, fog, Roads and Journey data are unaffected.
3. Use the **Restore backed-up native polygon** action; confirm it brings back
   the original native Shape and Atlas edit controls. Verify Atlas Layers keep
   native colors. Check canvas refresh/reload and Window restore/minimize.
4. Re-preview a Region with same-tier overlap: the Save must refuse any full
   geometric intersection, even if the candidate centers appear clear. Check
   an ineligible/older gridless Scene and a non-GM client: they must not gain
   authoring authority. Test a mid-journey session is blocked.
5. Re-test first startup and script resource loads with cache disabled: report
   Atlas `ERR_FAILED` URLs separately from `simple-quest` and `betterroofs`
   exception stacks, including whether problems recur after restart.

**Next Gate C slice (deferred):** an explicit GM-reviewed peer-to-peer grid
cell transfer requires staged multi-document intent, conflict resolution,
backup/export recovery and idempotent crash recovery; never infer permission
to modify a peer from converting the selected Region.

### beta.8.14 — Continent hierarchy and recoverable grid-cell transfer (automated; owner live pending)

- The GM's Territories directory uses the **existing Atlas geography hierarchy**
  (including confirmed automatic continent inference) to group named Continent
  rows above their Children. Each Continent **retains the complete native Region
  action row**; children are nested and groups can be collapsed. Regions with
  missing/unclassified/invalid parents remain reachable under **Uncategorized**.
  The grouping does not persist inferred parents, rewrite geography or create
  duplicate native Regions.
- In **Edit Atlas Territory control nodes or painted grid cells**, adding a
  grid cell already owned by exactly one **same-tier, linked, manually authored
  native grid Region** now presents an **additional GM approval** naming the
  source and target, moved cell count and both proposed totals. This is not a
  silent subtraction. Only actual newly painted cells can be claimed. A
  transfer may move at most 500 cells, and cannot empty the source. A candidate
  spanning multiple same-tier owners, overlapping a polygon peer, exceeding
  authoring budgets or leaving the selected parent's bounds is rejected.
- Both proposed native Grid Shapes are checked against Foundry's live grid,
  other peer Regions and parent containment before an intent is persisted. A
  **schema-versioned Scene transfer intent** records before/after Shapes and
  Atlas boundary sources. Atlas writes this intent **first**, then removes
  cells from the source, then adds them to the selected target; it clears the
  intent only after both native documents complete. Native ID, Behaviors,
  colors, Levels, parent geography and unrelated flags are never authored by
  this workflow.
- If any write fails or the World is interrupted, the intent remains available
  as **Resume / Roll Back Transfer** in the Workspace. Neither action runs
  automatically. Both validate permissions, unchanged Scene grid, unchanged
  native before/after snapshots, current parent/peer geometry and intended
  final ownership. Rollback removes target ownership before restoring source
  ownership. An unexpected native edit fails closed for GM investigation.
  Regular Atlas native Shape editing refuses to operate while an intent is
  pending. Manual native Foundry edits remain outside Atlas's control and can
  prevent safe automatic recovery.
- **Conversion backup interaction:** an earlier saved polygon-conversion backup
  is retained, but its Restore operation can be blocked after a transfer.
  A completed transfer no longer has a pending intent, so it has no one-click
  Roll Back; any reverse ownership edit requires a new reviewed transfer or
  recovery from an external World backup before restoring the old polygon.
  This limitation is explicitly shown in the transfer approval; no backup is
  silently discarded.
- **Not a single atomic Foundry transaction:** a Scene and two Region documents
  are persisted independently. This release deliberately uses durable intent
  and explicit recovery rather than claiming unavailable multi-document
  atomicity. Always back up the World before live editing. Transfer intents
  must not be treated as a player-facing data source; only the GM UI reads
  them. Per-Scene intent storage and large-region transfer performance should
  receive owner live stress/permission acceptance before general release.

**Owner live checklist for beta.8.14 (Foundry v14.370+):**

1. Confirm Valecor and Reshara appear as expandable Continent categories,
   with Dirwest/Millstone under Valecor and The Eyrie under Reshara. Verify
   native settings, Locate, labels, conversion and other actions still work
   for each parent and child. An unparented Region belongs to Uncategorized.
   Reopen the Workspace and confirm that collapsed groups retain their state.
2. On a **backed-up World**, choose two adjacent native grid Territories of
   the **same tier**. Edit the intended receiving Region and paint a few cells
   already belonging to the source Region. Confirm Atlas shows source, target,
   counts and a separate transfer authorization. Cancel and confirm both
   native Shapes remain unchanged; approve and verify only the selected cells
   switch owners. Source and target colors, IDs and Behaviors stay unchanged.
3. Try adding cells belonging to two different peers in one Save, painting
   across an unrelated polygon Region, leaving a source empty and crossing
   parent Continent bounds. Each must refuse safely with no unintended write.
4. Verify Scene reload, native Regions, Atlas Layers, fog, Roads, Journey data,
   non-GM permissions and canvas refresh. If a native update fails, stop
   further editing and use **Resume / Roll Back Transfer** in the Workspace.
   Test this failure path in a disposable test World; ordinary successful
   transactions should not leave a recovery banner.

## Explicitly out of scope until approved

- Silently converting all existing polygon Regions, automatically deleting parent Continent cells, conflating native Highlight Mode with saved Grid Shape conversion, generating duplicate native Regions, or changing native Behaviors to enforce hierarchy.
- Dropping polygon / Blank Wall support for older v14 versions or GMs who prefer exact authored contours.
- Merging the beta.8.10 draft PR or publishing a stable release before owner
  Foundry GM and non-GM acceptance. This is an **owner-authorized test build**,
  not a Foundry-live-verified release.
### beta.8.15 — Transfer progress, Layers sizing and Road classification (owner test)

- The Paint Territory panel switches from editing actions to a four-stage progress
  indicator after the GM approves a two-Region transfer. The recovery intent is
  persisted before native Region writes; errors restore the editor controls and
  leave any interrupted transfer available for explicit recovery.
- The Atlas Layers window opens at 430 × 620, with scrollable content. Native
  Region color editing remains in Foundry Region Configuration and is removed
  from this display-only palette.
- The Roads directory samples native RegionDocument.testPoint geometry when
  available, including native grid Shapes (rather than treating grids as empty).
- Transfer recovery clears its completed Scene flag through native unsetFlag.

**GM acceptance:** Verify progress is visible while a transferred-cell update is
pending; a failure leaves the recovery action available; Atlas Layers scrolls on
short displays; existing polygon and converted grid territories both classify
Roads correctly. Recheck native Region colors and Behaviors, canvas refresh,
and Journey continuity. Do not force a partial write in a primary World.

**Deferred:** Player territory geometry requires a separately reviewed GM
permission/publication contract; Public Territory currently covers a banner
label only. Polygon/multi-owner transfers and checkpoint–Region linking need
their own schema and recovery gates. No stable release or merge before owner
live Foundry v14 acceptance.

### beta.8.15.1 — Road containment and transfer progress visibility hotfix

- Road hierarchy membership now asks the native Region's 2D `polygonTree`
  for point containment (including native grid Shapes and holes), not the
  elevation-aware `RegionDocument.testPoint` with undefined elevation. A
  compatible fallback supplies an explicit elevation if required.
- Capped Road sampling now distributes the fixed point budget across the
  entire polyline instead of ignoring distant sections after the first 1024
  points. This is read-only and never changes road topology or Region Shapes.
- Paint Territory's transfer progress now hides every editing control,
  including brush radius, retains a stable minimum-size panel, and restores
  the editor on error. Its hidden attribute no longer suppresses the progress
  display. A visible validation stage starts immediately after confirmation.

**Owner test:** Open Paedor Roads and confirm Valecor/Reshara and their towns
receive automatically inferred road membership and Unclassified no longer
shows all 44. Check a long Road crossing more than one Region, plus Road
membership overrides. Transfer a few cells and confirm a readable progress
bar replaces the brush controls; cancellation and recovery remain safe.
Foundry v14 live results and player permissions remain pending.

