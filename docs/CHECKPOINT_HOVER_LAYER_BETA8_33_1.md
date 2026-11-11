# v0.3.9-beta.8.33.1 — Checkpoint hover above Territory borders

**Status:** stacked draft on beta.8.33, owner Foundry v14 retest pending.
The previous beta.8.33 native shared-cell workflow was reported successful.

## Scope

- GM Territory borders and native Road/Checkpoint graphics both use Foundry's
  `InterfaceCanvasGroup`. Territory border layers can be appended after the
  existing road graphic, causing their strokes to cover hovering Checkpoint
  title, Road subtitle, Elevation text or grouped checkpoint quick information.
- Only **active GM hover details** are added as late interface children, above
  the Territory border layer. Their image-local/native canvas coordinates,
  fonts, linked Journal status suffix, pointer hit tests and cleanup remain
  unchanged. The marker itself, road strokes and non-hover text remain in the
  existing Road/Checkpoint graphics container.
- Non-GM rendering retains its previous player/Fog/visibility contracts. No
  Scene, Region, Journal, Token, Actor, Fog, navigation or World flag changes.

## Foundry v14 live acceptance

1. Enable native Atlas Territory borders (for example, **All Regions**), then
   hover a Checkpoint close to a thick border. Its name, Road and Elevation
   must remain in front of the border at normal and high zoom.
2. Test a hovered Checkpoint with Labels **Hover**, **Always** and **Off**;
   hover details should not be hidden in any mode. An always label that is
   *not* hovered retains its original draw order.
3. Hover a grouped Checkpoint cluster, then zoom to expand it. The group
   quick-info text must be readable, and stale hover text must disappear.
4. Hide Atlas Territory borders, then show them again. Pointer movement must
   reestablish the hover label above the visible boundary; no stale text
   survives pointer leave, Scene switch or canvas redraw.
5. As a non-GM, confirm only previously authorized Checkpoint/Territory names
   and Journals appear, and Fog keeps all hidden map geometry concealed.

**Automated checks:** `tests/road-canvas.test.mjs` and the full test suite.
**Deferred:** broader canvas z-order refactors and the remaining Region editor
and native post-commit Undo backlog (#264/#265), per Product Owner priority.
