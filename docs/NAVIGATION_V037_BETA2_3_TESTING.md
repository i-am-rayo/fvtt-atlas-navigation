# v0.3.7-beta.2.3 — Pause, resume, end journey and journey progress

Test in a backed-up Foundry v14 World as a GM. This is a follow-up to beta.2.2; no new player-travel authority, World-clock advancement, rest rules, or Scene/Actor/Region/Fog migration is included.

1. Select the assigned Atlas party token, choose **Party token location → B**, and calculate a route that takes at least 20 real seconds to play. Press **Travel Route** once.
2. Confirm **Travel Route** disappears and the **Journey progress** bar moves during the trip. It must remain below 100% until the token visibly arrives. The Directions scroll and footer controls must remain usable.
3. Press **Pause Travel** while the token is visibly moving. A temporary **Pausing…** indicator appears; the current short stretch finishes (normally within about 2 seconds), then the button becomes **Resume Travel**. Verify the token does not move further while paused.
4. Press **Resume Travel**. The token continues from its paused position, following the same curved road without teleporting to the original start; progress increases from its previous value.
5. Press **End Journey** in the middle of a trip, including once immediately after selecting Pause. The current short stretch may finish, but no further stretches run. The token stays near the ended position; no "could not be ended" warning, return to the start, or duplicate journey should appear. Progress remains below 100% for an interrupted trip.
6. Repeat on a route with road bends and native Terrain Regions. Verify the token follows the displayed route, speed remains within the configured playback range, and native movement restrictions are honored. If a native Region blocks or redirects the token, Atlas should stop scheduling further route stretches and ask for a fresh route.
7. Finish an uninterrupted journey. **Arrived at destination** and **100% complete** appear only when the visible motion is finished. Only then is **Travel Route** available again.
8. Close Navigation or change Scenes during travel. Confirm Atlas doesn't submit further stretches. Players still cannot initiate GM-only Travel Route. World time, Actor exhaustion/resources, saved road geometry, native Regions and Foundry Fog must stay unchanged.

**Architecture note:** Pause and End now happen at safe short-stretch boundaries. They intentionally do not call the native pause/stop operations on a Document movement that may already have completed while Canvas is still animating. This can take up to roughly 2 seconds; if the Scene/server is slow, the pending native stretch must also finish. Each stretch remains an authorized Foundry Token movement rather than a direct token-position write.

Automated verification: `npm run check`. The distinct Document/Canvas movement lifetimes and smoothness under Foundry v14 still require live acceptance.
