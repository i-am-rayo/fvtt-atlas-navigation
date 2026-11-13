# Navigation UX beta.8.48 — City/Continent directory, tabs, playback, party capacity

## Source and release status
- Base is draft PR #351 / v0.3.9-beta.8.47, retaining the owner-live-tested beta.8.45 movement path through clean PR #350.
- **Draft PR only**: no merge, no final release. Full Foundry v14 GM/non-GM acceptance is required before integration.
- Atlas data ownership remains unchanged. Native Region geography is read-only display metadata; Scene Atlas Checkpoint IDs still own Point B. TokenDocument, Group Actor, native Regions and Journey Journal remain authoritative.

## Requirements implemented
1. **Checkpoint hierarchy:** Group by a uniquely linked/containing **City (town/village/settlement included)**; otherwise uniquely known **Continent**; otherwise **Uncategorized**. Conflicting same-tier Region membership does not manufacture a city. Road surface and Road name never determine grouping. Checkpoints remain stable-ID options, sorted alphabetically, with duplicate-name disambiguation. An unavailable native grid membership falls back to explicit links and then uncategorized.
2. **Three GM planning tabs:** Travel, Playback, Directions. Buttons and panels use native tab roles/labels, keyboard arrows, Home/End navigation, active-state styling and per-panel scroll. The sticky footer remains usable. Critical Journey recovery, GM approval and native collision warnings must stay visible in the current relevant stage.
3. **Travel tab:** Point A from party explorer Token, Point B via Checkpoint or Pick on map. Travel method remains single-select; party-owned resources show confirmed quantity / seats, hired service labels expose only confirmed per-unit capacity and explicitly avoid claiming that offered inventory is in stock. Walking has no resource capacity.
4. **Party scope:** All party (PC count) or Select party members. Actual D&D5e Group Actor character IDs populate checkboxes; GM previews selected travelers plus other Group passengers, and capacity/quote use the preview count. **A partial Group cannot start an actual Journey with the original party explorer Token**: disabled Travel button and server-side controller guard; no Group, Actor, Token, or Journal mutation and no silent NPC reallocation.
5. **Timing:** Main Total Trip shows expected GM Long Rest downtime, normally **8h per overnight decision**, and a smaller alternate 16h overnight estimate (World custom rules remain authoritative when different). This is not a GM rest approval.
6. **Playback tab:** 0.5–30 visual seconds per in-game hour; a second slider adjusts expected real trip duration based on 8h Long Rests. Values are constrained to feasible projection and retained as validated optional approved Journey Journal field. The existing ten-minute movement animation cap remains. Visual rest holds are capped at 24h × 30s; never duplicate a World-clock or Actor rest.
7. **Directions tab:** Same read-only compressed directions, with named final arrival **Arrive to {Checkpoint}** when the last Atlas node uniquely matches an authored Checkpoint. Suppress redundant final **Reach {Checkpoint}** marker; no invented stop or unlabeled hidden geometry. A generic selected map location keeps a generic arrival.
8. **Clutter reduction:** Remove redundant party-token route status, verbose seat-count advisory, and the general planning "Travel calculation and World-time notes" disclosure; preserve current confirmed World time and high-severity native recoverability notices. Per-method quote stays part of GM review when it might affect money.

## Invariants and compatibility
- No native Token movement geometry, Wall/Region constraint, weather, fog, Actor rest, time-authority, or graph migration changes.
- Preserved origin and original B for Journeys; preview choices cannot retarget a recovered or active Journal.
- New choice modes remain transient until a GM expressly approves a Journey. Existing Journeys without playback snapshot remain readable, no write-on-read.
- Player-facing visibility/permissions unchanged. All-party travel remains the only authorized token movement in this stage.
- No claim that a hired service has physical stock unless Atlas stores explicit quantity; displayed 'Offered' means only an authored available service.

## Automated gates
- Node tests (including new pure geography grouping, presentation tabs, a11y keyboard, party count/seat preview and 30s timing)
- `npm run check`; `npm run architecture:check`; syntax checks; `git diff --check`
- No missing imports or import cycles
- Native Foundry v14 GM/non-GM acceptance remains a separate gate.

## GM live acceptance checklist (cloned World)
1. Install beta.8.48 test manifest; check module version. Confirm prior Roads, Checkpoints, Regions and Journey journals unchanged; backup before testing.
2. Open Navigation at 1024×768 and desktop. Verify three tabs, reachable scroll/footer, keyboard Tab/Arrow navigation, no text overlaps or blocked focus.
3. Verify directory groups City→Continent→Uncategorized, independent Checkpoints, duplicate names, hidden GM-native territory metadata and ambiguous overlapping cities. Choose Dirwest, Bridge, Dock and map location; Point A remains the party Token.
4. Inspect Party Owned mounts/carts/ships with known quantity and seats, and hired options with per-unit capacity but no false stock count. Walking has no seats.
5. Use All party, then Select party members. Observe PC checkboxes, selected count, fare/capacity preview. With a subset selected, start action must be blocked and no token, World time, Journal or fare may change. Return to All party.
6. Compare Total Trip's 8h Long Rest baseline with small 16h overnight reference. Change playback seconds/hour 0.5–30 and real-duration target slider, check calculated movement and rest holds. Try unreachable requested timing, ensure UI rejects rather than silently changing gameplay.
7. Directions tab: repeated Road to Dirwest steps consolidated, actual authored Bridge checkpoint is a distinct milestone, no duplicate final Reach Dirwest and Arrive to Dirwest.
8. Start a clean all-party journey, test 8h approved Long Rest → stationary hold → native movement continuation; verify World-time and Journal events once and no duplicate fares. Pause, refresh, recover; verify per-Journey playback setting retained.
9. Non-GM: confirm no secret Region/Checkpoint metadata or GM control leakage; fog, native Walls, Regions and Atlas Layers remain unchanged.

## Manifest
https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.48-navigation-tabs-party-capacity/module.json

## Archive
https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.9-beta.8.48-navigation-tabs-party-capacity.zip
