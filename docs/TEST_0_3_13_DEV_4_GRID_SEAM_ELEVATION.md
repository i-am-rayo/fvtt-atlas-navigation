# Atlas 0.3.13-dev.4 — Native Elevation-Aware Shared Seam (Milestone 02)

## Scope

This development candidate **contains PO-tested 0.3.13-dev.3** and only one new read-only enhancement for #264: shared-boundary shortcut suggestions require *matching native Region elevation ranges*, including `topInclusive`. The native v14 grid coordinates are 2D; matching XY cells on different Levels are not automatically interchangeable.

The GM sees an explicit count of directly adjacent cells excluded for differing ranges. This **does not** alter the authoritative transfer planner/writer, committed Region Shapes/Behaviors, recovery ledger, World settings, player permissions, Road graph, Token movement, Journal, Fog, World time or prices.

**Important:** The outstanding blocked v3 multi-Region recovery issue #265 is **not fixed** by this candidate. If a World has a pending blocked transfer, retain the ledger/Scene backup and do **not** try a new transfer or force Resume/Roll Back.

## Owner GM smoke test (backed-up Foundry v14 World)

1. With two adjacent native Hex/Grid Territories on the **same** elevation interval, open Paint Territory. The existing Shared Boundary control offers eligible directly adjacent cells as before.
2. With an adjacent Territory on a **different** elevation interval, the shortcut must **exclude** its cells and show their excluded count. Same 2D grid offset alone cannot make it eligible.
3. Set equal bottom/top but different upper-bound inclusion. The shortcut must still exclude the peer.
4. If one Region has a constrained native elevation range and the other has no range, the shortcut excludes the peer conservatively.
5. Check both square and hex Scenes. Native adjacency, size limits and at-most-one-owner protections stay intact.
6. Cancel the editor. Verify zero Scene, Atlas flag or native Region changes; no save-on-review or automatic movement.
7. Validate the prior dev.3 dropdown A–Z, Road → Settings handoff and Region preview still behave correctly. Check keyboard focus and 200% zoom.
8. Test from a **separate non-GM client**: no GM authoring shortcut or confidential native Region metadata is exposed.

Do **not** intentionally trigger partial native writes. A separate safe backup/recovery acceptance is needed for #265.

## Exact test build

- Branch: `feat/0.3.13-m02-grid-seam-elevation`
- Manifest: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feat/0.3.13-m02-grid-seam-elevation/module.json
- Archive: https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/feat/0.3.13-m02-grid-seam-elevation.zip
- Draft feature PR #523 targeting the dev.3 feature branch; no merge/release authorization.

The new read-only shortcut is not proof that elevation-aware multi-Region transaction commits or native recovery have been accepted.
