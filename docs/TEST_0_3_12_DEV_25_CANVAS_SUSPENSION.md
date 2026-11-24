# Atlas 0.3.12-dev.25 — canvas suspension and partial movement recovery

## Owner evidence and automated regressions

Dev.24 completed multiple normalized vessel intervals and auto-continued after the first weather redraw. At the second redraw, native checkpoint 6 operation dX7qhx6Yl9nA5L5d had origin (3967,2029), endpoint (3965,2104), actual TokenDocument (3965.049458110207,2051.431231732619), state completed, same ID, no endpoint receipt, 14430 seconds intended and no new World time. The full passed/native arrays were not present in the diagnostic; no exact partial duration can be concluded. Red CI 45042157408 reproduced four missing suspension/partial behaviors; green CI 45042332733 passed 1239 tests; second red 45042463709 established the partial clock target without a receipt and outstanding finalization tests. The exact screenshot coordinates are covered as a negative evidence fixture, not an invented native trace. Positive partial recovery uses a synthetic ordered prefix with explicit native IDs.

## Owner live acceptance — Foundry v14.370

1. Back up the World and retain the current saved Journey. Install after final CI passes. Do not move the party manually or click Forget. Open Review Saved Journey. If full native ordered history is still available and passes the partial proof, recover, verify credited time and actual token position without replay. If the old operation ID or passed path vanished on install, the current Journey must remain blocked. Preserve that record and test a fresh Journey in a disposable copy instead.
2. Run the same land-to-ship-to-land journey with Simple Timekeeping/weather and native Regions/fog enabled. Verify at least two daily weather redraws during a continuous approved voyage. Canvas teardown must not call End Journey or stopMovement for the submitted interval; wait for its native result and durable Journal writes. The next interval cannot begin during settlement. Navigation must restore approved remaining travel only when the same Scene, token, revision, active GM, and Journey validate. If native settlement is delayed beyond the existing automatic recovery window, manual review is appropriate after the old operation settles; never force a parallel operation.
3. At an interruption verify full endpoint / at-start / partial classification. Partial credit uses an ordered, matching native prefix and a valid authored forward position; unknown native evidence, constraints, missing or reordered steps, outside route, or unexpected World time remain blocked. Partial receipt is persisted before World-time credit. Record the proposed extent and clock delta, then verify a retry never credits the same seconds again. Do not presume an amount from screen coordinates.
4. Test canvas teardown while preparing an intent, after native submission, after document update before animation, and after clock update before Journal confirmation. In a disposable copy repeat interrupted Journal writes and reload. A durable receipt supports replay-free accounting; a receipt-less older record may be unrecoverable. Verify repeated weather redraws, route, approved conveyance, assignment, speed, original Point B, fares, passenger rest and confirmed Journal events stay consistent; preserve fog and native Regions/weather.
5. Test deliberate End and Pause remain distinct from canvas suspension; after confirmed Port Barthos arrival no onward travel before GM approval. Test non-GM cannot recover/read GM-only details or mutate Journey. Check ordinary land travel and legacy Journals. No onward planner change on this branch.

## Relevant public API

https://foundryvtt.com/api/v14/classes/foundry.documents.TokenDocument.html#move
https://foundryvtt.com/api/v14/interfaces/foundry.documents.types.TokenMovementData.html

Do not promote or merge before owner live acceptance. No manual time credit, teleport, broad tolerance or new fare is authorized by this build.
