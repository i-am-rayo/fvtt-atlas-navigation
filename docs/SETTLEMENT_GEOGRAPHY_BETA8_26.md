# v0.3.9-beta.8.26 — Settlement geographic kind

Status: stacked draft, automated verification pending live Foundry v14 acceptance.

## Scope

- Add **Settlement** as a native Territory's geographic classification in Atlas Workspace → Territories and its new-Territory creation form. Existing `territoryGeography` flag stays at schema version **1**; `settlement` is one additional valid `kind`, and reading old metadata never writes a migration.
- Give Settlement the same map-directory and peer-boundary tier as City, Town and Village; detect its Road memberships from geometry and include it in Continent child Road rollups.
- Permit a Settlement without an explicit parent to infer a dominant Continent in memory only, using the existing majority/ambiguity safeguards. Explicit parents always win.
- Include only explicitly GM-shared Settlements in the player map projection; a separately public Territory name remains necessary to render the text. Existing native/manual fog occlusion is unchanged.
- Suggest a same-name **Settlement Checkpoint ↔ Settlement Territory** link using the existing unambiguous, type-exact review flow. Suggestions never link anything by themselves.
- Handle Settlement in already existing native polygon/grid peer-collision and border-analysis routines without introducing automatic Shape edits.

## GM acceptance

1. Open an existing Atlas-linked manual native Region. Change its **Geographic kind** to **Settlement**, save, close, and reopen. It should persist and still show its existing native Shapes, Behaviors and road metadata.
2. Create a new Territory with type **Settlement**, confirm creation, then inspect its native Region: Atlas geography flag `kind: "settlement"`, `schemaVersion: 1`, and no added Behaviors.
3. In Atlas Layers choose **Settlements**. Cities, Towns, Villages and Settlements should be shown together. Confirm **Continents** excludes the Settlement outline and **All Regions** draws the broad Region first.
4. Place a Settlement primarily inside a Continent. Without an explicit parent, the Atlas directory should infer that Continent; ambiguous boundaries should leave the parent unset. Reopen native Region flags to confirm inference made no write.
5. For a named Settlement Checkpoint and identically named Settlement Territory, review the suggested association. A matching name with the wrong type or multiple candidate Regions should not auto-suggest. A manual link remains the only way to apply it.
6. Check that overlaps between a Settlement and a neighboring Village/City/Town/Settlement are detected, while intended nested Continent → Settlement geometry remains permitted. No peer outline should be trimmed automatically.

## Two-client player acceptance

1. Without **Player boundary** sharing, a Settlement must be absent from the player Territory layer even when its public name exists.
2. Share the Settlement boundary as GM. Player Atlas Layers → **Settlements** should show only the permitted outline, **below Foundry and Atlas fog**; unexplored sections must remain invisible.
3. Publish a public name independently; only then should the player see a label when **Show Region names** is checked. No native private Region name, Road membership overrides or unpublished labels should be exposed via the Atlas presentation projection.
4. If the Settlement is linked to a player-visible Checkpoint, check existing duplicate-name `Always`→`Hover` handling and Journal permission checks. Unshared and unrevealed content must remain hidden.
5. Reload/switch Scenes and verify saved client-local Atlas Layers preferences, plus no unwanted native Region writes.

## Deferred

- [#288](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/288): Make Checkpoint Settings' full compatible Territory list visible, with already-claimed choices clearly disabled and reviewed explicit reassignment.
- Later improvements: checkpoint-driven native Region creation, geographic label typography defaults, checkpoint-icon prefix, and consolidated Terrain Region settings UI. These are separate GM-authoring changes.

Automated suite covers geography schema v1, player projection, parent inference, type-specific suggestions, map tiers, Road directory and native boundary safeguards. A live Foundry v14 GM/player test is still required before merging.
