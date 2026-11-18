# v0.3.8-beta.7.9 — read-only Navigation summary boundary

Architecture-only test build stacked after the future-feature roadmap draft.
This build moves the **display construction** for GM Navigation estimates,
Journey progress, world clock, travel speed, playback and terrain cost into a
dedicated summary renderer. All calculations, persisted state, native v14
movement, transportation/rest choices and Journey Journal writes remain
unchanged in their existing owners.

## GM and player acceptance (Foundry VTT v14)

1. Back up the World and install the branch manifest. Confirm **0.3.8-beta.7.9**
   under Manage Modules and reload both GM and player clients.
2. GM opens an Atlas route (walking, then Riding Horse). Compare beta.7.8:
   **Distance**, **Travel Time**, **Total Trip**, speed, real-time playback
   estimate, terrain-weighted distance and explanatory text display in the
   same order and with the same values/units. Changing methods updates the
   estimate as before. No duplicated metric cards or missing labels.
3. Test a checkpoint-to-checkpoint land → hired ship → land Journey. The
   estimate must say **Current Leg Distance/Time/Total** and show only the
   first approved leg's figures. Later transport legs remain GM previews.
4. Start guided movement. Verify Journey progress, **Travelled (moving)**,
   **Elapsed (with rests)** and **ETA remaining (in-game)** update in-place.
   Pausing and resuming retain their existing values. Reopening Navigation
   must not add World time or start a second movement session.
5. At a daily break, confirm Overnight Camp, Long Rest, Short Rest and
   Continue March remain GM-only explicit actions. During a manual pause,
   both Short/Long Rest are still available under the same conditions as
   beta.7.8. Verify the Journey Journal and World time advance only once
   for confirmed movement/breaks; Actor resources are unchanged.
6. Test shipboard continuous travel and optional passenger rests; the
   progress/World-time summary and footer controls must remain identical to
   beta.7.8. Do not double-count underway rest as downtime.
7. Reload the Scene/canvas while riding a horse. If movement is interrupted,
   confirm the Journal remains recoverable with its prior method, original
   destination, confirmed clock time, and no duplicate checkpoint/ship
   bookings. Test at least one completed Journey.
8. On the non-GM player, verify existing visible roads/checkpoints, Atlas fog,
   weather and native Region effects are unchanged, and that the **GM
   Navigation window, summary and editing controls are not exposed**. No
   player progress bar is introduced by this build.

## Separately tracked R-01 investigation — not a beta.7.9 fix

The owner reports that player-side travel can appear to stop when the GM
window/browser is inactive. This needs separate two-client evidence:

1. Compare GM tab active, backgrounded, minimized and disconnected, with
   player client continuously observing the assigned party token.
2. Record native TokenDocument coordinates, elapsed World time, Journey
   Journal confirmed-percent/last event, and each client's animation.
3. Determine if movement/clock progress actually stops or **only player
   canvas visualization** stalls. Note browser/device sleep and native
   canvas lifecycle warnings separately from unrelated third-party logs.
4. Do not decide to bypass GM authority, force canvas redraw, or promise
   unattended continuation without diagnosis and explicit owner approval.

**Owner decision:** Whether unfinished movement safely pauses or continues
when the authoritative GM client is absent is **on hold** until R-01 is
understood. This architecture-only build does not change that behavior.

## Automated engineering gates

- Run syntax checks for the new renderer and modified controller.
- Run the pure DOM renderer regression tests plus the existing Navigation
  footer/controller/daily and continuous Journey tests.
- Run the full repository test suite and architecture dependency checker;
  no unresolved relative imports or cyclic groups.
- Check the manifest/version and published archive URL before installing.
- Do not merge the stacked draft PR without owner acceptance.
