# FVTT Atlas Navigation

A developing **standalone, system-agnostic atlas and road-navigation module for Foundry Virtual Tabletop v14**.

> **Current status: Phase 1 development shell, pending in-Foundry testing.** The repository includes a manually installable manifest, startup hooks, and a GM diagnostic setting. Road editing and navigation remain planned features.


## What Phase 1 currently provides

- A Foundry v14-compatible **manifest structure** and lightweight ES module startup script (runtime verification pending).
- A world-level **Show GM startup confirmation** setting. When enabled, it displays a confirmation only to a GM after reloading the World.
- Namespaced English localization and dependency-free Node static/mock tests.
- [Manual installation and smoke-test instructions](docs/INSTALLATION.md).

The project does **not** yet draw maps, author roads, or compute routes. See the [roadmap](docs/ROADMAP.md) for those later phases.

## Vision

Help a Gamemaster turn an existing Foundry Scene into an interactive world or regional atlas: mark places, author connected roads, calculate travel routes, and present a readable journey to players. The interaction model takes inspiration from LegendKeeper's maps and Indy Route's scene-level route presentation, without depending on either service or module.

Core goals:

- **Native Foundry content:** Scenes provide maps, Notes connect places to Journal Entries/Pages, and later Regions can describe terrain.
- **Authored roads:** The GM draws a persistent, editable network of connected road segments and junctions.
- **Actual navigation:** A graph algorithm finds a route through that network, rather than merely animating a freely sketched line.
- **Distance-aware maps:** Calibrate Scene image coordinates to meaningful travel units.
- **Readable overlays:** Show the persistent road network and a selected route as separate visual elements.
- **System independence:** No D&D-specific movement, actor data, sheet integration, or mandatory third-party module.

## Initial playable milestone (GM-only)

1. Activate the module in a Foundry v14 world.
2. Mark a Scene as an atlas and calibrate its scale.
3. Draw, connect, edit, and persist road junctions/segments.
4. Pick two network points and calculate the shortest connected route.
5. See the highlighted path and total distance; receive a clear "no route" result for disconnected roads.
6. Reload and confirm the authored network persists.

Native map Notes/Journal links will remain the first choice for places and lore. The player-facing reveal/hide workflow comes **after** verifying what data a player client can receive.

## Not in the initial milestone

Automatic token travel; a combat/grid movement engine; terrain or weather modifiers; travel costs; cross-Scene paths; fog-of-war automation; LegendKeeper sync; a D&D-specific ruleset; a dependency on Indy Route.

These are possible later phases, not prerequisites for useful GM navigation.

## Design documentation

- [Architecture and Foundry integration](docs/ARCHITECTURE.md)
- [Proposed data model and invariants](docs/DATA_MODEL.md)
- [Milestones and acceptance criteria](docs/ROADMAP.md)
- [Instructions for Codex and contributors](AGENTS.md)

The owner approved implementing **Phase 1** on October 22, 2026. Remaining architectural decisions and later-phase work still require review.

## Sources and inspiration

- [Foundry: Introduction to Module Development](https://foundryvtt.com/article/module-development/)
- [Foundry v14 API](https://foundryvtt.com/api/v14/)
- [LegendKeeper developer documentation](https://www.legendkeeper.com/developers/)
- [Indy Route](https://github.com/jwrpalmer99/indy-route) — independent reference for route drawing, storage, and presentation; not an architectural dependency

This project is unaffiliated with Foundry Virtual Tabletop, LegendKeeper, and Indy Route.
