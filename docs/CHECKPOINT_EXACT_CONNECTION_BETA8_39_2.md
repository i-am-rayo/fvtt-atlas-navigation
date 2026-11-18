# v0.3.9-beta.8.39.2 — Exact Checkpoint / Road Graph Connections

**Status:** versioned Foundry v14 owner GM/non-GM test build, NOT accepted or released.

**Install manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.39.2-exact-checkpoint-connection/module.json

**Archive:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.9-beta.8.39.2-exact-checkpoint-connection.zip

**Source:** [Draft #328](https://github.com/i-am-rayo/fvtt-atlas-navigation/pull/328), stacked on previous [beta.8.39.1](https://github.com/i-am-rayo/fvtt-atlas-navigation/pull/327). **Automated** 1018/1018 passing; architecture checks passed on source commit `fd347b85b8fb29750839e4dbb558ca2aaf754de4`. Packaging-branch CI and actual Foundry v14 live verification are separate checks.

## Owner findings (2026-11-12)

1. Move an independent Checkpoint onto the **beginning/end Road Node**: previously “Move Only”, unable to connect.
2. A Road moved/edited into an independent Checkpoint linked logically but was not geometrically coincident: saved Road and Checkpoint graph position must be exactly shared.

## Implementation

- **Terminal merge, explicit GM-only:** When a relocation lands within the existing 14-image-pixel Road snap tolerance of a genuine terminal Node with no existing Checkpoint, offer Move & Connect / Move Only / Cancel. Confirming connects the Checkpoint by updating its `nodeId` to the authoritative existing Road endpoint and sets `roadId`. The former unshared isolated Node is removed. The Checkpoint ID, road segment ID, Road endpoint Node ID, attached Journals, discovery/transportation/semantic Territory associations are preserved.
- **Safety limits:** Shared Road junctions, already-checkpoint-owned Road endpoints, unshared-node validation failure, unsupported Scene version, or stale revisions abort or offer Move Only; no zero-length segment, duplicated Node or invisible graph connection. Source Checkpoint Node ID necessarily changes on merge; this is shown in the GM confirmation instead of claiming all Node IDs are preserved.
- **Exact interior joins:** When a reviewed Road edit or interior Move & Connect selects an eligible standalone Checkpoint, place its authoritative saved Node at the closest projected centerline point *within the same revision-checked Atlas Scene update*, then connect both Road sections through that same Node ID. Non-selected standalone Checkpoint locations remain unchanged. Both the existing Road's original upstream segment ID and the Checkpoint ID remain stable.
- No native Region, Fog, Token, Actor, approved Journey, Journal or time write. Rendering is only a read of Scene Atlas graph.

## GM checklist (back up the World)

1. Install manifest. Verify displayed version `0.3.9-beta.8.39.2` and record original Road/Checkpoint/node/Region/Journal counts and IDs.
2. Create Road A with two endpoints, create independent Checkpoint B nearby. Use Workspace → Checkpoints → Move; click **Road A start** and choose **Move & Connect**. Confirm Checkpoint B's saved `nodeId` equals the existing Road start ID, its `roadId` refers to Road A, the old isolated Node is retired, no extra Road section was created, and routing recognizes the junction. Repeat on an end endpoint.
3. Use **Move Only** near an endpoint; it must remain an independent Checkpoint and leave Road topology unchanged. Use Cancel; no Atlas Scene flag write.
4. Attempt Move & Connect at an existing **shared junction** or a Road endpoint already containing another Checkpoint: no unsafe automatic merge should be offered.
5. Place a standalone Checkpoint ~5 image pixels off the interior of Road A; edit Road A so the authoring review offers it. Approve connection; confirm the Road ends/starts reference exactly the same Checkpoint Node, the Node's geometry is on Road A's saved centerline, not at the old slightly-offset location. Repeat using Move & Connect to a Road interior.
6. Use Select None and Cancel when editing Road intersections; unchanged Checkpoint coordinates and IDs must remain intact. Verify collision/near-coincident candidates fail closed.
7. Refresh canvas, switch Scene, reload and reconnect, then verify original IDs and geometry do not drift.
8. On a separate non-GM client verify that unpublished Checkpoints and private Journals remain invisible, and that published ones obey native permission checks. Smoke-test Atlas Roads, Regions, fog, transport/journey approved actions, Journal and World time. These writes must not be duplicated by a canvas refresh.

## Remaining considerations / release gate

- Endpoint joining is **one isolated Checkpoint to one genuine terminal Road Node**. Full shared-junction reconciliation and connected Checkpoint relocation remain deferred. The former isolated Node ID is retired to ensure exactly one graph Node at the anchor; references to Checkpoint IDs and existing Road Nodes are retained.
- Complete Surface/Exploration/Navigation Workspace migration, Sunday cross-World smoke and private-beta signoff remain **P0**; this fix does not close their tracking.
- No owner Foundry live acceptance yet. Keep stacked PRs draft/unmerged. If any regression is found, stop, preserve the console stack and Scene revision, and restore the backup rather than rewriting newer Scene flags.

