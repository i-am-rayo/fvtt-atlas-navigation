# v0.3.8-beta.7.3 — Passenger rest continuity and destination checkpoint completion

Stacked draft test build on v0.3.8-beta.7.2. Foundry v14 + D&D 5e, GM-guided native TokenDocument movement. No merge without owner live acceptance.

## Changes

- A GM's **Long / Short Rest Aboard** request is now checkpointed immediately into optional schema-one Journey Journal metadata: action, duration, and confirmed cumulative voyage movement-hour at request.
- During an interrupted/restored **continuous ship voyage**, the remaining rest interval is computed from already-confirmed movement in all earlier legs. The rest action remains disabled until those hours complete; no restart or duplicated rest is issued just because the canvas was rebuilt.
- On completion, the rest annotation is saved immediately, the pending metadata is cleared, and neither movement nor World time is re-credited. Existing Journeys without rest metadata remain readable.
- If the assigned party has reached the Journey's original destination at its authored checkpoint (including normal native token center/grid snapping tolerance), **Complete Journey** replaces **Continue from checkpoint**. Completing finalizes the existing Journal and does not move the token or add another 0.07-mile loop.
- Canvas rebuild interrupts remain under investigation as [known issue #135](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/135). This hotfix does not block or circumvent Foundry canvas lifecycle.
- Future scheduled/on-call hire service plans recorded as [issue #136](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/136), added to the v0.3.8 beta.8 roadmap. No service availability functionality is shipped here.

## GM acceptance

1. **Recover existing interrupted Paedor Journal**. If at Hearth's Heart Dock, choose **Complete Journey** instead of another short walk/horse leg. Verify status is Completed; original legs/times stay intact; no extra native move or World-time write occurs.
2. **New continuous vessel**: choose Long Rest Aboard at e.g. 6h into its passage. Confirm the button disables and metadata appears under the Journal Journey Overview while rest is in progress.
3. Interrupt/cause a canvas refresh **before 8h of sailing since the rest request**. Recover. Verify the rest button stays disabled and 8h countdown resumes from confirmed travel already recorded.
4. Once 8h from request have actually passed, verify the rest is written once with 0 additional downtime, World time tracks sailing only, and pending metadata disappears.
5. Confirm ordinary walking and land mounted daily-limit rest choices behave unchanged.
6. Confirm an intermediate port while the destination is elsewhere still offers **Continue from checkpoint** and can select an onward transport.
7. Compare ship overlay, map fog/weather, Journal and checkpoint UI with GM/player clients; record any Foundry redraws under known issue #135.

## Boundaries

- Passenger rests are narrative Journey annotations. Atlas does not automatically call D&D 5e Actor rest or enforce the rules' separate character-level 24-hour long-rest benefit restriction.
- The new pending rest is retained only after the Journal save completes. A failed Journal write suspends further guided movement rather than claiming durable rest state.
- If the saved destination is clearly beyond a checkpoint, Atlas does not falsely complete the Journey. The destination check requires the **same authored arrival checkpoint ID**, a confirmed completed leg, and native Scene grid tolerance.
