# v0.3.7-beta.2.1 — Native guided-travel pause/resume test

This focused hotfix is stacked on the owner-tested v0.3.7-beta.2 animation-speed branch. Test in a backed-up Foundry v14 world as a GM; native movement timing, hook interactions and UI rendering cannot be fully simulated by unit tests.

1. Assign the placed party explorer, calculate a long enough navigation route (about 30–60 seconds playback), and click **Travel Route**. Before the token begins moving, the sticky footer should show **Pause Travel** and **End Journey**.
2. Click **Pause Travel** partway. Confirm the token halts without jumping and the control becomes **Resume Travel**. Check that the movement path is not reselected and no new route is required.
3. Click **Resume Travel**. Confirm the token follows the remaining curved path from the paused location, then reaches the destination. After completion, the control should return to **Travel Route**, and the message should say **Arrived at destination**.
4. Repeat, then choose **End Journey** while moving and while paused. Confirm movement cannot be resumed, the token stays where Foundry stopped it, and Atlas reports the interrupted journey. A fresh route may be calculated from the current token location.
5. Test closing Navigation or changing Scene while paused. Any native movement should be ended safely. Confirm players cannot initiate GM-only Atlas travel, and that native Region movement constraints, Fog, world clock and Actor stats are unchanged.

Automated verification: `npm run check`. Do not merge the draft before live v14 GM acceptance.
