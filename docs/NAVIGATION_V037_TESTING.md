# v0.3.7-beta.1.1 — GM guided token travel test gate

This is the first, deliberately narrow v0.3.7 movement slice, stacked on the owner-accepted v0.3.6-beta.1.1. **Live Foundry v14 acceptance is mandatory before merging.** Test in a backed-up world with a GM and separately connected player.

## GM journey

1. Assign a placed party explorer in the token's Atlas settings. In Navigation, choose **Start from → Party token location**; Atlas uses the token's actual Scene center for Point A. Click the map once for Point B. Verify a route calculates without manually clicking the token's center. Also switch to **Map Point A** and confirm manual A/B, Shift+A and Alt/Option+B still work.
2. The panel's bottom action bar must keep **New Route**, **Travel Route** and **Exit Navigation** visible even when the Directions list is scrolled to the end. Click **Travel Route**. The assigned token should move along the orange road, including its smoothed bends; it must not jump straight from A to B. Confirm the normal road direction and final position.
3. Start a longer journey, click **Stop Travel** partway. The token should remain where Foundry stopped it. If the stop completes, the panel should report interrupted travel; no teleport to destination.
4. In manual mode, test Point A far away from the explorer. In party mode, move the token before starting travel: Atlas should recalculate from its current location, not an old A. Test **Refresh location**, **New Route** (keep party A, clear B), and switching modes while preserving B. A missing explorer assignment, stale/removed road and oversized complex route must refuse before movement. Selecting another endpoint or departure mode while travel is in progress should have no effect.
5. Start a journey, then change a native Region, edit a road, change the Scene Grid, switch Scenes, or close Navigation. The existing native movement must be stopped where possible. No automatic road/Region edit or Scene data reset.

## Compatibility and permission checks

- Verify curves at World curvature **Off, Gentle, Moderate, Strong**, including shared checkpoint subdivisions. Overlay geometry and token motion should agree within the small bounded simplification tolerance.
- Verify native v14 collision/terrain restrictions, Region movement-cost Behaviors, and Atlas party exploration still work. This beta does not ignore native constraints, alter overland estimates or implement a custom Token updater.
- Verify the movement engine is unavailable in the separate player client. Token dragging outside Atlas is still Foundry-native and **not blocked** by this beta; no claim of a player discovery enforcement boundary has been made.
- At this stage **direct drag/drop-to-route** is a follow-up interaction pass, after reviewing the Token drag and native `preMoveToken` lifecycle in a real Foundry v14 client. Player travel is a later, separately authorized two-client security gate.

Automated check: `npm run check`. Unit tests cannot substitute for real token-movement testing, especially on Regions, walls, movement interruption, multi-client updates, Scene changes, and Token placement.
