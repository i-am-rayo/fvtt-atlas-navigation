# v0.3.8-beta.7.20.1 — Independent Checkpoint architecture contract

**Status: DESIGN ONLY — owner approved November 5, 2026.** This is an accepted future contract,
not an implemented schema, compatibility reader, migration, UI feature, or
Foundry Region integration. Beta.7.20's successful owner GM/non-GM smoke tests
remain the runtime baseline. Changes to native data or gameplay require a
separate v0.4 implementation authorization and live Foundry v14 acceptance.

## Decision and purpose

**Nodes and Checkpoints are separate Scene Atlas entities.** A Node owns
image-relative coordinates and graph connectivity; a Checkpoint owns semantic
location metadata and references one persistent Node by `nodeId`. A Node can
exist without any Road segments. A Checkpoint must eventually be creatable at
such a Node, retain its stable ID after Road edits/deletion, and become
traversable when the GM explicitly attaches real Road segments to its Node.
Native Foundry Regions own geometric boundary, elevation/Levels applicability
and Behaviors. Region containment is a *derived relationship* between a
Checkpoint's referenced Node position and native Region geometry, not its
identity. **Do not make the Node itself a Checkpoint, duplicate its position
in the Checkpoint, or save a redundant array of Road links.**

The Road/Checkpoint authoring application boundary introduced in beta.7.20
helps isolate future operations but does **not** make current checkpoints
independent. Existing v4–v9 Scene Atlas flags require `roadId` and `nodeId`;
`validateAtlas()` rejects missing attachments. Current creation splits a
Road edge in the same revision; Road delete/merge logic protects or changes
its checkpoint associations. Rendering, discovery, transportation and
generated-Region planning read the graph node for a checkpoint's position.
These are preserved contracts today, not defects to hotfix in beta.7.20.1.
The current validator already allows unreferenced Nodes; Road deletion keeps
orphaned junctions. Future schema validation must also permit Checkpoints to
reference Nodes without incident Road segments.

## Responsibility and authority

| Concern | Future authority | Invariant |
| --- | --- | --- |
| Checkpoint identity, name, style, player visibility | Validated versioned Scene Atlas flag | Stable `checkpointId` and `nodeId`; never require a Road or Region; metadata does not become a graph vertex |
| Node position and Road graph connectivity | Existing Scene Atlas `nodes`, named Roads and segments | The Node is the *sole* stored position authority; image-relative coordinates survive padding/zoom; only explicit segment endpoints on its ID connect Roads |
| Checkpoint–Road relationship | Derived from Road segments incident at `checkpoint.nodeId` | Zero or more Roads; no separate writable `roadId` or `roadLinks` list, and no coordinate-based implied connection |
| Checkpoint discovery, Journals, categories, offers, presets | Existing namespaced stores and native Journal permissions | Stable Checkpoint IDs continue to reference the same entity; no write-on-read consolidation |
| Region geometry, Levels, Behaviors and terrain costs | Native Foundry `RegionDocument` and public v14 APIs | Never copy native geometry/Behaviors into authoritative Atlas state or overwrite manual edits |
| Region membership | Read-only spatial projection of referenced Node coordinates against applicable native Region shapes | Many-to-many membership; recompute/invalidate when Node position, Region geometry, Scene Grid or elevation changes |
| Journey checkpoints and recovery | Confirmed TokenDocument positions plus Journey Journal checkpoint ledger | Migration cannot invent travel, remap in-flight targets silently, or replay World time, fares or rests |
| Player projection | Explicit permission-checked, whitelisted read model (future A19-P1 gate) | Canvas hiding does not guarantee confidentiality of raw Scene flags |

## Candidate future Scene schema (not currently valid)

The next Scene Atlas checkpoint schema version is **provisionally v10** (v9 is
the current strict player-visibility version). This example is an interface
proposal for v0.4, **not** a payload accepted or written by beta.7.20.1:

```json
{
  "id": "dirwest",
  "name": "Dirwest",
  "nodeId": "node-dirwest",
  "elevationMeters": null,
  "appearance": null,
  "playerVisible": false
}
```

For this proposed standalone Checkpoint, the Scene also contains:

```json
{ "id": "node-dirwest", "x": 1340.5, "y": 768 }
```

The Node belongs to `atlas.nodes[]`; the Checkpoint belongs to
`atlas.checkpoints[]`. When a GM connects Southern Road, its actual segment
endpoint references `node-dirwest`. More Roads may connect to the same Node
through their own authored segments and `roadId`, without additional
Checkpoint references or a fabricated shortcut.

- **Single authoritative position:** A Node stores finite Scene-image-local
  coordinates. The Checkpoint references it; no duplicate `position`, `x/y`,
  `roadId` or road-link list is persisted in the Checkpoint. Existing
  discovery, offers and Journal links remain keyed by stable Checkpoint ID.
- **Zero or more Roads:** An isolated Node with a Checkpoint and no incident
  Road is valid and visible when permitted, but not traversable through the
  road network. Road crossings at the same pixel do not connect unless the
  actual graph shares the same Node ID. No synthetic Roads or teleport edges.
- **Distinct lifecycles:** Deleting a Road removes its segments, **not** the
  Checkpoint or its referenced Node. Deleting a Checkpoint removes only its
  semantic metadata; a Node referenced by Road segments must remain. Deleting
  an otherwise unused Node requires explicit GM confirmation and must never
  leave a dangling Checkpoint reference.
- **Movement policy to confirm:** Moving a connected Node changes every
  incident Road endpoint and its attached Checkpoint location. Require
  staged GM preview/approval, Undo and revision checks. Alternatively, let
  the GM detach the Checkpoint to a new Node and move it independently,
  keeping the Checkpoint ID and sidecar metadata. Never silently rewire
  another Road or alter native Regions.
- **Legacy co-location:** v4–v9 permits distinct Checkpoint IDs on the same
  Node when associated with different named Roads. v10 must preserve those
  identities and shared Node rather than merging or cloning them without
  permission. A GM can explicitly split/move one later if desired.
- **Journey safety:** If a Road deletion/move affects a saved route, preserve
  the Checkpoint ID, native TokenDocument anchor and Journey ledger; stop for
  GM review when recovery eligibility cannot be proven. Never use a matching
  checkpoint ID alone to bypass distance, progress or route checks.

## Native Region containment and boundaries

1. A GM can eventually draw Atlas boundary points, review a derived shape,
   and explicitly create/update an associated **native Scene Region**. Atlas
   stores only minimal provenance/association metadata; Foundry retains the
   actual native shape, holes, elevation range, Levels and Behaviors.
2. Existing manually edited Regions are never regenerated on read, on
   Checkpoint movement, or on World preset changes. Regeneration requires a
   separate GM preview and applicable native provenance checks.
3. For a Checkpoint, an adapter resolves its Node coordinates and computes
   membership using Foundry v14 public geometry/containment and elevation applicability. A Region may contain
   several Checkpoints and a Checkpoint may belong to several Regions.
   Boundary-edge, holes, overlapping Regions and Levels cases need explicit
   native tests before we choose exact edge-inclusion semantics.
4. Region categories/labels and membership are **descriptive projections**;
   a containment result cannot grant movement, discovery or player access.
   Travel costs still come from native Region Behaviors and explicit route
   calculations, not from an Atlas membership list.
5. Road corridor generation still requires a real authored Road path and
   eligible connected endpoints. A standalone Checkpoint's circular Region
   may instead use its Node coordinate. Do not reinterpret the old
   `generatedRegion` provenance format until a separate migration gate.

## Compatibility and migration plan for v0.4 (not authorized now)

1. **Inventory:** Pure read-only preflight validates existing Scene Atlas
   versions (including v1/v2 coordinate-anchor requirements), checkpoint
   `roadId/nodeId`, graph integrity, legacy namespaced metadata, linked
   Journals, native Region provenance and saved Journey checkpoint references.
   Stop on a missing Node, ambiguous coordinate origin or unrecoverable link;
   never guess a position or assign a substitute Road.
2. **Deterministic projection:** For each valid v4–v9 Checkpoint, copy the
   existing `id`, name, elevation, appearance and visibility unchanged;
   retain its exact existing `nodeId`; remove only the now-redundant mandatory
   checkpoint `roadId` field in the new validated schema. Preserve existing
   Node coordinates, shared Nodes and distinct Checkpoint IDs without merging
   or cloning them. Keep sidecar discovery/offers,
   Journal links and native Region data intact.
3. **Compatibility reader:** Old schemas remain readable in memory without
   writes. Introduce one normalized application read model/selector for
   resolved Checkpoint location and incident Road connections in visual,
   authoring and Navigation consumers. Do not spread legacy `roadId` fallbacks
   through new modules or retain two competing writable connection lists.
4. **GM dry-run:** Present entity counts, old→new ID continuity, prospective
   links, disconnected records, affected Region/Journal references and
   blocking issues. Provide a recoverable pre-migration Scene data snapshot
   and explicit confirmation; no automatic migration on module load/read.
5. **Atomic Atlas write:** After fresh GM permission/revision checks, commit
   the new validated Scene Atlas flag in a single write; do not claim atomic
   modification of sidecar flags, Journals, Regions, World time or Tokens.
   Do not run while an active/ambiguous Journey recovery would depend on
   mutable topology unless a separately tested guard can preserve it.
6. **Rollback:** Allow restoring the validated pre-migration Scene snapshot
   only when no subsequent authored changes would be overwritten. If its
   revision/linked state changed, stop and provide diagnostics instead of
   overwriting newer data. Never remove a native Region or Journal as part
   of checkpoint rollback.

### Consumer cutover checklist

| Consumer | Required v0.4 adaptation |
| --- | --- |
| `atlas-model.js`, `checkpoint-model.js`, `road-storage.js` | Versioned v10 validation, independent Checkpoint+Node creation, explicit connection/disconnection through graph edges, read-only old-schema conversion |
| `road-model.js`, `road-point-editor.js`, `road-canvas.js` | Road move/delete/merge/split must protect Checkpoint Nodes and prompt for coupled movement or deliberate detach; keep staged GM choices |
| `atlas-canvas-hit.js`, overlay labels, discovery/survey, checkpoint transportation | Resolve positions through one shared Node/Checkpoint selector rather than duplicating position logic |
| Navigation route targets, guided transport, Journal/recovery | Distinguish location selection from routable graph attachment; preserve stable checkpoint IDs and confirmed native anchors |
| `generated-region-model.js`, native Region adapters, Scene configuration | Separate point-based Checkpoint Region planning from road corridor planning; read native containment without overwriting Behaviors |
| `player-visibility.js` and future player views | Explicit, whitelisted data projection before publishing new player Checkpoint information |

## Future implementation exit gates

- Pure migration tests: legacy schemas, invalid/missing Nodes, shared Node
  with multiple Checkpoint IDs, orphan Nodes, image padding, stable IDs,
  one/multiple incident Roads and disconnected Checkpoints,
  malformed drafts, revision conflicts, explicit rollback and idempotent reads.
- GM Foundry v14: independent create/move/relink/detach/delete, old Scene
  migration, nested/overlapping Regions with holes, elevation/Levels,
  preservation of edited native Behaviors and deterministic Scene updates.
- GM/non-GM integration: authorized visibility, no hidden metadata leak,
  standalone Checkpoint not falsely routed, checkpoint transport offers and
  discovery unchanged, native fog/weather unaffected, Journey/World-time/
  Journal recovery before and after migration without replay.
- No import cycles/missing targets; `npm run check`,
  `npm run architecture:check`, syntax and `git diff --check` pass. Actual
  Foundry acceptance remains distinct from Node tests.

**Decision gate for beta.7.21:** Native Region/Surface refactors must respect
this separation of Checkpoint identity, Node-owned position, Road-graph
connectivity and native Region ownership. They may prepare narrow read/adapter
boundaries, but must not write v10 data or silently regenerate/retarget any
existing Region. The contract is owner-approved as a design constraint;
v0.4 work and migration
still require separate Product Owner authorization.
