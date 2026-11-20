# Atlas 0.3.12-dev.11 — mixed passenger, mounted, walking and cargo modes

This development branch builds on accepted dev.10 and replaces the assumption
that a **mixed** Journey has only walking passengers and cargo-only hires.

## Expected GM interaction

1. Select two or more **compatible land** travel methods in the existing checkbox
   fieldset. The selections do not mean everyone boards every vehicle.
2. Assign **each Group Actor traveler** explicitly to exactly one selected method:
   Walking, party-owned mount/vehicle, or a hired vehicle. NPCs that share a
   seat still travel and count for per-passenger fare, but do not consume a
   separate seat. Batch Group actors retain their declared quantity.
3. For hired passenger vehicles, Atlas calculates the required number of
   vehicles from assigned seats and validates the local finite inventory.
   Set a larger count for extra purchased cargo capacity if desired.
   An unused per-unit hire becomes **cargo-only**; a per-passenger hire without
   riders is invalid. No actual booking or seating mutation occurs.
4. For owned mounts/vehicles, Atlas projects the actual Group Actor resource IDs
   and requires adequate matching seats. Personal mounts cannot seat unrelated
   riders. The same mount may not satisfy two selected methods.
5. The recommended pace is the slowest participating selected method.
   The GM may override Walking upward **only** while staying at/below every
   chosen mount/vehicle's pace. Scene units stay authoritative; World
   metric/imperial preference determines displayed units.
6. Only actual hired **passengers** are charged for per-passenger services.
   Per-unit fares use the selected vehicles; day/time rates use the chosen
   shared journey moving hours. No currency, Actor or World write in preview.
7. Before actual native Token movement/World time/Journal, the GM confirms
   individual assignments, units, estimated price and speed. Changes during
   confirmation reject the Journey; no partial write is permitted.
8. The Journey Journal saves a validated **schemaVersion 2** mixed manifest and
   speed. Existing version-one cargo-only and single-method Journeys remain
   readable, recoverable and unchanged. No migration/write on read.

## Foundry v14 GM/non-GM live acceptance

- **Walking + coach:** at Hearth's Heart, 3 PCs / 2 NPCs, 4 seats needed,
  choose Walking + Coach. Seat 2 PCs + 1 NPC in the coach, others walk.
  Confirm hired units = 1 with 4-seat coach. Per-passenger fare covers only
  three assigned riders, including the seat-sharing NPC when applicable.
- **Walking + coach + cart:** assign coach riders, walkers, and leave a
  per-unit cart as cargo; confirm appropriate hire quantities and combined
  time-based fares.
- **Owned mount + coach + walking:** reserve named owned mounts for their
  riders, seat separate riders in coach and leave the rest walking. Missing
  owned resources, duplicate mount allocations and assigned-person mismatch
  must block Travel.
- **Finite availability:** one two-seat cart cannot carry four seat-needing
  riders. Two carts allow four riders if locally available; zero stock blocks.
  No phantom extra vehicle for hired coach or wagon.
- **Mixed all-riding:** select two compatible transport methods with no
  walking; explicit passenger assignments still required. The slowest
  vehicle sets speed, and no Walking override may bypass it.
- **Invalid selections:** missing passenger assignment, a hired per-passenger
  service with zero riders, excessive unit counts, an invalid faster pace or
  a road-surface transition must block confirmation and Journey Journal writes.
- **Stale confirmation:** edit Group roster, vehicle seat count, local supply,
  vehicle speed, road geometry, Actor resource ownership or fare while the
  GM confirmation is displayed. Reject the outdated approval before movement.
- **World/Journal recovery:** interrupt, reload and resume an approved
  mixed Journey. The saved manifest and speed must win over current checkpoint
  inventory and World presets. No duplicated native Token movement, time,
  fares, rests or announcements.
- **Legacy:** Dev.10 walking + cart cargo-only Journey records load without
  migration; conventional one-method, transport transfer and completed
  Journal behavior must remain unchanged.
- **Permissions/UI:** non-GM cannot approve or see hidden GM-only data,
  keyboard and narrow layouts work, and the UI never implies physical
  boarding or automatic payment.

**Boundary:** A single native Group explorer moves together. Splitting members
into separately moving parties requires separate Group/explorer ownership;
Atlas must not represent two independent speeds with one TokenDocument.
Land-to-water/air transitions remain per-leg transfers, not a single simultaneous
mixed convoy. Always preserve the authored route, native Regions, World time
and recovery safeguards.

## Required gates

`npm run check`, `npm run architecture:check`, Node/DOM/recovery regressions,
syntax checks, `git diff --check`, GM and non-GM Foundry v14 acceptance.
Draft PR only until Product Owner approval.
