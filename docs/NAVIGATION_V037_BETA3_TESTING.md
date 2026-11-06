# v0.3.7-beta.3 — Optional World-time advancement during guided travel

**Test in a backed-up Foundry v14 World.** Unlike earlier guided-travel betas, this phase may write the canonical World clock. Foundry's own World-time hooks and any installed calendar/time modules can react to it. No automatic reversal is provided if you decide to discard a test journey.

## Preparation

1. Confirm the previously accepted beta.2.3 Pause, Resume, End Journey, curved travel and progress bar remain usable.
2. Check **Configure Settings → Module Settings → Atlas Guided Travel — Allow World Time Advancement**. It must be **off by default**, even in upgraded Worlds. With it off, Navigation should show a disabled per-journey clock option and travel should not change Foundry World time.
3. Enable the setting as GM. Open Navigation and check **Advance Foundry World time during this journey**. The box should be unchecked by default on every new journey. A Journey is never opted in merely because the World setting is enabled.

## Acceptance tests

1. Start a simple road journey with a known travel-hour estimate. Check World time before starting. After a completed journey the World time must advance by the route's **terrain-aware travel hours**, not by the real-time animation length. For example, a four-hour journey advances the World clock by approximately four hours, whether the token takes eight or 30 real seconds to animate.
2. Choose a displayed multi-day journey (for example, **2d** of eight-hour travel days). The World clock must increase by approximately **16 hours of actual movement**, not 48 hours: overnight rests do not happen automatically in this beta. The Navigation panel shows the World time actually advanced.
3. Pause the token about a quarter of the way into a longer journey. Allow the short current stretch to finish. World time should stop advancing while the token remains paused. Resume and confirm time continues only after further successful movement.
4. **End Journey** partway through. Confirm only traveled stretches add time, the cancelled remainder does not, the token doesn't return to Point A, and the progress bar stays below 100%.
5. Start another journey without rechecking the per-journey clock box. Confirm no World time changes. **New Route**, departure changes and Scene changes must also clear the opt-in.
6. With two logged-in GMs, only the user Foundry designates as `game.users.activeGM` can start a time-advancing Atlas trip. A non-active GM cannot write time through Atlas. Player travel remains unavailable in this release.
7. Use a route with native Regions/Behaviors and a terrain-weighted cost. Time must still follow the calculated weighted travel hours; native movement restrictions, checkpoint discovery and Atlas road geometry must remain intact.
8. If the World setting is disabled during travel or a World-time update fails, Atlas should stop queuing further movement and report the clock error. It must not silently retry the failed delta or claim 100% completion.
9. Test alongside existing calendar/time modules or Foundry clock displays and watch for duplicate updates. Atlas alone should make the World-time write for each confirmed increment; installed modules may react to Foundry's ordinary time-update hook.

**Safety boundaries:** The explicit opt-in changes only `game.time.worldTime` via Foundry's documented API. Atlas does **not** add sleep, short/long rests, daily travel limits, exhaustion, recovery, Actor changes, money, or Journal records in beta.3. Those will be a separate, system-aware milestone after this live test.

Automated verification: `npm run check`; live GM and two-client review is required before merging.
