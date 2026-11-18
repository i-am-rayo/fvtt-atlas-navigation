# Atlas v0.3.9-beta.8.44 — Contextual Road Naming

## Scope and design
This is a **read-only navigation/presentation** enhancement. Authored Road names stay permanent and remain visible in Road settings and the map. Navigation directions, saved itinerary directions and confirmed Journey Journal directions may use **Road to {final destination}** when the original Point B coincides with one uniquely identifiable, known Checkpoint. The new alias is transient; stored itinerary Road-leg names continue to identify their original authored Roads.

A shared route Dirwest → Millstone → The Eyrie can display **Road to The Eyrie** on both Road segments. Reverse travel toward Dirwest displays **Road to Dirwest**. Destination names must be explicitly party-known (discovered or lore-known with exploration enabled; public checkpoint only in legacy exploration mode). If a destination is unknown, co-located/ambiguous, off-road, or not at a checkpoint, existing directions using Road/terrain names remain unchanged. Existing World calendar title semantics are unchanged.

## Data ownership and compatibility
- No Scene Atlas migration, flag writes, new Road groups, generated segments, extra links or identity changes.
- No native Region/Behavior/Fog, Journey authority, token movement, clock, hire/fare or Actor changes.
- Route naming reads the immutable/current destination only; a resumed Journey prefers the persisted original Point B rather than an intermediate transfer stop.
- Foundry v14 native permission checks and movement coordinator are unchanged.
- This feature is **not** contextual renaming of canvas Road labels, the Road Settings name field, the Map directory, or all player-visible road signs. Those are separate UX/product decisions.
- Knowledge-filtered labels are a presentation safeguard, not a confidentiality boundary on Foundry Scene flags.
- Pure domain projection is implemented in `scripts/navigation-road-naming.js`; instructions/itinerary remain pure; the controller is the Foundry adapter reading party state.

## Automated coverage
`tests/navigation-road-naming.test.mjs` covers both directions, same-road continuation across Millstone, retained Road names/IDs, party-known/lore destinations, explicit public legacy fallback, unknown and ambiguous checkpoints, remote destinations and off-road route, and default instruction backward compatibility.

Required before acceptance:
1. `npm run check`
2. `npm run architecture:check`
3. `node --check` for changed JavaScript
4. `git diff --check`

**Verification:** Remote GitHub source edits committed; automated test results and owner live Foundry v14 testing not yet confirmed.

## Foundry v14 GM acceptance checklist
1. Back up a dedicated test World; install this branch's module manifest and reload Foundry. Verify version `0.3.9-beta.8.44`.
2. On an Atlas Scene with separate named Roads Dirwest–Millstone and Millstone–The Eyrie, make **The Eyrie** a known public or lore-revealed Checkpoint. Plan Dirwest → The Eyrie: both approach instructions use **Road to The Eyrie**, even across the intermediate Millstone.
3. Reverse The Eyrie → Dirwest: directional display changes to **Road to Dirwest**. Confirm the two Roads retain their exact original names and Road IDs in Settings, overlays, and Map directory.
4. Mark The Eyrie unknown in the active party exploration (or nonpublic with exploration disabled). Replan. Confirm its hidden name **never appears in directions**. Turn on discovery/lore and replan to restore the contextual label.
5. Add a second Checkpoint at the exact destination coordinate. Confirm the ambiguous endpoint does not select or reveal either name. Test a destination in the middle of a Road and an off-road destination: authored naming/terrain fallback applies.
6. With a test party Journey only, validate starting a route, arrival at Millstone, continuing toward original Point B, saving a Journey Journal, canvas refresh/resume and eventual final arrival. Inspect recorded itinerary and confirmed positions: no extra token movement, time advance, fare/rest or duplicate Journal events.
7. With a non-GM client: confirm no new GM controls, no secret Checkpoint names on player-visible surfaces, and player Road/Fog/Region visibility unchanged. This does not itself add the contextual label to the player canvas.

## Rollback
Reinstall the previously accepted `v0.3.9-beta.8.43` candidate after backing up the test World. No data migration or undo is required; stored Road names and identities have never changed.

## Open considerations
- GM-configured permanent names (King's Road) are retained and not overwritten. Whether to prioritize these over destination aliases in Journey directions is a later UX decision.
- Territory name fallback, per-junction local direction signs, localization, contextual Road hover labels and player road-sign projection are deferred.
