# v0.3.8-beta.7.8 — Navigation footer rendering boundary

Architecture-only, stacked draft release. This build extracts Navigation
footer rendering into `navigation-footer.js`; it must not change the existing
Journey rules, Canvas behavior, saved Scene/Token flags, or Journal schema.

## Foundry v14 acceptance (GM, then player)

1. Back up the World and install this branch manifest. Confirm the installed
   version is `0.3.8-beta.7.8`. Reload both clients.
2. Open Navigation from an assigned party token. Confirm the **New Route**,
   **Travel Route**, and **Open Journey Journal** controls appear as before.
   A route without an eligible method keeps Travel Route disabled.
3. Begin travel, then Pause. Check that **Pause Travel** changes to **Resume
   Travel** and that the existing manual rest controls are displayed exactly
   as in beta.7.7.2. Pause, resume, and end at short native movement boundaries.
4. At the normal daily limit, confirm Overnight Camp, Long Rest, Short Rest and
   Continue March are unchanged. Verify that these remain deliberate GM
   actions and do not alter Actors automatically.
5. If using a waterway, test **Short Rest Aboard / Long Rest Aboard** while the
   vessel is moving, then reach a dock. Confirm **Continue**, **Stop and
   replan**, and **Complete Journey** (only at the actual destination).
6. Reload the canvas while traveling by Riding Horse. Confirm the saved method
   is not replaced with Walking, and confirm the Journey Journal records no
   duplicate clock time or port rebooking.
7. On the player client, check that roads/checkpoints, fog exploration,
   weather and permitted Journals appear unchanged and no GM actions surface.

No UI redesign or automatic rest application is in scope. Button icon parity,
more compact windows and Journal beautification remain separate future work.
