# FVTT Atlas Navigation

A developing **standalone, system-agnostic atlas and road-navigation module for Foundry Virtual Tabletop v14**.

> **Current development test build: v0.2.14 — optional generated native Regions.** The owner verified v0.2.13 checkpoint names, elevations and filters in Foundry. This draft adds explicit GM preview/confirmation for an independent checkpoint Region or one corridor Region connecting two checkpoints on the same named road. Width uses the native Scene grid (quarter-to-three grid spaces per side). A new linked native Region starts with **no Behaviors**; use Foundry's native Region editor to assign them. Existing generated Regions may be regenerated only if their geometry has not been changed manually; native Behaviors, name and Levels remain untouched. Nothing is generated automatically or in bulk. No slope calculation, native elevation ranges, token costs or event triggers are implemented. Test in Foundry v14 before accepting this draft; earlier draft PRs remain unmerged.

## What works now

- Phase 1 bootstrap, GM startup diagnostic setting, and URL-based installation.
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
- **Generated Road Regions (v0.2.14):** Select a road and checkpoint to preview a native circular Region, or two checkpoints on the same named road for a rounded corridor covering the actual polyline (including shaping bends). Set its **half-width in Scene grid cells** and explicitly confirm Create; the Region is linked to Atlas and has no Behaviors until you set them in Foundry's native editor. A loop with two valid paths is refused rather than guessed, even when paths overlap visually. The generated list offers **Regenerate** only if the native geometry was not manually edited. Preview clears after confirm/cancel/closing the sheet; creating, renaming, editing or deleting roads/checkpoints never silently changes an existing Region. A stored generated Region may need explicit regeneration after map padding, grid or road geometry changes; existing native Behaviors and GM geometry are protected.
- **Narrative Waypoints and Journal links:** Toll/checkpoint labels can now be named on the map, but Journal/Note linking, secret triggers, generated corridor/checkpoint Regions and event execution are future milestones. No player-facing markers or permissions are implemented.
- Road list counts refer to internal **graph segments** (split at junctions), not distinct visually drawn road branches. Hover the count for a reminder.
- Road geometry is stored as versioned per-Scene flags with permissions/revision checks; historical manual calibration values are preserved but ignored.
- Native **Scene Grid** distance and units remain the only measurement source. **Route lengths and navigation have not been implemented**; road lines do not yet display distance labels.
- [v0.2.14 installation and Foundry smoke-test instructions](docs/PHASE2_TESTING.md).

**Still to build:** native Note/Journal associations, direct canvas context menus, road appearance/label/hover controls, slope/terrain-aware previews, route calculation and terrain-based travel, and player reveal/hide. The module remains GM-only for editing. For Phase 1 history, see [Phase 1 test notes](docs/INSTALLATION.md).

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
