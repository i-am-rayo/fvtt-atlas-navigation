# Atlas 0.3.12-dev.14 — interrupted-journey anchor integrity

## Observed live-test failure (2026-11-21)
- A canvas teardown interrupted a native journey with a saved 40% confirmed leg.
- Atlas withheld **automatic** recovery after TokenDocument advanced ahead of
  the last durably confirmed Journey anchor.
- Subsequent **manual** recovery was allowed at a same-road point ahead of the
  saved anchor; this could replace the unconfirmed remainder with a shorter
  route without crediting its World time. The owner-provided Journal showed
  24.01 mi originally planned, ~9.60 mi confirmed first leg, then 4.82 mi,
  with 5h 58m recorded versus 9h 56m estimated for the original route.
  These figures merit inspection, not a retroactive correction.

## Narrow mitigation
- Keep the existing GM Journal anchor assessment, but require a matching
  confirmed coordinate for **both manual and automatic** continuation.
- Retain the existing GM review guidance and preserve the saved Journal;
  do **not** synthesize extra progress, duplicate time, move the token,
  auto-advance a route, change Actors, or write history on read.
- This mitigation deliberately rejects same-road drift after a canvas
  teardown until a GM investigates and reconciles TokenDocument to the
  confirmed saved position; no bypass for manually clicking Recover.
- No schema migration or changes to already completed Journal records.

## GM / non-GM live test
1. On a fresh World backup, start travel then force a canvas redraw while the
   native token is mid-motion. Confirm automatic resume is stopped when
   the token is ahead of its Journal anchor.
2. Click **Recover Saved Journey** while the native token still lies ahead:
   both automatic and manual recovery must remain blocked, and no extra
   movement, World time, fare, rest or Journey leg is saved.
3. Compare original saved Journal flag (lastConfirmedAnchor and leg
   completedPercent/worldTravelSeconds) with TokenDocument coordinates and
   actual World time. Do not modify the historical completed report.
4. As GM, reconcile the native token with the verified committed anchor,
   reopen Navigation and resume. Validate remaining Point B, route, leg
   history, and absence of duplicate time/fare/rest events.
5. Verify non-GM cannot recover or commit gameplay changes; recheck
   canvas refresh, paused journeys, confirmed checkpoint transfers.

Keep this PR draft pending GM/non-GM Foundry v14 acceptance; do not merge
or release until owner authorization.
