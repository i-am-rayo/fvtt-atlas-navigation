# v0.2.25.2 — Party exploration & checkpoint discovery (implementation gate)

Status: **installable v0.2.25.2 test build; draft PR, not a validated release**. Base: v0.2.25.1. The owner explicitly requested an installable manifest to test the new features. Do not merge pending GM/player v14 acceptance. The full-color Vision 5e override is still unimplemented; the radius currently governs Atlas discovery only.

## Owner-approved behavior

1. **Manual, Scene-local assignment:** only a GM selects an existing placed token by Scene TokenDocument ID. Never auto-assign the first Group or Player Character, and do not modify Actor ownership or prototype data. If the selected token disappears, fail closed and show a recoverable GM warning.
2. **Scene-local map exploration radius:** explicit positive distance in native Scene Grid units (10 when the Grid unit is kilometers). Treat this as cartographic survey distance, not D&D combat sight or an Actor's senses. Never silently mutate D&D5e senses, Vision 5e derived data, or a Group actor.
3. **Foundry-managed geography:** preserve v14 Token Vision, Shared Fog, sight obstruction, and exploration persistence. Do not create a duplicate fog database. Verify a Foundry v14-compatible method to supply the selected token's full-color map sight before wiring the setting; the Vision 5e module prepares `TokenDocument.sight` from actor detection modes and disables the native token range input, so naive `token.update({sight:{range}})` is insufficient.
4. **Two knowledge sources for every checkpoint:**
   - **Visited/seen:** the designated party token actually reveals the checkpoint during play; this state persists. Previously explored fog alone is NOT grounds for retroactive discovery when a checkpoint is added later.
   - **Lore-known:** deliberate GM reveal after the party learns about a location from dialogue, a map, or other narrative source. May display its icon and permitted name in unexplored geography.
   - **Unknown:** player cannot see the checkpoint, hover hit target, name, cluster member, or related road subtitle.
5. **Player visibility is necessary in every case.** `playerVisible:false` remains a hard display exclusion regardless of discovered/lore-known state. Native Journal/Note permissions remain authoritative for journal content.
6. **GM overrides:** explicit GM controls for mark visited, mark lore-known, revoke knowledge. Marking as known must not automatically expose a GM-hidden road; where a checkpoint's road is hidden, omit the road name as in v0.2.25.1.
7. **Migration:** configuration is a separately versioned Scene flag; old Scene Atlas v9 graph and checkpoints are not rewritten. Default is disabled, preserving v0.2.25.1 behavior. Enabling it starts with no inferred historic checkpoint knowledge—Foundry's fog cannot tell which entries existed during the previous visit. GM can explicitly mark existing locations known.
8. **Security:** Scene flags are not a confidentiality boundary. The player renderer filters unknown points and metadata; this does not cryptographically hide raw scene records from sophisticated clients. No socket trust, GM automation based on a player's unverified message, or broad data rearchitecture in this hotfix.
9. **No terrain/elevation calculation:** do not introduce height-based sight, Region changes, movement costs, route finding, or Phase 3.

## Persistence design

Separate flag: `flags.fvtt-atlas-navigation.partyExploration`:
```json
{
  "schemaVersion": 1,
  "enabled": false,
  "tokenId": null,
  "radius": 10,
  "discoveredCheckpointIds": [],
  "loreKnownCheckpointIds": []
}
```

IDs are stable Atlas checkpoint IDs. The collections are mutually exclusive. All writes require GM Scene update permission and a fresh read. Avoid automatic writes during Scene load. Clean up deleted IDs only via confirmed repair or as part of a verified authorized operation; do not silently migrate. The pure schema and display tests are in `scripts/party-exploration-model.js` and `tests/party-exploration-model.test.js`.

## Acceptance test (real Foundry v14, two sessions)

- GM manually selects a Group token. No auto-assignment, no other Scene affected.
- Vision 5e remains enabled; selected token has 10 km (native scene unit) full-color sight and only that radius reveals new map. No actual emitted light or desaturated Darkvision workaround.
- Moving the token updates Shared Fog; player reload preserves explored terrain.
- Initial Port discovered; a newly created **playerVisible** Guild inside already explored territory stays completely absent to the player.
- Returning the selected party token to a position from which the Guild is currently visible records Guild as visited. It remains visible on the explored map after departure and reload.
- GM uses **Lore-known** on a different checkpoint in unexplored territory; players can see the permitted checkpoint marker and its own name without revealing underlying unexplored map or hidden road identity.
- GM revokes lore; marker/hover/cluster info disappears. Mark `playerVisible:false` even on a known checkpoint; it disappears.
- Check checkpoint creation/deletion, stale writes, broken selected token, GM changes to scene, duplicate token labels, Scene switches and disconnected/reconnected player.
- Automated tests are necessary, not sufficient; do not label complete before testing on a running Foundry v14 + Vision 5e installation.

## Known integration blocker

The upstream Vision 5e `scripts/token-document.mjs` subclass recalculates `sight.range` and `visionMode` from detection modes at prepareDerivedData time. It may force the mode to Darkvision. An Atlas config-only override is therefore misleading. Use Foundry v14 public APIs and a two-client compatibility test; avoid invasive prototype patches to third-party modules. The owner authorized a distinct **v0.2.25.2 test manifest** before that integration is proven. Keep the PR draft, warn testers that Atlas's radius does not change Vision 5e's actual sight, and do not merge or claim full feature completion.
