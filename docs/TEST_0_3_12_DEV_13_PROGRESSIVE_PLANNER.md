# Atlas v0.3.12-dev.13 — progressive Journey planner

Based on the GM's 2026-11-21 usability feedback. Stacked on dev.12.

## Four concise steps
1. Where are we going? Existing checkpoint and map Point B.
2. How are we traveling? Select compatible methods (no All Party/Selected Members radios).
3. Who is going, and how? One method = all Group travelers checked by default.
   Multiple methods = one assignment column per selected method. Drag a
   traveler or use the keyboard Move control. Existing personal mount riders
   provide defaults but are NOT permanently bound to a mount.
4. How fast? Only when selected speeds differ. Lowest recommended;
   a GM may approve a faster walking pace up to the slowest vehicle speed,
   or a custom slower pace. Unit labels are mph/kph.

## Safety
A selected subset is planning-only. It may show capacity estimates but cannot
move the full native Group explorer Token, alter Actor membership, advance
World time, charge currency or create an approved Journey. The GM must first
configure a separate native Group/explorer for actual split-party travel.
Do not change the Journal recovery schema or migrate existing records.
V1 cargo-only, v2 explicit allocation and v3 pooled allocation remain readable.
Preview remains transient and only an authorized GM may confirm the native move.

## Owner Foundry v14 GM / non-GM acceptance
1. New Journey with Cassian, Lucious, Torrus, Jonathan and Nyx (no seat):
   single Walking method shows five checked names and four required seats.
   Old radio group is absent. Uncheck Nyx: preview-only notice; Play blocked.
2. Walking + Warhorse + Cart: exactly three columns; configured Lucious
   rider defaults to Warhorse. Drag Lucious to Cart, Jonathan to Warhorse.
   Both are draft choices, not Group Actor mutations. Test keyboard Move.
3. Walking + Coach: assign three travelers to Coach; price per actual
   passenger, validate seats, finite local stock, NPC no-seat treatment.
   Unused hire with per-unit charge may haul cargo, without riders.
4. Mix several methods; remove one; method-specific assignments survive
   only while its key remains selected; each active member is listed once.
5. Equal speeds hide step 4. Differing speeds display alternatives using
   mph/kph from global preferences. Walking 3 mph + Cart 4 mph allows
   explicitly approved 4 mph, but must block 5 mph.
6. Verify GM confirmation, interrupted Journal recovery, canvas redraw,
   World time, Token movement and lack of duplicate fare/rest events.
   Non-GMs cannot authorize movement or read hidden GM-only information.
7. Recheck accessibility (keyboard and touch fallback), narrow screen
   layout, road/checkpoint, Scene Regions, fog and multi-leg transitions.

## Gates
Node/DOM tests, npm run check, npm run architecture:check, syntax,
git diff --check, then actual GM + non-GM Foundry v14 acceptance.
Draft PR only. No merge or release without owner approval.
