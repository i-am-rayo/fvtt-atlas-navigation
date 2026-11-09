# v0.3.9-beta.8.9.1.4 — Native polygon origin round-trip hotfix

## Owner live failure (2026-11-09)

The owner repositioned Hearth's Heart using Foundry native Region tools after a previous Atlas offset, selected **Adopt Native Boundary**, and received the successful adoption notification. Immediately opening **Edit Boundary** repeatedly failed with:

> Atlas controls cannot be aligned with this native Region Shape. Do not save; inspect the native Region and reconcile its source.

The log contains the successful adoption notification before the alignment failure; other module warnings are unrelated. The native Shape's Region editor displayed an arbitrary origin near X 6333.14, Y 2966.27. A native Region polygon can be expressed as a world-space origin and a list of local points that do not start at the polygon's minimum bounds.

## Root cause and correction

The beta.8.9.1.3 alignment check used `polygonShapeFromNodes`, which normalizes to the minimum X/Y of Atlas control nodes. It then required those normalized *relative* points to numerically match Foundry's existing native Region's relative points, although the same world-space polygon can use a different origin. Adoption reconstructed the correct absolute points, but the next Edit failed the false mismatch check. An automated regression with a non-minimum native Shape origin reproduces the failure before the fix and passes afterward.

In the corrected editor:

1. Project Atlas nodes into a polygon using their currently configured smoothing.
2. Convert both the projected Shape and the original native Shape into absolute world-space vertices using each Shape's own origin.
3. Require equal vertex count/order and the same outline, allowing only a **constant** translation to compensate for changed Scene padding. Reject unsupported and genuinely changed geometry.
4. Translate the editable control nodes to match the native world-space vertices. Reading remains non-mutating.
5. When an explicitly approved Save leaves all boundary vertices unchanged, update only Atlas metadata flags: **do not rewrite** the native polygon origin/relative point encoding or trigger a native Shape update.

Native Region Shapes, Behaviors, Levels, IDs, permission checks, stale guards, geography validation and multi-GM concurrency behavior remain authoritative. No automatic moving, unapproved repair, bulk data change or migration.

## Owner Foundry v14 retest

1. **Back up the World.** Install beta.8.9.1.4 and reopen Scene Paedor.
2. Confirm Hearth's Heart currently sits in the *intended* place. If not, correct its native Region position using Foundry's tools and **Adopt Native Boundary** again; do not expect Atlas to undo past erroneous moves.
3. Open **Atlas Workspace → Territories → Hearth's Heart → Edit Boundary**. The editor should open, including previously adopted detailed polygons, without the false alignment error.
4. Click Cancel. Confirm Hearth's Heart's native Shape and Behaviors remain unchanged.
5. Open Edit Boundary again, do **not** move any nodes, then Preview & Save. Confirm the native Region retains the same actual boundary, original origin/relative point representation, IDs and Behaviors.
6. Move exactly one Atlas control node, Preview & Save, approve. Verify an authorized native boundary update with no full-region displacement, and that reopen/refresh persists the intended change. Undo/Cancel should never commit.
7. On a **copy** of another native polygon with a different origin or smoothing preset, repeat the unchanged Save and one-node edit, including a Scene padding/canvas-refresh change.
8. Repeat with Dirwest's 104-node polygon, a new no-parent City and painted grid Regions. Check non-GM permission, Road/Checkpoint overlays, Fog, and any paused/active Journey remain unaffected.

## Verification gate

- Targeted native-origin regression before/after fix, existing adopted/padding/smoothed controls and stale-write protections.
- Run the full automated suite, syntax checks, architecture graph and whitespace validation.
- No genuine Foundry v14 owner acceptance yet; keep this branch and stacked PR in draft. No merge/final release without Product Owner approval.
