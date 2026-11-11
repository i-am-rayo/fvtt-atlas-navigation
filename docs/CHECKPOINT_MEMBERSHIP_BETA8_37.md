# beta.8.37 — Stage 3B Checkpoint–Territory membership management

Stacked on accepted read-only Stage 3A draft #313. Do not merge or close #268/#204 until owner Foundry v14 GM/non-GM acceptance. This update remains non-mutating except for invoking the **existing separately confirmed semantic link editor** when the GM chooses it.

## Scope / owner live checks

1. Open Dirwest Territory → Checkpoint & Journal. The membership report now distinguishes **Peer overlap: review ownership** (same geographic tier) from **Cross-tier overlap: review hierarchy** (different-tier cells without a declared parent) and ordinary **nested** parent/child containment. The latter must **not** show a conflict warning. Verify your five Checkpoints no longer receive a generic identical warning merely because they share geography with higher-level Regions.
2. Move a saved Checkpoint with the existing Checkpoint editor. An open Territory Settings membership report should update after the authoritative Scene Atlas update; reopening must also show the new cell. Unsaved draft positions should not appear.
3. Transfer saved Hex/Grid cells between native Regions (only using the existing guarded transfer workflow). An open report should update on native Region events; Cancel/failed transfer should not claim a new membership. Verify recovery state remains untouched.
4. Explicitly link a Checkpoint to a Region outside its native cells. Expect **Link outside boundary: review** and a **Review semantic association** action. Click only if intentionally correcting it: this launches the preexisting GM-confirmed link picker, not an automatic mutation.
5. Click **Locate** for a reported Checkpoint; the settings window minimizes and the existing Road/Checkpoint map focus locates it. This should not save data, move its node, or change permissions.
6. Delete or rename a linked Checkpoint/Region through supported workflows. Invalid/missing association metadata must surface as a review warning, never be silently remapped. Close Settings and verify it unregisters refresh hooks; switch Scenes and confirm no cross-Scene refresh.
7. Run a separate player client: it must have no GM membership report, overlap hierarchy, link reconciliation or Locate controls. Verify no new names, Region Shapes/Behaviors, Journal data, Fog, Tokens or Journey changes.

## Limits / follow-up

- This is a **native grid-cell** inspector, not a Levels/elevation or polygon classifier. Mixed/unsupported native Shapes are reported as skipped. No silent authoritative membership resolution occurs.
- Same-tier shared cells are flagged as peer ambiguity; unrelated geographic tiers are advisory even when no explicit parent link exists. Parent/child containment is informational, not a duplicate ownership conflict.
- The report refreshes when native Regions or Scene Atlas change while the window is open. No background membership database or migration is written. Exact event ordering and large-world performance still require owner live verification.
- Full #268/#204 closure additionally requires elevation/Levels, mixed Shapes/boundary semantics, the broader player-safe projection policy, and live GM/non-GM acceptance.
