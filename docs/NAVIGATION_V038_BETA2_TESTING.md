# Atlas v0.3.8-beta.2 — Transportation Presets (draft test build)

**Stack:** draft beta.2 on unmerged [v0.3.8-beta.1 PR #111](https://github.com/i-am-rayo/fvtt-atlas-navigation/pull/111). Do not merge until GM and non-GM Foundry v14 checks are complete.

- Manifest: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.8-beta.2/module.json
- Archive: https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.8-beta.2.zip

## Scope

- A single **Atlas — Transportation Presets** restricted World submenu under Module Settings collects:
  - **Transportation:** walking (Group Actor pace + editable World fallback), D&D 2024 reference mounts and vehicles, costs, and optional custom profiles.
  - **Travel rules:** Atlas Guided Travel — Rules Profile plus custom moving/rest/overnight limits.
  - **Journey & playback:** visual playback speed and explicit World clock advancement.
- Existing settings keys are still registered and read, but are hidden from the top-level module settings list. **No automatic World/Scene/Journal migration.**
- Built-in 2024 reference methods use normal *overland travel pace*, never creature tactical Speed. Listed boats and airships use 2024 Equipment mph values. The 2014 profile has a separate reference projection and per-profile GM overrides. System profile projects 2024 references for D&D 5e; other game systems display neutral reference estimates and do not acquire D&D fatigue rules.
- Walking still reads the existing Group Actor pace. Legacy beta.1 Mounted/Sailing speeds remain effective until the GM explicitly changes or resets them.
- GM can create, edit and remove custom transportation methods and edit speed (slider + precise numeric input), type, route surface, cost in CP per day or mile, purchase price in GP, and a short note.
- Optional workbook **tireless creature examples** can be imported by explicit GM confirmation. Their tactical-speed conversions are *not* D&D 2024 normal daily mount speeds.
- Navigation **Travel by** lists World methods and calculates speed in active Scene km/mi. Only walking can **Travel Route**. All other methods are planning previews, even if a matching Road exists. Future checkpoint boarding/disembark and method-specific rests need their own version and validation.
- Cost and purchase-price fields are **informational only**. No Actor currency, food, feed, condition, exhaustion, native Regions/Behaviors, checkpoint metadata or world time is changed by editing them.

## GM test checklist

1. Back up World settings, use Foundry **v14**, and install the above manifest. Check the module and Module Settings open without errors.
2. Under Atlas Module Settings, open **Transportation Presets**. Verify the three tabs have clearly named fields and that the many old travel fields no longer clutter the top-level Atlas settings list.
3. Check D&D 2024 defaults: Walking uses the party; Mounted 3 mph; Sailing Ship 2 mph; Airship 8 mph; Galley 4 mph; Keelboat 1 mph; Longship 3 mph; Rowboat 1.5 mph; Warship 2.5 mph. Feed is 5 CP/mount/day; hired coach 3 CP/mile; ship passage 10 CP/mile. All are editable without charging money.
4. Change Mounted speed to 4 mph in the Transportation tab. Save, close/reopen, refresh/reopen Navigation, select Mounted, and confirm travel time changes on km/mi Scenes while the World old beta.1 setting is preserved. Reset only this preset and verify normal 3 mph returns.
5. Switch Rules Profile between D&D 2024 and 2014, edit one built-in separately in each, switch back, and confirm overrides do not leak across profiles. With **Use current game system**, D&D 5e should use 2024 references. Custom/rest rules remain intact across restarts.
6. Add a Custom **Skiff** (Water, 6.5 mph, 10 CP/mile). Select it in Navigation over a Water preset road, verify the estimate and **Travel Route stays disabled**. Try it on Land and verify conservative surface warning. Delete Skiff and confirm it disappears from the dropdown.
7. Import optional tireless creatures, repeat import (no duplicates), and confirm they are labeled as optional/tireless rather than standard D&D overland speeds.
8. Verify World clock and playback controls save in Journey & playback and the enabled/disabled setting has the same effect as beta.1.
9. On a valid Land road, select Walking. Confirm **Travel Route** remains usable and existing rests, journal departure/arrival stamps, World time, pause/resume and progress continue normally. Check Journal recovery after canvas interruption.
10. Connect a non-GM client. Confirm only the GM can change World presets and that no player gets access to the Transportation settings submenu.
11. Reload clients and switch Scenes. Check fog persistence, checkpoint discovery, Road appearance, weather effects, Region Behaviors, selected party token and saved Journal records are unchanged.
12. Verify invalid custom values are rejected without partial updates; opening the settings window alone must not save or migrate World data.

## Deferred deliberately

- Safely changing transportation at a checkpoint; boarding, stables, ports, fees charged on arrival, transfer token movement and mixed Land/Water/Air pathfinding.
- Simulation of one-hour mount burst and mandated rest; ship continuous sailing, crew capacity, wind/current, consumables and maintenance billing.
- The previously reported occasional flickering and canvas teardown closing Navigation; Journal-first recovery remains the workaround.
- Journal and Navigation aesthetic refresh.

## Sources

- D&D 2024 Basic Rules: [Travel Pace and Vehicles](https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game) and [Mounts, Vehicles and Travel Costs](https://www.dndbeyond.com/sources/dnd/br-2024/equipment).
- Owner-supplied **5e Travel Speeds** workbook. Its optional "tireless" rows are not treated as normal sustained D&D 2024 travel pace.

**Required before merging:** automated tests, manual GM/non-GM FVTT v14 run and explicit owner approval.
