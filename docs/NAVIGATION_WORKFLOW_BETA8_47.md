# Navigation workflow and readability — v0.3.9-beta.8.47 (draft)

## Source and scope
- Based on the **clean v0.3.9-beta.8.46 dual-destination** candidate (PR #350), not superseded diagnostics or integer-waypoint changes.
- This is a GM Navigation planning UX stage. No new Scene/Region flags, Graph mutations, native TokenDocument movement algorithm, World calendar rules, fare/rest/Actor writes, or automatic Journal recovery behavior.
- **The only new persisted field** is optional, validated `playbackSecondsPerHour` on a GM-confirmed Journey Journal. Legacy schema 1 records remain compatible without migration or write-on-read.

## New normal GM workflow
1. Open Navigation. The window opens at 560×665 (resizable and scrolling) rather than 420×320. Point A comes from the assigned Atlas Party explorer; the Start from and Refresh location controls are removed.
2. Destination begins with a **Checkpoint dropdown**. Its only groups are **Land, Water, Air, Uncategorized**. All readable Checkpoints remain selectable by stable ID, including independent/missing-Road records. No Road or Territory hierarchy in labels.
3. Alternatively press **Pick on map**. Navigation minimizes using public ApplicationV2 API and presents a modeless small instruction window. A validated GM Scene click sets Point B and restores Navigation. Cancel restores the existing unapproved preview; closing/teardown releases the prompt. Map clicks are *not* intercepted in party mode until explicitly requested.
4. Only after a valid route is calculated do transport choices appear as native **radio tiles** grouped into **Party Owned** and **Available at {Checkpoint}**. Walking and owned resources are calculated from existing availability; hired options still require the existing explicit approval/capacity/route checks. Only one current method can be selected; the existing per-method editor is retained.
5. Show distance, moving travel time (8-hour travel-day context) and estimated total elapsed trip. Total includes World rules' overnight time (default 16h); a separate **8h Long Rest comparison** is displayed and tooltips explain both. Actual rest is always a GM decision.
6. **Playback speed, this trip only**: slider 0.5–8 real seconds per in-game hour, or request a target real trip length in minutes. A pure, bounded inverse calculates seconds/hour using estimated moving animation and 16h overnight holds; impossible targets show a warning without silently clamping. The panel previews both 16h overnight holds and 8h Long Rest alternatives, each with an expected per-stop duration. The existing visual movement maximum (10 minutes) is honored. World time and travel speed never change because of this control.
7. Directions default to **collapsed**. Identical adjacent instructions merge their displayed distance/time, with detailed terrain subsegments available through a nested disclosure. GM-authored Checkpoints at intermediate route-leg endpoints become **Reach {Checkpoint}** milestones, and substantial actual Road changes can produce left/right turns. The source Journal and raw itinerary remain unchanged; no invented junction names or unpublished player data.

## Explicit invariants
- Route calculation, ownership, saved Point B/Point C, Token movement, native Walls/Regions, World time, Journal confirmed progress, fare and Actor rests remain governed by beta.8.46.
- GM scene update permission and recoverable-Journey locks apply to **both** Point B selection methods.
- Browser-only `mapPickActive`, preview and open/closed directions state are never persisted as gameplay. A closed picker must not interfere with Foundry Scene clicks or leave a listener.
- `playbackSecondsPerHour` is persisted once **at GM-approved Journey creation** for stable pauses/recovery; no World settings writes, and no migration for older schema 1 Journals. Recovery chooses the saved approved value before the global preference.
- No player-facing Road or Territory metadata is exposed by the GM planner. Landmark text remains GM-only.

## Automated gates
- `npm run check`
- `npm run architecture:check`
- Changed JS syntax, `git diff --check`, no missing targets/cycles
- Tests for Checkpoint terrain-only grouping, valid/default source mode, selector lock, radio choice callback behavior, pure playback target projection and impossible target, optional Journal playback round-trip, repeated directions and true Checkpoint milestones.
- CI passing is not GM/non-GM live acceptance.

## Foundry v14 acceptance checklist — Product Owner
1. Back up Sandbox and preserve existing Journey Logs. Install beta.8.47 manifest; verify correct version and no native Walls/Region modifications. Test in a cloned World first.
2. Open Navigation at 1024×768 and a wide desktop. Confirm usable initial dimensions and scrollable contents; no Start from or Refresh location.
3. Confirm the Checkpoint dropdown is default and categorized only Land / Water / Air / Uncategorized; test independent Checkpoints, duplicate names, and unknown Road/terrain metadata.
4. Select a named Checkpoint. Verify exact saved Point B, party Token Point A, and route/Journal preview. Press Pick on map; the main window minimizes, the small instruction prompt remains usable; cancel preserves preview. Reopen and click map to set a new Point B, restore normal Navigation. Unrelated map clicks must not alter the route without active picker.
5. Verify Party Owned and Available at {Checkpoint} radio tiles show only valid options; select Walking, Horse/Caravan/Camel as configured and hired options. Confirm a single selection at a time; unowned transport or absent checkpoint offers do not become available. Editing remains scoped, fares not silently deducted.
6. Check distance/time/total metrics, tooltip assumptions, 16h overnight plan and 8h Long Rest alternative. On a route of ~35h, set target to 5m; verify visual compression and both rest durations. Try impossible targets: warning, no World/time/Journey change.
7. Collapse/expand directions; repeated Road to Dirwest sections should aggregate. Author a Bridge Checkpoint exactly at a routed intermediate Node: verify **Reach {Bridge}** appears. At a real change of Road with a substantial turn, verify left/right text. Surface details should remain accessible without distracting from primary steps.
8. Approve one unobstructed Journey and reach the daily 8h decision; select Long Rest, check stationary visual hold, 8h World-time/Journal confirmation exactly once, continuation through the next movement chunk and final arrival. Canvas refresh and saved-Journey resume must restore the chosen per-trip visual speed and must never duplicate movement/time/rest/fare.
9. Non-GM: verify no new GM Navigation authoring/selection, secret checkpoint names, Region metadata, fog leaks, unauthorized movement or Journal writes. Confirm all native Scene/Region/Wall behavior matches beta.8.46.

## Deferred / explicit limitations
- No dynamic nested Roads/Cities destination hierarchy, automated booking, or native auto-rest action.
- Checkpoint milestones require authored node alignment; no fabricated landmark from text or surface name alone.
- A real-time playback target is an estimate, not a hard audiovisual clock or automatic roleplay timer. The GM may pause, choose different rests or alter the number of travel days, so actual duration can differ.
- An extreme target outside 0.5–8 seconds/hour or movement 600-second cap is rejected instead of changing native movement constraints.

## Test build
Manifest: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.47-navigation-workflow-ux/module.json

Archive: https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.9-beta.8.47-navigation-workflow-ux.zip

Keep this PR in draft until owner GM/non-GM acceptance. No merging or final publication authorized.
