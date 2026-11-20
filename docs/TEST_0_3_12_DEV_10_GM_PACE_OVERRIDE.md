# Atlas 0.3.12-dev.10 — explicit GM walking-pace exception in mixed cargo convoys

Stacked on draft PR #470 (dev.9). Owner feedback from 2026-11-20: 3 mph Walking + 4 mph hired Cart should allow an **explicit GM-authorized 4 mph walking-pace exception**. This is not permission to silently exceed any participating vehicle's speed.

## Invariants
- The recommended convoy speed remains the slowest configured participant (3 mph in the reported example).
- GM may select **GM pace override** and enter 4 mph. Values use Atlas global measurement units for presentation and input; calculation, Token movement, World time and Journal continue to use native Scene units.
- A faster-than-recommended pace may **only override the walking component**. It must not exceed the speed of **any** hired cargo vehicle. 3 mph walking + 4 mph cart => GM's 4 mph valid; 5 mph is blocked. Walking + a 3 mph cart => 4 mph blocked.
- The GM must explicitly confirm the exceptional pace. The confirmation identifies recommended and approved speed, explains that all walkers must keep up, and states that Atlas does not change Actor speeds or enforce fatigue.
- A validated, version-one convoy snapshot retains the approved speed, recommended speed and exceptional GM-authorization marker. Existing dev.8/dev.9 convoys without the marker remain valid if at/below recommended pace. An unmarked faster pace, tampered vehicle speed or invalid measurement unit fails closed.
- Journey Journal displays the GM-approved pace exception and keeps its saved speed for interrupted/recovered travel without re-estimating, rebilling, or duplicating Token/World-time changes.
- Hired daily rates use the approved moving hours. No automatic booking, Actor mutation, fare deduction, or cargo mass allocation is added.

## Owner Foundry v14 acceptance
1. At Hearth's Heart Dock, choose a valid party route, **Walking** plus **one Cart**, with Walking 3 mph and Cart 4 mph. Default recommended shared speed is **3 mph**.
2. Select **GM pace override**, enter **4 mph** (or **6.44 km/h** under the metric preference). Verify the route Time/Total Trip and price estimates recalculate, and the Play/Start action becomes eligible if all other requirements are satisfied.
3. Start Travel: a GM confirmation must identify both the original recommended speed and the chosen **4 mph** exceptional pace. Cancel = no Journal, native movement, currency, Actor or World-time write; confirm = one approved Journey.
4. Attempt 5 mph when Cart is configured for 4 mph: block. Add a second cargo vehicle slower than 4 mph and retry 4 mph: block. No fallback to an apparently valid time or unauthorized Token move.
5. Confirm a longer 30-mile test with a 100 CP/day Cart and 8h/day service: at 3 mph, 10 moving hours = 2 operating days / 200 CP. At explicitly approved 4 mph, 7.5 moving hours = 1 operating day / 100 CP. All price figures are estimates only.
6. Pause/interrupt, reload, canvas redraw and resume. Verify the same approved faster pace and Journal notice survive without reapproval, currency deductions, Actor changes, double time or movement.
7. Verify legacy dev.8/dev.9 approved convoy records still load, current single-method travel stays unchanged, unauthorized speed flags are rejected, and non-GM users cannot approve or alter a Journey.
8. Recheck keyboard/radio/number entry, invalid or empty values, narrow window and Atlas metric/imperial preferences.

## Verification requirements
`npm run check`, `npm run architecture:check`, syntax, Node regressions, and `git diff --check`. Owner Foundry v14 GM + non-GM acceptance remains required before merging any stacked draft PR.
