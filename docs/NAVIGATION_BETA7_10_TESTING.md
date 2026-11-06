# v0.3.8-beta.7.10 — Navigation directions presentation boundary

Architecture-only build stacked after the owner-tested beta.7.9. This
extracts the **read-only Directions and calculation explanation** HTML into
the dedicated directions view, without changing how the GM controller
calculates distance, directions, Journal events, checkpoint transitions,
transport/rest operations, native movement or World time.

## Live acceptance — Foundry VTT v14 (GM and non-GM)

1. Back up the World, install the beta.7.10 branch manifest, confirm the
   exact installed version, and reload the GM and player.
2. In the GM Navigation panel, create a normal land route. The calculation
   disclosure, **Directions** heading, **Depart from starting point** card,
   compass arrows, named roads, distances, displayed time and **Arrive at
   destination** card must look and behave exactly as beta.7.9. No duplicate
   directions or lost road names.
3. Plan a multi-surface Riding Horse → hired Ship passage → Riding Horse
   Journey. The current-leg section must still say **Directions to next
   decision point**, lead only to the approved checkpoint, and show per-leg
   time rather than falsely treating that checkpoint as the final Point B.
   The Journal must keep the original destination for later continuation.
4. During travel, confirm the main summary, Journey progress, ETA,
   World-time status and action footer still work. Pause, resume and
   complete a short land leg. Rendering Directions must never approve a
   Journey decision or move the assigned token.
5. While on a continuous hired ship, complete Long Rest Aboard, then
   disembark. The relevant Journey event appears in the same instruction
   position with **rest aboard while underway** and the correct elapsed
   moving-hour/day marker. Rest does not add duplicate downtime.
6. On a later land leg, choose **Continue March** at the daily limit.
   Each approved event must appear in order and with its existing time/day
   context. Navigation footers and Journal text remain unchanged.
7. Perform a Canvas refresh during an active leg. Verify conservative
   Journal recovery, preserved Riding Horse/ship method where approved,
   correct final destination and no replayed World time or fares.
8. On the non-GM client, verify roads, checkpoints, Atlas fog, weather
   and native Regions remain unchanged. No new player Navigation window,
   GM directions or authoring controls are exposed.

## Known separate investigation

**R-01:** Player observation may seem to stall when the GM browser/window
is inactive. The owner deferred the choice between autonomous continuation
and safe pause until diagnosis. Beta.7.10 does not change any GM ownership,
client scheduling, Canvas animation or movement recovery policy.

## Automated verification

- New directions renderer DOM tests: normal directions, current transfer
  point, confirmed Long Rest Aboard and Continue March event ordering.
- Existing Navigation controller, travel-day, Summary, Footer, Journal,
  continuous voyage and checkpoint transfer regression tests.
- Full Node test suite, syntax checks and import dependency graph (no new
  cyclic groups or missing relative imports).
- Check version, branch manifest and archive URL before distributing.
- Keep the stacked PR draft until the owner explicitly approves merge.
