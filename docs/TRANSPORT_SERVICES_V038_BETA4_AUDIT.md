# Atlas v0.3.8-beta.4 — Transportation Services Audit & Proposed Model

**Status:** Design review only. This document does **not** change live World catalog values, Actor flags or Navigation calculations. The baseline is `v0.3.8-beta.3.2` (land wagon travel-day correction). Owner GM/player test pending.

## Reference vs. estimate

- Official D&D 2024 Basic Rules: [Equipment — mounts, drawn vehicles, crews, passengers, travel and hirelings](https://www.dndbeyond.com/sources/dnd/br-2024/equipment) and [Playing the Game — Travel Pace/Vehicles](https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game).
- "RAW" below indicates published numbers. "GM estimate" is a **suggestion**, not a D&D rule or world-specific lore fact. **Never silently overwrite edited World profiles or Group override flags.**
- All speeds below refer to sustained travel (not combat Speed). Land uses normal 8-hour travel days unless the GM approves overtime. Ships *may* operate up to 24 hours with suitable crew; no universal continuous-travel entitlement.
- Capacity for mounts defaults to **one appropriately-sized rider**, not the animal's cargo capacity. Suitability/carrying constraints remain a future warning, never an automatic size block.

## Reference catalog audit — 2024 built-ins

| World method | Surface | Proposed passengers per unit | Baseline owned recurring cost | Charge basis | Source / caveat |
|---|---|---:|---|---|---|
| Walking (party pace) | Land | N/A | 0 | None | No vehicle |
| Mounted (general) | Land | 1 | 5 CP/day | Per mount | Feed reference; daily animal needs can differ |
| Camel | Land | 1 | 5 CP/day | Per animal | 50 GP purchase RAW; feed baseline only |
| Elephant | Land | 1 conservative | 5 CP/day minimum reference | Per animal | 200 GP purchase RAW; larger feed and extra riders subject to GM |
| Draft Horse | Land | 1 | 5 CP/day | Per animal | 50 GP purchase RAW |
| Riding Horse | Land | 1 | 5 CP/day | Per animal | 75 GP purchase RAW |
| Mastiff | Land | 1, suitable Small rider only | 5 CP/day baseline | Per animal | 25 GP RAW; rider-size warning deferred |
| Mule | Land | 1 | 5 CP/day | Per animal | 8 GP purchase RAW |
| Pony | Land | 1, suitable rider only | 5 CP/day | Per animal | 30 GP purchase RAW; size warning deferred |
| Warhorse | Land | 1 | 5 CP/day | Per animal | 400 GP purchase RAW |
| Carriage | Land | **4 (GM estimate)** | 0; draft-animal feed separately | None | 100 GP RAW, no published passenger figure |
| Cart | Land | **2 (GM estimate)** | 0; draft-animal feed separately | None | 15 GP RAW, no published passenger figure |
| Chariot | Land | **2 (GM estimate)** | 0; draft-animal feed separately | None | 250 GP RAW, no published passenger figure |
| Sled | Land | **2 (GM estimate)** | 0; draft-animal feed separately | None | 20 GP RAW, no published passenger figure |
| Wagon | Land | **6 (GM estimate)** | 0; draft-animal feed separately | None | 35 GP RAW, no published passenger figure |
| Coach ride between towns | Land | **4 (GM estimate)** | **3 CP/mile/passenger** | Passenger / mile | Hire fare RAW; driver included in service |
| Airship | Air | **20 RAW** | 20 GP/day if all **10 skilled crew** are paid | Per vessel / day | Crew count RAW; wages based on 2 GP/day skilled hireling minimum |
| Galley | Water | **Unknown (RAW —)** | 160 GP/day for 80 paid skilled crew | Per vessel / day | Do not invent passenger berths; require GM capacity |
| Keelboat | Water | **6 RAW** | 2 GP/day for 1 paid skilled crew | Per vessel / day | Crew count RAW |
| Longship | Water | **150 RAW** | 80 GP/day for 40 paid skilled crew | Per vessel / day | Crew count RAW |
| Rowboat | Water | **3 RAW** | 2 GP/day only if 1 operator is hired | Per boat / day | A party rower may cost 0 |
| Sailing Ship | Water | **20 RAW** | 40 GP/day for 20 paid skilled crew | Per vessel / day | Crew count RAW |
| Warship | Water | **60 RAW** | 120 GP/day for 60 paid skilled crew | Per vessel / day | Crew count RAW |
| Ship passage (hired) | Water | **20 example** | **1 SP/mile/passenger** | Passenger / mile | Published passage fare; chosen ship may have different berths |

**Important distinction:** Published crew minimums are *not* proof those hirelings are currently being paid by the party. The proposed crew wages are service estimates, not an automatic owned-vessel deduction. Offer an explicit **Paid crew** estimate toggle; leave base owned upkeep at zero unless configured.

## Optional new checkpoint-hire offers (GM estimates, not RAW)

| Offer | Capacity estimate | Fare proposal | Driver/crew | Why |
|---|---:|---|---|---|
| Coach within a city | 4 | **1 CP/mile/passenger (RAW)** | Included | Publish as separate offer from intercity coach |
| Cart with driver | 2 | **2.5 GP/day/unit** | Included | Small local haulage |
| Chariot with driver | 2 | **5 GP/day/unit** | Included | Skilled, specialist transport |
| Sled with driver | 2 | **3 GP/day/unit** | Included | Suitable in snow/ice |
| Wagon with driver and draft team | 6 | **4 GP/day/unit** | Included | Full service price, do not charge draft feed twice |
| Carriage with driver and draft team | 4 | **4 GP/day/unit** | Included | Passenger comfort/handling |
| Caravan convoy (e.g. 3 wagons) | 12–18 | **12 GP/day/convoy** | Drivers included, guards extra | New GM-editable service, not a published 2024 item |
| Airship charter | 20 | **50 GP/day/vessel** starting quote | Crew included | Highly campaign- and rarity-dependent |
| Ship's hammock / private cabin | Ship-specific | **5 SP/day / 2 GP/day/passenger (RAW guidance)** | Vessel crew | Alternative lodging tariff, not additive to passage fare by default |

*Land vehicles need draft animals. Hiring the complete service includes drivers and animals; owning just the cart/wagon does not conjure them. Where the underlying Group explicitly owns draft animals, the engine must avoid duplicate feed costs.*

## Other imported/custom methods

Optional workbook examples include exotic beasts, magic flying objects, spells, and setting-specific vehicles (e.g. Lyrandar airships). They are **not** standardized D&D 2024 transportation entries. Preserve their World/Group edits, mark capacity and recurring cost **Needs GM review**, and do not assign generic wages, crew counts or continuous-operation privileges from creature names. Enable service capabilities only after the GM establishes their actual lore.

## Proposed service capability schema (World profile, independently editable)

- **For hire**: enabled, fare CP, basis `trip | mile | day`, charge `unit | passenger`, driver/crew included (yes/no). Service is offered at particular checkpoint(s), not automatically everywhere.
- **Overtime**: enabled, default 8 regular hours + up to 8 extra hours (16 travel hours/day). Add an editable multiplier (proposed default **1.5×**) **only for the overtime portion** of fare/labor. Allow GM approval and an exhaustion/forced-march warning; no silent actor exhaustion changes. Overnights become 8h under a 16h operating day.
- **Continuous operation**: enabled only for selected ships/aircraft with adequate crews or magic, up to 24h/day; GM-approved, with optional extra crew-shift labor cost. No universal continuous option for carts, carriages, wagons, or ordinary riding animals.
- **Paid crew**: enabled, required crew (published count where available), skilled hireling wages (2 GP/day default), custom headcount/pay permitted. Never charge already-staffed Group crew implicitly.

World catalog keeps reference capabilities. A Group-owned resource can override service settings locally without altering World defaults; checkpoint offers can override a hire quote for local economy/lore.

## Navigation behavior / tests

1. Select method and a **travel arrangement** (owned, hire, overtime, continuous when authorized). Keep hire and overtime composable; continuous and overtime are mutually exclusive.
2. Offer "Hire" only when a compatible checkpoint advertises the service. Validate passenger seats and route surface; hired method needs no owned matching Group resource. Owned method still needs Group capacity.
3. Calculate movement hours from distance/speed, then elapsed time from chosen schedule: normal 8h travel + 16h downtime; 16h overtime + 8h downtime; continuous 24h + 0 overnight for approved vessels.
4. Price **per trip**, **per mile** or **per travel day**, per unit/passenger. Apply overtime surcharge to the extra-hours portion only. Include paid crew if selected and not already included in hire price. Display highest coins with an auditable line-item breakdown. **Do not deduct currency.**
5. Surface/boarding remain explicit. GM can edit a proposed quote for negotiation, tolls, and world-specific discounts before eventually recording any transaction.
6. Ensure no regression to walking, rest tracking, itinerary, fare, non-GM access, native Actors or World data.

## Proposed implementation sequence

- **beta.4a — Catalog/validation:** reference capacities, crew table, optional GM estimate defaults, versioned service schema and v1 migration. No active travel behavior change.
- **beta.4b — Route policies/pricing:** opt-in hire/overtime/continuous selection, calculation engine and price breakdown with unit tests.
- **beta.4c — Checkpoint supply:** GM checkpoint offers constrain nearby available services and fares, with two-client security tests.
- **beta.4 acceptance:** full Foundry v14 GM/player live test, custom World overrides retained, no merges until owner approval.

**Design decision to confirm before coding:** Treat crew wages as **opt-in service estimates**, never automatic upkeep on every owned ship. This avoids charging wages for crew the Group already pays or characters already aboard.
