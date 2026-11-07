# v0.3.9-beta.8.7 — native Territory authoring and diagnostics

## Scope and ownership

This stacked draft preserves the existing beta.8.6.2 announcement diagnostics. No
Journey, Token, Journal, World-time, native fog, wall or road schema change is
introduced here. Native `RegionDocument.shapes` remain the only authoritative
geography. Region Behaviors, IDs, visibility, levels, links, published labels and
other properties are not edited by boundary smoothing.

### Large native polygon smoothing

The previous implementation used Chaikin corner cutting, which doubled the
vertex count per pass, then rejected a Region with over 128 source vertices.
Already-smoothed continent coastlines quickly hit that limit. The new pure
boundary model preserves that algorithm for small input where the requested
passes yield at most 256 vertices. For more detailed single polygons (up to
2,048 vertices), it uses a bounded, **vertex-preserving** neighbor-weighted
filter. Both algorithms validate finite coordinates, nonzero area, no duplicate
adjacent vertices and no self-intersection. Dense smoothing also refuses a
reversed polygon or area change above 7% in a single preview.

The GM must review an orange original/green proposed overlay and a summary
containing algorithm, vertex counts and estimated percentage area change;
then separately confirm the shape-only write. The write re-reads the original
native Region and refuses a stale snapshot. A malformed polygon, complex
multi-shape Region, hole, native grid-based shape, Atlas-generated corridor,
or a polygon exceeding 2,048 vertices is not modified. The upper bound avoids
unbounded synchronous intersection checks and huge canvas previews. Repeated
smoothing still can move shared boundaries inward; no automatic neighbor
editing or perfect area conservation is implied.

### Territory [+] control

The Atlas Scene Workspace **Territories & custom native Regions [+]** action
is GM-authorized and disabled during a Road draft. It first asks for a Region
name. It then delegates **interactive placement** to the documented public
Foundry v14 `canvas.regions.placeRegion`, with a one-grid-square polygon as an
editable starter and no Behaviors. The GM clicks the canvas to place the
Region, or cancels; Foundry owns the resulting native document and its editor.
Atlas does not assign a public label, Atlas association, geopolitical type,
special elevation, or navigation effects during creation. The GM can use the
existing association/geography actions afterward. No Region gets created
merely by opening the Workspace or pressing Cancel.

### Verbose diagnostics policy

**Every new feature** should instrument the existing browser-local, GM-only
Atlas Debug `Verbose` channel at the key request/selection, eligibility,
preview, approval, mutation, cancellation and failure boundaries that make
the behavior diagnosable. This is a standing forward-looking development
contract; it does not imply that every historical feature has already been
retrofitted. Do not add per-frame logs, arbitrary Actor/Token/Region object
dumps, raw geometry, hidden labels, secrets, or player-facing diagnostics.
Use categorized, compact structured summaries. Standard remains journey
milestones, Trace is reserved for potentially noisy lifecycle detail.

This slice adds a **Territories & Native Regions** category to the same
Debug level selector and instruments association edits, geographic
classification, public label saves, native polygon placement/cancellation,
and smoothing preview/rejections/commits. This diagnostic surface contains
safe counts and outcome flags, not full native Region shapes or names. The
previous beta.8.6.2 announcement-name resolution issue remains an independent
GM live-test item and is not declared fixed by this change.

### Controlled Walls and neighboring borders

Foundry v14 already offers native Region creation from selected Walls. It can
be useful **if** existing Walls accurately enclose a coast or interior
boundary. However, WallDocuments control native vision/movement behavior and
their endpoints are not a political-boundary topology in Atlas. Adding Walls
solely to solve map-territory ownership is not recommended. This beta does
not edit Walls, build Regions from Walls or infer adjacency. Accurate shared
border snapping/non-overlap remains a separately designed, previewed,
GM-confirmed **paired-edge topology editor** that can reconcile both native
Region shapes without overwriting unrelated areas or Behaviors.

## Owner Foundry v14 acceptance checklist (not yet live-verified)

1. In a GM scene, open Workspace → Territories and click `[+]`; enter a name,
   place the starter polygon on the canvas. Verify native Region sheet, no
   Atlas link/public flag, no Behaviors, and editable native Shapes.
2. Cancel name dialog and native placement separately; neither creates a
   Region. Try a non-GM client and during an active Road draft: no write.
3. Enable Atlas Debug **Verbose** locally as GM; repeat creation, linking,
   geography, public label, smoothing preview/cancel/save. Inspect grouped
   `[fvtt-atlas-navigation][territory]` logs without private shape dumps.
   The player client must not receive diagnostic data.
4. Preview Valecor with its detailed native polygon (approximately 300–1,500
   vertices). Verify both outlines, reported method, vertex count, area delta,
   and reasonable UI performance. Save only if visually safe; try a second
   Gentle preview. Inspect nearby Dirwest/Hearth's Heart boundaries closely.
5. Test corrupted/self-crossing polygon, a hole/multi-shape Region, a Region
   changed in native editor during preview, and an Atlas-generated corridor:
   these must refuse unsafe smoothing with no data write.
6. Reopen the Scene, compare Region ID, Behaviors, levels, visibility, name,
   flags and native shapes. Verify roads, checkpoints, fog, weather, travel,
   pause/resume, Journal/world time and announcements remain unaffected.
7. Run non-GM visual/permissions review before calling the build accepted.

Automated tests and architecture checks are development evidence, **not**
owner live Foundry v14 acceptance.
