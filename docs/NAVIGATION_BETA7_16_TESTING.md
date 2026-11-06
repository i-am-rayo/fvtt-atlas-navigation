# 0.3.8-beta.7.16 — Navigation stages / GM test checklist

This is a focused, stacked **draft** test build atop beta.7.15.2. Automated tests are not Foundry v14 live acceptance. Do not merge or publish the final release before the Product Owner accepts the live results.

## Behavior and ownership

- A single `Atlas — Navigation` ApplicationV2 shell retains its scene/canvas pointer lifecycle. Its screen is derived in memory: **Choose destination → Journey in progress → Checkpoint decision → Journey completed**.
- Choosing a destination still uses party-token or map Point A, map-click Point B, and the existing transport preview/GM eligibility. The Region-grouped checkpoint picker is deferred.
- An active Journey shows the **saved approved** method, leg distance and speed, progress, the confirmed route directions, World clock and only the applicable pause/resume/end/rest controls. No rebooking or fare quote is offered during movement.
- A verified checkpoint shows Continue, Stop/replan, and (if final) Complete. Continue returns to destination/next-method planning from the confirmed token; no onward movement or payment occurs until separate GM confirmation.
- Completion shows a read-only roll-up from a validated Journal record plus **Open Journey Journal** and **New Route**. The Journal is still the sole recoverable source of truth. No Scene, Region, Level, token, or Journal metadata migrations are performed.

## Owner live acceptance — Foundry v14

1. As GM, open Navigation on a world Scene. Check party-token or map A, choose B with a map click, change B via Alt/Option-click, and inspect route estimates/transport method; verify no TokenDocument move, time advance, Journal creation, or payment before approval.
2. Start a walking/horse Journey. Confirm only the active stage renders; Progress, elapsed time, ETA and Directions update without flickering, and Pause/Resume/Short Rest/Long Rest/Overnight Camp/End are enabled only in appropriate phases. Validate confirmed Journal and World time after rests; ensure Actor resources remain unchanged.
3. Reproduce the prior accepted Port Barthos → Hearth's Heart Dock multi-leg route (land/water/land). At each checkpoint, verify the checkpoint stage, saved Point B, and next decision; continue with a different approved transportation method. Verify approved method/speed remain visible while sailing, no additional booking at a checkpoint, and no repeated tiny leg to an occupied port.
4. At the final destination, choose Complete (or finish a direct single-leg route). Verify the dedicated completed screen lists confirmed legs, travel/break time and original Journal link. Confirm its footer offers no replay button; **New Route** starts a fresh selection.
5. During active journey, pause, refresh the Foundry canvas, reopen Navigation and recover the confirmed progress. Repeat for a continuous voyage with a short/long passenger rest underway. Verify no double movement, fares, World-time advancement or Journal events; unresolved failures must stay recoverable.
6. As non-GM, verify Atlas GM Navigation/edit actions are inaccessible; changing scenes, visibility, Regions, fog, weather, and native Levels remains unaffected. Return as GM and verify native road/checkpoint overlays and Scene settings still work.

## Deferred / known limits

- Searchable named-checkpoint/Region hierarchy and map-to-directory destination selection.
- Transport booking/payment and Actor rest/exhaustion automation (still GM responsibility).
- Full Journal visual restyling or grouped narrative simplification (saved chronological events remain intact).
- Scene scale presets, global measurement setting overhaul, and native Levels improvements are separate workstreams.
