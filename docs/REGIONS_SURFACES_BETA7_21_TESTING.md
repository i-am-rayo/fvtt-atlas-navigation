# v0.3.8-beta.7.21 — Native Regions & Surfaces read-boundary checklist

**Status:** focused refactor; automated checks run locally, owner Foundry v14
GM/non-GM acceptance pending. **Owner found a blocking Region-generator
preview error (`width is not defined`) on beta.7.21; retest with the focused
beta.7.21.1 hotfix before marking this checklist passed.** Install only in a backed-up test World. This
build does **not** activate independent Checkpoints or migrate any schema.

## Implemented boundary

- `region-native-read.js` reads generated/native Region state and descriptive
  Atlas surface assignments. The generated-Region writer and Road overlay
  retain their prior import entrypoints by re-export; no callers must change.
- `region-surface-model.js` selects display-only preset colors and ordered
  Regions from readouts, independent of native Foundry Document globals.
- Native shape observations are copied to plain visual data for sampling;
  original Region documents are not modified or stored in Atlas Scene flags.
- Preset association, overlap ranking and visual hole interpretation retain
  existing behavior. Native movement costs remain owned by the applicable
  Foundry Region Behaviors, not the overlay sampler.

**Not implemented:** v10 Checkpoints; free-standing Checkpoint generation;
new Region containment logic; native cost/overlap calculations; Region or
Behavior migration; updates to Canvas lifecycle, Fog, Navigation or permissions.

## Owner GM / non-GM Foundry v14 acceptance

1. **Region lists:** Open Scene Atlas, Road Settings and the native Region
   editor. Linked, generated and manually authored Regions should retain
   their names, sort order, enabled/disabled Behavior summaries and presets.
2. **Overlays:** Observe Land/Water/Air color segments on a curved Road,
   including overlapping preset-backed Regions with a saved display order.
   Surface labels and color boundaries must match beta.7.20.1. Repeat after
   pan, zoom, Canvas refresh and Scene switch.
3. **Native edits:** Manually change one generated Region's shapes (including
   a polygon hole if available) and one Region's elevation/Levels or Behavior.
   The listing should identify edited generated geometry and refuse unsafe
   regeneration. No native shape, Behavior, elevation, Level, color or name
   should be changed by simply viewing/refreshing Atlas.
4. **GM writer preservation:** Preview and create one eligible generated
   Checkpoint Region or corridor; reject a duplicate, then regenerate an
   *unchanged* generated Region after explicit confirmation. Confirm Region
   and Behavior IDs stay stable on regeneration, with other native settings
   untouched.
5. **Player and recovery:** With a non-GM client, verify no Atlas edit access
   was added. Refresh Canvas with a preexisting Journey and Fog state;
   Checkpoint discovery, native Fog, weather and Journey Journal/World time
   must remain unchanged. No new Journey should start automatically.

## Automated gates and residual risks

- `node --test tests/region-native-read.test.mjs` validates the new read
  boundary, display ordering, manual/native shape preservation, invalid
  generated metadata, native Behavior status and legacy import compatibility.
- Existing `road-surface-overlay`, `generated-region`, `region-atlas` and
  native cost tests guard prior behavior. Full `npm run check`,
  `npm run architecture:check`, new JS syntax checks, `git diff --check`
  remain required before publishing the draft branch.
- **Residual:** Existing pixel-sampled visual containment, polygon-origin
  heuristics, native elevation/overlap semantics, system-provided movement
  actions and manually edited Behaviors need live v14 evidence. Visual
  colors are descriptive, not authorization for travel or native cost.
  The shared native Region write functions are intentionally unchanged.

Report pass/fail for each item, Foundry v14 build, active game system and
other relevant module conflicts, plus error logs if anything fails. A failed
native-Region or Journey safety check blocks the next stabilization slice.
