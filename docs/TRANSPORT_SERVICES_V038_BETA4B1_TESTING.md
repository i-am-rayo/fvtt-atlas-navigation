# v0.3.8-beta.4b.1 — GM navigation fare editor and Group form alignment

Stacked draft on v0.3.8-beta.4b. Do not merge before the owner's live GM and player checks.

## Group transportation presentation

1. Open the GM Party-owned Transportation window, Vehicles tab, Warship overrides expanded.
2. Verify Recurring cost override, Cost frequency override, Charge per, Purchase price controls share the same input top baseline and compact height despite optional help text.
3. Open NPC and Player Characters tabs; existing quantities, capacities, role links, speed/cost overrides and saved flags remain unchanged.

## Hired trip quote in Navigation

1. Select Carriage without an owned matching carriage; Arrangement should choose For hire by default (checkpoint supply filtering remains beta.4c).
2. At the same ~90-mile route, confirm a *World preset estimate* and a *Current hired service estimate* are both visible. The World preset fare label should reflect 4 GP per operating day per transport unit unless edited in World settings.
3. Change only the journey fare from 4 GP to 5 GP; current estimate changes, World preset estimate does not.
4. Change currency GP to CP: the editor displays the equivalent 500 CP, without changing the estimate. Change CP back to GP and verify 5 GP.
5. Change frequency to Per traveled mile, then Flat per trip; quote updates for the same route. Change Charge for each from Transport unit to Passenger and verify the party size multiplier.
6. Apply positive and negative CP negotiated adjustments. Confirm the baseline never changes, no negative final quote, and no currency is deducted.
7. Click Reset to World preset: amount, frequency, charging basis, denomination and negotiated adjustment return to defaults. Close/reopen Navigation or choose New Route: temporary changes are discarded.
8. If a Group Actor owns a matching vehicle, the selection defaults to Party-owned, with its inherited Group overrides unchanged; a GM may still switch to Hire when that method offers it.
9. On incompatible surfaces or methods with no available owned seats, availability warnings remain; these controls must never unlock guided non-walking movement or treat provisional hiring as a real checkpoint offer.

## Safety and regressions

- World transportation catalog, Group overrides, token position, Journal, Scene flags, World time and Actor currencies are not changed by price preview edits.
- Full Node stabilization suite must pass. Test in Foundry v14 as GM and with a non-GM client.
- Stable road geometry, fog discovery, weather and travel checkpointing unchanged.
- beta.4c filters offered/owned transport. Separately, rest automation from daily prompts and paused journeys needs a dedicated stateful milestone and native dnd5e actor-rest integration; it is deliberately not enabled here.
