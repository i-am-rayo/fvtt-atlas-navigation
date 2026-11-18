# v0.3.9-beta.8.40 — Sunday private-beta Atlas Scene Workspace consolidation

**Status:** Foundry v14 test build only; live GM/non-GM acceptance PENDING. This is NOT a public stable release. Source branches remain draft/unmerged: [#332](https://github.com/i-am-rayo/fvtt-atlas-navigation/pull/332) Exploration/Surfaces, [#333](https://github.com/i-am-rayo/fvtt-atlas-navigation/pull/333) Navigation/portability, [#334](https://github.com/i-am-rayo/fvtt-atlas-navigation/pull/334) native Region association parity.

**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.40-workspace-consolidation/module.json

**Archive:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.9-beta.8.40-workspace-consolidation.zip

## Included control migrations (no new persistence owners)

| Workspace view | Authoritative handler / ownership | What to verify |
| --- | --- | --- |
| Overview | Read-only Atlas graph, native Region counts | Existing Scene data never changes merely on view |
| Roads | Existing Road canvas/editor and Atlas Scene graph | [+], point editing, Save/Cancel/Undo, locate, visibility, travel preset, Region shortcuts |
| Checkpoints | Existing v10 Node model and Checkpoint editor | Independent [+], move, attach to any eligible saved Road junction, full settings, knowledge, reveal radius, Journal |
| Territories | Existing Atlas Territory management + native Region Documents | Shapes, Behaviors, hierarchy, generation, public names and player sharing remain independent |
| Surfaces **new** | Reused Scene native Region generator, generated corridor colors/costs, native Region link/unlink/configure | Choose Road, checkpoint/corridor Preview & Confirm, travel preset, regenerated cost; native Region association actions |
| Exploration **new** | Reused manual Fog toggle, Paint map brush, native Scene read-only counters | No changes to Foundry native FogExploration; GM brush writes only when explicitly used |
| Navigation **new** | Existing AtlasNavigationController and World Transportation Settings | Read-only Scene graph/grid summary; existing Journey UI launcher; no approval, Token move, Journal/World-time writes on opening |
| Topology & Levels | Existing native Level setup preview/review | Foundry Scene native Levels are authoritative, never map-Territory hierarchy |
| Import / Export **new** | Foundry native Scene JSON export/import; read-only dependency preflight | Image/icon/thumbnail paths, referenced Journal UUIDs, native Region/Behavior counts, recovery ledger warning and GM link resolution |

The old Scene Configuration → Atlas controls remain accessible as a **temporary comparison/fallback** during this release candidate's acceptance. Do not remove them or force migrations until GM and non-GM tests establish handler parity. World transportation catalogs/rules remain World-owned, and native Scene background/grid/dimensions remain Foundry-owned.

## GM v14 priority test (back up source World first)

1. Install version `0.3.9-beta.8.40`. Open Paedor on canvas and click the GM Atlas Scene Workspace sidebar icon. Verify all nine views are accessible, scrollable, with native minimize/maximize retaining selected tab and pending editor drafts.
2. Open **Exploration**; verify current manual Fog state and revealed/hidden counts equal Scene Configuration → Atlas. Open Paint map; preview and Cancel without saved change, then perform an intentional brush edit and verify persistence/reload. Confirm native FVTT Fog remains untouched.
3. Open **Surfaces**; select a Road with Checkpoints and inspect the same native generator as the legacy tab. Change corridor width and travel preset but Cancel preview. Confirm no Region write. With backup, approve one native corridor Region and ensure Region ID, Shapes, Behaviors/costs and linked Road stay correct. Test native Region Link/Configure/Unlink actions from Surfaces, and verify the legacy interface still reaches the same native Region records.
4. Open **Navigation**. Verify native Scene Grid measurements, authored Roads and party Token configuration read correctly. Open the existing Navigation panel; opening and closing must NOT move a Token, charge funds, rest an Actor, advance World time or write a Journey. Check World Travel & Transportation Settings opens the same existing catalog/rules editor (not a new Scene-scoped copy). Test a GM-approved short Journey separately, including refresh/resume and Journal.
5. Open **Checkpoints**. Re-test the owner-confirmed beta.8.39.3 multi-Road junction merge and full Checkpoint settings; verify stable Checkpoint ID, exact junction Node, no duplicate Roads/Nodes and no saved-data drift. Verify independent Checkpoint Journal/discovery permissions.
6. Open **Territories** and **Topology & Levels**. Verify Region ownership, elevation hierarchy, atlas layers, native Shape/Behavior permissions, overlap protections and native Region recovery unchanged. No write on preview.
7. Open **Import / Export**. Verify revision, Road/Checkpoint/Region/Behavior totals, background/thumbnail/icon paths and Journal UUIDs. Use read-only Check Journal UUID resolution, then confirm a separate non-GM client can open only intentionally shared Journal content. If the native recovery ledger is pending or invalid, the preflight must show STOP without clearing it.
8. Verify Scene Configuration → Atlas legacy controls still function for parity comparison; no duplicate auto-save, unexpected focus changes or parallel settings storage. The only new action is Workspace presentation/launch; native behavior is unchanged.

## Saturday cross-World private-beta dependency test

- Back up both source and destination Worlds, verify no unresolved #265 native Region recovery intent, then export the authored Scene using **Foundry's native Scene JSON**.
- Transfer map background, thumbnail and custom checkpoint/icon assets via your own approved filesystem/asset workflow; native Scene JSON does not embed those resources.
- Transfer Journal Entry/Page references through the shared compendium workflow preserving intended UUIDs; resolve the exact UUIDs as GM on destination and check appropriate OBSERVER permissions using a separate player login. Never copy private Journal contents into the player projection.
- Import as **new Scene** into a backed-up destination World. Verify native grid and dimensions, Atlas image-relative Node locations, all Road IDs, Checkpoints, native Region Shapes/Behaviors, fog, published layers and graph routing. Re-export destination Scene JSON and compare semantic counts/IDs, not incidental document ordering.
- Check no approved Journey / Actor / Token / World-time progress was duplicated by reloading or importing. If any Region transfer recovery is pending, STOP and preserve source ledger and backup.

## Release gates

- Automated: source GitHub CI on `cf45eec90c0bf59dcf5056a83e784913f6effcad` **1024/1024 tests PASS**, architecture PASS. Package build runs CI separately. No Foundry v14 live acceptance claimed by CI.
- Manual GM + separate non-GM: all nine Workspace tabs, hidden metadata confidentiality, map/Journal dependency accessibility, native Region/Fog/Journey regression.
- Safety: backup and restore evidence, broken dependency diagnostics, import as new Scene, no bypass of #265 recovery and no write-on-read.
- Governance: Product Owner explicitly approves Sunday private-beta install/feedback. Keep PRs draft until approved; no merge, force push, public release or automatic migration.

**Known limits:** This build does not implement a custom self-contained Scene importer/exporter or automatic asset/Journal copying/remapping. Existing native Foundry transfer is intentionally preferred based on positive owner cross-World smoke test. Full shared-junction reconciliation and arbitrary editing of already Road-connected Checkpoints remain out-of-scope.
