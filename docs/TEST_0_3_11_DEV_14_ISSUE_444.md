# Atlas 0.3.11-dev.14 — Safe sequential saves in independent settings windows

**Milestone 01** · [Issue #444](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/444). This addresses the Product Owner's requirement that the dev.13 multiple Map Marker window fix be consistent across **all independently editable Atlas settings**. Requires **actual Foundry v14 GM/non-GM acceptance**. This is a cumulative development build, not a public release.

**Foundry installation manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/fix/0.3.11-m01-444-settings-save-consistency/module.json

**Branch archive:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/fix/0.3.11-m01-444-settings-save-consistency.zip

**Cumulative parent:** dev.13 / draft PR #443 (Map Marker rebase + Road hover); dev.12 and earlier approved features included. PR #443 has automated CI success but the Owner has **not yet live-tested** its fix. No drafts are merged to main.

## Editor-by-editor concurrency contract

| Menu / action | Record authority and expected behavior |
|---|---|
| **Saved Map Marker Settings** | Existing dev.13 target marker + sidecar snapshots; A then B in the same Scene succeed if B unchanged. Same marker and stale new creation fail closed. |
| **Road Settings** | Existing latest-scene rebase on unchanged Road presentation; A then B succeed, same Road edit is refused. Topology/graph point editing retains strict revision checks. |
| **Territory Settings / native Region geography** | Territory Settings is an action hub, not a bulk Save: independent per-native-Region writers validate name, hidden and Region geography. Geometry, behavior and transfer remain native/guarded, never auto-merged. |
| **World Map Marker presets** | Unique saved-preset window IDs; A then B merges the latest validated catalog, but same-preset changes/deletion are refused. New-ID collision fails. |
| **World Surface presets** | A then B edits or deletions preserve other preset IDs; same-preset stale changes/deletes fail. Modal creation is validated independently. |
| **World Transportation methods** | Each method ID under its active rules profile is validated against the snapshot on Save/Reset/Delete; unrelated method edits no longer invalidate a World profile edit. Walking speed and rules profile changes are checked. Journey/Map Marker context callbacks retain stricter original snapshots. |
| **D&D5e Group transportation** | Window ID scoped to Group Actor, save only changed Group assignments onto latest validated World catalog. Other Groups stay intact. Same Group changes, native membership changes, or current method changes block stale Save. Does not modify Actor data. |
| **World Road appearance** | Land / Air / Water are independent profiles: merge only altered modes. Same-mode external changes block Save. No writes when there were no changes. |
| **World travel rules and Journey playback** | Each is a whole-world singleton setting form, not separate entity records. A stale whole-form Save is rejected rather than potentially overwriting a colleague's changes. Separate forms write separate keys. |
| **World announcement previews and other read-only menus** | No Save path; no concurrency change required. |
| **Atlas canvas authoring, native Region Shape/Behavior, migration, Fog/Journey recovery** | Strict original GM-authorized revision/ledger guards retained. No generic rebase or automatic merge across graph/geometry/history. |

**Important:** These changes support **sequential** saves using the current Foundry client, after checking the latest authoritative data. Foundry Scene and World setting writes are not transactionally atomic compare-and-swap across simultaneous GM clients; do not promise multi-GM race-free editing.

## GM Foundry v14 acceptance (backed-up test World)

1. **Two saved Map Marker windows**, Eyrie/Dirwest: save distinct names/appearance/categories/transport one after another without reopening; recheck dev.13 Road banner Off/On. Same-marker conflict must block and preserve draft. Check retained Journal and discovery details.
2. **Two Road Settings windows** for different Roads: edit independent appearance/preset/name, save A then B; both persisted. Same Road stale edit must reject without replacing A. Point editor/graph edits retain original strict revision checks.
3. **Two Territory Settings windows**, separate native Regions: change geographic classification/public label/boundary sharing through the existing native confirmed workflows. Changes to Region A should not require closing B; same Region or related topology conflict must stop safely. Native Shape/Behavior and Region IDs unchanged.
4. **Two World Map Marker preset windows**: preset A and preset B, edit different values; Save A then B. Both remain. Two windows of the same preset must refuse stale overwrite with draft retained; create a new preset with no ID collision.
5. **World Surface presets**: edit two different surfaces/presets in succession and confirm both survive; editing or deleting the same stale preset must fail. Native Region travel assignments unaffected.
6. **World Transportation methods**: edit two different methods in succession, then test stale same-method edit/reset/delete. Check rules-profile switching while editor is open refuses unsafe Save. Confirm Journey-specific editor behavior remains strict.
7. **Different D&D5e Group Actors**: open Party Transportation from two Groups; Save A then B. Both Group assignments persist, actor IDs and membership remain native. Same Group stale edit and externally modified membership must refuse the Save.
8. **World Road appearance defaults**: two windows/editors — change Land in A, Water in B, save sequentially; both persist. Change Land in A and Land again elsewhere; stale A must fail, preserving updated values. Check inherited Road line colors.
9. **Travel Rules and Journey Options**: two settings windows changing the *same* singleton should reject stale save; changing independent singleton forms retains separate state. No automatic World time or Journeys start during settings save.
10. **Permissions/recovery**: non-GM cannot open GM-only editors or see hidden Atlas data; no writes on opening, tabs, previews, Cancel, rejected conflict or stale new creation. Confirm native Regions/Behaviors, fog, stable graph IDs, Journeys, TokenDocument position, Journal and World time unaffected by these UI settings.

## Automated gates

Focused DOM and model regressions for Group A/B and same-Group refusal, Map Marker preset A/B and same-preset conflict, Road appearance Land/Water independent mode save and same-mode conflict. Existing marker/road revision, native Region/transfer/World preset, player-safe and Journey suites must remain green. Run `npm run check`, `npm run architecture:check`, syntax, `git diff --check`. Automated green **does not equal Foundry live acceptance**.

**Stop if** a stale same-target Save succeeds, an independent Save overwrites another target, an editor silently migrates a schema, an unauthorized non-GM can write, or a native recovery/Journal/World time/Token side effect occurs.
