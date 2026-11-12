# Sunday Paedor native Scene transfer — asset/Journal dependency checklist

This is a read-only planning checklist and **does not claim transferable files are embedded**. The complete authored map resides in the Foundry Scene JSON plus separately referenced resource paths, native Regions/Behaviors and Atlas Scene flags. Use the module's **Workspace → Import / Export** preflight before any transfer.

## Source GM
1. Back up the source World independently. Confirm that Atlas native Region transfer recovery (#265) has **no unresolved pending or malformed intent**. Do not force-clear a ledger.
2. Open Workspace → Import / Export; record Atlas revision/schema, Road/Checkpoint counts, native Region and Behavior totals, asset paths and referenced Journal UUIDs. Use read-only GM Journal resolution check.
3. Export Paedor via Foundry's **Scene directory → Export Data**. Native Scene JSON contains Atlas flags/native Region data but **does not embed** background/icon files or Journal Entry/Page documents. Do not export a World database to the spouse's World.
4. Make background, any thumbnail and custom Checkpoint icon assets accessible to the destination Foundry server. Ensure their URI paths resolve; the same path can point to different files across separate installations.
5. Make the necessary shared Journal compendiums available on the destination system with the intended stable Entry/Page UUIDs and permissions. Verify player-visibility rules separately; do not grant access to GM-only JournaIs accidentally.

## Destination GM + separate player
1. Back up the destination World; import a **new Scene** rather than overwriting an existing one.
2. Confirm the map background/image, dimensions/grid, authored Roads/Checkpoints, native Region Shapes/Behaviors and Atlas Territory publications match source; re-export and compare semantics.
3. Check every recorded Journal UUID resolves for the intended GM and every player has ONLY expected native Journal Observer permission.
4. Test Fog, Road visibility, Checkpoint labels, travel route eligibility and an approved short Journey without duplicate Token, Actor, World clock or Journal effects.
5. If there is a missing asset, UUID mismatch, hidden-data leak or unresolved Region recovery, STOP. Preserve backups/logs and document a concrete portability blocker for the next focused fix.

The Sunday private beta is an **authoring handoff**, not public distribution or a promise to bundle private assets.
