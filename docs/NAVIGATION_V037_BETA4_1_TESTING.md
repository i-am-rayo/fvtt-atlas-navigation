# Atlas v0.3.7-beta.4.1 — Travel Progress, Route Rest Cards, and Fog Refresh

Test build only. Back up the Foundry v14 world before testing. This is a draft PR stacked on beta.4; do not merge until live GM acceptance.

## What changed

- Under Journey progress, the percentage now has three companion values: **Travelled (moving)**, **Elapsed (with rests)**, and **ETA remaining (in-game)**. Values update with the visual journey; Foundry World time still advances only for confirmed native movement and explicit GM rests.
- The daily-limit prompt now describes the impact of **each** choice. Overnight Camp adds 16h downtime and resets an 8h D&D travel day; Long Rest adds 8h and resets it; Short Rest adds 1h and **does not** reset the day; Continue March allows 1h more movement (with an approximate distance at the route's overall pace) and shows the upcoming D&D Constitution-save DC. Custom rule lengths remain configurable.
- After confirming a rest or extended march, Directions adds an event card **at the exact moving-hour point**, splitting the interrupted direction into two. The saved Atlas road, native Regions and original v1 route itinerary remain unchanged. Multiple choices at the same stop are listed in the order confirmed.
- Repeated survey reveals of already-explored cells no longer write the unchanged Scene fog flag. The Atlas manual-fog overlay is rebuilt out of view and swapped only after complete, and a manual-fog-only update skips a costly full GM road redraw. Native token movement still uses short, independently confirmed segments for safe Pause/Resume/End.

## Live acceptance

1. On a **backup** world, confirm an active Atlas party token with Manual Fog enabled. Start a route longer than 8 moving hours, with the Navigator and map visible together. Watch the token at each short native segment boundary: **no full-black fog flash** should appear. If flicker persists, note whether the token sprite itself or the whole map turns black and whether another module is affecting Token Vision.
2. Check the progress row at approximately 40%, at the 8h limit, after a short rest and on arrival. The moving value should never include rest; elapsed should include approved breaks; ETA should shrink as the trip progresses and update when breaks change.
3. At 8h, read each option's visible impact. Short Rest adds 1h downtime but still requires a new decision. Continue March grants one additional moving hour and shows an approximate distance; the GM resolves exhaustion saves manually. Overnight Camp and Long Rest reset the next travel allowance as advertised.
4. Take a Short Rest **in the middle of a long road direction**. The Directions list should show the first portion of that road, a **Short Rest — 1h** card, then the remainder of that same road. If you then Continue March at the same stop, it should be listed in the correct order. The total route distance, remaining instructions and saved roads must not change.
5. Enable the World clock Module Setting and confirm **only** completed movement and GM-approved downtime advance Foundry World time. Repeat with the setting off, and with Pause / Resume / End Journey. No duplicate journeys, phantom clock jumps, Actor rests or exhaustion changes may occur.
6. Check a player client and revisit already-discovered areas. The fog must preserve GM and player visibility rules, including checkpoint reveals and manual Hide overrides. Native Foundry FogExploration must remain untouched.

## Limits

The ETA is an **estimated in-game duration remaining**, not a real-time video playback countdown or a calculated calendar clock timestamp. The extra-distance estimate for Continue March uses the route's average physical distance per moving hour; terrain transitions may vary locally. No automatic Actor long-rest resource recovery, fatigue penalties, or character exhaustion is introduced here.
