# v0.3.8-beta.7.15.1 — native Level scene opt-in and checkpoint voyage

**Status:** automated tests only. Foundry v14 GM and non-GM live testing required.
Stacked on beta.7.15; prior PRs remain draft. Back up the World before installing.

## Changes and ownership

- The World **Atlas — Enable Native Scene Level Setup** setting defaults to **on**
  for fresh configurations. An existing explicitly saved `false` is preserved.
  **Each Scene remains off until a GM explicitly enables** Atlas Level setup
  in Scene Configuration → Atlas. This flag enables only the editor; it neither
  creates nor edits native Levels automatically.
- Editable presets represent **meters converted to the Scene's Grid units**:
  Surface 0–300 m, Aerial 300–3,000 m, Underwater −300–0 m, and Underground
  −3,000–0 m. On a Scene in kilometers, these appear as 0–0.3, 0.3–3,
  −0.3–0, and −3–0 **km**. Unknown Grid units receive no invented numbers.
- Atlas reads Foundry's native `Level` document IDs and permits the GM to
  explicitly **adopt/update a native Level in place**. A Scene with only the
  initial native `Level` offers it for Surface adoption by default; the GM
  must still preview and confirm. Its document ID is preserved, as are other
  flags and existing Regions. No automatic deletion or initial-Level remapping.
- Separate native `Level` documents can have overlapping vertical ranges.
  Atlas previews overlap warnings rather than rejecting legal native data.
  The `flags.fvtt-atlas-navigation.environment` semantic label differentiates
  underwater and underground; **elevation alone cannot distinguish them**.
  Explicit route/road Level ID bindings and automatic slopes are not yet part
  of this release. This editor does not move tokens or alter road geometry.
- A saved paused Journey whose **last checkpoint was confirmed** may start a
  single-surface water/air next leg when its arrival checkpoint and coordinate
  match the **next saved A/B/C target**. The GM must choose an available method
  in the current-leg selector and explicitly approve departure. Existing
  duplicate-arrival, permission, revision, native-token and Journal guards
  remain in force. Unapproved previews and manually stopped Journeys cannot
  use the new continuation path. No implicit booking or currency deduction.

## GM live acceptance (Foundry v14)

1. Back up the World. Install this branch's manifest, reload GM and player,
   check module version and errors. Verify an older saved `false` World setting
   remains off, or enable the World setting if previously disabled.
2. On an unmodified Scene, confirm Atlas's Scene Level editor is **off**.
   Switch it on and verify this alone neither creates nor alters native Levels.
3. In a **km Scene**, check Surface `0–0.3`, Aerial `0.3–3`, Underwater
   `-0.3–0`, Underground `-3–0`. Toggle categories and edit ranges. Preview
   multiple templates; cancel confirmation and verify native Levels unchanged.
4. With only Foundry's default `Level` (usually `[0,20]` but version/grid
   dependent), preview **Surface → Adopt/update Level**. Confirm and verify
   the **same native Level ID** now has the proposed name/range; its Scene
   initial Level, Regions, other flags and token elevations remain intact.
5. On a different test Scene, deliberately create two overlapping native
   Levels. Confirm Atlas warns but allows the two distinct IDs. Apply
   Underwater and Underground and inspect their distinct Atlas environment
   flags; verify neither is inferred solely from token elevation.
6. Reproduce **Walking → Port Barthos (B) → Continue from Checkpoint →
   Ship passage (hired) → Hearth's Heart Dock (C)**. The current journey leg
   must show the ship option and an enabled Play control after valid selection.
   Confirm departure, verify the token follows the waterway to **C**, with
   only one newly approved Journey leg. The original final destination D,
   approved fare estimate, Journal and World-time accounting must persist.
7. Refresh midway through the voyage: recover from native Token position,
   without replaying past travel/rest/time/booking. At dock C, do not replay
   C or unexpectedly show the Port Barthos route. A wrong/missing C checkpoint
   must leave the route blocked with a useful diagnostic; inspect the Journal
   before replanning.
8. As a non-GM, verify no native Atlas Level editing or authoritative
   gameplay actions are accessible. Check manual Regions, weather, fog, road
   appearance, Scene canvas lifecycle and Levels visibility as before.

If the native Level batch partially fails, **do not click Apply again without
reopening and previewing**. The UI reports failure, and re-preview reads the
current native Scene documents. Existing Journey Journals are not migrated on
read. Preserve both PRs as draft until the owner signs off.
