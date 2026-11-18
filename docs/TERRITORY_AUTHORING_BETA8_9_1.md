# v0.3.9-beta.8.9.1 — Atlas Territory boundary authoring (stacked draft)

## Scope and user-approved decisions

After the successful beta.8.8 Continent-parent inference test and the beta.8.9
peer-overlap preview/trim milestone, the owner approved **Atlas control nodes as
the primary Territory drawing method**, a **native square/hex cell brush as a
secondary method**, and **selected native Blank Wall import** as a convenience.

**This build is the initial GM-only single-Region authoring slice.** It does
not yet perform automatic paired-border splitting, transfer a painted cell
between competing Regions, move a neighboring boundary on node drag, construct
shared-border ownership, or provide atomic multi-Region save/rollback. Those
operations require a separate topology/multi-document transaction milestone.

## Boundaries and ownership

- `territory-authoring-model.js`: pure polygon control-node validation,
  simple-ring checks, closed Blank Wall import, grid offset validation,
  add/erase and exact grid-grid conflict detection. Limits: 3–256 control
  nodes, 1–6,000 painted native cells. Malformed rings, self-intersections,
  disconnected/branched Walls and non-Blank Walls fail closed.
- `territory-authoring-canvas.js`: one disposable GM canvas editor (click to
  add or insert nodes, drag existing nodes, select/delete a node, optional
  smoothing, grid add/erase and up to three brush rings, staged Undo/Cancel,
  explicit Save). It creates **no** native document until confirmation.
  Preview graphics and capture listeners are cleaned on cancel, Scene teardown
  and session termination. Smoothing projects from unsmoothed source nodes;
  the control ring is never replaced with additional smoothed vertices.
- `territory-authoring.js`: Foundry v14 adapter. Reads a supported existing
  Atlas-linked one-Shape Region without writing. A confirmed GM save changes
  **exactly one** native `RegionDocument` Shape and its opt-in versioned Atlas
  source/geography flags. Native Regions continue to own Shapes, Levels,
  Behaviors, visibility and gameplay applicability. Existing Region IDs and
  unrelated flags survive editing. Existing manually authored native Regions
  and native Wall documents are not edited on read/import.
- Atlas stores polygon control nodes relative to the Scene **image origin**
  (`coordinateSpace: scene-image`) and projects them to native canvas positions
  during editing. Grid-painted Shape offsets deliberately use Foundry's native
  square/hex grid addresses; Scene grid/padding changes require live acceptance
  and no silent automatic rewriting of native Shapes.
- The GM's selected Blank Walls are checked for all-zero movement, sight,
  light and sound restrictions and absence of doors. The resulting native
  Region is a snapshot of a **single closed ring**. Wall IDs are remembered in
  Atlas source metadata for future re-import; no ongoing Wall→Region sync,
  hidden Wall mutation, duplicate gameplay collision, or auto-smoothing of
  Walls is implied.
- The save gate checks Scene/Region edit authority, Atlas-generated corridor
  provenance, native Shape staleness, Atlas source consistency, valid geography
  hierarchy, 100% containment in a selected parent, and zero positive-area
  intersection against same-tier peers. In v14 native Region geometry the
  grid-cell tests use Scene Grid offsets and native polygon intersections;
  complex cases beyond the bounded comparison budget refuse rather than save.
  Settlement-without-parent remains possible for existing data; the new
  creation dialog requires choosing a parent when one is available.
- The beta.8.9 read-only border analyzer now reports grid-related peer
  intersections, but disables its polygon-only trim action for them. Atlas
  source-owned polygon Regions also cannot be one-sided trimmed outside their
  authoring source. The GM must explicitly edit the control nodes/cells.
- Only safe counts/modes/diagnostics go to the optional Atlas Verbose console.
  No GM-only geographic names/coordinates are printed for players.

## Not implemented in this draft

1. **Paired/shared edges and auto-delimitation:** moving a common control node
   must eventually produce a coordinated two-or-more-Region preview with
   revision-checked, recoverable GM-approved saves. Neighboring Regions cannot
   be unilaterally overwritten merely because an outline overlaps.
2. **Native cell transfers:** painting a cell already owned by a peer currently
   rejects the save. Future explicit transfer must show before/after ownership
   and handle stale data atomically or with a durable recoverable intent.
3. **Live linked Walls:** source metadata records IDs only. GM Wall edits do
   not currently refresh native Region Shapes automatically; a future explicit
   re-import must validate the whole closed ring again.
4. **Geography masks across grids:** grid/hex coordinates are native Scene
   data and may need an explicit grid-origin migration when Scene grid
   configuration or padding is changed. No automatic migration here.
5. **Multi-Shape/hole/island editors** and **Region Behavior creation** are
   deferred. Existing unsupported native Regions are preserved untouched.

## Owner Foundry v14.370+ acceptance checklist

Use a **backed-up test World**, Paedor Scene, and GM + non-GM clients.

1. Open **Atlas Workspace → Territories → [+]**. Select *Draw Atlas
   Boundary Nodes*, enter Dirwest, Town and parent Valecor; click at least
   three boundary vertices. Insert by clicking an edge, drag a control point,
   delete a selected point, Undo, and Cancel. After Cancel, confirm no Region
   was created or changed. Reopen, set Gentle then Moderate smoothing, preview,
   approve, and check one native polygon Region has valid Shapes and Atlas
   metadata; no native Behaviors were inserted or modified.
2. Edit that Region with the new boundary action. Verify control nodes are
   unchanged by smoothing, and a change/Save updates the same native Region
   ID. Move Scene padding or zoom and inspect image-relative control placement
   in a *backup*, verifying no writes occur merely by reopening.
3. Create a second Town/Village with a partial overlap of Dirwest, including
   an overlap at Valecor's edge. Save must refuse both peer overlap and any
   boundary extending beyond the selected Continent. An adjacent border with
   exactly matching edges may be saved. Continent/settlement nesting itself
   is valid.
4. Select *Paint Native Hex/Grid Spaces* in a square Scene, then a hex Scene
   (requires native Foundry v14.370+ grid support). Add/erase with 1-cell and
   ring brushes, Undo, Save and edit/repaint. Confirm native Region has a grid
   Shape and the selected cell ownership matches what was painted. Cells
   extending past Scene image centers, outside Valecor, or assigned to
   another peer must be refused without partial writes.
5. Draw three or more **Blank Walls** making a single closed ring. Select
   them and import a new native Territory. Confirm its Region Shapes match
   the ring, its source remembers Wall IDs, and existing Wall restrictions
   remain zero. Try an open edge, duplicate Wall, touching nonadjacent edge,
   door, and a vision/movement-blocking Wall; all must fail with no Region
   write. Changing those Walls afterward must *not* silently change a Region.
6. Run **Analyze Borders** on mixed polygon/grid and grid/grid peers. Their
   conflicts should be reported but not offered to polygon trimming; native
   control-node polygons should not be trimmable independently of source.
7. Edit a native Region in Foundry while Atlas's editor is open; then Save.
   Stale native geometry must reject the Atlas save, without clobbering the
   external native edit. Test a missing/deleted Region, a Scene change, a
   canceled editor and reload.
8. Try opening editors as non-GM, during a Road draft, during Fog painting,
   and an ongoing Journey. Confirm authoring is inaccessible or safely
   refused. Check prior native Behaviors/Levels, Fog, Roads, Checkpoints,
   Journey resume, World time, Journal updates, and player visibility remain
   unaffected by a legitimate isolated Territory save.

Automated tests and documentation **do not establish Foundry v14 live
acceptance**. Keep this PR a draft until the owner verifies the matrix.
