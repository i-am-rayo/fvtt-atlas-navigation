# Atlas v0.3.8-beta.7.4.3 — Land continuation and transport UI acceptance

Target: Foundry VTT v14, GM client plus a non-GM client, paused Journal from beta.7.4.2.

## Static review

- [ ] `npm run check` succeeds for the changed JavaScript.
- [ ] `npm test` succeeds, including pure transport recovery and Journal regressions.
- [ ] `module.json` and `package.json` both identify 0.3.8-beta.7.4.3; manifest and branch archive both resolve.
- [ ] Existing Journals remain valid; no Scene, token, Actor, currency, or native Fog flags are rewritten.

## GM acceptance — completed ship leg to land

1. Load a Journal with a **completed** ship checkpoint leg at Hearth's Heart Dock and saved later destination 5.49 miles inland.
2. Choose **Continue** at the dock; verify the original destination is still selected and the prior hired ship and passenger rest remain in the Journal.
3. Select **Walking**, press Play. Confirm the token advances along the land-only road and that the old error `Select a supported method and an authored arrival checkpoint for this leg` does not appear. Verify the final destination, Journey completion, and World-time total; neither completed voyage nor any past World time is replayed.
4. Repeat from an equivalent saved checkpoint with sufficient **party-owned Riding Horse** capacity. The Play control should be enabled. A distinct GM confirmation identifies the Riding Horse and makes clear no currency/Actor resources are changed. Confirm it follows the route natively, with correct method speed and no additional checkpoint requirement.
5. Interrupt mounted travel with a canvas rebuild and re-open Navigation. Verify the same land method is recovered from Journal metadata; progress continues from the confirmed token location and previous movement/World time is not duplicated.
6. Inspect the Journal: completed ship leg keeps the original confirmed passage narrative; the new land leg records **Riding Horse (party-owned)** rather than inventing another ship boarding.
7. Remove/insufficiently assign horse capacity in a **test** Group. Play should remain disabled with an explanatory message. Do not mutate live Group resources during this test.

## Navigation UI and safety

- [ ] The main Travel method dropdown has Party and hired/checkpoint groupings; **Arrangement** and **Operating schedule** are absent from the main Navigation pane.
- [ ] The pencil editor for a non-walking method contains **Operating schedule for this journey** on its General tab, with only supported normal/overtime/continuous choices. Change the schedule and save: it affects this journey's estimates, not World presets.
- [ ] A selected land mount on a map-point origin (rather than assigned party token) cannot start native guided movement.
- [ ] A mixed land/water route still requires an authored transfer checkpoint; a water/air-only route cannot use the direct-land bypass.
- [ ] Recovered unfinished approved ship travel still restores its ship method, saved checkpoint, fare semantics and passenger rest, with explicit GM confirmation.
- [ ] GM and non-GM clients can view their permitted roads/checkpoints without permissions leaking; weather/fog and token navigation do not regress.

## Known boundaries

The new direct terminal exception is **land-only**. Ships, aircraft, and hired land services still require approved authored checkpoint transfers. Journey method snapshots are additive optional fields in the existing Journal schema and must not be interpreted as implicit boarding/purchase. The pre-existing Foundry canvas redraw issue remains separately tracked in issue #135; this patch addresses recovery and onward-leg eligibility, not the redraw trigger itself.
