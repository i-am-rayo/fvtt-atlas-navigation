# v0.3.8-beta.7.7.2 — optional rest while manually paused

Stacked on the beta.7.7.1 Journey continuity hotfix. This is an independent,
draft-only test build for Foundry v14. Preserve a World backup and existing
Scene/Token flags and Journal records.

## GM acceptance

1. Confirm the installed version is `0.3.8-beta.7.7.2`. Begin an eligible
   walking or mounted Journey and let the party travel for **less than** its
   daily allowance, such as two hours of an eight-hour day.
2. Select **Pause Travel** and wait for the current native movement stretch to
   finish. The footer should show **Resume Travel**, **Short Rest**,
   **Long Rest**, and **Overnight Camp**. No rest is automatically recorded.
3. Choose **Short Rest**. The Journal adds its configured duration as downtime
   at the confirmed position. With World-time advancement enabled, the clock
   increases by that duration exactly once; it does not add new travel time or
   move the token. The day's used travel hours are unchanged.
4. Choose **Long Rest** or **Overnight Camp** while still paused. Confirm the
   configured duration is recorded only once, the daily allowance resets, and
   the journey remains paused. Actor resources/exhaustion are *not* changed.
5. Use **Resume Travel** to finish the route; compare final moving/downtime
   totals, timestamps, and saved travel decisions with the Journal.
6. Verify the usual **daily limit** menu still offers Overnight Camp,
   Long Rest, Short Rest, and Continue March. The **Continue March** option is
   intentionally absent from an early/manual pause.
7. Separately verify an underway *continuous* vessel still offers its existing
   Short/Long Rest Aboard controls. While its Journey is manually paused,
   optional camp/rest means the voyage is paused too; do not confuse it with
   an overlapping passenger rest while the ship is moving.
8. Reload the GM and player clients; confirm consistent Journal values,
   location, weather/fog, and no Atlas-attributed console errors.

**Safety:** Paused-rest choices are GM-only. They use the same validated
travel-day events and serialized clock/Journal checkpoint order as rests at
the daily travel limit. If the save fails after a World clock write, movement
locks with a recovery warning; inspect the clock and Journey Journal before
continuing. Never retry blindly or reset exploration.
