# v0.3.9-beta.3 — Confirmed Journey Announcement Delivery

**Status:** draft owner test build. Requires Foundry v14 active GM + non-GM acceptance. The owner has approved beta.2's **visual** design, not yet the automatic two-client delivery.

## What now triggers

| Confirmed operation | Banner | Minimum authority |
| --- | --- | --- |
| New GM-approved guided Journey, after Journal creation | Journey started | Durable new Journal; verified initial token anchor |
| Arrival at an authored transfer checkpoint | Checkpoint reached | Confirmed native TokenDocument + 100% leg + saved checkpoint/target |
| Verified final destination or explicit complete-at-checkpoint | Destination reached | Saved completed Journal; verified terminal progress |
| GM explicitly ends/stops/forgets an unfinished Journey | Journey ended | Saved status **ended**; no pending native move |
| GM requests Pause and the next native stretch commits | Journey paused | Saved paused Journal after World-time confirmation |

The destination reached event is **not** the same as an intermediate checkpoint. The Journey ended event is **not** automatically sent a second time after successful destination arrival. Canvas teardown, refresh, Scene load, redraw, preview clicks, unfinished native movement, aborted writes and unconfirmed positions do not produce a live event.

## Data ownership and privacy design review

- **Journal:** Sole durable owner of approved Journey statuses, TokenDocument recovery anchor and completed progress. The presenter checks the latest `journal.getFlag` against the exact just-saved record **after** the save resolves. No new Journey schema, migration or write-on-read.
- **Foundry native World setting:** `fvtt-atlas-navigation.atlasAnnouncementPulse` is one tiny, versioned, **public** delivery pointer `{schemaVersion:1,id,type}` updated only by the active GM after a confirmed Journal transition. This is **not** a second Journey database or durable event history. Native World-setting authorization, rather than an unauthenticated client socket message, supplies the write authority. A failed presentation write is logged but never rolls back or repeats approved movement/time.
- **Presentation:** All clients render one local DOM-only banner using the existing beta.2 renderer; **no Canvas, PIXI or TokenDocument operations**. The originating GM sees a real confirmed checkpoint name, but other clients see only a fixed, neutral subject such as “a waypoint” or “your destination.” No Journal UUID, token, road, scene, coordinate, checkpoint name, route target, hidden lore or free-form text is transmitted to players. Discovery and exact-name reveal need a separate privacy/visibility review.
- **Deduplication:** Each publisher deduplicates just-committed status transitions in bounded memory; each receiver deduplicates notification IDs. Receivers seed the most recent World-setting pointer on `ready` and **never replay it on login/reconnect**. The display layer replaces rather than stacks banners. The World setting retains only the most recent pointer and must never be used to infer Journey progress or repair history.
- **GM authority:** Only the native active GM may issue a pulse, and the Journal flag check fails closed if missing, stale, mismatched, or marked with a pending native movement. Failed delivery does not create new gameplay actions. No module socket listeners or private core APIs were introduced.

### Decision rationale

A raw module socket allows client-supplied event packets without a trustworthy documented sender identity; a non-GM could forge a cosmetic “Journey completed” message. Native GM-restricted World setting updates remove that client-origin trust problem without modifying gameplay. The one-slot public setting costs an extra nonblocking tiny write per confirmed announcement; if that proves disruptive in live v14, disable automatic delivery and revisit transport design. Hidden names are withheld deliberately until a player-safe disclosure policy is established.

## Foundry v14 two-client acceptance

1. Install the beta.3 branch. Join with **one active GM** and **one non-GM** player, preferably on different browsers.
2. Begin a new Journey. After its initial Journal is saved, the GM and connected player should each see a **Journey started** banner; no banner should trigger simply by planning or previewing a route.
3. Reach a genuine transfer checkpoint. Both see **Checkpoint reached** after native movement and Journal commit. The GM sees its name; the player sees “You have arrived at a waypoint.” Resume from the checkpoint. No second start banner.
4. Arrive at Point B (including a final checkpoint with explicit **Complete Journey**). Verify one **Destination reached** banner and identical committed World time/Journal totals to beta.2. No duplicate Journey ended banner.
5. Start another Journey, manually pause during movement, then confirm **Journey paused** only after the pause is saved. Resume. A daily-rest decision must **not** trigger the manual-pause banner.
6. Explicitly end a Journey, then use **Stop and Replan** / **Forget Saved Journey** for the appropriate confirmed state. Only actual saved **ended** status produces **Journey ended**.
7. While moving, force a Foundry Canvas teardown/rebuild, browser reload or reconnect. Verify **no** replay, no extra token movement/World-time/Journal history, and recovery continues to obey previous guards.
8. Open beta.2's GM Module Settings banner previews; these must remain local to that GM and cause no player announcements.
9. As non-GM, attempt to edit World settings or open the restricted preview. Verify native denial. Check the public `atlasAnnouncementPulse` payload: it must contain only version, opaque ID and whitelisted type.
10. Test two connected GMs, a closed client, and the absence of `game.users.activeGM`. Only the active GM can publish; a delivery failure must never interrupt travel.

## Automated review

Run `node --test tests/atlas-announcement-commit.test.mjs`, `npm run check`, `npm run architecture:check`, syntax checks for the new runtime/policy and `git diff --check`.

## Explicitly deferred

Checkpoint discovered, road discovered, break started/ended, actual discovered-name broadcasts, cinematic camera movement, sound, user-customized copy, banner history, and replay. No token-vision, native Regions, fog, Scene flags, Actor rests, fare collection, transport catalogs, Journal schema or movement coordinator were changed by beta.3.
