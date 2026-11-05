# v0.3.8-beta.7.26.1 — Checkpoint boundary and Journal recovery investigation

**Status:** Draft implementation, automated tests; real Foundry v14 GM and
non-GM verification required. Stacked on beta.7.26 / PR #223. Related open
incidents: #224 (100%-moved checkpoint target not finalized), #189 (native
TokenDocument versus saved Journal anchor), and #135 (canvas rebuild trigger).

## Owner evidence and limits

- The first Dirwest → Hearth's Heart voyage completed five legs and confirmed
  World time, passenger rest, transfers, and Journal history across two
  canvas rebuilds. That direction is an owner-verified **positive test**.
- On the next Hearth's Heart → Dirwest Journey, a `canvasTearDown` interrupted
  travel near Port Barthos. After `canvasReady`, Atlas logged `Native token
  recovery anchor checked`, `Saved journey prepared for GM recovery`, and
  `Canvas recovery restored confirmed leg without travel`. The restored UI
  showed A → B → C → D, next B, and a water-route preview. Continuing raised
  `This route no longer matches the saved next A/B/C target` repeatedly.
- That recovery log occurs only when the validated last leg is treated as
  **at least 99.999% complete**. Thus this is a saved completion/transfer
  decision problem, **not evidence of a three-cell positional discrepancy**.
- The export serializes diagnostic objects merely as `Object`; it does **not**
  identify the actual flag's `status`, `routeTargets.nextTargetIndex`,
  `transport.arrivalCheckpointId`, or native TokenDocument position. The
  generated human-readable Journal page may remain at 0% after interruption
  because it is published only at approved boundaries. The exact live trigger
  is therefore **a code-supported hypothesis**, not a proven root cause.

## Concrete audit of the existing transition

1. `TokenDocument#move` returns only when the native movement completes, is
   stopped, or is prevented. Ordinary guided travel additionally awaits the
   visible token animation and confirms the native endpoint.
2. Its prior loop saved **every** completed chunk with Journal status `moving`,
   including the *last* chunk at exactly 100%. Only a later outer finalizer
   verified arrival and changed the record to `paused` with a validated port,
   or `completed` at the final destination.
3. `canvasTearDown` is a documented Canvas deactivation hook. In the interval
   between those writes, teardown could persist `interrupted` at 100% without
   advancing the saved A/B/C checkpoint index. This is an invalid recovery
   *decision boundary* even if the TokenDocument coordinates are correct.
4. `recoverSavedJourney()` previously reconstructed a pending transfer only
   for status `paused`, 100% and a saved transport arrival checkpoint. A
   100%-`interrupted` leg instead recalculated toward the *original final*
   Point B, not the saved next checkpoint B. The A/B/C guard correctly blocked
   that mismatched preview, but the error did not explain the underlying
   incomplete checkpoint decision.
5. Continuous water/air travel already wrote `paused` on its final confirmed
   native checkpoint within the checkpoint callback. The vulnerable window
   was in the separate ordinary guided-chunk path (including on-foot/land
   arrival at a transfer port).

Official v14 references: [canvasTearDown](https://foundryvtt.com/api/functions/hookEvents.canvasTearDown.html),
[canvasReady](https://foundryvtt.com/api/v14/functions/hookEvents.canvasReady.html),
[Canvas.tearDown](https://foundryvtt.com/api/v14/classes/foundry.canvas.Canvas.html),
and [TokenDocument.move](https://foundryvtt.com/api/classes/foundry.documents.TokenDocument.html).

## Focused fix and invariants

- On the *final verified native chunk*, confirm the token's checkpoint geometry
  if there is an active guided transfer, settle final World-clock rounding,
  then write **100% + last native anchor + `paused` + checkpoint target** in
  one queued Journal flag update. For an ordinary terminal destination, save
  status `completed` with the 100% progress at that same boundary. Redrawing
  after this write can no longer downgrade the confirmed arrival.
- An existing Journey whose last leg is already 100% but whose durable status
  or checkpoint target is inconsistent does **not** automatically recover as
  an onward route. The GM receives `checkpoint-not-finalized`,
  `checkpoint-target-not-committed`, or a similar bounded diagnostic; no
  token is moved or teleported, and no Journal flag is rewritten on read.
- For newly approved-path-backed Journeys, *recalculated geometry* may vary
  laterally by at most **3 Grid cells**; native-vs-Journal polyline length may
  differ by at most **3 cells**. The 5% measurement allowance is now capped to
  avoid accepting dozens of cells on very long routes. The route must keep
  the exact chosen destination, original authored segment ID sequence, and
  monotonic direction. Ten-cell deviations and ambiguous loops remain unsafe.
- The independent native TokenDocument-to-Journal anchor guard is **unchanged**
  at 0.35 cell (or 2 pixels), because a greater mismatch may represent actual
  **unconfirmed movement**, not harmless route curvature. A reported 99.9%
  leg is still unfinished until its native last stretch and associated clock
  state are durably confirmed. No change to Region/fog/Scene/weather behavior.
- Legacy Journals without `approvedPath` retain their older strict recovery
  check; a missing path snapshot is not fabricated during recovery.

## Automated verification

- Three-cell curved-road discrepancy allowed; more than three and ten cells
  blocked; long-route percentage tolerance capped by cell distance.
- Saved branch, exact destination, moving direction, ambiguous return/crossing,
  uncommitted native token movement remain blocked.
- Unit regression: an `interrupted` record with completedPercent=100 and saved
  next-target index B does not become a confirmed transfer. Even status
  `paused` cannot invent an unadvanced target. Verified paused/advanced
  checkpoint is eligible, and a pending native intent remains unsafe.
- Controller regression: recovery with stale A/B/C does not even calculate
  another route or enable native movement; the Journal remains untouched.
- Ordinary land→port integration regression: **no saved Journal snapshot may
  contain 100% movement with `moving` status**; last native checkpoint and
  paused transfer state are committed together.

## Owner's live Foundry v14 acceptance gate

On a copied test World, record the native TokenDocument `x/y`, Journey flag
`status`, last leg `completedPercent`, `transport.arrivalCheckpointId`,
`pendingNativeMove`, `lastConfirmedAnchor.point`, `routeTargets.nextTargetIndex`
and A/B/C target checkpoint IDs *before and after* each redraw (GM only).

1. Start **land → port → continuous hired ship → destination** using a new
   Journal on a curved, long world route. Trigger redraw during the first
   land leg, exactly as the token reaches the port, and just after the port
   confirmation. In each case, continue with the saved transport and original
   final Point B without replaying the land segment.
2. Repeat canvas redraw at an internal native vessel checkpoint and the final
   vessel dock; exercise optional rest aboard, long rest on land, day boundary,
   and repeated redraws. Native token, World time, Journal events, passenger
   rest, and estimated/approved fare must not be duplicated.
3. Test with the third-party weather/day-rollover automation enabled, then
   disabled, to distinguish the external Canvas trigger from Atlas recovery.
4. Deliberately move the token one cell from the saved anchor: movement must
   **not** be credited or resumed automatically. It should request GM review,
   even though the *route geometry* has a three-cell comparison allowance.
5. Alter the derived road by ~2–3 cells while preserving its IDs and terminal
   coordinate in a backup: route comparison may permit the benign variation.
   Change the road segment ID, checkpoint ID, reverse order, or shift ten
   cells: it must refuse safely.
6. Reopen an already-stranded beta.7.26 `interrupted` 100% Journal. Confirm it
   presents the explicit reason and does not automatically advance target B,
   move token, repeat World time, or rewrite history. Keep this record for
   forensic review before choosing an explicit GM recovery procedure.
7. Verify GM and non-GM clients concurrently, journal permission, overlay,
   roads, checkpoints, native Regions, fog/weather, and Scene canvas teardown
   cleanup. No GM-only recovery data should be broadcast into player UI.

**Release gate:** issue #224 remains open until the owner demonstrates a real
v14 redrawn port transfer and correct saved A/B/C target. The pre-existing
failed Journal cannot be certified as repaired without its flag evidence.
