# v0.3.8-beta.3 — Party-owned transportation (GM / player acceptance)

This is a stacked draft built on v0.3.8-beta.2.2.2. Do not merge until owner verification in Foundry VTT v14 with D&D5e.

## Changes

- D&D5e Group sheets now show one GM-only horse icon between **Travel Pace** and the existing pace arrows. Clicking it opens **Atlas — Party-owned Transportation** for that exact Group; no Group selector.
- PCs, NPCs and Vehicles have separate sections. NPC roles remain explicit. Each Actor can represent a quantity of physical mounts or vehicles.
- GM links NPC mounts and vehicles to a stable World transportation profile ID (including optional custom World profiles), so Actor renames do not change route method matching, speed or price assumptions.
- Existing World Group assignments remain readable. Saved v1 entries are normalized to v2 in memory; only an explicit GM Save writes the new version.
- World Transportation Presets now manage the global method catalog and rules without embedded Group selectors. Their custom preset editor remains available from the Group window.
- Navigation's **Review mounts & NPC roles** shortcut opens the appropriate Group window.
- No automatic boarding, NPC auto-classification, native Group changes, Scene/Region changes, actor currency deductions, or non-walking token movement.

## Owner verification (GM)

1. Open the D&D5e Group Actor "The Party" on the Members tab.
2. Confirm the small transportation icon appears inside the **Travel Pace** header between the title and left pace arrow. Verify both pace arrows and Normal pace still operate.
3. Click the icon. Confirm the editor opens **for this Group only**, with separate PCs, NPCs and Vehicles sections, and *no* Group selection dropdown.
4. Confirm Camel and Riding Horse can be given role **Mount** with quantity and rider capacity. Choose their matching transportation profiles. Verify Warship's profile and water surface.
5. Rename Camel to another name (e.g. Biscuit) in its native Actor sheet and reopen Atlas. Confirm its linked **Camel** profile and seat count remain. Select Camel under Navigation and confirm correct matched capacity.
6. Create a custom profile through **Edit World Transportation Profiles**, return and refresh the Group editor, then link the new profile to a mount. Verify changing the Actor name does not change the profile.
7. With a pre-existing v1 World assignment, merely open/close the editor: World setting must stay v1. Save explicitly: saved entry becomes v2 and retains quantities, roles and capacity.
8. Test a Group with only PCs, one with no NPCs, and one with no Vehicles. Test rapid rerenders/closed/reopened sheets; no duplicate icon.
9. Verify the old World Transportation Presets window no longer contains a Group Actor selector or Group roster.
10. Confirm no native Group Actor members, Token positions, Scene graph, Regions, Fog, Journal or currency are changed.

## Player verification (non-GM)

1. Open the same Group sheet: **no transportation management icon** should appear.
2. Verify the player cannot access the editor or save Atlas Group assignments through a UI shortcut.
3. Confirm normal Group sheet display, pace selector and inventory remain unchanged.

## Additional regressions

- Existing 31h34m Riding Horse travel-day pricing still estimates 4 billable 8h days: three 5 CP/day mounts = 60 CP (6 SP), with no deduction.
- Only the relevant profile supplies seats. Camel mounts must not count toward Warship water seats.
- Generic Mounted method still counts all explicitly assigned mounts. Unassigned NPCs do not count as mounts by default.
- Missing/deleted World profiles show a remapping warning and do not silently select an unrelated method.
- Validate modules with `npm run check` and `npm test`. Live Foundry v14 remains a separate acceptance gate.

## Installation (draft)

Manifest: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.8-beta.3/module.json

Archive: https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.8-beta.3.zip
