# v0.3.8-beta.7.21.1 — Region generator width reference hotfix

**Status:** owner-reported beta.7.21 failure reproduced in automated DOM
regression; live Foundry v14 GM/non-GM retest pending.

## Observed failure and cause

- Screenshot: the generator visibly displayed **0.75 cells** as the distance
  on either side of a Road, but clicking **Preview & Confirm** raised
  `width is not defined` and produced no Region preview.
- Evidence: the generator had already adopted the shared
  `createCheckpointRegionWidth()` slider (`widthControl.input`). Its preview
  callback still referenced the removed `width` variable. That line already
  existed before beta.7.21; the Region read-boundary extraction did not
  introduce it. This is a JavaScript `ReferenceError`, not a geometry-width
  validation error or an invalid 0.75-cell setting.
- Correction: read `Number(widthControl.input.value)` from the actual visible
  slider at confirmation time. No native Region, Scene flag, preset, graph,
  Journey, Fog, Behavior or permissions contract changes.

## Automated verification

The DOM regression reaches the real standalone Region generator, switches to
**Path between two checkpoints**, sets 0.75 cells, clicks Preview & Confirm,
and checks the unchanged callback receives `widthCells:0.75` without a
notification or Scene write. It also switches back to a checkpoint-centered
Region, sets 0.5 cells, and checks its submission. The test failed with the
reported error before the fix and passes afterward.

## Owner Foundry v14 retest

1. Select the same Road and **Path between two checkpoints** as before, with
   From/To checkpoints set to different checkpoints on that Road.
2. Set **Distance on either side of road** to **0.75 cells** and click
   **Preview & Confirm**. The preview and explicit GM confirmation must open
   without `width is not defined`.
3. Confirm one new native Region is created with the expected geometry,
   selected preset, and optional native movement-cost Behavior. Verify that
   native Behaviors, Levels and other Regions are unchanged.
4. Switch to **Area around one checkpoint**, set its Radius to **0.5 cells**,
   and confirm its separate preview. Canceling either preview creates nothing.
5. Reload and verify linked/generated Region listings, Road/Checkpoint IDs,
   surface overlays, Fog, weather and existing Journeys/World time are
   unchanged. Confirm non-GM clients cannot create/edit Regions through Atlas.

**Important:** Do not continue to beta.7.22 on the strength of automated
tests alone. Complete the parent [beta.7.21 Regions & Surfaces checklist](REGIONS_SURFACES_BETA7_21_TESTING.md)
and stop if Region creation or existing native data is affected.
