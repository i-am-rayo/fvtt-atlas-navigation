# v0.3.9-beta.6 — Stationary Rest Playback (Owner test)

## Report and diagnosis

The owner observed in beta.5 that selecting **Long Rest (8h)** at the GM daily
travel prompt immediately sent the token into the next native movement stretch;
the supplied 5.8-second screen recording reproduces it. The existing workflow
already committed the eight hours to Foundry World time and the Journey Journal,
so the missing element was visual dwell, not a missing rest transaction.

## Test with GM and player in Foundry v14

1. Set **Animation speed** to **4 real seconds per in-game travel hour** in
   Transportation Presets → Journey & playback. Plan a land route requiring
   more than eight moving hours. Keep both GM and non-GM screens visible.
2. At the eight-hour stop choose **Long Rest (8h)**. The party token should stay
   at exactly the same road position for approximately **32 real seconds**,
   while both screens show the queued **Break Started** banner.
3. Confirm **Break Ended** is sent after the visual interval, before Atlas
   submits the next native TokenDocument movement. Subsequent movement uses
   the existing route, speed, and checkpoint itinerary.
4. Verify the Journal contains **one** eight-hour rest, World time gains **one**
   eight-hour downtime interval, the token makes no intervening move, and no
   Actor rest, currency or Region write occurs. The 32 seconds are playback
   only; they never count as a second eight-hour period.
5. Repeat with **Short Rest** and **Overnight Camp**, each scaled to its
   configured in-game hours. Continue March must have **no** artificial hold.
6. During a visual Long Rest, press **End Journey**. The hold cancels promptly;
   no further move and no duplicate rest should occur. A reload/canvas rebuild
   during the hold must stop the local timer and use Journal-led recovery,
   without duplicating previously committed downtime.
7. When resting during a deliberate manual Pause, the token must remain paused
   until **Resume Travel** is explicitly chosen. Passenger rests aboard a
   continuously moving ship should still overlap travel without stopping the ship.
8. Check the existing beta.5 canvas/GM-awaiting and checkpoint discovery
   announcements for regressions, including queued order on both clients.

## Scope / intentional non-changes

- Visual delay is bounded by configured rest hours (0–24) and playback speed
  (0.5–8 seconds/hour), with no new World setting or persisted schema.
- The confirmed Journal remains authoritative; a canvas rebuild may truncate
  an *ephemeral visual* rest hold, but must never replay or add the eight hours.
- No automatic native D&D Actor rest, exhaustion, fare, camp construction,
  campground requirement, inn prerequisite, or checkpoint type modification.
- Optional setup/breakdown phases and inns/rest-stop checkpoint integration
  belong to a later, system-neutral proposal with GM-controlled policies.

Automated passing is not live Foundry v14 acceptance. Keep the PR draft.
