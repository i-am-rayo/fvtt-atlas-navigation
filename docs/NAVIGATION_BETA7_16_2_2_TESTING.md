# beta.7.16.2.2 — Native diagnostic export and blocked Journey recovery

**Status:** Owner-authorized, automated-test build. The Foundry v14 live movement mismatch is **not yet resolved**. Keep this PR draft and stacked on beta.7.16.2.1 PR #172 until the owner accepts the real-World result.

## Install safely

1. Back up the test World. Leave existing interrupted Journey Journals unchanged: the native TokenDocument could be ahead of the last *confirmed* Journal checkpoint.
2. Use the branch manifest `https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/hotfix/v0.3.8-beta.7.16.2.2-native-diagnostics-recovery/module.json` and verify `0.3.8-beta.7.16.2.2` in Foundry.
3. In the GM client enable **Atlas Debug — Console Logging Level → Verbose**. Keep a non-GM client connected for permission and visibility checks.

## GM acceptance checklist

- [ ] Reopen the interrupted land → Port Barthos → hired ship → Hearth's Heart Dock Journey. If a `pendingNativeMove` remains, the UI must show **Ship passage (hired)** from the saved approved Journal, not offer Walking as the method to replay it. The method selector, New Route, Travel, and Recover must be disabled in the unresolved view. The **Open Journey Journal** button must work. The saved record and token must not change merely by opening the window.
- [ ] Start a **new disposable** Journey with Riding Horse, arrive at Port Barthos, approve Ship passage (hired), and observe the first ship checkpoint. On mismatch, copy the *entire text* of `[fvtt-atlas-navigation][movement] Native checkpoint reconciliation blocked` (JSON string), which is now exportable without expanding `Object`.
- [ ] Confirm the JSON includes `failureReason`, `failedChecks`, `nativeOperationId`, `nativeMovementId`, `nativeSubpathId`, `nativeCheckpointIndex`, `atlasCheckpointId`, `roadId`, `segmentId`, `nearestRoadId`, `nearestSegmentId`, `expectedFrom`, `expectedTo`, `nativeOrigin`, `nativeDestination`, `tokenDocument`, coordinate pixel differences, passed and pending waypoint bounds, and match booleans. `atlasCheckpointId: null` is valid on intermediate checkpoints that aren't authored docks.
- [ ] Confirm **no Journal sea-distance/time/fare credit** for a rejected native checkpoint. World time and Journey events must not duplicate after canvas refresh, reopening or reconnect. Do not manually move the token to force an apparent match.
- [ ] Check normal Walking, Riding Horse, checkpoint decisions, saved A→B→C→D targets, and a journey without pending native movement still expose their ordinary controls and recover as before.
- [ ] With a non-GM client, confirm the warning does not appear in its Atlas UI and GM-only approval/movement controls remain unavailable. Smoke-test fog, Regions, native weather/effects, and canvas redraw.

## Next decision

Return the full console JSON for the failed sea checkpoint and the Journey Journal summary. The team can then compare Foundry's actual `moveToken` event identity and checkpoint coordinates with the approved native plan and design a *separate* precision fix with dedicated acceptance. Do not relax the native guard based on an unverified guess; this beta build is for diagnostics and safe presentation, not automatic reconciliation.
