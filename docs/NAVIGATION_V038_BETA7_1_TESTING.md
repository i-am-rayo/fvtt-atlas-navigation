# v0.3.8-beta.7.1 — Guided leg timing hotfix (Foundry v14)

**Status:** Draft, stacked on `test/v0.3.8-beta.7`. Live GM and non-GM acceptance pending.

## Root cause

After accepting the beta.7 GM confirmation, Atlas saved a correct checkpoint-bound session
but constructed the Navigation progress widget with the *full* planned multi-surface route's
duration. The active daily-travel schedule instead covered only the first checkpoint leg.
`projectJourneyTiming` correctly rejected the mismatched durations and Foundry could not
render the Navigation window. The actual log reported:
`Invalid journey timing projection` at `navigation-journey-timeline.js:20`.

## Fix

- During guided transportation, the live progress and remaining ETA use the current
  checkpoint-bound session's exact moving hours, schedule and rest settings.
- Direction break annotations likewise use the active leg's duration and compatible speed.
  No full-route travel time is substituted for a currently executing leg.
- The top-level **Travel method** selector is hidden before a successful route calculation;
  it remains visible for ordinary single-surface travel after the route is selected.
  Multi-surface journeys continue using the **Transportation for this leg** selector.
- Before a route exists, Navigation gives a neutral prompt to choose Point B.
- Existing Journey Journal history, currency, Group Actor, Scene flags, and native movement
  constraints are unchanged.

## Live acceptance checklist

1. On a copy of the World, open Navigation with only Point A: no Travel method dropdown.
2. Select Point B for a normal single-surface route: its Travel method dropdown appears.
3. Select a route with land and water, choose an available Riding Horse for the land leg,
   and confirm **Travel to Port Barthos**.
4. The Navigation app must remain open; progress and ETA reflect only the riding leg
   (not the full land-water route). Pause/Resume remains functional.
5. At the port, confirm the token stopped before water, the Journey Journal records
   the completed leg, and Continue/Stop decision buttons appear.
6. Verify cancelling confirmation results in no movement/World-time/Journal mutation.
7. Test a non-GM client for preserved fog, roads, weather and checkpoint visibility.
8. If native Foundry movement rejects a chunk, Atlas should stop without teleporting
   the token or deducting any currency.

The confirmation dialogue wording is deferred, per owner request.
