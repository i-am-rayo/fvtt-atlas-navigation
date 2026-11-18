# Atlas v0.3.8-beta.2.2 — Transportation UX and Group adapter testing

Stacked on draft v0.3.8-beta.2.1. Do **not** merge before owner GM/non-GM Foundry v14 acceptance.

## Scope

- Land / Water / Air section-title [+] controls, consistent Add/Edit field layout.
- Walking fallback is edited in displayed Atlas measuring units with a slider.
- Consistent per-transport-unit capacity and cost-basis/pricing controls.
- D&D 5e currency denomination controls use Foundry's available currency options; storage is unchanged (CP recurring and GP purchase).
- Group Actor read-only member projection with explicit GM NPC role, represented quantity, per-unit capacity and surface, stored in a separate versioned **Atlas World setting**.
- Journey: World-time checkbox before the playback slider, three stable example trips with live updates.
- Read-only Navigation seat warning for specific Group transport resources; guided non-walking movement is still disabled.

## In a Foundry v14 D&D 5e World (GM)

1. Open **Configure Transportation and Travel Rules**. Check that the three tabs are obvious and Land/Water/Air each has a [+] within its heading.
2. Add an Air method. Edit it and a built-in method; check all fields appear in a consistent order. Save, close, reopen.
3. Change a camel's per-unit passenger capacity and recurring cost in a chosen denomination (e.g. 1 SP per day = 10 CP/day). Verify saved values are consistent across reopening and changing Atlas Measuring Units.
4. Open **Walking (party pace)**. Verify the Group pace remains primary and only the fallback uses the slider; no unrounded conversion artifact should be shown.
5. In **Journey & playback**, verify World-time checkbox comes first. Drag/type animation speed; each of the three sample trip times should update immediately without changing trip distances. Verify nothing changes in Foundry World time before saving or traveling.
6. Assign a Group Actor as the Atlas party token. Add one PC, one Camel NPC and one Warship Vehicle. In the Transportation tab, verify 1 traveler, Camel unclassified, Warship shown separately. Set Camel role=Mount, number available=2, riders per unit=1; save, close, reopen and verify 2 seats and 1 traveler.
7. Add a second distinct Camel Actor with the same name. Confirm both remain separate entries (with different Actor IDs) and can have independent quantities. The same Actor ID should never be counted twice.
8. Add more PCs. Verify there are not enough Camel seats when quantity is less than travelers. A Warship's water seats must **not** count as Camel riding capacity.
9. Select Camel and Warship methods in Navigation with a planned route. Verify the advisory shows eligible riders and deficit, but **Travel Route** remains disabled for those methods.
10. Remove an Actor from the Group and reopen the preset window: Atlas should show only current Group members while retaining any dormant Atlas quantities for re-adding the Actor.
11. Verify editing Group transport assignments does **not** modify the Group member list, character/vehicle statistics, currency, Region Behaviors, Fog, or Scene roads.

## Non-GM checks

- Confirm transportation World editing stays GM-restricted.
- Existing player-visible roads/checkpoints and Atlas Fog should behave unchanged.
- Confirm the Group roster editor is not accessible to non-GMs. Atlas sends no custom sockets.
- Inspect the new World setting with a non-GM client: World-setting values may be synchronized by Foundry. Treat Actor IDs and role assignments as **not secret**, and do not put GM-only lore in these fields.

## Compatibility and limitations

- No automatic Animal/NPC role inference: an NPC may be a mount, companion, pack animal, crew or passenger.
- No automatic boarding, mixed-mode journey simulation, cost withdrawal, purchasing, rest/exhaustion or inventory deductions.
- The native Group Actor's **Primary Vehicle** is shown for reference only; it is not proof of embarkation.
- D&D 5e Group travel paces are daily travel values and must not be treated as hourly speed without dividing by travel hours/day.
- The separate Atlas Group quantity/role World setting has no migration side effects on reads.
- If no real Foundry runtime is available during CI, the above must be completed by the owner manually before merging.
