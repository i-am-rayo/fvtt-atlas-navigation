# v0.3.9-beta.8.9.1.5 — Foundry v14 absolute polygon vertices

## Owner live diagnostic and root cause (2026-11-09)

The owner reports that after an Atlas edit, manual native Region reposition and explicit reconciliation, Hearth's Heart's **Atlas control nodes appear outside the Scene** even though the authoritative native Region is visible at its intended location. The diagnostic provides an unambiguous comparison:

| Native Region measurement | Reported canvas coordinates |
| --- | --- |
| Native polygon bounding rectangle | X 3167.38–3999.07; Y 1480.80–2071.49 |
| Native polygon raw-point bounding rectangle | X 3167.38–3999.07; Y 1480.80–2071.49 |
| Separate native origin | X 6333.25; Y 2963.39 |
| Erroneous origin-plus-points rectangle | X 9500.63–10332.32; Y 4444.19–5034.88 |
| Previously adopted first Atlas node | X 9889.77; Y 4477.03 |
| Reported Atlas control vertices | 184 |

The raw polygon `points` agree with Foundry's rendered `bounds`; adding `origin` a second time projects them **thousands of pixels away**. The previous beta.8.9.1.4 hotfix wrongly treated native v14 polygon points as origin-relative; its published explanation and corresponding regression assumptions were incorrect. The value called `origin` is a separately stored native manipulation anchor, not a vertex-space transform for Atlas to apply.

## Focused correction and safeguards

1. Read native polygon vertices directly from their absolute canvas-space `points`. Adoption/reconciliation no longer adds native `origin` to those points.
2. Project Atlas control nodes and smoothing directly into absolute native polygon points. Newly created regions no longer have vertices shifted by subtracting the origin. Validation of geographic parent containment and peer intersections uses those same absolute vertices.
3. When an Atlas control source from beta.8.9.1.3/.1.4 already contains a **uniform incorrect translation**, align controls to the matching native vertex outline in memory. **Reading does not modify either Foundry documents or Atlas flags.** An explicit GM Save with no moved nodes updates the provenance flag but retains the native Shape representation exactly.
4. On an explicit node edit of an existing polygon, retain the native Shape's existing `origin` anchor while updating only the intended vertex coordinates. The original native Region ID, Behaviors, Levels, visibility and links remain untouched.
5. Check a single native polygon's `bounds` against its raw vertex rectangle when exposed by Foundry. Reject unsupported or inconsistent representations rather than guessing or silently moving a Region. Preserve the Shape digest/concurrent-author checks and require explicit GM Save.

No schema change, bulk migration, automatic native Region reposition, automatic reconciliation, data read-write, new permission, road, checkpoint, Journey, Fog or Atlas navigation behavior is part of this build.

## Owner Foundry v14 GM acceptance / recovery

**Back up the World first.** For the first edit, use a duplicated World or a *copy* of Hearth's Heart's Region. Do not move the original native Region merely because Atlas control nodes were off-map, and do not use beta.8.9.1.4 to save another polygon.

1. Install **0.3.9-beta.8.9.1.5** and reload the Paedor Scene. Confirm that the *native* Hearth's Heart polygon is visibly in the intended location in Foundry's Region layer. If the native polygon itself is misplaced, correct that geometry first using Foundry tools; this build does not guess or repair the location.
2. Open **Atlas → Territories → Hearth's Heart → Edit Boundary**. Previously misadopted Atlas nodes should now appear over the visible native polygon, rather than beyond the Scene edge. No further **Adopt Native Boundary** click should be needed when the native Shape digest is unchanged.
3. Click **Cancel** and verify both the native polygon and its flags are unchanged. Repeat, make **no node movements**, then **Preview & Save** and explicitly approve. Confirm the native Region did **not move** and its ID, origin, Shape points and Behaviors remain identical; only the Atlas authoring source flag may be corrected.
4. Reopen the editor. Move **one** control node a few pixels and explicitly Save. Verify only the intended vertex moved, the other vertices and native origin remained stable, and reopening the editor displays the saved node at the proper location.
5. Repeat on Dirwest's existing control polygon; create a small new independent test City/Continent at a clearly nonzero map location. Verify new native polygon placement matches the painted controls, including after Scene refresh, padding change and cancel/undo.
6. Repeat a smoothing preview, a Region with a parent Continent, and a hex/grid-cell Territory. Confirm the parent/peer overlap safeguards still work, the already implemented brush radius slider is unaffected and no unauthorized Region write occurs.
7. Verify a non-GM cannot author/reconcile Territories. Smoke-test existing Roads/Checkpoints, Fog overlays and active/paused Journeys after a canvas rebuild. No World time or Journey state should be advanced by opening a Territory editor.

Stop testing on a copied Region and report the native `bounds`, raw `points`, `origin`, Atlas source points and console error if the editor reports a new bounds mismatch; do not repeatedly adopt/save in an attempt to force alignment.

## Verification status

- Automated coverage: absolute native vertex round-trip at nonzero map coordinates; original owner numeric diagnostic; previously misadopted control metadata; unchanged Save preserves native geometry; single-node edit retains original anchor; invalid native bounds fail closed; padding/smoothing, GM permission and stale writes.
- `npm run check`: **813/813** tests passed, including module syntax checks.
- `npm run architecture:check`: **4/4** tests passed; **171** imports scanned, **0** cycles and **0** missing targets.
- `git diff --check`: passed.
- **Actual Foundry v14 live GM/non-GM verification remains pending.** Keep the PR draft, with no merge/final release until the owner accepts the live test.
