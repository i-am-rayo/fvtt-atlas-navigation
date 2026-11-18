# v0.3.8-beta.7.4.1 — Interrupted voyage recovery (Foundry v14)

Draft test build stacked on beta.7.4.1. Do not merge until GM and non-GM checks pass.

## Prepare

1. Back up the test World's relevant Scene and Journal. Retain existing Atlas flags; do not reset discovery or erase Journey Journals.
2. On a mixed land–water–land route, select the original destination **beyond** a port checkpoint (for example, Hearth's Heart after Hearth's Heart Dock).
3. Confirm a hired ship/continuous operating method at Port Barthos. Start guided movement and begin a **Long Rest Aboard**. Verify the Journal notes the rest remaining while underway.

## Regression acceptance

- [ ] During the sea leg, trigger or observe a native canvas rebuild. Automatic re-entry continues **only toward Hearth's Heart Dock**, with the previously approved **Ship passage (hired)** selection, not Walking.
- [ ] No new ship booking, second fare, extra World time, or replay of confirmed segments occurs. The token's live position remains the source of departure.
- [ ] The original full Point B remains saved as the Journey destination; at Hearth's Heart Dock, the GM can decide how to proceed toward that Point B.
- [ ] Pending Long Rest Aboard remains unavailable while its remaining sailing time elapses; the rest completes exactly once and World time counts sailing only.
- [ ] Repeat two or three canvas rebuilds at different progress points; recover each time without duplicate transport events or a new 0.07-mile terminal checkpoint loop.
- [ ] Move or delete the approved checkpoint (in a disposable copy of the World). Recovery must stop with an actionable warning; it must never substitute Walking or move the token silently.
- [ ] From a completed checkpoint, the saved final Point B is still used for subsequent travel.
- [ ] As a non-GM, verify the confirmed Journal is readable and Atlas Fog, road colors, checkpoint visibility, weather and Scene effects still work.

## Log capture

If recovery fails, export the browser console from **canvasTearDown** through **autoResumeAfterCanvasReady** and include the Journal's current Journey Summary plus the selected transportation screenshot. Existing journeys should remain recoverable.
