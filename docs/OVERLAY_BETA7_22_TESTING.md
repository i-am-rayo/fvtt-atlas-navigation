# v0.3.8-beta.7.22 — Overlay observability & lifecycle checklist

**Status:** focused stabilization draft; automated checks are not live Foundry
acceptance. Install only in a backed-up Foundry v14 test World. This build is
stacked on beta.7.21.1, whose Region creation failure was retested successfully
by the owner. The rest of the beta.7.21 Region/Surface acceptance remains open.

## Implemented

- A small, in-memory `RoadOverlayObservability` observer records refresh count,
  average/maximum refresh duration, requested pan/fog refreshes, Graphics
  allocations/destructions and the most recent derived road-path, checkpoint-hit
  and label counts. Counters do not store geometry, player secrets, flags,
  Journals or personal data. The observer does not write to Foundry documents.
- At `canvasTearDown`, a GM who explicitly enables **Atlas Debug — Console
  Logging Level: Trace** receives a bounded Road overlay lifetime summary in
  the browser developer console. Default debug level is Off. Timings are local
  client measurements, not evidence of Foundry canvas rebuild causation.
- Canvas teardown now clears the temporary Locate Road highlight interval,
  its highlight state, and the existing pan/fog timers. Already queued callbacks
  are rejected by lifecycle generation and timer identity guards. Late texture,
  font and Journal-permission resolutions can populate read-only caches, but
  cannot redraw a torn-down canvas.
- Existing road/checkpoint overlay presentation, Scene data, hit testing,
  permission gates and debounce intervals remain unchanged. No persistent
  cache, schema migration or new Foundry hook listener was introduced.

**Not implemented:** blanket refresh suppression, native canvas monkeypatches,
unproven PIXI draw optimizations, edited player visibility contracts, independent
Checkpoint v10 migration, Fog architecture changes, or a fix for R-01 / canvas
rebuild issue #135. The next step after measurements is to target demonstrably
expensive paths while preserving hit testing and view correctness.

## Foundry v14 live acceptance — GM and non-GM

1. **Baseline:** Record Foundry and game-system versions and approximate Road,
   Checkpoint and Region counts. Observe a populated Scene's GM overlay with
   labels and checkpoint clusters at several zoom levels. Hover curved Roads,
   junctions and checkpoint icons, including Journal links. Appearance, names,
   hit areas, permissions and edge snapping should match beta.7.21.1.
2. **Measurements:** GM enables Atlas Debug Console Logging Level **Trace**.
   Pan and zoom several times, run Locate Road, and switch to another Scene.
   Inspect the `Road overlay lifetime diagnostics` console entry after teardown:
   `refreshes`, `panRequests`, `fogRequests`, `graphicsCreated`,
   `graphicsDestroyed`, `averageMs`, `maxMs`, `last`. Captures are cumulative for
   the browser session; take a baseline before comparing and use similar Scenes.
   Record counts and any discernible stuttering; don't infer causation from a
   high count alone. Off level must not produce this trace output.
3. **Teardown:** Start Locate Road then immediately switch Scenes or refresh
   Canvas. Repeat with a zoom in progress and icons just loading. No lingering
   highlight, stale Road labels or graphics should appear on the next Scene;
   no increasing Graphics imbalance should persist after repeated teardowns.
4. **Player:** In a simultaneous non-GM client, exercise pan/zoom, dense Road
   clusters, fog exploration, Journal link access and repeated Scene switches.
   Only previously permitted Atlas information should appear. Player must not
   gain authoring controls or see hidden Checkpoints/Road metadata.
5. **Regressions:** Create/edit/save/cancel Road points; verify Checkpoint IDs,
   Journey route and saved Journal remain stable. Compare native Regions,
   movement Behaviors and overlapping surface colors. Verify native/Atlas Fog,
   weather, Scene effects and party TokenDocument position remain unchanged
   through refresh; no World time, fare, Actor rest or Journey progress changes.
6. **Canvas rebuild investigation:** If a rebuild happens during or after
   guided travel, capture the Atlas lifecycle trace, other module warnings,
   saved Journey/Token/World time and reproduction steps. R-01 and #135 remain
   open and must be diagnosed separately from overlay render duration.

## Automated verification and limitations

- `tests/road-overlay-observability.test.mjs` checks bounded metrics with a
  controlled clock and read-only snapshots.
- `tests/road-canvas.test.mjs` checks Graphics reuse/cleanup, cleared Locate
  Road pulse, rejected queued callbacks, and late icon texture resolution.
- Run `npm run check`, `npm run architecture:check`, new module syntax checks and
  `git diff --check` before uploading; then perform real v14 GM/non-GM review.
- Counter totals are per-controller browser lifetime. Maximum duration can be
  skewed by browser scheduling and is **not a performance benchmark**. The
  observer does not capture Foundry's native hook listener count, browser GPU
  allocations, a causal canvas rebuild trace, or the full manual Fog renderer.

**Deferred improvements:** [#186](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/186)
minimize/confirm/close Terrain Region workflow;
[#187](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/187)
safe Checkpoint relocation, behind the approved independent-node migration.

Report each item as pass/fail with GM and non-GM client details. Do not merge
until the Product Owner accepts the relevant Foundry v14 results.
