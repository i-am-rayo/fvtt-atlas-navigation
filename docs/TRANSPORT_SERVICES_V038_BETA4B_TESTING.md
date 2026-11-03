# v0.3.8-beta.4b — GM transportation services acceptance

Draft stacked on v0.3.8-beta.4a; **do not merge** until the owner signs off after Foundry v14 GM/player tests.

## Preflight

- Back up the World. Install `test/v0.3.8-beta.4b` through its branch manifest.
- Verify beta.4a Group-owned profiles, crew/wage settings, World catalogs and per-profile overrides are unchanged.
- No Actor currency, Scene flags, native Region/Behavior or World-clock values should change from viewing/editing preview estimates.

## World Transportation Presets — Services tab

1. Confirm General | Cost | Services tabs, with edits preserved when switching tabs.
2. Edit **Wagon**: reference for-hire quote 4 GP per operating day/unit, crew included (GM estimate, not official fare). Save/reopen. Switch D&D profile; old profile remains separate.
3. Edit **Coach ride between towns**: reference fare 3 CP/mile/passenger; edit price/frequency to Trip/Mile/Day; save/reopen.
4. Enable Wagon **Overtime** with extra hours 8 and multiplier 1.5; save.
5. Edit **Warship**: default continuous disabled. Enable **Continuous**. Confirm land animals/vehicles cannot enable continuous.
6. Keep any user-imported magical vehicles and old custom World entries unchanged unless the GM explicitly sets capabilities. No automatic bulk World migration.

## Navigation — schedule preview

Use the same ~90 mi route:

| Method | Standard | Overtime (if enabled) | Continuous (if enabled) |
|---|---|---|---|
| Wagon 3 mph | ~30h moving; **3d 6h elapsed** (8h/day + 16h overnight) | ~30h moving; **1d 14h elapsed** (16h/day + 8h overnight) | Not offered |
| Warship 2.5 mph on a compatible water route | 8h/day + 16h overnight | Only if separately enabled | 24h/day, no overnight, with GM confirmation of crew/magic |

- For incompatible road surfaces, Navigation must warn and **not** present a usable quote.
- Switching Owned ↔ Hire should use the World method speed for Hire, and the Group's slowest assigned matching resource for Owned.
- No guided mount/vehicle/ship movement or automated booking is unlocked.

## Navigation — hired service quote

1. Wagon set to Hire (without an owned Wagon Actor): provide a provisional quote based on passenger capacity and journey days.
2. One Wagon with 3 passengers, 12 moving hours:
   - Standard: 2 operating days × 4 GP = **8 GP**.
   - Overtime 16h/day: one operating day at 4 GP plus 4 overtime hours at 1.5× of the hourly fare = **7 GP**.
3. Coach between towns: 90 mi × 3 passengers × 3 CP/mile = **810 CP = 8 GP 1 SP**, before overtime.
4. Ship passage: confirm fare is per passenger/mile. Hiring should not also bill the party for vessel crew when crew is included in the hired fare.
5. Try a negative GM price adjustment (haggling) and a positive one (surcharge). Quote changes only; no currency is deducted or stored.
6. Hired availability states **provisional**: beta.4c will make checkpoint supply authoritative. Do not treat the quote as evidence the party has boarded or booked.

## Navigation — party-owned service and crew estimates

1. Warship Group resource, 60 crew at 2 GP/day each, with wages opt-in:
   - Standard: bill 8h operating days.
   - Continuous (when explicitly enabled): 24h operating days; cost changes consistently.
2. Overtime crew premium adds labor cost only for extra hours; owned feed/upkeep is not multiplied indiscriminately.
3. Disabling crew wages results in zero labor cost. Hired fare marked crew-included must not double charge.
4. GM quote adjustment never changes World presets, Group member settings or Actor currency.

## Compatibility and release gates

- Run all Node checks and tests, ensure manifest / archive refs point to the beta.4b branch.
- Validate on real Foundry v14 GM and non-GM clients; player cannot change GM transportation settings.
- Road rendering, fog and weather, route surface guard, Journey Journal, Foundry time, checkpoint interactions and native Regions remain stable.
- Keep the separate World preset layout polish in the UI backlog, as requested.
- beta.4c will add actual checkpoint offers and location-gated hire visibility.
