# Atlas v0.3.8-beta.1 — Method Planning Foundation (Foundry v14)

Unmerged **draft** test build stacked on `test/v0.3.7-beta.4.2.5`. Do not merge without live owner GM/non-GM testing.

## Scope

- Navigation adds **Travel by → Walking / Mounted / Sailing Ship**, separate from **Start from → Party token / Map Point A**.
- **Walking** remains unchanged: existing D&D 5e Group Actor pace where supported, terrain-weighted road route, token movement, daily travel decisions, World time and Journey Journal.
- **Mounted** and **Sailing Ship** have separately GM-editable World speeds, entered in **miles per hour** (Module Settings). Atlas converts them to the active Scene's **mi/km** grid units. Unknown Scene unit systems block transport preview with an explicit warning.
- Defaults are sourced from the D&D 2024 / 5.5e Basic Rules: **Mounted = 3 mph** (Normal pace), **Sailing Ship = 2 mph**. The mount's double-distance burst applies to **one hour** and requires a Short or Long Rest before reusing it; the burst is **not automatically applied**. Ship speeds depend on vessel type and conditions; the GM can edit the speed, and a later custom-profile catalog will allow distinct named vessels/mounts.
- Transport currently uses **physical route distance**, not native Walk/Swim terrain costs, and shows **moving time only** (no assumed travel-day/rest schedules). Mounted route legs must be Land, Sailing Ship legs must be Water; unassigned legacy roads count as Land and unknown preset IDs fail closed. **Travel Route** stays disabled for both methods even when compatible; explicit checkpoint transfers are not built yet.
- No new Scene flag, Actor/currency write, native Region Behavior alteration, Journal data migration or token action occurs from selecting a planning method. Custom mounts/vehicles, flying, port/stable transitions, tolls and transport schedules are **later v0.3.8 slices**, not working features of beta.1.

## GM and player acceptance checklist

1. Install this branch's manifest into a test world, check `0.3.8-beta.1`. Open Paedor with the previously tested Atlas party token: Navigation should default to **Party token location** and **Walking**.
2. Plan the same Land route as in v0.3.7. Confirm the familiar Walking speed, Total Trip, rest decisions, Token movement and Journal date/time log work as before.
3. Select **Mounted**. The preview should use **3 mph** converted to the Scene Grid unit (approximately **4.83 km/hour** in a km Scene). The trip estimate should count moving hours only, and **Travel Route** should be disabled with a clear transfer-point message.
4. Choose a Water-preset road and **Sailing Ship**. Preview speed should be **2 mph** (approximately **3.22 km/hour** in a km Scene). The method remains planning-only. Mixed Land/Water routes should show a surface mismatch; invalid road preset IDs should show an unknown-preset warning.
5. Edit both World speeds, reload the GM client, and verify the edited values are used. Confirm reopening Navigation resets to Walking. In an unrecognized Scene Grid unit, a new non-walking selection should explain that conversion is unavailable.
6. On the non-GM client, verify prior roads/fog/checkpoints/weather remain stable. No Transport UI action may change the Scene, native Regions, Actors or party token.
7. Keep the PR **draft and unmerged**; report screenshots/logs of any issue before beginning transfer-point work.

## Deferred, previously accepted limitations

Occasional token flicker and canvas rebuild/Navigation close are tracked separately; the Journal-first recovery workaround remains. Journal layout formatting is postponed. Live Foundry testing is still necessary; passing automated tests does not establish compatibility with all installed modules.

### Rules references

- [D&D 2024 Basic Rules — Travel Pace and Vehicles](https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game)
- [D&D 2024 Basic Rules — Equipment: Airborne and Waterborne Vehicles](https://www.dndbeyond.com/sources/dnd/br-2024/equipment)
- [D&D 2024 Basic Rules — DM's Toolbox: Special Movement and Vehicles](https://www.dndbeyond.com/sources/dnd/br-2024/dms-toolbox)
