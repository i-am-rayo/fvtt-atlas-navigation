# Atlas 0.3.12-dev.7 — finite hired transport inventory

Stacked on dev.6 / PR #466. These are **GM live-test steps**, not claims of live acceptance.

1. As a Foundry v14 GM, create/inspect an existing cart offer at a Map Marker with two seats/unit. Existing offers must open as **Unlimited availability** without a migration or Scene write on read.
2. In Transportation → Cart → Services, uncheck Unlimited, set Quantity available = **1** with the linked slider and numeric input, then **Apply Map Marker overrides** and save the parent marker. Reload both forms: Quantity 1 must persist at the same marker only. World Cart must not change.
3. At that marker, assign the Group explorer with **3 PCs and 2 NPCs, 4 required seats** (one NPC shares a seat). Navigation must show 4 seats needed, 2 carts required, 1 available; GM cannot authorize Travel. Verify no TokenDocument move, Journey Journal, World-time increment, currency deduction, or booking.
4. Change Quantity available to **2**; same 4-seat itinerary should be eligible, using **2 units** for the quote. Restore **1** and check that both Journey confirmation and subsequent revalidation reject the departure.
5. Set Quantity **0** and later Unlimited: zero blocks; unlimited permits the estimate. Reset Map Marker overrides to inherit World and confirm older offers remain effectively unlimited.
6. Compare second marker's supply to prove location isolation; compare trip-only edit versus Save to Map Marker and Cancel. A World preset edit must not silently turn finite supply into unlimited or modify another checkpoint.
7. Test per-unit and per-passenger fares, per-day and per-distance pricing, 8-hour and overtime service days, legacy and unknown capacity, and long trips. Quoting never deducts currency.
8. Verify a multi-surface transfer leg also rejects insufficient checkpoint units before any movement. Resume an already approved, interrupted Journey with its saved speed and arrangement, without rebooking or recharging.
9. Repeat with non-GM permissions, 100%/200% UI scale, keyboard slider/number interactions, and canvas reload. Players must not gain edit or GM approval access.

**Mixed walking-plus-cart convoys:** deliberately separate implementation and Journal acceptance gate. The pure quote can reserve a cargo-only unit; this dev.7 UI does not yet authorize mixed walking/vehicle travel or represent multi-method Journey sessions.

**Validation:** `npm run check`; `npm run architecture:check`; `git diff --check`; Foundry v14 GM and non-GM acceptance required before merge.
