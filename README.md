# FVTT Atlas Navigation

A developing **standalone, system-agnostic atlas and road-navigation module for Foundry Virtual Tabletop v14**.

> **Current test build: Phase 2c (v0.2.4).** The GM verified Phase 2b native Scene Grid values updating correctly. This build replaces the redundant Configure Atlas dialog and enabled toggle with **Roads [+]** in the native Scene Atlas tab, plus first-pass map drawing and saved road management. It has not yet been tested live in Foundry. Draft PR #3 is unmerged.

## What works now

- Phase 1 bootstrap, GM startup diagnostic setting, and URL-based installation.
- A GM-only **Atlas** tab in native Scene Configuration, with an in-sheet fallback for custom sheets.
- **Roads [+]:** start a drawing session on the configured Scene, click two or more map positions to add bends, **Finish Road** (or Enter) to save; Backspace undoes the last draft point; Esc/Cancel discards the draft.
- Saved roads appear in the Atlas list. Highlight a road on the GM canvas, rename or delete it with confirmation. A Scene with roads has an active Atlas automatically; **there is no separate toggle**.
- Endpoints near existing junctions (14 Scene pixels) reuse their IDs. Lines that cross visually **do not** connect automatically. Existing saved junctions are retained on road deletion.
- Road geometry is stored as versioned per-Scene flags with permissions/revision checks; historical manual calibration values are preserved but ignored.
- Native **Scene Grid** distance and units remain the only measurement source. **Route lengths and navigation have not been implemented**; road lines do not yet display distance labels.
- [Phase 2c installation and Foundry smoke-test instructions (v0.2.4)](docs/PHASE2_TESTING.md).

**Still to build:** editing existing road points, a dedicated Waypoints/junction manager, linking native Regions, route calculation and terrain-based travel, and player reveal/hide. The module remains GM-only for editing. For Phase 1 history, see [Phase 1 test notes](docs/INSTALLATION.md).

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
3. Use Roads [+] to draw/persist road segments; future tools will support editing their saved geometry and explicit waypoint management.
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

The owner approved Phase 2 after successfully testing Phase 1 on October 22, 2026. Routing and player-facing features remain gated to later milestones.

## Sources and inspiration

- [Foundry: Introduction to Module Development](https://foundryvtt.com/article/module-development/)
- [Foundry v14 API](https://foundryvtt.com/api/v14/)
- [LegendKeeper developer documentation](https://www.legendkeeper.com/developers/)
- [Indy Route](https://github.com/jwrpalmer99/indy-route) — independent reference for route drawing, storage, and presentation; not an architectural dependency

This project is unaffiliated with Foundry Virtual Tabletop, LegendKeeper, and Indy Route.
