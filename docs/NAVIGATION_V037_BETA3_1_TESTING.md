# v0.3.7-beta.3.1 — World time and travel-day display hotfix

Test in a backed-up Foundry v14 World. This build can advance the canonical World clock when its existing World setting is enabled. Other time/calendar modules may respond to Foundry World-time updates; do not assume test time can be automatically undone.

## Module setting is the only time switch

1. Leave **Configure Settings → Module Settings → Atlas Guided Travel — Advance World Time** off. Calculate a route; Navigation must show **no** per-journey time checkbox. Complete a journey and confirm Foundry World time is unchanged.
2. Enable the World setting as the active GM. Reopen Navigation; no checkbox appears. Complete another journey and confirm the clock advances automatically after each confirmed movement segment and on arrival.
3. Disable the World setting again. A new journey must no longer advance time. The existing setting key and previously saved selection must remain intact through module reloads.

## Travel days are not calendar days yet

1. Assign a D&D Group Actor with an **eight-hour travel day**. Choose a route estimated at **2 travel days + 1h 19m**. The primary Navigation metric should read **Travel time (moving): 17h 19m**. A separate note should read **Travel-day estimate: 2d 1h 19m (8 travel hours/day; overnight rests not included)**.
2. With World time enabled, a completed journey should advance the Foundry clock by approximately **17h 19m**, not 49h 19m. Atlas applies the exact confirmed seconds; the UI rounds to the nearest minute.
3. On another configured daily allowance (for example 10h/day), confirm the travel-day explanation adjusts while the total active travel hours and World-clock delta stay unchanged. Non-D&D or unknown daily allowances must still show active hours without inventing a rest rule.

## Existing safety behavior

1. Pause partway through a journey. Confirm the World clock advances only for completed road stretches, remains unchanged while paused, and resumes with confirmed movement.
2. End a paused journey. Confirm the untraveled remainder receives no time credit, the token remains at the last reached point, and progress stays below 100%.
3. Confirm a non-active GM cannot start a World-time-enabled journey. If Foundry rejects a World-time update, further Atlas movement must stop and no uncommitted time may be reported.
4. Re-test curved road travel, Scene changes, road/Region integrity, and reaching 100%. No Scene/Actor/Region behavior changes are included.

**Deferred:** Automatic overnight rest time, short/long rest prompts, daily travel limits, exhaustion and Actor modifications. Those require separate system-aware approval and live testing in the following milestone.

Automated verification: `npm run check`; live Foundry v14 GM testing remains required before merging.
