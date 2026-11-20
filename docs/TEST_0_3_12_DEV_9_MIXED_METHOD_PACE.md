# Atlas v0.3.12-dev.9 — unified travel-method selection and convoy pace

Stacked draft PR on dev.8 (#469). Follow-up to GM live annotations of 2026-11-20. **No merge or release authorized.**

## Decision and boundary
- Existing single-method journeys remain unchanged for valid capacity; the source selector is now multi-select, but **only walking Group + checkpoint-hired per-unit land cargo vehicles** can be combined safely.
- Each compatible method appears in **one Travel method fieldset**. Selecting Walking + one or more eligible hired cargo options reveals an inline speed comparison and a single recommended-vs-custom-slower shared pace decision. Selected cargo counts are explicit in the comparison, not a second mode selection.
- Atlas globally selected metric/imperial units are used consistently for the walker, cart, speed comparison, custom entry, and GM confirmation. Conversions are presentation/input only: the Scene remains the authoritative speed unit and stored World presets remain canonical mph.
- A shared group never moves faster than its slowest participant; a faster override, zero quantity, or exhausted finite stock blocks approval. Cost uses the approved shared *moving* hours; an 8h operating-day rate never uses a faster standalone vehicle duration.
- A solo hired cart that lacks seats for the full Group is not an approved journey: **Travel Time / Total Trip are unavailable**, rather than showing the cart's theoretical unloaded speed. The capacity warning and disabled Travel action remain intact. Invalid mixed pace similarly hides stale route/direction duration while retaining enough information to correct the entry.
- Single-method playback and approved Journal records are unchanged; prior approved speed and quote are still recovered from the Journal, not reconstructed on canvas reload.
- Multi-boarding, personally assigned mounts mixed with walkers, split parties, and mixed-surface legs are not newly authorized. An unsupported second selection is rejected when a convoy is active; otherwise it switches to a *single* method with an explicit notice, not a phantom mixed journey.

## Owner GM + non-GM acceptance (Foundry v14)
1. With **Atlas measuring units = Metric** while Scene uses miles (and vice versa), select Walking and a Cart at Hearth's Heart. Verify *all* speeds show km/h or mph consistently, and displayed walking/cart speed difference is dimensionally correct (3mph walking = 4.83km/h; 4mph cart = 6.44km/h; delta +1.61km/h).
2. Choose Walking + Cart directly in the **Travel method** cards. The inline comparison appears within that fieldset; there is no separate “Travel together” checkbox or duplicated cart selector. Uncheck Cart to return to Walking; uncheck Walking with exactly one cargo vehicle to return to single Cart.
3. With four seat-requiring travelers and finite one two-seat cart, **Cart alone** must show insufficient seats and unavailable party travel/total time. **Walking + Cart cargo-only** may be valid for one unit.
4. Change to **custom slower** speed (e.g. 4km/h if suggested 4.83km/h); verify moving travel time, overnight/total trip, and day-rate hire cost update together. Select recommended speed again; ensure all values revert.
5. Enter a *faster* custom pace (e.g. 7km/h when Walking is 4.83km/h). Show a clear blocking message; Travel must be disabled and time/total trip/direction duration must not silently revert to walking or cart estimates.
6. Test second and third eligible cargo method selections, finite quantity limits, invalid integer quantity, and selected party subset. Unavailable passenger/owned-mount combinations must not claim shared approval.
7. Start an approved trip, pause, reload/canvas teardown, resume, complete, and inspect World time/fog/Journal and no double fare. Verify non-GM cannot authorize or leak hidden offers.
8. Check keyboard navigation, checkbox labels, screen-reader names, narrow window and exact fare/pace confirmation text. Older dev.8-approved Journey recovers without a forced migration.

## Verification
Run Node regression tests, npm run check, npm run architecture:check, syntax checks, git diff --check, then **Foundry v14 GM and non-GM live acceptance**. Draft only until owner acceptance.
