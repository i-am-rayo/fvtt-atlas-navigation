# v0.2.25.3 — Checkpoint Discovery UI (Testing Hotfix)

This hotfix builds on v0.2.25.2 and is isolated in its own branch/draft PR. It is **not merged**.

## Scope

- When **Party Exploration is enabled** in a Scene, a checkpoint's discovery state is the single visibility control:
  - **Undiscovered** — hidden from players.
  - **Seen / Visited** — marker and name visible to players, regardless of the old `playerVisible` checkbox.
  - **Known through Lore** — marker and name visible to players, regardless of the old checkbox, including over unexplored terrain.
- The old `Visible to players` control is hidden in discovery-enabled Scenes, both in the Scene Atlas checkpoint list and the GM Shift-click checkpoint editor. The three discovery states are editable in both.
- In Scenes **without** Party Exploration, existing `Visible to players` behavior is preserved.
- Road names near checkpoint markers are suppressed on hover or dimmed for always-visible labels (screen-space radius 85px) to reduce overlaps.

## Fog distinction

**Known through Lore reveals the Atlas checkpoint marker, not the underlying terrain image.** Atlas does not permanently clear a circular patch from Foundry's native Fog Exploration in this hotfix. Automating terrain reveals requires a separate Foundry v14-compatible, permission-safe design and live testing. Do not turn off scene Token Vision or global fog to expose a checkpoint.

## Party vision intentionally deferred

The configured exploration source references a **placed scene token ID**, stable when that placed token is renamed. `Actor.CIAifBB2P6y7PhKz` is an **Actor document UUID**, not the placed TokenDocument ID; choosing the same Actor does not necessarily identify the same placed token. Vision 5e interaction, daylight sight, survey radius as actual vision, and token selection robustness belong to a follow-up milestone.

## Install for testing

Manifest:
`https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/hotfix/v0.2.25.3-checkpoint-discovery-ui/module.json`

The branch-specific archive is linked in that manifest. Reinstall/update via this manifest to avoid testing a different branch.

## GM / player live checks

1. Enable Party Exploration for a Scene with an explicitly assigned placed party token.
2. Add or select a checkpoint whose old `Visible to players` value is false.
3. Set it to **Undiscovered**; confirm the player cannot see the checkpoint.
4. Set it to **Known through Lore**; confirm the marker and its name appear in the player map even on unexplored terrain, without revealing underlying terrain.
5. Set it to **Seen / Visited**; confirm the checkpoint remains visible as an Atlas marker.
6. Shift-click the checkpoint as GM and change its discovery status, then reload and verify persistence.
7. Hover a road near and far from the checkpoint at different zoom levels; check the road label does not overlap checkpoint labels.
8. Confirm an older Scene with Party Exploration disabled still honors its original `Visible to players` toggle.
