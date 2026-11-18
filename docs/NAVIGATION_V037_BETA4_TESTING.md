# Atlas v0.3.7-beta.4 — Daily Travel, Rest, and Time Management

Test build only; please back up your Foundry v14 world before testing. This build is a draft PR, not a released/merged production update.

## What changed

- Navigation now shows **Distance | Travel Time | Total Trip** together. Travel Time is moving hours; Total Trip includes planned overnight downtime. For example, 17h19m moving with two overnight camps of 16h becomes **2d1h19m total**, not a 17-hour clock jump.
- **Atlas Guided Travel — Rules Profile** in Module Settings supports 2014/2024 D&D, system default and custom travel-day settings. For D&D use 8h of moving time per day and 16h of overnight downtime including rest. Unknown non-D&D systems have no automatic day limit under System default.
- At the travel-day boundary Atlas waits for the GM to select **Overnight Camp**, **Long Rest**, **Short Rest**, **Continue March** or **End Journey**. No travel segments are queued while the decision is pending. The next road segment is split at the exact boundary, including on curved paths.
- Overnight camp resets the Atlas travel-day allowance and adds 16h; long rest resets it and adds 8h; short rest adds 1h but *does not* reset it. Custom durations are in Module Settings. Continue March authorizes one more hour and displays the forced-march Constitution-save DC for manual adjudication.
- The existing global **Atlas Guided Travel — Advance World Time** setting is still the *only* time-advance switch and defaults to off. If enabled, only the active GM commits completed travel and specifically chosen breaks using Foundry World time. Actual elapsed clock time is shown separately from estimated Total Trip.
- **No D&D Actor rests, resources, exhaustion, penalties, coins or native Region Behaviors are modified by Atlas.** The GM resolves saves and character effects manually. Total Trip is a planning estimate that updates when actual decisions differ.

## GM acceptance test

1. On a backed-up v14 Scene, assign an Atlas party token and calculate a road route. Confirm three metric cards and no unexpected change to existing Road/Checkpoint settings or the drawn route.
2. With D&D 2014 or 2024 rules chosen, calculate a trip lasting over 8h, e.g. 10h. Verify **Travel Time 10h** and **Total Trip 1d2h** (10h movement + 16h planned camp). The D&D 2014/2024 profiles should be separately selectable.
3. Start Travel Route. At 8h of confirmed moving time, verify the token waits and the **Overnight Camp / Long Rest / Short Rest / Continue March** actions appear, while Pause/Resume/End continue to behave safely. Choose **Overnight Camp**: the token continues to the destination; Total Trip includes the 16h rest.
4. Repeat with **Short Rest** at 8h. Verify that 1h is added but the day remains spent, requiring another choice. Choose **Continue March** for one hour, observe the manually adjudicated Constitution-save DC 11 warning, then continue again for hour ten (DC 12). Atlas must not silently alter an Actor's exhaustion.
5. Test **Long Rest** and one custom profile (e.g. 6h daily moving, 12h overnight, 0.5h short rest, 10h long rest). Verify the stop occurs exactly at the configured limit and Total Trip recalculates from GM decisions.
6. With World time **off**, the party travels and stops for rest but Foundry time does not change. With it **on**, capture a World-clock before/after: a 10h trip with a confirmed 16h overnight advances **26 hours**; ending before a rest adds *only* already confirmed moving time. The displayed trip estimate alone must never advance the clock.
7. Pause or End Journey near a day boundary; verify the party token stays at its last confirmed road position, no ghost queued movement starts, and no unapproved downtime is credited. Test returning to the Navigation window after arrival.
8. Check **System default** with an unrelated game system: no D&D-based break prompts should be forced. Switching to **Custom** explicitly should enable the chosen day limit.
9. As a non-GM, verify there is no new privilege to initiate guided travel or advance World time. Check Foundry console for errors and test after refresh.

## Safety and pending features

Pauses/ends remain native bounded `TokenDocument.move` operations. The World clock ledger credits confirmed travel and approved rests separately and never retries a failed clock write automatically. If Foundry rejects a time advance, remaining travel stops. Repeated rests are bounded. No automatic long-rest game-system action, forced-march exhaustion, dynamic speed reduction, travel method, vehicle behavior or player-owned travel is implemented in beta.4. Those require their own permissions, game-system adapter and live v14 test gates.
