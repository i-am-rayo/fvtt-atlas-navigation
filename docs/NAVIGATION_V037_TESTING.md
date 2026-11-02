# v0.3.7-beta.1 — GM guided token travel test gate

This is the first, deliberately narrow v0.3.7 movement slice, stacked on the owner-accepted v0.3.6-beta.1.1. **Live Foundry v14 acceptance is mandatory before merging.** Test in a backed-up world with a GM and separately connected player.

## GM journey

1. Assign a placed party explorer in the token's Atlas settings. On the same Scene, put Point A at the token's **center**, then select Point B and calculate a connected route.
2. The Navigation panel offers **Travel Route**. Click once. The assigned token should move along the orange road, including its smoothed bends; it must not jump straight from A to B. Confirm the normal road direction and final position.
3. Start a longer journey, click **Stop Travel** partway. The token should remain where Foundry stopped it. If the stop completes, the panel should report interrupted travel; no teleport to destination.
4. Test Point A far away from the explorer, no assigned explorer, stale/removed road, and an oversized complex route. All should refuse before moving the token. Selecting another endpoint while travel is in progress should have no effect.
5. Start a journey, then change a native Region, edit a road, change the Scene Grid, switch Scenes, or close Navigation. The existing native movement must be stopped where possible. No automatic road/Region edit or Scene data reset.

## Compatibility and permission checks

- Verify curves at World curvature **Off, Gentle, Moderate, Strong**, including shared checkpoint subdivisions. Overlay geometry and token motion should agree within the small bounded simplification tolerance.
- Verify native v14 collision/terrain restrictions, Region movement-cost Behaviors, and Atlas party exploration still work. This beta does not ignore native constraints, alter overland estimates or implement a custom Token updater.
- Verify the movement engine is unavailable in the separate player client. Token dragging outside Atlas is still Foundry-native and **not blocked** by this beta; no claim of a player discovery enforcement boundary has been made.
- At this stage **direct drag/drop-to-route** is a follow-up interaction pass, after reviewing the Token drag and native `preMoveToken` lifecycle in a real Foundry v14 client. Player travel is a later, separately authorized two-client security gate.

Automated check: `npm run check`. Unit tests cannot substitute for real token-movement testing, especially on Regions, walls, movement interruption, multi-client updates, Scene changes, and Token placement.
