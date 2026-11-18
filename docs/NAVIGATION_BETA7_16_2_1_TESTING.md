# beta.7.16.2.1 — Native checkpoint reconciliation / GM diagnostics

**Status:** Product-Owner-approved recovery hotfix, automated tests required and live Foundry v14 GM/non-GM acceptance pending. Stack this draft on beta.7.16.2 PR #171; do not merge or promote to a final release until the owner validates the real World.

## Install / safety

1. Back up the test World and do not modify or replay the previously interrupted `0997-12-16 07:37:38` Journey Journal: the TokenDocument may have moved without a confirmed ship checkpoint.
2. Install using `https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/hotfix/v0.3.8-beta.7.16.2.1-native-checkpoint-reconciliation/module.json` and confirm module version `0.3.8-beta.7.16.2.1`.
3. In the GM client, set **Atlas Debug — Console Logging Level** to **Verbose**. Keep a separate non-GM client open to test that checkpoint diagnostics are not player-facing.
4. Start a **new disposable** land → Port Barthos → hired continuous ship → Hearth's Heart Dock → land test; don't repurpose a prior unresolved Journal.

## Owner acceptance

- [ ] Reach Port Barthos by Riding Horse. On the first ship movement, the token should continue instead of stopping at zero confirmed sea progress. Its native start may be near (but off) the actual road node within the accepted same-hex origin distance; no teleport, shortcut, or snap to grid.
- [ ] Inspect the Verbose console entries `Native checkpoint intent saved`, `Native checkpoint observed`, `Native checkpoint durably confirmed`. Each should identify the **native operation/movement ID** (when the native move has started), **native checkpoint key/index**, **nearest Atlas road ID and segment ID**, **final authored Atlas checkpoint ID**, and **planned vs actual top-left TokenDocument coordinates**. Intermediate native durability checkpoints legitimately have no authored Atlas checkpoint ID.
- [ ] On any mismatch, the `Native checkpoint reconciliation blocked` warning should include expected start/end, Foundry movement origin/destination, committed TokenDocument x/y, their pixel differences, passed-path length, and whether the native operation was constrained. Capture the expanded object, not only the console's collapsed `Object` label.
- [ ] Finish at Hearth's Heart Dock with the approved hired ship; verify the final Journal and World time credit only validated movement, with no duplicated booking or charge and preserved A→B→C→D destination.
- [ ] Repeat after Pause/Resume and with a canvas refresh during a voyage. A pending checkpoint may require GM review; automatic recovery must **not** credit a movement with incomplete Journal/clock proof.
- [ ] Test altered native Region constraints / a road or checkpoint changed during movement in a disposable World: Atlas must stop without accepting a redirected or unrelated coordinate.
- [ ] Repeat a normal (noncontinuous) ship, walking, and Riding Horse route. Check fog, weather, Regions, Levels and player permissions in v14; no new GM controls or hidden IDs should appear in the non-GM client.

## Boundaries

This fix changes the native continuous-vessel adapter and read-only diagnostic attribution only. It does not migrate or repair interrupted Journeys, change native Region Behaviors, edit authored roads, change fares/rest rules, adjust the World calendar, or bypass the exact destination guard. Real Foundry v14 movement event shapes and native pause timing still require live verification; unit tests alone cannot prove the hotfix is successful.
