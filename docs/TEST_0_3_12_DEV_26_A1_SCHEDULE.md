# 0.3.12-dev.26 — A1 Cross-Surface Operating Schedules (GM test)

## Scope / product contract

- Land, water, and air **vehicles** can each be configured for standard, overtime, or continuous travel. A continuous operation requires an explicit configured capability; a foot traveler or ordinary mount does not inherit 24-hour capability.
- World transportation presets and local offers determine eligibility, speed, stock, fare and crew terms. The shared **Journey** transportation editor selects the operating schedule for the **current** checkpoint leg. Its trip-only choice must not rewrite World presets.
- Global A→B surface projection supplies a read-only whole-route forecast, including moving hours, estimated duty downtime and independently rounded transportation fare estimates. Later legs remain preview-only; if an intermediate transportation choice is unresolved, Atlas must not invent an overall arrival/cost.
- Duty already used by the Group carries from one standard/overtime leg into the next. A continuous operator may keep moving without vehicle downtime, but the passenger party is **not automatically rested**, has not approved any Actor benefit, and cannot be considered rested merely for changing vehicles.
- The saved Journey Journal, native TokenDocument movement and confirmed World time remain authoritative. Render/preview and setting edits never book, debit money, mutate Actors, advance time, or move tokens. Approval to travel one leg never approves its successor.
- Preserve v1–v3 legacy Journey readers, approved recovery, original A/B destinations and immutable confirmed history. No dependency, persisted schema change or migration in A1.

## Automated verification

- `node --test tests/navigation-a1-operating.test.mjs`: all three surfaces and unsupported mount/method/surface cases; normal vs overtime vs continuous quotes; shared duty across method switches; no automatic passenger rest; unresolved future leg blocks a fabricated total.
- `npm run check` and `npm run architecture:check` must pass on the PR head. Verify `module.json` and `package.json` both say `0.3.12-dev.26`, manifest/archive reference this branch, and no new cycles/missing imports.
- Check the diff for unrelated changes and whitespace errors. GitHub CI is evidence for automation only, not for Foundry live acceptance.

## Foundry v14 GM smoke tests

1. In **World transportation presets**, enable continuous for a **land carriage** with planned rotating drivers. Verify Standard, Overtime (if enabled), and Continuous appear in the same shared trip-level method editor used for a ship or airship; unsupported methods do not offer Continuous.
2. Plan a land → water → land Journey. Inspect the global route projection, per-leg mode and estimated duration, downtime, fares. Future water choice without an available vessel must leave whole-route totals unavailable. Verify native Scene units and all explanatory labels.
3. Choose an eligible continuous carriage for the **current** land leg and approve only that leg. Verify one explicit GM confirmation before movement, stored operation in the Journey, native TokenDocument movement and exact World-clock accounting; no automatic rest, Actor action, fare deduction or approval of the next leg.
4. Change current leg to Standard and Overtime where supported. Compare 26 hours of carriage travel under 8h, 16h, and 24h operating days; verify quotes and GM choice remain trip-local. Reopening the editor should show the chosen operation; **Cancel** must not change it.
5. Repeat for steamship and zeppelin/airship examples with actual compatible authored roads and checkpoint offers. Native movement constraints and checkpoint eligibility must remain active, including hidden/no stock and an unclassified landing.
6. During a continuous leg, trigger Canvas teardown/redraw and resume a saved Journey. Confirm the same approved operation, path, checkpoint, fare estimate and World-time receipt are recovered without duplicate movement, clock increments or passenger rests. If evidence conflicts, Atlas must halt and preserve the Journal.
7. Confirm that an uninterrupted voyage still offers only the existing manual underway rest controls; a previous standard travel day does not magically reset merely because the party boarded a continuous vehicle. Cross-check final Journal and partial historical legs.

## Non-GM and interruption tests

- A non-GM cannot change World presets, trip-level operating schedules, checkpoint offers or approve movement through UI **or** controller methods. Hidden map metadata does not become visible through the global preview.
- Change the World catalog/offer while the GM confirmation dialog is open: the operation must be rechecked and a stale offer rejected without gameplay writes.
- Stop/cancel, missing token permissions, invalid surface, missing offer capacity, duplicate checkpoint, external native movement, failed Journal write and optional clock-off mode all remain fail-closed.

## Deferred

B1 traveler/mount assignment carryover across legs, shipboard horse boarding and per-animal fares, and integrated stabilization each remain separately owner-accepted phases under #468. This A1 release does not implement them.
