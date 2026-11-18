# v0.3.8-beta.3.1 — Party-owned transport editor hotfix

Stacked draft beta hotfix; **do not merge before owner live v14 GM and player verification**.

## Intended changes

- GM-only Group Travel Pace icon opens Party-owned Transportation with three tabs:
  **Vehicles | NPC | Player Characters**. Vehicles is selected initially.
- Tab changes preserve unsaved fields and avoid scrolling across unrelated categories.
- A linked World transportation profile owns the travel surface. The redundant
  Group surface selector is removed; the Group record retains a derived surface for
  old-save projection compatibility.
- Mount/vehicle resources may opt into an individual **Travel speed override (mph)**.
  Blank means inherit from the World profile. Overrides are saved only in Atlas
  Group assignment metadata; they do not mutate the shared catalog or native Actors.
- The Navigation estimate uses the slowest *matching* resource for a chosen owned
  transport profile if the Group has enough matching seats. Hired and unowned
  reference methods keep World profile speeds. Mixed-convoy selection and individual
  rider assignments remain a later beta.
- Read-only schema normalization supports Group v1/v2 -> v3; no implicit flag writes.

## GM smoke tests

1. Open a D&D 5e Group with a vehicle, an NPC mount and a PC. Click the horse
   icon within Travel Pace. Verify tabs **Vehicles | NPC | Player Characters**,
   default Vehicles, correct lists, and no Group dropdown.
2. Edit mount quantity, change tabs twice and return. Verify the unsaved quantity
   persists. Save; reopen; verify the stored quantity.
3. Select a Warship World profile. Confirm **Water** is visible as profile-derived
   surface in its summary, without a separate Travel surface dropdown.
4. Rename a Camel Actor and reopen; the stable profile link remains intact.
5. Set Camel speed override to **3.75 mph**, save and reopen. World Camel remains
   **3 mph**. Blank the override, save; the World default is inherited again.
6. Assign two mounts to the same profile with different override speeds. In
   Navigation, confirm the method preview uses the slower matching resource
   when seats cover all travelers. Walking and hired methods remain unchanged.
7. Try invalid values (0, negative, >600, nonnumeric) and verify Save fails
   without overwriting prior settings. If World profile changes while editor is
   open, Save must reject stale data.
8. Reopen on a player client. Player must not see the horse icon, open the editor,
   or save Group assignments; Group and native Actor records remain unchanged.
9. Reopen pre-existing v1 and v2 settings. Verify they appear correctly; no
   migration occurs until the GM explicitly saves.
10. Open Navigation and verify route previews, fare calculations, and World time
   still work in a scenario without any Group speed overrides.

## Known limits

- A transport method is a planning option, not a boarding state. Atlas does not
  assign riders to particular mounts.
- In the absence of rider-by-rider selection, the speed estimate assumes **all
  resources matching the selected method** travel together and takes the slowest.
  It does not yet combine horse/donkey/camel in a single mixed convoy.
- Mount size/anatomy/carrying capacity suitability is intentionally not enforced.
- Guided mount/vehicle travel still waits for explicit checkpoint transfers.
