# Atlas Territory Road Directory — v0.3.9-beta.8.6 (GM test build)

## Owner-approved scope

The owner accepted beta.8.5 Topology isolation, then approved a geographical
Road directory based on explicit GM-defined native Region types/parents,
read-only geometry-derived Road membership, and manual corrections.
The old Scene Configuration Road picker is retained for compatibility;
the **Workspace → Roads** view now provides the geographic directory.

## Architecture and contracts

- Native Foundry `RegionDocument` owns name, shapes, elevations, Levels,
  visibility, Behaviors, and the existing separate public Journey label.
- A **new versioned Atlas Region flag** (`territoryGeography`, v1) holds only
  `kind` (`continent`, `city`, `town`, `village`, `area`), optional parent
  native Region ID, and Road-ID corrections (`include` / `exclude`).
- Only a GM with Scene/Region edit access may create, update or remove it.
  Explicit save confirmation, exact prior-state/name/visibility checks,
  strict schema and linked/valid parent hierarchy checks prevent silent
  migration or changes to unsupported future flags. A parent with existing
  descendants cannot be deleted or reclassified incompatibly.
- The adapter reads the current Scene canvas origin and native Region shapes,
  then samples each authored Road polyline at bounded intervals. A pure
  domain projector calculates many-to-many Road membership, folds descendant
  Roads into their continent/area parent, and creates **All Roads** and
  **Unclassified** fallbacks. Membership is a GM-only **read model**; no
  Scene, Road, Journey, Journal, Token or native Region data is written by
  opening/using filters. Manual include/exclude takes precedence over samples.
- The canvas must be open on this Scene for geometric inference. Off-canvas,
  only explicit manual includes are shown under territories. Sampling can
  miss thin regions/brief crossings; review doubtful Roads and use the
  territory's correction dropdown when needed. A capped Road is flagged in
  the GM UI. The directory never decides gameplay routing or player labels.
- Native elevation Levels are **not** geographic categories. Publishing
  names to players still requires the separate approved Journey label.

## GM live acceptance checklist (Foundry v14)

1. Back up a test World. Open Scene Paedor and Atlas Workspace → Territories.
   Link manually authored regions and click the new **Classify territory**
   action. Set Valecor = Continent; Dirwest and Millstone = City, with Valecor
   as each City parent. Confirm both dialogs; verify persistent values after
   reloading Foundry and reopening the editor.
2. Workspace → Roads: select **All Roads**, **Unclassified**, the continent,
   and each City. The Millstone–Dirwest Road should appear in both City
   selections when its geometry intersects each region. Selecting a category
   must only filter existing Road cards; editing them still works.
3. Add a manual include and exclude for a Road via a City territory. Verify
   the corresponding list changes, without edits to the Road graph or native
   Region Shapes/Behaviors. Clear the override using **Use geometry**.
4. Close/change the active Scene canvas and open Workspace for the original
   Scene: see the geometric inference warning, All Roads, and Unclassified;
   no silent writes. Reopen the original canvas and refresh to recover
   geometry-derived membership.
5. Attempt to make a City its own parent, orphan a dependent City by deleting
   its Continent, or classify an unlinked Region. Observe explicit validation
   or disabled controls, with unchanged Region flags.
6. Check road-generated corridor Regions remain in the Road editor rather
   than Territories. Verify native Levels, public Journey banners, fog,
   weather, map visuals, and saved Journeys remain unchanged.
7. Non-GM: the authoring Workspace must be inaccessible and no unpublished
   territory name or hierarchy should appear in player UI/network payloads.

## Deliberately deferred

Shared-edge topology/snapping, bulk geographic classification, robust native
shape-intersection beyond bounded samples, coast buffers (the owner's proposed
20 km coastal strip and residual ocean), player geography visibility, and
the remaining Workspace migrations. No automatic conversions of existing
Regions or preexisting public labels occur in beta.8.6.

Automated tests do not constitute Foundry v14 GM/non-GM live acceptance.
