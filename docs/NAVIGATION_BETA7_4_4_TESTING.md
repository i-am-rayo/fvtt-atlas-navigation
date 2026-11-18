# Atlas v0.3.8-beta.7.4.4 — Shipboard rest controls acceptance

Target: Foundry VTT v14, GM and non-GM clients, continuous hired ship passage.

## Automated checks

- [ ] `npm run check` passes syntax checks and the entire Node test suite.
- [ ] Continuous voyage tests cover pending → 8-hour completion → unlocked controls, a subsequent Short Rest, insufficient remaining voyage time, and canvas-interrupted rest recovery.
- [ ] `module.json` and `package.json` are 0.3.8-beta.7.4.4; the branch manifest and ZIP archive resolve.
- [ ] No Scene, token, Group, Actor, currency, native Fog or Journal-schema migration is introduced.

## GM acceptance — repeat rests aboard a moving ship

1. Start a continuously operated hired ship leg with **more than 16 hours remaining**; open Navigation and verify Short Rest Aboard (1h) and Long Rest Aboard (8h) are available.
2. Begin **Long Rest Aboard**. Verify both rest buttons disable while the rest is pending, and the vessel and Foundry World time continue advancing with confirmed native movement.
3. After eight confirmed sailing hours, keep Navigation open **without manually reopening or refreshing it**. Both buttons should become available again as soon as the rest is recorded, provided the voyage has enough remaining hours for each action.
4. Start a **Short Rest Aboard**. Verify both buttons lock until its one hour completes, then unlock again when eligible. No duplicate World-time/downtime entry should appear.
5. With fewer than eight sailing hours remaining, verify Long Rest Aboard is disabled. With fewer than one hour remaining, verify both are disabled.
6. Inspect the Journey Journal: each completed shipboard rest appears exactly once. The moving time and World-clock advancement remain continuous; confirmed downtime remains 0h.

## Recovery and compatibility

- [ ] Start a long rest, interrupt the Canvas during the eight-hour window, recover the same Journey, and verify new rests remain disabled while the prior rest is pending.
- [ ] Finish the recovered rest: the button lock must clear only after the completed event is saved, and past native travel/World time must not replay.
- [ ] Finish the voyage, transfer to an owned Riding Horse, and complete the original destination using the same Journal.
- [ ] GM/non-GM UI permissions, Scene/weather/fog rendering, and normal day-limited camping choices remain unchanged.
- [ ] D&D5e Actors and Rest Recovery 5e are not invoked by the Atlas rest buttons yet; that integration remains a separate approved milestone.

## Scope boundary

This hotfix fixes Atlas rest-request **availability and footer state**, not rules for how often a character may benefit from a D&D long rest. Character resource recovery, rest automation, and new GM/player layouts are deferred. A single clean journey without a Canvas rebuild does not close the independently tracked Canvas refresh issue #135.
