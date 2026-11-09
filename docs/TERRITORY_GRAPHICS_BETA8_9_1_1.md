# v0.3.9-beta.8.9.1.1 — Territory canvas drawing compatibility hotfix

## Owner-reported Foundry v14 live failure

In beta.8.9.1 the owner attempted to edit the existing **Dirwest** Territory
and to create a new **Continent** using Atlas Boundary Nodes. Both authoring
paths displayed `graphics.stroke is not a function`. The provided browser log
has this error twice. The screenshot confirms the Workspace button and the
Create Atlas Territory dialog loaded successfully; the failure begins in the
new transient canvas preview.

The direct cause is `scripts/territory-authoring-canvas.js`: its new drawing
path called `PIXI.Graphics.stroke`, `circle().fill`, and `poly().fill`
unconditionally. The Foundry canvas Graphics surface in the owner's World
does not supply `stroke`. Atlas's existing Road canvas already checks the
available API and uses `lineStyle`/`draw*` where required.

## Focused fix

- Move Territory preview painting into three local adapter helpers. Use the
  modern `stroke`, `circle`/`fill`, and `poly`/`fill` path when available;
  otherwise use the legacy `lineStyle`, `beginFill`, `drawCircle`,
  `drawPolygon`, and `endFill` methods.
- If neither supported graphics surface exists, fail with an actionable
  Canvas diagnostic and clean the preview instead of throwing an unhelpful
  function-call `TypeError`.
- Maintain the exact same editable control nodes, native Shapes, editor
  staging/Undo/Cancel, GM permissions, peer and parent validation, and
  one-Region Save contract. **No migration or Region write** occurs in this
  drawing hotfix.
- The log also contains a Foundry minimum-window-width warning (889px
  effective width) and unrelated module messages. Those are **not** the
  demonstrated source of the `graphics.stroke` failure.

## Automated regression

Add a canvas DOM regression with a Graphics double that **does not implement
`stroke`, `circle`, `fill`, or `poly`** but does implement the legacy methods.
Verify opening an existing 3-node Region, drawing three new nodes, and
rendering a painted native cell, followed by cancellation and full listener
and graphics cleanup. Retain the modern Graphics test. Run the full test
suite, architecture gate, syntax checks, and Git diff gate.

## Owner retest (Foundry v14)

1. Install beta.8.9.1.1 on the backed-up test World and reload the Scene.
2. Open **Atlas Workspace → Territories → Dirwest → Edit Boundary**. The
   editor should open with existing control-node handles and border preview;
   test dragging one node, Undo and **Cancel**. Native Region unchanged.
3. Open **Territories → [+]**, enter a unique Continent name and select **Draw
   Atlas Boundary Nodes**. Click *Edit Boundary*; the modeless canvas editor
   should remain available. Draw 3+ nodes, preview and Cancel once. Reopen,
   then Save a nonoverlapping new Continent and check its native Region.
4. Try **Paint Native Hex/Grid Spaces** and verify filled cells render and
   can be erased before Save. Native Shape/Behaviors should not change on
   preview or Cancel.
5. Confirm no `graphics.stroke is not a function` messages in console, GM
   Verbose remains enabled, and Road/Fog/Journey visuals still work. Report
   any new errors separately with their full first stack trace.

This hotfix is automated-test-passing only until the owner repeats the live
Foundry checks. Keep the stacked PR draft and do not merge or release.
