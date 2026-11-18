# v0.3.7-beta.2.2 — Visible movement completion and duplicate-travel guard

This focused hotfix follows the owner's recording of v0.3.7-beta.2.1: **Arrived at destination** appeared while the Canvas token was still visibly traveling, then repeated **Travel Route** clicks queued duplicate trips. Test in a backed-up Foundry v14 world before merging.

1. Pick a 30–60-second route using **Party token location → B**. Click **Travel Route** once. Confirm **Pause Travel** and **End Journey** replace it and remain visible for the *entire* on-screen animation, not just while the server processes the token document.
2. While the token is still moving, click the footer repeatedly: **Travel Route** must not reappear, no duplicate journey must be queued, and the token must never return to its old starting location to replay the path.
3. Let the token reach B. Only after the full visible movement finishes should Atlas display **Arrived at destination** and return to the idle **Travel Route** action.
4. Also check **Pause Travel / Resume Travel** while the native movement is still in progress. Some native movement environments complete server processing before the visual animation finishes; if Foundry reports the movement is no longer pausable, Atlas should warn instead of starting another route. Report whether native pause works during the actual animation so the next checkpoint-based travel pass can be scoped appropriately.
5. Confirm **End Journey**, Navigation close, and Scene changes still fail safely; player travel stays GM-only. World time, Actors, saved road geometry, Fog, and native Region Behaviors must remain unchanged.

Automated check: `npm run check`. Real Foundry v14 tests are required for the separate movement and Canvas animation promises.
