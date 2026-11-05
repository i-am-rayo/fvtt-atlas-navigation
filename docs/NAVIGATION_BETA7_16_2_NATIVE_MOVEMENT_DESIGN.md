# beta.7.16.2 — Native waypoint movement / durable recovery design

**Status: native continuous-voyage coordinator integrated in the development branch; automated tests in progress, live v14 behavior unverified.** Stacked on beta.7.16.1. This remains an unpublished draft, not an installable test release. Preserve the interrupted real Journeys for inspection, not for speculative retroactive credit.

## Verified public Foundry v14 primitives

- `TokenDocument.move(waypoints, options)` accepts one *entire route* with multiple `{x,y}` positions. `options.animation.movementSpeed` specifies grid spaces/real second. Atlas already supplies this speed, so slowing playback alone does not eliminate stop/start.
- The public `TokenMovementWaypoint.checkpoint` property makes an intermediate waypoint a separate token update/movement operation; a native checkpoint can be stopped or paused. The final waypoint is automatically a checkpoint.
- `TokenDocument.pauseMovement()` returns a resume callback; `resumeMovement` and `stopMovement` are public. A movement remains pending while paused. The `moveToken` hook fires after each native update on all clients with the native movement ID, origin, destination and animation completion promise.
- `TokenDocument.movement` and `movementHistory` are read-only API accessors. They may corroborate native movement, but Atlas must not assume that the visible Canvas sprite or animation frame is authoritative persisted movement.

Source: https://foundryvtt.com/api/v14/classes/foundry.documents.TokenDocument.html ; https://foundryvtt.com/api/v14/interfaces/foundry.documents.types.TokenMovementOptions.html ; https://foundryvtt.com/api/v14/interfaces/foundry.documents.types.TokenMovementWaypoint.html ; https://foundryvtt.com/api/v14/functions/hookEvents.moveToken.html

## Why the current movement fails after refresh

Atlas currently divides playback into roughly 2-real-second intervals and calls `token.move()` separately on every interval. Native TokenDocument position may already be at the next chunk endpoint while its Canvas animation remains pending, yet Atlas credits progress only after both promises settle. A Canvas redraw inside that gap leaves the native token ahead of the last Journal anchor.

Owner's beta.7.16.1 test: 95.48 mi ship leg with about 33.5% Journal-confirmed progress implies 63.49 mi remaining; a fresh 55.09 mi route leaves roughly 8.40 mi not confirmed by the Journal. That is consistent with an unconfirmed native movement interval, **not proof of a hex misalignment**. The exact native chunk ID/endpoint was not present in the expanded console output, so record it during live acceptance.

## Target architecture

1. **Domain plan**: Build one validated path preserving Atlas's authored road bends. Include bounded native `checkpoint:true` positions and an immutable mapping from each checkpoint to approved movement distance, time, road identity and optional rest/decision boundary. Never infer new road surfaces from movement graphics.
2. **Durable intent before movement**: Serialize a versioned, uniquely identified *pending native checkpoint* inside the existing Journey Journal, with token/Scene/Atlas revision, from/to native positions, approved remaining distance, clock-before snapshot and expected clock delta. A GM-only, revision-checked Journal write must succeed before the native move starts or resumes. No second Scene/Token flag source of truth.
3. **One native path**: Call `TokenDocument.move` with the approved full set of waypoints, including explicit checkpoints. At each `moveToken` hook for the exact token and movement identity, immediately apply native `pauseMovement` before asynchronous work. Use the API-reported native endpoint and animation promise; never trust sprite position. Refuse any unexpected destination or extra update.
4. **Checkpoint commit**: When the checkpoint's native move and animation are confirmed, update the Journal progress and World time through a queued, idempotent operation. Only release the Foundry pause after its durable pending-intent/confirmation records are consistent. Handle user Pause/Resume/End and travel-day/rest decision at these same boundaries; never silently continue through a required GM choice.
5. **Canvas recovery**: Read Journal, TokenDocument native position, native movement ID/history (when retained), and World time. If still at the saved start, proceed from already confirmed progress. If exactly at a verified pending endpoint, reconcile the single known step once, respecting whether World time already advanced. If history/clock/anchor is ambiguous, leave the Journal intact and block with a GM diagnostic. Never rewind/teleport or credit a whole remaining route from proximity alone.
6. **Lifecycle**: Guard active-GM permissions; detach hook listeners and release/stop native movement when a window closes, Scene changes, World disconnects or Canvas tears down. Do not repeatedly rebuild canvas or rerender full Directions on each checkpoint. Playback speed is visual and must not alter game travel hours.

## Current implementation boundaries

- `navigation-native-movement-plan.js` builds one path with bounded integer-pixel native checkpoints from authored road geometry. It never moves a Token.
- `navigation-native-movement-coordinator.js` is the Foundry-facing adapter: one `token.move(path, {id,animation:{movementSpeed}})`, `moveToken` identity/endpoint validation, synchronous native pause, awaited animation, durable callback, and native resume. It detaches hooks on completion/failure.
- `AtlasNavigationController.runNativeContinuousLeg` implements a **continuous checkpoint transport leg only**. Before each native update, it persists an optional schema-1 `pendingNativeMove` in the existing Journey Journal. After native endpoint/animation proof, it advances only intended World time, credits the schedule/anchor, and commits progress before allowing the next native checkpoint. Five-second visual checkpoints reduce Journal writes; the final dock is durably committed as `paused` with transfer metadata before native `move()` resolves. Canvas interruption calls `stopMovement` without downgrading an already confirmed dock.
- If a pending intent survives a refresh, recovery **fails closed with a GM review diagnostic**. `navigation-native-movement-reconciliation.js` supplies a pure proof classifier, but native movement-history corroboration, revision-checked automatic reconciliation, and safely crediting a pending endpoint on reload are **not yet integrated**. No interrupted Journal is retroactively modified or assumed completed.
- Normal walking, mounted travel, noncontinuous ships, rest/forced-march decisions, and checkpoint transfers **retain their previously proven movement loop** during this focused change. In a non-v14 environment missing the public API, continuous travel is refused before the Journal or Token changes.

Technical tradeoff: the public native checkpoint pauses must await Journal writes, which may introduce brief holds in an otherwise single continuous animation. The new approach avoids reissuing a new move command after each short interval. The owner must assess real v14 animation smoothness and movement-history behavior before enabling a test release.

## Live adapter gate before any test build

- On Foundry v14 with one isolated test token, confirm a multi-waypoint `TokenDocument.move` produces continuous visible animation and `moveToken` events exactly at `checkpoint:true` native updates, with the documented IDs and `pauseMovement()` callback. Check Region Behaviors, Levels and Token Vision along the path.
- Confirm a pause requested while an animation is running stops at the *next* checkpoint without skipping or duplicating movement, and that the resumed movement retains the original route/speed.
- Simulate Canvas refresh **before native update**, **after native update but before animation ends**, **after World-time advance but before Journal confirmation**, **while awaiting a GM rest choice**, and **after the final checkpoint**. Verify token/clock/Journal agree, or the system fails closed without duplicate writes.
- Repeat continuously operating ship with passenger rest, normal ship with overnight breaks, land/mounted travel and land→sea→land transfers, both active GM and non-GM clients.
- Run `npm run check`, `npm run architecture:check`, syntax checks, `git diff --check`, and confirm native v14 live acceptance before the Product Owner approves a final merge.

## Explicit non-goals

Do **not** set TokenDocument positions directly or animate unofficial PIXI properties in place of the public movement API. Do not disable Canvas redraw, bypass Region restrictions, reinterpret native movement costs as fares, or migrate old Journeys on read. Do not silently assume lost movement-history IDs after a full reconnect mean a native move was confirmed.
