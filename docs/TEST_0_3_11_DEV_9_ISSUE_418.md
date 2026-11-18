# Atlas 0.3.11-dev.9 — Contextual Map Directory tools (#418)

**Milestone 01** · [Issue #418](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/418) · Foundry v14 GM/non-GM acceptance required.

**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/fix/0.3.11-m01-418-map-directory-native-tools/module.json

**Archive:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/fix/0.3.11-m01-418-map-directory-native-tools.zip

**Base:** owner-accepted `0.3.11-dev.8` / PR #435 (cumulative dev.1–dev.7). Source drafts #428–#435 remain preserved. Integration PR #436 was closed **unmerged**, because the release-manifest test prohibits an unreleased development manifest pointing at `main`; release integration requires an authorized mainline version/manifest plan.

## Scope and capability/recovery matrix

Remove the **Advanced map operations** disclosure from Workshop Settings; the three **existing** managers are now immediately accessible under **Map directory → Tools**, alongside existing View switches. No new disclosure, recovery engine, writer or competing panel.

| Former Settings disclosure link | New entry | Same existing panel | Unique capability retained |
| --- | --- | --- | --- |
| Territory batch & native Region tools | Map directory → **Territory tools** | `createAtlasTerritoryPanel` | Native Territory creation, Locate/Settings, border analysis, Hex/Grid batch staging, guarded Review & Apply, **Resume / Roll Back Transfer** for interrupted native ledger, native Region associations and visibility |
| Road topology & legacy tools | Map directory → **Road tools** | `createAtlasRoadsPanel` | Legacy anchor/organize when applicable, Road graph/point editing, generated corridor/native movement costs, explicit edits and confirmations |
| Map Marker discovery & connections | Map directory → **Map Marker tools** | `createAtlasCheckpointPanel` | Placement, Road endpoint connection, native discovery/visibility and search/sort, reveal radius and guarded removal |

Only the **navigation** moved: the same GM permission check guards the Workspace, and the same Scene-authorized action handlers remain the only mutation paths. No native Regions/Behaviors, recovery ledger, World presets, Scene Atlas IDs, Road topology, Journal, Actor, Token or Journey data changes.

This is intentionally not #413 (new persistent border field), #289 (live contextual-title refresh for all editors), or #216 (broad UI consistency). Those need their own acceptance.

## Owner Foundry v14 acceptance on backed-up disposable World

1. GM opens **Atlas Workshop → Settings**: Advanced map operations is gone; Exploration, Presets, Surfaces, Topology & Levels and Import/Export remain available. Merely viewing Settings/Directory produces no native or Atlas writes.
2. Open **Map directory**: existing View options remain, plus clearly separated **Tools: Territory tools / Road tools / Map Marker tools**. Keyboard, tab focus, narrow window and 200% zoom preserve readable controls and selected state. No duplicate disclosure anywhere.
3. Click **Territory tools**. Verify native Region creation, linked/unlinked rows, Locate and Settings, border analysis, public/Sharing and contextual native Region controls. Test a copied World with two eligible Hex/Grid Territories: Start Batch Edit, Stage, Review & Apply all invoke the original guarded workflow. Cancel before commit and verify no writes.
4. With a deliberately pre-existing **valid, interrupted native transfer ledger** in the disposable World, open Territory tools and confirm the **Resume / Roll Back Transfer** control remains visible and enters the existing explicit GM recovery dialog. Do not manufacture an invalid ledger or edit native Shapes to make the button appear. Confirm Resume or Roll Back only through established #265 recovery acceptance.
5. In **Road tools**, verify legacy Anchor/Organize appears only for applicable old Atlas graphs, Road creation/point editing and per-Road Regions remain reachable. Confirm no automatic legacy migration or native cost update.
6. In **Map Marker tools**, verify discovery and connection actions, location, sorting and search remain functional; these are contextual, not duplicated World settings. No automatic reveal or checkpoint graph write from changing views.
7. Non-GM user must not open the GM Workspace or directly invoke these actions. Test Scene switch, reload, close/reopen, active Journey and interrupted native recovery state: navigation must not bypass existing safeguards.
8. Check Atlas console for errors in native panel re-entry. If any capability is lost, **halt further UI cleanup** and preserve the original tool until restored.

## Automated

`tests/atlas-scene-workspace.test.mjs` exercises actual old-disclosure absence, directory tool entries and click-to-panel routing, basic native Batch Edit availability/delegation, unchanged Road and Map Marker panel access, and no Scene writes from navigation. Existing interrupted transfer and native recovery test suites remain required. Run `npm run check`, `npm run architecture:check`, syntax and `git diff --check`. Passing CI is not live GM/non-GM recovery acceptance.
