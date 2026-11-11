# Sunday private-beta: implementation boundary audit (2026-11-11)

Status: design/audit only. No schema, native Region, Scene, World, or player data is migrated by this document. The Product Owner's live tests are distinguished from automated checks and pending acceptance.

## Transfer decision — native Scene JSON first

- **Owner-observed:** Native Foundry Scene export/import into a new World restored Atlas content. The Paedor destination Workspace reported 44 Roads, 38 Checkpoints, 26 Territory/custom Regions and 4 road-generated Regions. This is a positive cross-World smoke test, **not** yet a cross-install portability guarantee.
- **Owner-provided dependency workflow:** Background imagery and Journals are transferred separately using a shared compendium/asset workflow intended to preserve UUIDs. Do not implement a parallel Atlas Scene importer for Sunday unless an actual incompatibility is demonstrated.
- **Still verify:** Source/destination Scene image path and dimensions, image-local positioning, native grid, Region Shapes and Behaviors, Journal Entry/Page UUID resolution and permissions, player-only projection, saved visibility, Fog, and re-export semantic comparison. Shared-compendium access alone does not prove destination link resolution.
- **Recovery gate:** Check for unresolved native Region recovery intentions (#265) before export/handoff, back up both Worlds, and stop rather than silently clearing an unresolved operation. Native Scene import cannot ensure an external Journal/asset was copied or authorized.
- **Preferred Sunday deliverable:** An owner-tested native Foundry Scene JSON plus a dependency manifest/checklist (asset paths, UUIDs, destination permission checks, restore instructions), with limitations stated. Defer new importer/writer and automatic UUID rewriting until a concrete failure demands them.

## Independent Checkpoint contract — #206 (implementation next)

**Current state:** `scripts/atlas-model.js` schema 9 requires a valid `roadId` and demands that the Checkpoint's `nodeId` belong to its Road. `scripts/checkpoint-model.js` creates Checkpoints only by selecting a Road. Road deletion in `scripts/road-model.js`, Road-scoped rows in `scripts/scene-config.js`, creation in `scripts/checkpoint-appearance-editor.js`, Road canvas labels in `scripts/road-canvas.js`, and player projection in `scripts/player-overlay-model.js` assume this association. Navigation and Region generation also use `roadId`; they must not try to navigate from an unconnected Checkpoint.

**Target domain shape:** A Checkpoint keeps an immutable logical `id`, references a durable image-local `nodeId`, and may be unconnected (`roadId: null`) or incident to zero/many Roads. Road membership is derived from graph incidence instead of duplicating an authoritative list of links. Legacy non-null `roadId` remains a compatibility hint for existing records only; it is not a synthetic Road and cannot be treated as the sole definition of connectivity.

**Migration/authorization:** Add a versioned schema and explicit GM-authorized update path. Existing v9 records must read without write-on-read, retain IDs, Journals, knowledge, transport, appearance and visibility. Validate orphan nodes, deleted Roads, multi-Road junctions, duplicate incidents and revision-conflict writes. No automatic native Region/Fog/Token/Actor/World-time changes. A deliberate attach/detach changes Road incidence/graph relationships but cannot silently delete a Checkpoint or its linked Journal.

**User workflow:** Create a standalone Checkpoint on the Scene canvas; edit metadata; connect existing or newly authored Roads to its Node; detach a Road without deleting the Checkpoint. Distinguish an *unconnected map landmark* from a routable destination and disable route-only actions until a valid graph path exists. Show all Checkpoints in a Scene-wide view, not only under a Road.

**Required regression:** v9 Scene import/read, v9→next-schema GM save, standalone create/edit/delete, attach/detach and Road deletion, junction with multiple Roads, Scene export/reimport, player visibility with hidden Roads, Journal/knowledge/transport preservation, native Region/Fog unchanged, canvas refresh/reconnect, and no journey side effects. Require actual v14 GM/non-GM verification after automated checks.

## Atlas Workspace parity — remaining Scene → Atlas controls

The Workspace currently reuses `createAtlasRoadsPanel`, `createAtlasTerritoryPanel`, and `createAtlasTopologyPanel` from `scripts/scene-config.js`. Its navigation exposes Overview, Roads, Territories, and Topology & Levels; it explicitly defers Checkpoints, Surfaces, Exploration and Navigation. Do not add a second persistence service while relocating views.

| Legacy Scene → Atlas control | Current source / action | Workspace target | Authority and acceptance |
| --- | --- | --- | --- |
| Road editor and graph actions | `createAtlasRoadsPanel`, existing action handlers | Roads (already present) | Retain drafts, revision guards, Locate Road, modeless minimize |
| Native Territory/Region settings and sharing | `createAtlasTerritoryPanel`, native Region adapters | Territories (already present) | Keep native geometry/Behaviors authoritative; sharing distinct from public name |
| Native topology/level setup | `createAtlasTopologyPanel`, native Level adapter | Topology & Levels (already present) | Explicit GM review of native edits |
| Scene-wide Checkpoints, knowledge and reveal radius | `scene-config.js` checkpoint section and `readPartyExploration` | **Checkpoints** | Include unconnected Checkpoints; reuse existing GM handlers; player-safe projection |
| Checkpoint-based Region generation | `scene-config.js` generated-section selectors | Checkpoints / Territories (contextual) | No generated native Region without confirmation; safe unconnected behavior |
| Manual map exploration, brush and Fog | `scene-config.js` fog panel | **Exploration** | Preserve Foundry native Fog, existing party knowledge, explicit writes |
| Native movement surfaces/costs | `scene-config.js` native cost controls | **Surfaces** | Native Regions own Shapes/Behaviors; do not overwrite native movement effects |
| Journey/navigation Scene controls | Remaining Scene Atlas tab and navigation handlers | **Navigation** | Preserve preview/commit separation, GM authority and recovery |
| Native Scene background/grid/dimensions | Foundry Scene configuration | **Stay native** | Do not duplicate Scene source of truth |
| Native Region Shapes/Behaviors/elevation | Foundry Region documents | **Stay native**, with Atlas launch links | Do not clone native form fields or silently rewrite |

Audit implementation guard: Extract existing panel construction/handlers to reusable functions and mount each in Workspace; preserve the legacy Scene entry until owner-tested parity. Verify tab contents, Save/Cancel/Undo and close guards, focus/minimize, scrolling, Scene switching, keyboard access, and separate non-GM denial. Add the Scene transfer dependency checklist prominently in Workspace without promising a custom bundle.

## Sequencing and merge gates

1. Stabilize #206 schema and independent Checkpoint CRUD on a **focused draft PR** before introducing any custom portability format. Preserve existing v9 Scenes and imported data.
2. Move each Scene Atlas control family to the Workspace using its current underlying handlers, with parity tests in a separate focused draft PR. Keep all drafts unmerged until owner acceptance.
3. Run `npm test`, `npm run check`, `npm run architecture:check`, syntax checks and `git diff --check` for every implementation change; document exact result, not implied live proof.
4. Saturday: backed-up source/destination re-export comparison, separate player permission and confidentiality checks, independent Checkpoint smoke test, Workspace parity and essential Journey restart/reconnect.
5. Sunday afternoon JST: Product Owner decides whether to authorize a private test build and confirms manifest/archive URL, backups, rollback and known limitations. Do not turn the roadmap target into permission to merge or release.

Deferred: speculative importer, full World/Actor/catalog migration, broad Territory polish, Road slicing, advanced Region recovery swaps, and nonessential aesthetic redesign.
