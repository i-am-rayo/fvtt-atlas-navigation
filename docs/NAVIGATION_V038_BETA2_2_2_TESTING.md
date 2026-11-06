# Atlas v0.3.8-beta.2.2.2 — Mounted travel-day and feed-cost correction

Stacked draft on v0.3.8-beta.2.2.1. **No merge before owner Foundry v14 GM/non-GM live testing.**

## Focused correction

- A Land Mount preview now projects the configured D&D overland travel-day policy, normally 8 hours of movement plus 16 hours overnight downtime.
- World Rules Profile overrides still apply (custom daily-hours/overnight policy).
- Mount feed upkeep now bills by the **number of projected travel days**, not by 24 moving-hour periods.
- Group costs remain quantity-based for mounts (not merely character count), and daily breakdown explains quantity, days, hourly allowance, and rate.
- Other transport methods, including ships and airships, continue to use their previous movement-only time previews and unchanged cost schedule until method-specific policies are designed.
- No non-walking guided token movement, actual boarding, purchased resources, currency deductions or World clock mutation is enabled.

## Reproduce with the owner's values

For a Group with 3 Character travelers and 3 Riding Horses explicitly assigned as mounts:

1. Plan a 94.72-mile Riding Horse route using 3 mph.
2. Check that Travel Time remains about **31h 34m**.
3. Check that Total Trip now shows approximately **3d 7h 34m** (31h 34m movement plus 3 planned 16-hour nights).
4. Check that Group feed-cost preview shows **6 SP** (3 horses × 5 CP/day × 4 eight-hour travel days = 60 CP).
5. Confirm **Travel Route** remains disabled for Riding Horse; this is still an estimate, not a travel-mode transfer.
6. Change the mount quantity to 1, refresh Navigation and check 1 land seat, 2 seats short, and one-horse feed-cost preview for the same trip.
7. Check the Warship and Ship passage: neither gains automatic 8-hour limits or overnight breaks.
8. Check Walking estimates, World clock, persistent exploration, roads/checkpoints, and existing Group assignments do not regress.

For custom World travel rules (e.g. 6 hours/day), verify the projected mount days and feed costs follow the configured rule, rather than a hardcoded 8h.

## Deferred architecture

Party-owned mount/vehicle roster editing from the native Group sheet menu, stable Actor→transport preset bindings, and checkpoint-offered hired methods are deliberately **not** part of this stabilization hotfix. They require separate schema migrations, Foundry v14 integration, and GM/player testing.
