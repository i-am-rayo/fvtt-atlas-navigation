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

### beta.8.12 candidate — Gate C inspection-only slice (automated test; owner live pending)

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

**Next separate Gate C authoring slice (not implemented):** approved native
conversion commit with a recoverable backup, exact native-geometry/digest
revalidation and safe rollback; peer-to-peer transfer requires explicit GM
approval and a robust multi-document recovery protocol. Do not infer consent
to transfer from selecting the conversion target.

## Explicitly out of scope until approved

- Silently converting all existing polygon Regions, automatically deleting parent Continent cells, conflating native Highlight Mode with saved Grid Shape conversion, generating duplicate native Regions, or changing native Behaviors to enforce hierarchy.
- Dropping polygon / Blank Wall support for older v14 versions or GMs who prefer exact authored contours.
- Merging the beta.8.10 draft PR or publishing a stable release before owner
  Foundry GM and non-GM acceptance. This is an **owner-authorized test build**,
  not a Foundry-live-verified release.
