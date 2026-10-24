# Player road and checkpoint visibility — v0.2.23 review gate

**Status:** Design reviewed in code; **no player-facing Atlas overlay or visibility flag is activated in v0.2.23**. The owner explicitly accepts *visual-only* hiding rather than strong secrecy. A Foundry v14 two-client acceptance test is still needed before the feature is enabled.

## Existing behavior and exposure boundary

- As of v0.2.23, Atlas draws roads, markers, clustered markers and quick info only when `game.user.isGM`. The module does not send a player overlay or expose GM-only editor controls to players.
- Atlas roads/checkpoints are stored as a versioned namespaced **Scene flag**, not as native player Note documents. Scene data received by a connected player may include full names/coordinates/flags, even if Atlas does not render them. Do **not** advertise future visual hiding as protecting secret map data from technical inspection.
- Native Regions and their Behaviors are separate from display controls. Revealing/hiding an Atlas road must never toggle a native Region, or alter token movement.

## Proposed visual-only GM controls (future follow-up after live review)

1. Named roads and checkpoints each receive a **Visible to Players** setting, independent of one another. New and previously authored items default to *hidden* on the player overlay; GM overlay remains visible to the GM.
2. At most one schema-v9, revision-checked Scene flag save is made after an explicit GM toggle, preserving stable road, node, segment, checkpoint and Region references. Opening a Scene or module update never writes a migration.
3. Player canvas renders only explicitly visible road strokes/names and checkpoint markers/labels/cluster previews. Hide a road without hiding a checkpoint only if the GM deliberately chose that combination; a visible checkpoint can reveal its road name through current label settings, so preview text must not mention a hidden road automatically.
4. All edit, tooltip, shortcut, and native-Region controls remain GM-only; a player may inspect visible map information, but cannot change it. No network API or third-party icon fetch is required.
5. No socket projection or server-side secrecy layer is proposed at this time, **because the owner approved a visual-only feature**. If actual unrevealed-road confidentiality becomes important, this must be redesigned with a player-safe projection before publication.

## Two-client Foundry v14 gate

Use a disposable backed-up World with separate GM and ordinary player browsers connected to the same Scene:

- Confirm the player sees no Atlas roads/markers *before* enabling visibility, including after a reload or reconnection. Existing GM overlay remains unchanged.
- Reveal one road and one checkpoint separately, then hide them again; both clients should update without requiring a Scene reload, and any existing native Region remains unchanged.
- Confirm a visible checkpoint on a hidden road does **not** inadvertently show that road's name in hover previews, lists, labels, or cluster text.
- Confirm a player cannot open or save Atlas settings and does not intercept Shift-click authoring handlers. Check ordinary scene visibility/ownership cases and multiple connected players.
- Explicitly inspect the player's Scene document/console to understand what underlying Scene flags are distributed. Accept that **visual hiding is not confidentiality** before enabling this design.
- Test `canvasReady`, zoom/pan, Scene switch, disconnect/reconnect, and data revision conflicts; verify disabled-module behavior and no ghost overlays.

**Decision required before implementation:** Owner confirms the documented two-client results and the visual-only disclosure boundary. No Phase 3 routing or native token movement changes are part of this review.
