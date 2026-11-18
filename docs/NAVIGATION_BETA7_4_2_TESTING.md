# v0.3.8-beta.7.4.2 — Checkpoint Point B continuity (Foundry v14)

This draft is stacked on beta.7.4.1 and does not change the active Foundry canvas lifecycle.

## Test on a backed-up World

1. Select a destination **past** Hearth's Heart Dock (on the authored Hearth's Heart land road), starting at South-East Gate or Port Barthos.
2. Confirm hired continuous ship passage at Port Barthos and move into the water leg.
3. Start a Long Rest Aboard, then trigger or observe one or more Canvas redraws. Confirm the ship remains hired, progress resumes from the live token, and the rest countdown survives.
4. Let the vessel arrive at Hearth's Heart Dock. **Do not click the map to select another Point B.**
5. Select Continue from checkpoint (forward-step icon). Confirm the previously chosen Point B is still selected and the next land leg is calculated automatically.

## Acceptance

- [ ] At a checkpoint before the original destination, the Navigation panel says Continue toward saved Point B, not Destination reached/Complete Journey.
- [ ] The onward route is visible and its current transportation can be selected, including ordinary Walking when the dock offers no paid land service.
- [ ] A real short land leg near the dock is not suppressed by an overly broad proximity threshold.
- [ ] If Point B is intentionally the dock itself, it remains possible to Complete Journey without another 0.07-mile checkpoint loop.
- [ ] A second or third Canvas redraw never reclassifies the current ship-leg endpoint as the final Point B; Journal metadata retains the original destination.
- [ ] No duplicate World time, booking, fares, passenger-rest completion, or prior route movement.
- [ ] GM and non-GM display, Atlas fog, road visibility, checkpoint discovery, and Scene weather/effects remain unchanged.

## Failure capture

If the onward Point B is lost, export the Journal's `guidedJourney` flag metadata (or a privacy-safe summary of its root `destination` and latest leg `destination`), and browser console logs covering `Journey arrived` and `Continue from checkpoint`. Do not reset the Journal, actor or Scene flags.
