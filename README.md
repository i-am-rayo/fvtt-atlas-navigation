# FVTT Atlas Navigation

A developing **standalone, system-agnostic atlas and road-navigation module for Foundry Virtual Tabletop v14**.

> **Current build: Phase 2b development (v0.2.2), awaiting Foundry v14 visual testing.** Phase 1 startup and URL installation were tested and merged. This branch implements a GM-only native Atlas Scene Configuration tab, native Scene Grid-first measurement, and explicit manual overrides while preserving Phase 2a Scene flags. **Roads, Waypoints, Region linking, and route calculation are not implemented yet**; their approved design reuses Foundry's native Region Behaviors.

## What works now

- The Phase 1 module bootstrap, GM startup setting, and URL-based installation.
- A GM-only **Atlas** tab in native Scene Configuration, with a supported in-sheet fallback if a custom Scene sheet cannot display it.
- Enable/disable atlas mode per Scene, preserving data when disabled.
- Use **native Scene Grid distance and units by default**, derived without writing duplicate values into flags; optionally choose a per-Scene manual units-per-pixel override. Existing v0.2.1 manual values remain selected until explicitly changed.
- Validate and persist versioned Scene flags with revision checks; no game-system-specific dependency.
- Show an explicitly dismissible save notification in the current development build.
- [Phase 2b installation and smoke-test instructions (v0.2.2)](docs/PHASE2_TESTING.md).

This test build is **not** a usable road editor yet. Phase 2c will add road/waypoint authoring; Phase 2d adds optional native Region links. For the earlier Phase 1 check, see [Phase 1 test notes](docs/INSTALLATION.md).

## Vision

Help a Gamemaster turn an existing Foundry Scene into an interactive world or regional atlas: mark places, author connected roads, calculate travel routes, and present a readable journey to players. The interaction model takes inspiration from LegendKeeper's maps and Indy Route's scene-level route presentation, without depending on either service or module.

Core goals:

- **Native Foundry content:** Scenes provide maps, Notes connect places to Journals, and existing Regions provide both terrain geometry and configured movement Behaviors. Atlas links to these Regions without duplicating terrain multipliers.
- **Authored roads:** The GM draws a persistent, editable network of connected road segments and junctions.
- **Actual navigation:** A graph algorithm finds a route through that network, rather than merely animating a freely sketched line.
- **Distance-aware maps:** Prefer Scene Grid measurement settings, with an explicit per-Scene override where needed; preserve existing manual scales during migration.
- **Readable overlays:** Show the persistent road network and a selected route as separate visual elements.
- **System independence:** No D&D-specific movement, actor data, sheet integration, or mandatory third-party module.

## Initial playable milestone (GM-only)

1. Activate the module in a Foundry v14 world.
2. Open the Atlas tab in native Scene Configuration, with Grid measurement read automatically or explicitly overridden.
3. Draw, connect, edit, and persist road junctions/segments via GM canvas controls.
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
