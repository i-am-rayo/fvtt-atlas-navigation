# beta.7.16.2 — Native continuous-voyage GM acceptance checklist

**Status: Owner-authorized Foundry v14 test build.** This is a draft PR test build, not a stable release or authorization to merge. Use a backup or disposable World. The downloaded branch is `feature/v0.3.8-beta.7.16.2-native-movement-checkpoints`; the Foundry module ID remains `fvtt-atlas-navigation`.

## Installation preflight

1. Back up the test World and its Atlas Journey Journal entries before updating.
2. Install/update using this exact manifest:
   `https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feature/v0.3.8-beta.7.16.2-native-movement-checkpoints/module.json`
3. Confirm Foundry reports `0.3.8-beta.7.16.2`. Confirm the matching branch archive is the manifest's `download` field. Relaunch if Foundry still loads an older cached module.
4. Use a **fresh test journey**. Existing interrupted beta.7.16.1 Journeys must not be automatically credited, teleported, or overwritten by this build.
5. Open one GM and one non-GM client in Foundry v14. Ensure the assigned party explorer token is placed on the original Scene and can be modified by the GM.

## Core continuous-vessel test

- [ ] Plot a land → dock → sea → dock → land itinerary and confirm only the first approved checkpoint leg starts.
- [ ] From the first dock, choose an eligible **continuous** vessel operation and confirm travel. Observe one visually continuous native route through bends (brief checkpoint holds for Journal writes are possible).
- [ ] During passage, click Pause; the token should pause at the next native boundary, not rewind or teleport. Resume and verify the same vessel, speed and final Point B remain approved.
- [ ] Try Stop on a separate fresh test voyage. Only confirmed movement and permitted World time should remain; no new money, Actor rest or replay occurs.
- [ ] Reach the destination dock; Atlas should offer the appropriate checkpoint transfer. The Journey Journal must preserve route targets A → B → C → D and report the correct vessel, confirmed mileage and travel hours.
- [ ] Continue by Riding Horse or walking from the dock to the original destination. Verify no duplicate ship booking and no unexpected Walking fallback for a saved voyage.
- [ ] If enabled, World time should equal the Journal's confirmed moving/rest ledger, not the animation playback duration. No automatic currency deduction, purchased service, or Actor rest should occur.

## Canvas and Journal recovery safety

Use a **separate disposable voyage** for each interruption and retain the Journal after any block.

- [ ] Canvas refresh **before** a vessel begins moving: there must be no unrecorded movement or time.
- [ ] Canvas refresh during a native movement interval: the Journey may show a **pending checkpoint review warning**. This is an expected fail-closed outcome, not permission to credit unconfirmed miles. Do not repeatedly press Travel or move the party token to bypass it.
- [ ] Canvas refresh after a confirmed intermediate checkpoint: a saved leg with no pending intent should recover only from its confirmed native TokenDocument anchor.
- [ ] Canvas refresh at the confirmed destination dock: a completed transfer checkpoint must remain recorded as `paused`, without converting it to partial travel or booking again.
- [ ] While Paused, close/reopen Navigation and ensure the Journal and token agree. Reopening cannot advance the clock, move the token, or create duplicate events by itself.
- [ ] If the native path is blocked or a Region changes its endpoint, Atlas must stop and preserve the last confirmed Journal anchor. Report any mismatch and do not manually adjust the Journal to make it pass.

## Compatibility and non-GM checks

- [ ] Normal (noncontinuous) ship operation still presents overnight/rest choices as before.
- [ ] Walking and Riding Horse journeys retain their established timing and transition logic.
- [ ] Passenger short/long rest aboard continuous vessel does not stop the ship or automatically rest an Actor; record only GM-approved rest.
- [ ] Region movement Behaviors, Levels/elevation, weather and fog remain functional. Canvas redraws must not erase overlays or authored roads/checkpoints.
- [ ] In the non-GM client, confirm native token travel is visible as appropriate, but Atlas-authoritative controls remain GM-only and hidden metadata is not disclosed.

## Evidence to send back

For a success, report the Foundry version, module version, continuous travel method, visual smoothness, transfer result, and the final Journey Journal summary. For a failure, send the full console logs and a screenshot of the Navigation state, plus the last Journey Journal (including any pending-checkpoint warning). Do not merge this PR or overwrite the failed Journal before we review it.

**Known limitation:** Automatic reconciliation of a native Token movement that reached a checkpoint *without* completing its Journal confirmation remains intentionally disabled. Ambiguous native history, position, or World time must be reviewed by the GM. This build tests the integrated coordinator, not an unsafe replay shortcut.
