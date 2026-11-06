# Atlas Scene Workspace — v0.3.9-beta.8.5

## Owner live test / motivation

The owner confirmed beta.8.4's Workspace road behavior, and reported that
native Scene Levels take excessive vertical space above the Road list. They
requested a dedicated Topology section and a different, geographic hierarchy
for the Road filter. These are separate concerns: native Foundry **Levels**
represent vertical elevations; Atlas geographic **territories** represent
two-dimensional political or geographic regions.

## Implemented in beta.8.5

- Added **Topology & Levels** to the Workspace navigation. Renamed the Road
  view to **Roads**; native Level setup is no longer constructed inside the
  focused Road view. The original Scene Configuration → Atlas remains a
  compatibility fallback until the full Workspace migration is live-accepted.
- Reused the existing GM-only native Level setup component unchanged in its
  data flow: per-Scene opt-in, draft selections, preview, native Level ID
  adoption, explicit GM confirmation, revision/stale checks, and native
  `createEmbeddedDocuments` / `updateEmbeddedDocuments` on approved actions.
- Refined native Level row presentation: four-column layout at roomy sizes,
  responsive two-column grid on narrower windows; labeled Bottom/Top numeric
  fields, Level selection and category toggle. Buttons remain below the grid.
- World module opt-in is still honored. If the global native Level planner is
  off, Topology explains how to enable it. Merely opening Topology creates no
  Scene, native Level, Region, Road, or Journal writes.

## Future Road directory — assessed, not implemented here

See `docs/ATLAS_TERRITORY_ROAD_INDEX_DESIGN.md`. The existing native Region
association flag records linkage only; it does **not** encode continent/city
types, parent territory, or road membership. Guessing these from Region names
or native Levels would produce incorrect geographic results.

Design decision requested from the owner before adding new versioned native
Region Atlas geography flags or derived road-to-territory membership.

## Tests and live acceptance

- Automated: Topology view isolation, GM permission gate, native Level read
  without writes, original native Level preview/confirm/create/update tests,
  and legacy Scene Atlas Road controls.
- Owner Foundry v14 GM test: open Topology with the World setting on and Scene
  enabled; confirm Surface/Aerial/Underwater/Underground rows are compact,
  labels and dropdowns are readable, existing native Level IDs are preserved
  on confirmed in-place adoption, and Cancel/Preview cause no writes.
- Resize the window; verify controls do not overlap. Switch to Roads and
  confirm native Level setup is absent while road filtering/editing, floating
  editor, canvas, fog, weather, Journey history and World time behave as before.
- Non-GM test: Workspace and its native authoring controls are unavailable.

No Foundry live acceptance is represented by automated test success.
