# v0.3.8-beta.7.18 — Journey lifecycle boundaries

Status: **architecture-only draft; automated tests passed; owner Foundry v14
GM Journey successful. Non-GM and broader compatibility acceptance pending**.

## Owner GM live result — November 5, 2026

- Hearth's Heart → Dirwest completed across five confirmed legs; moving
  **2d 19h 38m**, downtime **16h**, elapsed **3d 11h 38m**. The arithmetic
  matches the recorded Foundry World-time total.
- Owner reports Journal and logs successful. Console evidence includes **two**
  Foundry `canvasTearDown` events while traveling, followed by confirmed
  native anchor checks, resumed automatic continuation and final arrival.
- Those observations validate the tested GM path only. They do not establish
  that a non-GM client sees correct progress when the GM is inactive, nor
  that canvas rebuild frequency is optimal. R-01/issue #135 remain open
  investigations in the beta.7.19+ architecture assessment.

## Implementation boundary

- The pure `navigation-journey-lifecycle.js` module centralizes three existing
  policies: terminal status cannot be downgraded; teardown distinguishes a
  confirmed dock/manual pause from an interrupted native move; only an
  involuntary canvas teardown while moving/rest-applying may request the
  existing automatic-recovery mechanism.
- The controller still owns retry limits, active-GM authorization,
  TokenDocument movement, World-clock updates, Journal writes, route and
  transport validation, and the existing user-facing notices.
- A targeted daily-rest integration test blocks the asynchronous World-time
  write and proves the native token receives **no** new movement request or
  coordinate change until the confirmed eight-hour rest finishes.
- No new features, schema migration, World/Scene/Actor flag changes,
  permission changes, Player travel, Actor rests, fare charges or UI polish.

## Owner test cases

1. Back up the test World. Install this **draft test build** and ensure the
   version is `0.3.8-beta.7.18` after refreshing Foundry.
2. Travel a multi-leg route: land to Port Barthos → hired ship to Hearth's
   Heart Dock → alternate eligible land method. Verify each checkpoint keeps
   its own GM decision, World time and previous leg history.
3. On non-continuous Wagon/Horse/Warship travel, Long Rest should add exactly
   eight World hours with a stationary token, then automatically continue;
   it should not add movement distance. A continuously operating ship may
   move during an onboard passenger rest without duplicate World time.
4. Pause manually; reopen Navigation/reload and confirm the Journey remains
   paused without automatic token movement. End/completed Journeys must not
   reappear as an active saved Journey.
5. Cause a Foundry canvas rebuild at a confirmed movement/rest checkpoint.
   Safe incomplete-leg recovery may resume automatically. An unresolved
   native move must stop with intact metadata and useful GM review.
6. Run a non-GM client concurrently. Confirm no unauthorized travel, time,
   Journal or Actor updates; verify road/checkpoint visibility, fog, native
   Regions, Levels and weather are unchanged.

## Expected evidence

- Record World time, Journey flag status/lastConfirmedAnchor and native
  TokenDocument position before/after rest, not just the visible animation.
- Capture any `canvasTearDown`, `canvasReady`, native checkpoint mismatch or
  failed Journal write log. Separate third-party console errors from Atlas.
- Automated test/architecture results will be recorded on the draft PR; they
  do not substitute for the owner checks above.
