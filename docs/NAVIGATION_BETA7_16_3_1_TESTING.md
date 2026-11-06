# beta.7.16.3.1 — automatic canvas recovery at confirmed checkpoints

**Status:** Product Owner-authorized draft hotfix stacked on beta.7.16.3 (draft PR #176). Automated tests do **not** substitute for actual Foundry v14 GM/non-GM acceptance. Leave draft and do not merge to stable without owner approval.

**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/hotfix/v0.3.8-beta.7.16.3.1-checkpoint-canvas-recovery/module.json

**Branch ZIP:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/hotfix/v0.3.8-beta.7.16.3.1-checkpoint-canvas-recovery.zip

## Live failure and intended decision

The owner's successful Port Barthos → Hearth's Heart Dock Journey showed two native `canvasTearDown`/`canvasReady` cycles. The second automatic recovery correctly restored an already-confirmed dock checkpoint and its `pendingTransfer` decision, but the controller immediately called `startGuidedTravel`, which rejected the unapproved new leg with `Finish the current checkpoint decision before starting another leg.` The Journey eventually completed; no evidence justifies bypassing the transfer guard.

**Approval boundary:** A genuine non-GM-triggered Foundry canvas redraw may **automatically recover** the same previously approved, unfinished leg after the TokenDocument anchor, Journal, World time, Scene revision, active GM and pending-intent safety checks pass. An explicit GM Pause/End is never auto-restarted. When recovery instead reaches a **durably confirmed authored checkpoint**, Atlas restores its checkpoint-choice UI without an additional "approve recovery" step, but does **not** silently select, hire, board, pay for, or move along the next transportation leg. That remains a separate GM transportation decision unless it was explicitly approved earlier. A fully confirmed leg without a pending transfer similarly does not replay.

This change does not alter native movement APIs, checkpoint IDs, Scene/Region/Token/Actor data, Journey schema, Journal credit, transport speed or fares. No migration or write-on-read.

## Owner checklist in Foundry v14

1. Back up the test World, use version `0.3.8-beta.7.16.3.1`, and enable Atlas Debug **Verbose**. Keep a non-GM observer client connected.
2. Start an approved hired-ship leg from Port Barthos. During active sailing, cause a **same-Scene** Foundry canvas redraw without using Pause/End. If the last checkpoint is incomplete but *durably recoverable*, the approved remaining leg should continue automatically, without a new authorization, duplicate fare, extra rest, or World-time replay.
3. Cause a redraw **at/just after** the confirmed Hearth's Heart Dock. Atlas should reopen the Navigation checkpoint decision without the error `Finish the current checkpoint decision before starting another leg`. There must be **no** automatic Riding Horse or other new onward leg, booking, or payment. Select the next method explicitly, then proceed normally.
4. Repeat an involuntary redraw when the last leg is already 100% confirmed but no new transfer is authorized. It should show a safe recovered screen and **not** replay the completed leg.
5. Press **Pause Travel** or **End Journey** deliberately, then refresh the canvas. No automatic token restart. A pending/unconfirmed native operation must remain blocked for GM review with accurate Journal history; a changed Scene, atlas revision, active GM, or token must still refuse unsafe recovery.
6. Finish the route, reopen Navigation, and verify no Saved Journey banner for the completed Journal. Compare the TokenDocument position, Journal percentage, World time, approved transportation and the completed World timestamp. Retest ordinary Walking/Riding Horse, native Regions/Behaviors, Levels, fog/weather, and GM/non-GM permissions.

**Expected:** No error during a confirmed checkpoint auto-recovery; no extra manual approval merely to restore an interrupted approved leg; and no implied approval of an unselected future transport leg. Any mismatched position/clock, pending native intent, or duplicate fare must stop testing and preserve evidence.
