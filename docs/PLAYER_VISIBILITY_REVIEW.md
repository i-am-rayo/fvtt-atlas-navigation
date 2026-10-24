# Player road and checkpoint visibility — v0.2.24.2 two-client acceptance gate

**Status:** An explicit, visual-only player overlay and GM visibility switches are **implemented on the v0.2.24.2 draft branch**, not merged or live-verified. The owner accepts visual hiding instead of strong secrecy. A Foundry v14 simultaneous GM/player test remains mandatory before merging.

## Existing behavior and exposure boundary

- In v0.2.24.2, the **GM** retains full roads, labels, marker clusters and quick info. An ordinary player sees explicitly revealed road strokes, checkpoint glyphs, their own visible checkpoint names on hover, and road-name labels according to the road's own Off/Hover/Always setting. Hidden road names, checkpoint elevations, GM editor controls and graph handles remain excluded.
- Atlas roads/checkpoints are stored as a versioned namespaced **Scene flag**, not as native player Note documents. Scene data received by a connected player may include full names/coordinates/flags, even if Atlas does not render them. Do **not** advertise future visual hiding as protecting secret map data from technical inspection.
- Native Regions and their Behaviors are separate from display controls. Revealing/hiding an Atlas road must never toggle a native Region, or alter token movement.

## Implemented visual-only GM controls (draft)

1. Named roads and checkpoints each receive a **Visible to Players** toggle, independent of one another. New and previously authored items are *hidden* until opted in. The GM always sees the full overlay.
2. One schema-v9 revision-checked Scene flag save follows an explicit GM toggle or checkpoint inspector Save. All road/checkpoint IDs, geometry and Region data are preserved. Opening a Scene never writes a migration.
3. The player canvas draws only opted-in road strokes and checkpoint glyphs. A revealed checkpoint projects its **own name** for hover (or an always-on label), but its road association is **null unless that road is separately visible**, and elevation is always null. Its optional italic road subtitle appears only when the road is also revealed and the checkpoint's existing `showRoadName` option is enabled. Road name labels still follow each road's Off/Hover/Always setting. Numbered clusters show only counts and recompute on player zoom.
4. All edit, shortcut, elevation/GM quick-info and native-Region controls remain GM-only. Dedicated player hover listeners use only already-filtered revealed-road and revealed-checkpoint projections; there is no player Shift-click authoring handler. No socket, online icon API, or new network broadcast is added.
5. No server-side secret-data projection exists, **because the owner approved visual-only hiding**. Scene flags may still be distributed to players. If unrevealed roads need to be truly secret later, this design needs a server-authorized player-safe data channel rather than a canvas filter.

## Two-client Foundry v14 gate

Use a disposable backed-up World with separate GM and ordinary player browsers connected to the same Scene:

- Confirm the player sees no Atlas roads/markers *before* enabling visibility, including after a reload or reconnection. Existing GM overlay remains unchanged.
- Reveal one road and one checkpoint separately, then hide them again; both clients should update without requiring a Scene reload, and any existing native Region remains unchanged.
- Confirm a visible checkpoint on a hidden road shows **its own name only** when hovered—not the road name or elevation. With the road independently revealed and `showRoadName` enabled, the italic subtitle may appear. Hide the checkpoint again and confirm the label disappears immediately.
- Hover both a floating checkpoint icon and the original checkpoint node. Zoom out to a cluster and verify that only its count appears, then zoom back in and verify individual checkpoint hover names work.
- Confirm a player cannot open or save Atlas settings and does not intercept Shift-click authoring handlers. Check ordinary scene visibility/ownership cases and multiple connected players.
- Explicitly inspect the player's Scene document/console to understand what underlying Scene flags are distributed. Accept that **visual hiding is not confidentiality** before enabling this design.
- Test `canvasReady`, zoom/pan, Scene switch, disconnect/reconnect, and data revision conflicts; verify disabled-module behavior and no ghost overlays.

**Decision required before merge:** Owner reports the documented two-client test results. Player road names are visible only for revealed roads with allowed label settings; checkpoint names are available only for individually revealed checkpoints. Elevation and other GM-only metadata remain excluded. No Phase 3 routing or native token movement changes are part of this release.
