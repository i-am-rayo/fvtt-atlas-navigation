# Native integer waypoint compatibility — v0.3.9-beta.8.48

## New confirmed evidence (owner, 2026-11-13)
The v0.3.9-beta.8.47 GM test logs identify the precise native rejected movement:
- Scene: `urz1d8NZFFhjo38J`; Token: `5I23WITpWb4q87MR`.
- Native `TokenDocument.move` on chunk 1 of 9, movement action `walk`, returned `false`.
- `startedAt` and current document position: **(3831, 2331)**; moved **0** pixels.
- First requested target: **(3761.1443468848224, 2346.7204791899035)**; **71.60269365120425** pixels from origin.
- The native `TokenMovementWaypoint` v14 public API states that `x` and `y` must be **integer top-left pixel coordinates**: https://foundryvtt.com/api/interfaces/foundry.documents.types.TokenMovementWaypoint.html.
- Therefore the preexisting chunked-movement adapter **violates the public data contract** by submitting fractional target x/y. This is a confirmed invalid adapter payload, **not yet a proven sole cause** of the native `false` response.
- The continuous-movement adapter already rounds to integer pixels. The problem was limited to the other chunked travel path.

## Focused correction
- Pure `toNativeIntegerWaypoints` validates a bounded sequence and rounds only the outbound public native movement waypoints to the nearest **pixel**, not to a grid cell. It preserves shape and does not bypass obstacles.
- Preflight of ordinary chunks now occurs **before the first Journal creation/write**. A quantized chunk without two distinct positions fails closed.
- The final native waypoint, not the unrounded model value, is used for post-move document-position confirmation and failure diagnostics.
- The saved authoring graph, Point B, route polyline, calculated distance/hours, approved transportation, Token permissions, Walls, native Region Behaviors, fog, native time/calendar semantics, and Journey schema are unchanged.
- No `ignoreWalls`, `ignoreCost`, direct `token.update`, manual `x/y` mutation, or automatic retry was introduced.

## Regression and quality gates
New `tests/navigation-native-integer-waypoints.test.mjs` verifies:
- The owner's exact fractional target becomes native integer (3761, 2347).
- Authoring geometry is not mutated.
- Bounded rounding removes consecutive subpixel duplicates.
- Collapsed, unbounded, and nonfinite paths fail before gameplay commits.

The existing GM guided-movement integration now asserts **every** submitted waypoint has integer `x` and `y`.

Required: `npm run check`, `npm run architecture:check`, JavaScript syntax, `git diff --check`, and no missing/cyclic imports. CI status is a separate evidence category from Foundry live acceptance.

## GM/non-GM Foundry v14 owner test
1. Back up the World, the existing **Port Barthos → Millstone** Journey Journal and the Party Token's native coordinates. First reconcile `pendingNativeMove` and `lastConfirmedAnchor` before any Resume; do not delete or reset a saved Journey to bypass recovery.
2. In a separate clean cloned Sandbox World/Scene, install this beta manifest. Verify version `0.3.9-beta.8.48`. Build the same route with the **same Party Token and `walk` action**. Verify both map click and categorized checkpoint selection resolve the same Point B.
3. Use the existing diagnostic stream. Confirm the first native movement now submits integer top-left coordinates: approximately (3831,2331) → **(3761,2347)** for the original geometry, subject to route/timing changes. If it returns `false`, capture the rejection and **halt**; check physical Walls, native Region Behaviors and third-party vetoes. Do not force-move.
4. Only if travel proceeds, test confirmation of token position, elapsed World time, Journal leg, checkpoint arrival and road/destination labels; then pause, canvas refresh/reload, resume and completion without duplicates.
5. Test a short route, routes with several turns and both land and water/continuous transport. Confirm unmodified Region, Fog, roads, checkpoint links, permitted Actor/Token states.
6. Non-GM: verify no new Journey approval permissions, no hidden checkpoint/territory exposure, and no unauthorized game-time or Token changes.
7. If original Journey remains at 0%, inspect saved status and reconcile it separately. A clean-world success **does not itself authorize** replaying that record.

## Install
Manifest: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.48-native-waypoint-integers/module.json

Archive: https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.9-beta.8.48-native-waypoint-integers.zip

No data migration. Draft only, pending owner live acceptance and confirmed resolution of #348.
