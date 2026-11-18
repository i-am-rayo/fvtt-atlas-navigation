# v0.3.8-beta.3.2 — Land vehicle day parity & Group-local property overrides

Stacked draft hotfix over v0.3.8-beta.3.1. **Do not merge until owner GM/player Foundry v14 acceptance.**

## Scope

- Overland **land mounts AND land vehicles** use the active D&D or Custom travel-day policy; in the D&D profile this is 8 travel hours per day and 16 overnight downtime.
- Water and air travel remain provisional movement-only estimates (no explicit crew/continuous-operation schedules yet). They do not inherit land-vehicle rest rules.
- Per-resource Group overrides now include sustained mph, recurring CP amount, cost frequency (none/day/mile), charging scope (unit/passenger), purchase price (inherit/not for sale/custom GP) and GM note; quantity and seats remain editable.
- Kind and travel surface remain derived from stable linked World profile IDs.
- Group fare previews apply per-resource cost overrides; if passenger-specific rates differ, passengers are assigned to available seats in Group roster order for **illustration only**. No boarding or deduction occurs.
- Group schema v4 normalizes v1, v2, v3 without writing; saving is GM-only.

## Manual checks in Foundry

1. On an identical 90.23 mi route with both at **3 mph**, verify Riding Horse and Wagon show **30h 5m moving, 3 overnight stops, 3d 6h 5m total** under D&D 2024. Wagon must not show 1d 6h 5m.
2. Change World daily travel policy to Custom 6h travel and its overnight hours; both land vehicle and mount previews should change consistently.
3. Confirm Warship stays a waterborne movement-only preview rather than silently receiving mandatory land rests.
4. Open Group sheet > Travel Pace horse icon > Vehicles. Edit a Warship's recurring upkeep, cost frequency, charge target, custom purchase price, and GM note. Save/reopen. Confirm values persist and the **World Warship** profile remains unchanged.
5. Select "Not for sale" for a Group-only vehicle; confirm purchase price displays as unspecified while the World reference price remains unchanged.
6. Use "Clear individual overrides" for a mount. Save/reopen: fields inherit World speed, cost, basis, purchase price and note.
7. With multiple matching mounts, confirm individual price overrides are reflected in the read-only Group transport fare, including per-day counts based on an 8-hour travel day.
8. Test invalid negative/non-finite and oversized costs, unknown basis, oversized note; Save rejects without corruption.
9. Confirm stable Actor renames, NPC role changes, unsaved tab edits, source property inheritance, and normal World travel catalog editing still behave as beta.3.1.
10. As non-GM, verify no Group transportation button/editor/save route is exposed. No native Actor/Group mutation, coin deduction, boarding or token movement.

## Deferred

- Dedicated continuous/crew-driven water and air operating calendars, optional vessel-level schedules.
- Accurate boarding manifest / which passengers use which priced vehicle when per-passenger rates differ.
- Mixed-method horse/camel/wagon convoy and optional mount size/anatomy checks.
