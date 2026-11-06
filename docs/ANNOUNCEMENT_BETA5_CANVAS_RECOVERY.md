# v0.3.9-beta.5 — Canvas refresh / GM-awaiting announcement test build

**Owner acceptance pending in Foundry v14 (GM and non-GM player).** Based on the Product Owner's successful beta.4 test. This is a focused visual-state notification slice, not a change to native recovery authority.

## Behavior

- The Foundry canvas teardown hook only captures a **provisional, in-memory** interruption candidate; it never emits `journey.paused` directly. Successful auto-continuation of the **same previously approved leg** is silent.
- After `canvasReady`, the existing automatic recovery and GM-window restoration attempts run first. Only after the old movement/Journal writes settle, the active Scene-authorized GM re-reads the matching saved Journey Journal.
- Saved `paused` requiring a decision becomes **Journey Paused — Awaiting GM** (`journey.awaiting-gm`). Saved `interrupted` becomes **Journey Interrupted — GM review is required** (`journey.interrupted`). Even an unresolved native intent can explain *interruption*, but never credits movement or announces arrival.
- Repeated `canvasReady` without another actual Journey interruption does not repeat the banner. An already manual-paused Journey has its own deliberate pause banner and is excluded. Completed/ended Journals, Scene switches, missing active GM, invalid/failed writes and unsettled promises do not announce.
- GM receives the existing Atlas banner. A connected non-GM sees the same event with **fixed generic text** only. The World setting contains only `{schemaVersion,id,type}`; it never includes Journal/Scene/checkpoint IDs, paths, GM names or hidden data. The pulse is an online display pointer, not durable event history; reconnect does not replay.
- Existing beta.4 checkpoint/road discovery and manual pause/rest banners and the five-second FIFO/fades are unchanged. No new settings, history writes, Actor rests, transport costs, changes to native movement, or gameplay rules.

## Foundry v14 acceptance checklist

1. **Baseline:** Back up the test World. Install the new beta.5 branch manifest on GM and non-GM clients, verify version `0.3.9-beta.5`, and use Atlas Debug → Verbose while reproducing. Verify beta.4 discovery, manual pause, rest, and destination banners still work.
2. **Safe automatic restart:** Begin an approved route, trigger a same-Scene canvas refresh while moving, and confirm Atlas resumes the *same* approved leg. Neither GM nor player should see `Journey Paused`/`Journey Interrupted` for this seamless continuation. Confirm no second fare, rest, World time, or route approval occurs.
3. **Confirmed checkpoint decision:** Let the party arrive at a transfer checkpoint as the canvas refreshes. If the saved Journal is fully confirmed but the next transportation/GM decision remains, both clients should see **Journey Paused — Awaiting GM** only once. Check that no unapproved next leg starts.
4. **Unsafe/manual recovery:** Refresh while an approved movement is blocked or a native move remains unresolved. If the saved Journey is `interrupted` and requires GM review, both clients should see **Journey Interrupted — GM review is required** once; verify neither movement nor World time is silently credited. The GM must review/explicitly recover before travel.
5. **Deliberate pause:** Use **Pause Journey** and then refresh while the confirmed Journey is already paused. The original deliberate `Journey Paused` remains correct, and **no additional canvas-review banner** appears simply because the canvas was rebuilt.
6. **Adversarial lifecycle:** Trigger repeated `canvasReady`, a refresh followed by a Scene switch, or a reload/reconnection of the player client. No duplicate/stale banners or restricted text. If a Journal write cannot settle/validate or the GM loses permissions, no misleading pause/review banner is published; the recoverable Journal remains intact.
7. **Presentation privacy:** Inspect the non-GM banner and the last public announcement World setting. The pulse must include only the schema version, random ID and whitelisted type—no names, coordinates, Journal IDs or private route metadata. Confirm 5-second FIFO and reduced-motion behavior.

## Automated coverage and limits

Unit/controller regressions cover the pure canvas classification, active-GM plus saved Journal receipt, unresolved native-intent receipt checks, duplicate suppression, manual-pause exclusion, same-Scene/Scene-switch and invalid-state guards, and successful automatic continuation suppression. They do **not** replace live Foundry v14 native movement/canvas/GM/non-GM verification.

No code for World themes, checkpoint-free destination wording, or native Region territory crossing belongs in this milestone; these are tracked in [future UX issue #233](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/233).
