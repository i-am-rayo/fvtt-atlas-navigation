# beta.7.16.3 — Pause, canvas lifecycle and terminal Journey state

**Status:** Owner-authorized **draft** hotfix, stacked on beta.7.16.2.4 (draft PR #175). Automated success is not live Foundry v14 acceptance. Do not merge or publish a stable release without owner approval.

**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/hotfix/v0.3.8-beta.7.16.3-journey-pause-lifecycle/module.json

**Branch ZIP:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/hotfix/v0.3.8-beta.7.16.3-journey-pause-lifecycle.zip

## Evidence and scope

The owner's return voyage from Hearth's Heart Dock to Port Barthos was marked **Interrupted — may resume** even though the displayed final leg was 100% and an **Arrived** World time was present. The exported log showed repeated `Pause requested`, `Journey resumed`, `canvasTearDown`, `Navigation teardown` and `End journey requested` events. Atlas was closing its ApplicationV2 window as a safe response to an actual Foundry canvas rebuild. The log does **not** establish what initiated the Foundry redraw; third-party canvas/weather interactions remain possible.

This hotfix prevents a late teardown or async checkpoint from downgrading a terminal `completed`/`ended` Journal, retains a confirmed pause status when stopping its native session, reopens the GM Navigation window after a **same-Scene** canvas redraw, and restores the preview of a safely confirmed paused Journey **without moving the token**. Unconfirmed pending native checkpoint intents are never automatically recovered or credited. Continuous vessel checkpoints are shortened from **5 to 2 nominal real-time seconds**; this can increase Journal flag writes, and an individual checkpoint may still wait for Foundry/Journal asynchronous confirmation.

No Scene, Region, Road, Token, Actor, travel catalog or Journey schema migrations. No native canvas patches, forced token movement, World-time rewinds, duplicate fare/rest credits or speculative recovery. The appearance and rest/downtime distinction in the Journey Journal are deferred to the **Journal UI refinement** milestone as requested.

## Owner Foundry v14 acceptance

1. **Back up the World.** Install the test build, verify `0.3.8-beta.7.16.3`, and enable Atlas Debug **Verbose**. Keep a separate non-GM client connected. Do not replay the already-blocked native operation `fqJRF5V4MwFhreSE` or manually clear its evidence to make it pass; use a new disposable Journey after review/explicit Forget.
2. Make a fresh Round Trip with Riding Horse → Port Barthos → hired ship → Hearth's Heart Dock, then return. On completing the destination, close and reopen Navigation twice. **No saved Journey recovery banner** should appear for that completed Journal; the summary should remain **Completed** with its arrival time.
3. During continuous ship movement press **Pause Travel** between authored road nodes. Expect **Pausing…**, then **Resume Travel** at the next native durability boundary (normally ~2 seconds plus asynchronous confirmation). The token, Journal, moving time and World time must agree; pressing Resume should continue the same approved ship without a second fare.
4. While fully paused, force a **same-Scene** Foundry canvas rebuild. Navigation should reopen automatically. If the last checkpoint was durably confirmed and its TokenDocument position matches its saved anchor, the route preview should return without any automatic token movement. Explicitly click **Travel Route** to continue; no duplicate progress or World time.
5. While the token is **in-flight**, force a canvas rebuild. Navigation may reopen showing **Saved Journey requires GM checkpoint review**. This is intentional if the last native intent has not been durably confirmed. Confirm no speculative movement, clock advance, payment, or automatic replay. **Do not press Forget** until the GM has reviewed the token/World time/Journal discrepancy.
6. Switch to a *different* Scene while moving or paused: the old Navigation window must **not** reopen onto the wrong Scene or silently continue. Verify the authored road/checkpoint IDs, Regions/Behaviors, fog and weather remain unchanged.
7. Test an ordinary Walking/Riding Horse trip, optional passenger **Long Rest Aboard**, GM/not-GM permissions, repeated Pause/Resume, close-window interruption and explicit End. A long rest aboard continues to overlap moving ship time; its Journal display improvement is deferred.

## Remaining limitations / stop conditions

- This does not identify or suppress the underlying Foundry canvas redraw trigger. Report the source and a Verbose console log if it repeats. Window restoration addresses the UI disruption, not an unsafe in-flight native intent.
- Two-second checkpoints are a practical latency bound, **not true mid-animation pausing**. Calling undocumented animation internals to freeze a token between persisted checkpoints would risk losing authoritative distance/time.
- Prior Journals already saved as **Interrupted** with a stale pending operation are *not* retroactively rewritten. They remain available for explicit GM review or Forget Saved Journey.
- Actual GM and player Foundry v14 acceptance is pending. If any old route is replayed, status regresses, or clock duplicates, stop further stabilization and report the log/Journal.
