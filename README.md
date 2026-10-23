# FVTT Atlas Navigation

A developing **standalone, system-agnostic atlas and road-navigation module for Foundry Virtual Tabletop v14**.

> **Current development test build: v0.2.16 — opt-in native corridor movement-cost Behaviors.** The owner verified v0.2.14 native checkpoint/corridor Region creation and manual-geometry safeguards in Foundry v14. This draft adds GM-only world-level Land/Air/Water preset editing in the module's Atlas Presets submenu, per-road defaults and per-generated-corridor overrides. All built-in cost suggestions are neutral ×1.00; preset assignment alone never creates or replaces a native Region Behavior. The Scene road flag upgrades to v5 only when a GM explicitly assigns a named-road default; back up the World before editing older v3/v4 road data, as older Atlas module versions cannot edit the new schema. Test this build in Foundry v14 before accepting it; PRs remain unmerged.

> **v0.2.15.1 dialog hotfix:** Foundry v14 now accepts the Add/Edit travel-preset dialogs; the serialized form retains existing names, modes, and cost values. No world or Scene data schema changed. Install/update to v0.2.15.2 before continuing the preset checklist.

> **v0.2.15.2 UI cleanup:** Removed the obsolete GM startup notification checkbox and its popup. Existing world settings, road data, preset assignments, and native Regions are untouched.

> **v0.2.16 opt-in action:** While creating an Atlas-generated corridor, a GM may now check **Apply native movement cost**, explicitly select a game-system movement action, review the exact preset multiplier and confirm. An existing generated corridor with a saved preset has a separate **⬆ Apply Native Cost** button. Both fail safely if Foundry cannot validate the native model or any native cost Behavior already exists. Preset assignments, preset edits and Region regeneration never retroactively alter Behaviors. Test in Foundry v14 before merging; colored surfaces and filters throughout the panels remain for a later milestone.

## What works now

- Phase 1 bootstrap and URL-based installation. The old GM startup confirmation setting was removed in v0.2.15.2; the module still logs its normal ready message to the console.
- A GM-only **Atlas** tab in native Scene Configuration, with an in-sheet fallback for custom sheets.
- **Roads [+]:** start a drawing session on the configured Scene, click two or more map positions to add bends, **Finish Road** (or Enter) to save; Backspace undoes the last draft point; Esc/Cancel discards the draft.
- Saved roads appear in the Atlas list. Highlight a road on the GM canvas, rename or delete it with confirmation. A Scene with roads has an active Atlas automatically; **there is no separate toggle**.
- New-road endpoints can snap to existing junctions **or an interior point of an existing road** (14 image pixels), but **Finish Road asks for GM confirmation before making any connection**. Declining keeps the draft for adjustment; holding Alt while placing an endpoint bypasses snapping. Joining an interior point splits the existing segment into connected sections that belong to **one named road** in the Atlas list. Ordinary crossings away from the endpoints **do not** auto-connect.
- v2 road coordinates are anchored to the Scene background image, so adjusting Scene padding no longer offsets their overlay. **Previously authored v1 roads require explicit image anchoring**, followed by **Organize named roads**; v2 roads require organization only. Neither migration guesses or silently merges roads.
- **Edit road points** shows draggable white bend handles and gold shared-junction handles on the canvas. Double-click an edge to add a bend; Alt-click a bend to remove it. Dragging an existing junction onto another road asks for **confirmation**; only acceptance creates a real junction. Cancelling the prompt leaves the original position unchanged. To disconnect a selected named road from a junction between different roads, **Alt/Option-click its gold point and confirm**; the selected road gains a separate coincident junction which you can then drag away without moving other roads. All these edits are staged until **Save Points** and support **Undo** and **Cancel Edits**. Connected groups can be explicitly **Merged** under one name. Closing Scene Configuration clears highlights and discards unsaved edits.
- **Same-road branch correction (v0.2.11):** If a former road merge left three or more sections of the **same named road** meeting at one junction, **Alt/Option-click that gold point**, choose the section/direction to disconnect, and confirm. Atlas creates a separate coincident endpoint for that section, which you can drag away. Then Shift-click the remaining two-section junction if you want a white shaping bend. No named road or section is deleted or renamed, and Undo/Cancel/Save still apply.
- **Junctions [+]:** Click an existing road to stage a real graph node at its interior, then Save Points, Undo, or Cancel Edits in the Junctions section. In Edit Points, **Shift-click a white bend** to promote it to a gold junction; **Shift-click a gold two-section single-road pass-through** to turn it back into a white bend without shifting geometry. Shared, branching, terminal and loop nodes are protected. These edits are staged and reversible. Drag onto another road to request explicit connection confirmation; mere visual crossings remain disconnected.
- **Filtered junction inspector:** Only road branches and junctions shared by different named roads appear (not every endpoint or same-road subdivision). The list defaults to the first selected road, offers **directly connected roads** or **entire Scene**, and renders no more than 25 matches. Highlighting a road changes the selected filter.
- **Terrain Regions [+] (v0.2.12):** In Scene Configuration → Atlas, link an existing native Region. Linked Regions display their native names, hidden state and configured Behaviors (active/inactive), with a shortcut to Foundry's native Region editor. The ↻ button refreshes the list after native edits. Unlinking removes **only the Atlas association flag**; native Region geometry, elevation, visibility, Behaviors and actual token movement remain unchanged. You can link Regions even before drawing any roads.
- **Checkpoints [+] (v0.2.13):** Click an existing road node or any interior road position. Enter a checkpoint name and optional **meters above sea level** (negative below); choose the named road when multiple roads meet there. An interior checkpoint creates a stable node and splits that section **without** turning it into a routing junction or a new named road. Checkpoints are visibly distinct on the GM road overlay; highlight, rename/change height, delete metadata without removing the road, and filter by selected road / directly connected roads / Scene (25 listed at once). Old v3 Scenes are upgraded to validated **v4** on the GM’s first checkpoint creation; existing road IDs, names, shapes and dormant manual calibration survive. **Back up your world before adding the first checkpoint: v0.2.12 and older editors cannot edit a v4 Scene without upgrading.** Shared-node movement and explicit road merge preserve checkpoint bindings; deleting their road or demoting their graph node is blocked until the checkpoint is removed. No native Regions or Behaviors are created.
- **Atlas Travel Presets (v0.2.15):** In Game Settings → Configure Settings → FVTT Atlas Navigation → **Atlas Presets**, a GM can create/edit/delete world-wide Land/Air/Water travel conditions and suggested movement **cost** multipliers (0.1–10). Presets are shared by all Scenes in this World, not all Worlds. Every built-in suggestion is ×1.00 until configured. In Scene Atlas, use ◈ beside a named road to select its default; the first such change explicitly upgrades that Scene to validated v5 while preserving graph geometry, checkpoint names/elevations, native Grid and Region links. When generating a corridor, choose a preset or override that road default; use ◈ on an existing generated corridor to change its annotation. Assignments are references only, persist after reload and never update native Region Behaviors or shape signatures. Updating a world preset changes its displayed suggestion but never silently writes to an existing native Region; v0.2.16 offers separate opt-in native cost application. Reassign road/Region references before deleting a preset. **Back up before upgrading v3/v4 roads to v5.**
- **Native movement costs (v0.2.16):** For a newly generated **corridor** only, choose a travel preset, check **Apply native movement cost**, and choose a movement action registered by your active Foundry game system. Confirm the preview to add exactly one native **Modify Movement Cost** Region Behavior, or leave the checkbox off for metadata only. Existing generated corridors with a preset offer an explicit **⬆** action to apply it separately. Atlas never overwrites or stacks an existing native movement-cost Behavior—even a disabled one—and never maps Land/Air/Water directly to token actions. The GM can edit the resulting native Behavior in Foundry. No automatic replay or update occurs when the preset is changed or the corridor geometry is regenerated. Actual system-specific movement effect must still be checked in Foundry v14.
- **Generated Road Regions (v0.2.14):** Select a road and checkpoint to preview a native circular Region, or two checkpoints on the same named road for a rounded corridor covering the actual polyline (including shaping bends). Set its **half-width in Scene grid cells** and explicitly confirm Create; the Region is linked to Atlas and has no Behaviors until you set them in Foundry's native editor. A loop with two valid paths is refused rather than guessed, even when paths overlap visually. The generated list offers **Regenerate** only if the native geometry was not manually edited. Preview clears after confirm/cancel/closing the sheet; creating, renaming, editing or deleting roads/checkpoints never silently changes an existing Region. A stored generated Region may need explicit regeneration after map padding, grid or road geometry changes; existing native Behaviors and GM geometry are protected.
- **Narrative Waypoints and Journal links:** Toll/checkpoint labels can now be named on the map, but Journal/Note linking, secret triggers, generated corridor/checkpoint Regions and event execution are future milestones. No player-facing markers or permissions are implemented.
- Road list counts refer to internal **graph segments** (split at junctions), not distinct visually drawn road branches. Hover the count for a reminder.
- Road geometry is stored as versioned per-Scene flags with permissions/revision checks; historical manual calibration values are preserved but ignored.
- Native **Scene Grid** distance and units remain the only measurement source. **Route lengths and navigation have not been implemented**; road lines do not yet display distance labels.
- [v0.2.16 installation and Foundry acceptance checklist](docs/PHASE2_TESTING.md).

**Still to build:** colored corridor surfaces and consistent Scene road filtering, native Note/Journal associations, direct canvas context menus, road appearance/label/hover controls, slope/terrain-aware previews, route calculation and terrain-based travel, and player reveal/hide. The module remains GM-only for editing. For Phase 1 history, see [Phase 1 test notes](docs/INSTALLATION.md).

## Vision

Help a Gamemaster turn an existing Foundry Scene into an interactive world or regional atlas: mark places, author connected roads, calculate travel routes, and present a readable journey to players. The interaction model takes inspiration from LegendKeeper's maps and Indy Route's scene-level route presentation, without depending on either service or module.

Core goals:

- **Native Foundry content:** Scenes provide maps, Notes connect places to Journals, and existing Regions provide both terrain geometry and configured movement Behaviors. Atlas links to these Regions without duplicating terrain multipliers.
- **Authored roads:** The GM draws a persistent, editable network of connected road segments and junctions.
- **Actual navigation:** A graph algorithm finds a route through that network, rather than merely animating a freely sketched line.
- **Distance-aware maps:** Rely on the Scene's own Grid configuration and, once routing is implemented, Foundry v14's native `canvas.grid.measurePath(...).distance` for drawn routes. Never calculate authoritative road distances using a separate pixels-to-units ratio.
- **Readable overlays:** Show the persistent road network and a selected route as separate visual elements.
- **System independence:** No D&D-specific movement, actor data, sheet integration, or mandatory third-party module.

## Initial playable milestone (GM-only)

1. Activate the module in a Foundry v14 world.
2. Open the Atlas tab in native Scene Configuration. Measurement is inherited automatically from the Scene's Grid tab.
3. Use Roads [+] to draw/persist road segments; the current build supports draggable intermediate bends, shared junctions, and a Junctions [+] picker for inserting new graph nodes on existing roads.
4. Pick two network points and calculate the shortest connected route.
5. See the highlighted path and total distance; receive a clear "no route" result for disconnected roads.
6. Reload and confirm the authored network persists.

Native map Notes/Journal links will remain the first choice for places and lore. The player-facing reveal/hide workflow comes **after** verifying what data a player client can receive.

## Not in the initial milestone

Automatic token travel; a replacement combat/grid movement engine; terrain-aware **token movement-cost previews and overland travel-time calculation** (proposed separately for Phase 3b after native Region linking in Phase 2d); weather; cross-Scene paths; fog-of-war automation; LegendKeeper sync; a D&D-specific ruleset; a dependency on Indy Route.

These are possible later phases, not prerequisites for useful GM navigation.

## Design documentation

- [Revised Phase 2: Atlas tab, roads, waypoints, and native terrain Regions](docs/PHASE2_DESIGN.md)
- [Architecture and Foundry integration](docs/ARCHITECTURE.md)
- [Proposed data model and invariants](docs/DATA_MODEL.md)
- [Milestones and acceptance criteria](docs/ROADMAP.md)
- [Instructions for Codex and contributors](AGENTS.md)

The owner approved Phase 2 after successfully testing Phase 1 on October 22, 2026, and verified Phase 2d Region linking on October 23, 2026. Routing and player-facing features remain gated to later milestones.

## Sources and inspiration

- [Foundry: Introduction to Module Development](https://foundryvtt.com/article/module-development/)
- [Foundry v14 API](https://foundryvtt.com/api/v14/)
- [LegendKeeper developer documentation](https://www.legendkeeper.com/developers/)
- [Indy Route](https://github.com/jwrpalmer99/indy-route) — independent reference for route drawing, storage, and presentation; not an architectural dependency

This project is unaffiliated with Foundry Virtual Tabletop, LegendKeeper, and Indy Route.
