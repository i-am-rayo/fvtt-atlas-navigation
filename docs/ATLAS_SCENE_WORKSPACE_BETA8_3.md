# Atlas Scene Workspace — v0.3.9-beta.8.3

## Scope and architectural contract

**Source:** accepted owner live test of beta.8.2 (territory/road-generated separation,
native boundary smoothing and Journey public labels). This beta adds a dedicated
GM-only, Scene-scoped `ApplicationV2` workspace foundation. It does not change any
Atlas Scene flag, native Region schema, Region geometry/Behavior, Journey history,
or navigation decision logic.

The workspace is a **presentation layer**. It reads validated existing Scene/Region
records through the current adapters, uses the same `roadActions` command boundary
as Scene Configuration, and has no document-write behavior during rendering.
The existing territory manager is a shared DOM builder, not a duplicated feature.

## Implemented

- Entry points: **Open Atlas Scene Workspace** on the Scene Atlas tab and a GM-only
  **Atlas Scene Workspace** button in Atlas canvas controls. Both open the exact
  chosen Scene, without changing the active canvas Scene.
- One resizable window per Scene; opening it again reuses the instance. Close
  removes it from the in-memory instance registry. Active section survives refresh.
- **Overview** reads road, checkpoint, manual/native territory, generated Region,
  and explicitly published Region label counts without altering documents.
- **Territories** reuses the same native Region configure, Atlas link/unlink,
  boundary smoothing preview and public Journey name commands as beta.8.2.
- Only an authorized GM can open/render the workspace. Regions retain native
  IDs, shapes, elevation, Levels, Behaviors, visibility and original ownership.
- Explicit Refresh and native create/update/delete Region refresh keep the open
  workspace aligned with recent Region changes.
- Existing Scene Atlas tab stays fully functional as a compatibility fallback.

## Explicitly out of scope

- Migration of Roads, Checkpoints, Surfaces, Exploration and Navigation editors
  to their own tabs. These remain in Scene Configuration → Atlas for now.
- Semantic geographic tiers, overlapping region selection/ranking, shared-edge
  snapping, seam/gap repair, undoable shape provenance and coast/ocean generation.
  Those remain separate accepted roadmap items, not inferred from native Levels.
- No native Scene/Region writes on open, read, tab switch or window close.

## Risks / follow-up design

- Existing standalone editor dialogs still use current native Foundry workflows.
  The workspace must not silently switch Scene, minimize a dirty draft, or rewrite
  a native Region to accommodate its window layout.
- The territory panel is now shared at the DOM-component level. Later phases
  should similarly extract focused Roads/Checkpoints/Surfaces/Exploration views
  rather than assembling the entire historical Scene panel inside each section.
- Overlapping published Regions intentionally remain ambiguous for Journey
  banners until a separate, explicit per-Region geographic tier/priority model
  is approved and tested with non-GM visibility checks.

## Owner's Foundry v14 test checklist

1. Install beta.8.3 by the branch manifest. Log in as a GM and open a Scene with
   existing roads, generated corridors, manual Regions and public labels.
2. In Scene Configuration → Atlas, click **Open Atlas Scene Workspace**. Verify a
   roomy resizable window with the correct Scene name and counts.
3. Use the Canvas Atlas control **Atlas Scene Workspace** for the active Scene.
   Verify it reuses the same window, without launching a duplicate.
4. Select **Territories**. Confirm manual native Regions appear (not road-generated
   corridors), public labels match beta.8.2, and ⚙/∿/🔗/🏷 launch their existing
   native / preview / link / label actions. Cancel previews to ensure no writes.
5. Save one *explicit* public-label change and refresh. Confirm the Journey banner
   uses the label and the native Region geometry/Behaviors are unchanged.
6. Return to Scene Configuration → Atlas: verify Roads, checkpoint tools,
   exploration and generated Region functions remain usable.
7. Switch canvas Scenes while a workspace is open; ensure its Scene name stays
   explicit and any Scene-dependent drawing action still enforces its normal
   safety guard. Close and reopen to verify cleanup.
8. Log in as a non-GM: confirm no Atlas authoring control or workspace launcher
   is available; existing player road/label visibility remains unchanged.
9. Check both GM and player clients after Scene reload/canvas refresh: fog,
   weather, navigation, World time and Journey Journal must remain unchanged.

Automated tests cover permissions (including revoked permission after open),
one-window-per-Scene reuse, native controls, and existing Scene tab regression.
Live Foundry v14 GM/non-GM acceptance is still required before any merge.
