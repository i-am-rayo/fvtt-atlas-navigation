# Atlas v0.3.8-beta.2.1 — Transportation UI and measuring units (draft)

**Stack:** draft beta.2.1 on unmerged v0.3.8-beta.2 PR #112.
**Owner acceptance:** pending on Foundry v14; do not merge.

## Included

- Fixed Foundry v14 \`DialogV2.input\` failures reported in the GM's logs:
  \`config.content element must have no attributes\` from \`navigation-transport-settings.js\`.
  An unstyled outer \`div\` now contains the styled form; post-render range
  listeners are reconnected after Foundry serializes the HTML.
- Atlas Measuring Units World setting: System Default / Metric / Imperial.
  D&D 5e System Default respects \`dnd5e.metricLengthUnits\`.
  Navigation, Travel by preset rates, Journal render output, checkpoints and
  token discovery-radius editing share one conversion module.
- Source measurements remain in native Scene units; transportation catalog
  speeds remain in mph, prices in CP per mile, elevations in meters.
  Conversion is display/input only. No saved flags or active Journeys migrate.
- Tabs have distinct selected-state appearance, roles and labels.
- Land / Water / Air travel have independent Add buttons. Presets use
  accessible Edit, Reset and Delete icon actions.
- Travel rule hours and animation speed now pair a slider with a numeric input.
- The optional workbook import now includes Pegasus, Griffon, Phantom Steed,
  four Flying Carpet sizes, Broom of Flying, other supplied flying objects,
  Wind Walk, Eberron Lyrandar Airship/Galleon and Orien Lightning Rail,
  and Acquisitions Incorporated Battle Balloon and Mechanical Beholder.
  Built-in 2024 overland rules remain separate. 2014 rowboat and warship speeds
  differ where the supplied workbook indicates.
- Existing beta.2 imported custom creature IDs/names and GM edits are preserved.
  The UI omits the confusing "optional tireless" suffix without mutating
  the stored record. An optional workbook import only adds missing examples.

## Foundry v14 GM test

1. Back up the test World; install from the branch manifest below.
2. In D&D 5e System Settings leave **Use Metric Length Units** unchecked.
   In Atlas settings set **Atlas Measuring Units → System Default**.
   Open Navigation on a Scene stored in km: distances should show miles,
   speeds mph, elevations feet.
3. Toggle D&D 5e Metric Length Units, refresh or reopen the UI. Atlas should
   display km / km/h / meters. Test explicit Metric and Imperial overrides
   regardless of the D&D toggle. Existing route ETA must not change.
4. Open **Atlas — Transportation Presets** and visit all three tabs.
   Click the **Land / Water / Air travel [+]** buttons; confirm each editor
   opens, has the correct preselected surface and that cancelling never saves.
   Add a custom mode, edit its speed, drag the speed slider, and verify edits
   persist after closing/reopening.
5. Edit a built-in mode and reset it. Delete a custom mode using the icon.
   Check readable icon labels by hovering and keyboard accessibility.
6. Select **Import optional workbook examples**. Check Pegasus, Griffon,
   Phantom Steed, carpets, spell effects, Eberron and Acquisitions Inc. vehicles.
   Import again; no duplicates, overwrites or GM adjustments should be lost.
7. In Travel rules and Journey & playback move a slider, type a precise value,
   save and reopen. The two input controls should stay synchronized.
8. Verify a previously saved Journey Journal remains recoverable, including
   World time, stops and departure/arrival. Confirm distance text uses the
   configured Atlas units on the next Journal update.
9. Check with a non-GM client: the GM-only editor and destructive actions
   remain restricted. Verify roads, Fog, weather and checkpoint exploration
   remain unchanged.

## Deferred by design

- Guided travel for mounts/ships and checkpoint embark/disembark triggers.
- Existing minor canvas flicker and session teardown issue.
- Historical generated Journal pages are static until re-rendered by the
  journey writer; source flags remain authoritative and untouched.
- A Scene's \`grid.units\` still defines its native coordinate and speed
  calculation basis. Unknown nonstandard grid units are left unchanged
  rather than assigned an incorrect conversion.

## Install on test branch

Manifest:
https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.8-beta.2.1/module.json

Archive:
https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.8-beta.2.1.zip

**Leave both beta.2 and beta.2.1 draft PRs open and unmerged.**
