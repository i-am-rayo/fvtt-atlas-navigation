# v0.3.8-beta.7.12.1 — Completed Journey Play control

Focused hotfix based on owner-tested beta.7.12. Keeps the completed Journey
route and Journal visible but prevents its Play control from offering a
second journey on the same finished preview. No Atlas Scene flag, Journey
record schema, travel speed, rest, World time or native Canvas changes.

## Foundry v14 GM / player test

1. Back up the World and install the beta.7.12.1 branch manifest. Verify its
   version before testing. Reload the GM and non-GM clients.
2. Using the manually assigned party token, complete a route with at least one
   checkpoint transfer (e.g. horse → hired vessel → horse) and an ordinary
   final land leg. Confirm the Journey Journal is **Completed** and World time,
   stops and transportation match the approved movement.
3. At **Arrived at destination** / **100% complete**, confirm **Travel Route**
   (Play) is **absent**, while **New Route** and **Open Journey Journal** remain
   usable. Opening the Journal or rerendering the panel must never restart
   token movement or advance World time.
4. Choose **New Route** and explicitly select a new Point B from the party's
   current TokenDocument location. The appropriate Travel button must return
   for a valid new route; finishing that second Journey hides it again.
5. Confirm **Resume Travel** remains available for a genuinely paused or
   interrupted Journey. A confirmed checkpoint still offers its existing
   Continue/Complete decisions. No new automatic booking or fare deduction.
6. Refresh Canvas during an unfinished voyage. Verify the existing Journal
   recovery flow still works and does not duplicate confirmed time/rests.
7. From a non-GM client, check that the route/Journal changes reveal no new GM
   actions and that roads, checkpoints, native Regions, fog and weather remain
   unchanged.

## Automated checks

- Footer DOM test: completed preview hides Play without hiding Journal/New Route;
  a fresh route makes Play eligible again.
- Controller integration: confirmed final arrival locks the completed preview;
  the guarded travel method refuses replay until a new route is calculated.
- Full Node tests, syntax check, architecture graph and whitespace validation.

Leave the PR draft; owner approval is required before merge or the next
dependent architecture extraction.
