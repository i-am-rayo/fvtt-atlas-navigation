# Atlas 0.3.12-dev.8 — GM walking + cargo convoy
Stacked draft on PR #467. **No World, Scene, Actor, Token, currency or Journey writes during preview.** Part of Issue #468.

## Intended scope
- GM chooses **Walking (party pace)** then turns on **Travel together — walking + cargo**.
- Only checkpoint-offered, land, per-unit hired vehicles appear as cargo choices. The GM selects one or more types and whole-number unit counts. All Group members, including NPCs, walk; no one boards a cargo vehicle and no passenger seats are consumed.
- Native Scene walking terrain costs remain applicable. The shared speed is the slower of walking and every chosen vehicle, or an explicit slower GM pace. Per-day fares are re-estimated using this shared pace, then added; there is no hire booking or payment.
- GM confirms the selected vehicles, units, speed, travel time and estimated price. Atlas rechecks Group, route, units and offer terms after confirmation and saves a validated convoy snapshot in the authoritative Journey Journal before native TokenDocument movement.
- Interrupted approved journeys restore the snapshot and saved speed. Supply and World fare changes after authorization do not rebill, reapprove or change recovered speed.

## Foundry v14 GM acceptance
1. At Hearth's Heart Dock with a cart of two passenger seats, quantity **1**, and four seat-requiring travelers, verify **Cart carrying everyone** remains blocked from dev.7.
2. Choose **Walking (party pace)**. Enable cargo, select **Cart quantity 1**, then confirm. It should be allowed because all travelers walk and the cart carries only unspecified cargo (cargo mass is a GM responsibility).
3. At 20mi, 2mph walking and 4mph cart, verify **2mph** and **10 moving hours**. For a 100 CP/day cart and 8h operating day, the estimate must be **200 CP**, not the cart's 5h/100 CP fare. No money deducted.
4. Change cart quantity to 0 then 1 at checkpoint: zero should block **before** Journal/Token movement; quantity one should permit. Increase selected cargo to 2 with stock 1: block. Repeat with unlimited availability.
5. Select both cart and wagon; verify slowest applicable pace, each selected finite quantity, sum of independent quotes. A per-passenger coach must not appear as a cargo-only option.
6. Change checkpoint supply/terms or the Group roster **during the GM confirmation**. It must reject the stale approval, without starting movement, time or payment.
7. Confirm and interrupt a real journey, reload canvas, recover as GM. Approved speed/selection must remain unchanged; there must be no repeated movement, World time, fare or boarding.
8. Verify the saved Journal has a readable cargo breakdown, and that an older single-method Journal still resumes as before.
9. Check narrow Navigation window, keyboard interaction, non-GM authorization, Canvas refresh, World time, Atlas fog, and local hire limits.
10. Confirm mixed surface routes, passengers boarding a vehicle, and split-party speeds are **not supported** in this increment. Do not bypass the guard.

## Verification gate
Run `npm run check`, `npm run architecture:check`, syntax checks and `git diff --check`. Also require Foundry v14 live GM **and** non-GM acceptance before merge.
