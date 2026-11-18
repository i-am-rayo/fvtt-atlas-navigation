# v0.2.25.4 — Reversible Checkpoint Terrain Reveals

**Testing hotfix**, stacked on v0.2.25.3. This is a draft and must not be merged until live Foundry v14 GM/player acceptance.

## Intended behavior

When Scene Atlas **Party Exploration** is enabled:

- **Undiscovered:** checkpoint marker and Atlas-controlled terrain reveal are both hidden.
- **Seen / Visited:** marker is visible and the background map image is copied into a circular reveal.
- **Known through Lore:** same map-background reveal without requiring party-token movement.
- **Per-checkpoint terrain radius** is configurable in the GM Shift-click checkpoint editor, **in native Scene grid cells** (0–100, default 3). Zero means show the checkpoint marker without revealing any map image.
- **Scene default radius** is editable in Scene Atlas Party Exploration settings; new/existing checkpoints without an override inherit it.
- Changing a known checkpoint back to Undiscovered or setting its radius to zero removes its Atlas-owned reveal. Overlapping circles from other known checkpoints remain.
- Player sees no source tokens, tiles, unrevealed roads, hidden checkpoint metadata, or Foundry fog history through the masked copy. Only the Scene's background image texture is intentionally duplicated for display.

## Crucial native fog boundary

Atlas **does not alter, replace, reset, save, synchronize, or paint** Foundry `FogExploration` documents or their native textures. Reveals are transient `PIXI.Sprite` + `PIXI.Graphics` masks built from `canvas.primary.background.texture`, layered over the native fog during player rendering.

This is a *presentation overlay*, not a native fog edit. If the party's genuine Foundry exploration already exposed a circle, hiding the Atlas checkpoint cannot re-cover that legitimate exploration. Conversely, an Atlas lore reveal can be undone without deleting any legitimately explored terrain.

The reveal intentionally duplicates **only the Scene background image**, not the entire primary render texture: no tiles, tokens, roofs, scene effects, Regions, or secrets from these layers. Scenes without a valid background texture fail closed and display only checkpoint markers. Dynamic scene-image aspect/position, multi-level rendering and differing fog/lighting configurations need live testing.

## Data and migration

Party Exploration Scene flag now writes schema v2. Legacy v1 is normalized **read-only in memory** to v2; it is written as v2 only following an explicit GM save. Existing checkpoint knowledge IDs and selected placed TokenDocument ID remain untouched. New fields: `defaultRevealRadiusCells` and `checkpointRevealRadiusCells` (bounded map keyed by stable checkpoint ID). Native fog and Atlas road/checkpoint network flags are never mutated by this migration.

## Install

`https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/hotfix/v0.2.25.4-reversible-checkpoint-reveals/module.json`

## Live acceptance checklist

1. Duplicate a test Scene or take a world backup before trying a new rendering integration.
2. In GM Scene Atlas enable Party Exploration; set default reveal radius to 3 grid cells and save.
3. On the ordinary player client, set a checkpoint to Known through Lore inside unexplored fog. Verify only the Scene map image appears inside the circle, and the label shows.
4. Shift-click and set this checkpoint's radius to 1, then 0. Verify the circle resizes and disappears without removing its visible marker.
5. Set it back to 3, then change knowledge to Undiscovered. Verify its Atlas reveal disappears **without** clearing other legitimately explored terrain or another known checkpoint's overlapping reveal.
6. Try Seen / Visited; verify equivalent reveal semantics. Save/reload, reconnect player, switch Scenes and return.
7. Validate long-distance zoom/pan alignment and overlapping circles with Vision 5e enabled and disabled in a disposable test world.
8. Check that hidden tiles, tokens and roads do **not** become visible through the lore circle.
9. Disable Atlas and confirm native Foundry fog remains exactly as previously explored.
10. Test a Scene with no background image: Atlas should not create a fake reveal or cause a client error.

**Not included:** manual fog brush, writing to native FogExploration, party daylight sight, Vision 5e overrides, survey-radius-as-vision, actor token rebinding, or elevation-aware reveals.
