# Native move rejection investigation — v0.3.9-beta.8.46

## Owner evidence, 13 November 2026
Foundry v14.370/D&D5e 6.0.6; Atlas Scene Sandbox. The uploaded console log shows two attempts:
- Loaded a recoverable Journey with a verified native anchor (0 px drift).
- Planned 9 native movement chunks, 35.4 hours, World clock enabled.
- Called the public `TokenDocument.move()` on chunk 1 (planned 2,000 ms).
- The public move returned a false/stopped result; Atlas logged `Foundry stopped or blocked the current travel stretch` and retained 0% confirmed progress.
- The owner Journal reports **Port Barthos to Millstone**, 70.97 mi, 0m confirmed; a Journey record exists. Treat its World time/Token state as authoritative and **do not clear, restart or auto-replay** without reconciling the failed attempt.

The log does **not** identify the native veto source (collision, Regions, movement action, another module's movement hook, or another constraint). The destination list is a preview-only setter and does not call `TokenDocument.move`; no causal evidence ties it to the rejection. The World CLI helper warning and DAE/Patrol/ChatLog deprecations are unrelated evidence, not an Atlas movement diagnosis.

## Changes and boundaries
- Keep the documented Foundry v14 `TokenDocument.move()` public API and its false result authoritative.
- When false, record (GM diagnostics only) the chunk number, public movement action, original chunk waypoint, intended endpoint, current TokenDocument position, drift/remaining px, and whether native movement changed position but was **not confirmed**.
- Do not assume success on any false result; do not advance moving time, confirm a Journal anchor, move Tokens manually, skip constraints, ignore hooks or repeat a native action.
- No Road/Checkpoint/Region/Fog, Atlas persistence, schema, or travel target changes.

## Required tests
- `npm run check`; `npm run architecture:check`; `git diff --check`.
- Pure unit regressions: failed first chunk/0 movement, false after partial native displacement, false after reaching endpoint, invalid position.
- GM v14: back up the Sandbox World. Open the existing Journey (do not forget it). Inspect its saved lastConfirmedAnchor, pendingNativeMove and World clock against actual TokenDocument before any Resume.
- Reproduce a **new** movement only in a separate test World/Scene with no unfinished Journal; exercise map-click and named-checkpoint selection separately, same A/B path, and inspect the new bounded rejection diagnostics.
- If no movement: test in a copied Scene with known unblocked native path; compare walls, active Region Behaviors, token movementAction, and third-party preMoveToken listeners. Any native veto must remain a safe interruption.
- If actual TokenDocument moved but result was false: do not retry. Escalate an unconfirmed-native-position recovery defect; reconcile before adding a recovery transition.
- Non-GM: no new authoring or movement authority, no leaked journal or hidden Atlas metadata. Canvas refresh/reload must not double movement, time, fare, rest or Journal events.

## Owner decision gate
Automated checks alone do **not** establish that the underlying movement rejection has been fixed. CI and live v14 evidence are pending. Further gameplay movement changes require the actual native veto cause and a reproducible regression.

## Install and rollback
Manifest: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.46-native-travel-interruption/module.json

Archive: https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.9-beta.8.46-native-travel-interruption.zip

Rollback to beta.8.45 only after backing up the test World. No data migration is performed.
