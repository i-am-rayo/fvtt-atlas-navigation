# Atlas v0.3.8-beta.4c — Checkpoint Transportation (GM test build)

## What this beta adds

- World Checkpoint Preset editor: Transportation tab grouped into **Land Travel**, **Water Travel** (rivers/lakes), **Sea Travel** (coasts/oceans) and **Air Travel**. Offer controls inherit World travel preset values unless independently overridden at the checkpoint.
- Placed Checkpoint settings: same Transportation tab. Each location has independently saved offers in an Atlas-owned Scene flag `checkpointTransportOffers`. Prices, capacity, wages, schedules and purchase estimates may differ between locations without modifying World catalog settings.
- World template editor: **Apply to open Scene…** action on each preset. The GM chooses checkpoint scope (same type, linked to this preset, or all) and exact appearance/discovery/transportation fields to overwrite. A second confirmation lists affected checkpoints. The operation does not change checkpoint names, coordinates, roads, native Regions, or the exploration history.
- Navigation **Travel by** lists only Walking, matching Group-owned mounts/vehicles, or methods explicitly offered at a checkpoint near the route origin. Hired quotes use local checkpoint overrides. The travel-method pencil opens the same General / Services / Ownership dialog as World presets, with journey-only overrides and a reset action. A separate inline fare editor is no longer needed.
- New checkpoint types include **Town**, **Air Dock**, **Stables**, **Mines**, **Lighthouse**, **Sea Storm**, **Dangerous Reef**, **Whirlpool**, **Pirate Attack**, **Sea Monster**; new bundled pickaxe SVG; improved free RPG icon filters.
- New built-in checkpoint marker sizes are **12 px** for ordinary features and **24 px** for major settlement/port types. Existing saved appearance values are preserved until the GM explicitly changes them.
- Default transport examples include city carriage/cart/wagon/coach, village carts/wagons, stables riding horses/ponies/mules/draft horses, ports sea passage and sailing vessels, docks rowboats/keelboats/ship passage. They are editable planning defaults, not guaranteed historical or RAW prices.

## Important boundaries

1. The preset editor never automatically overwrites already-placed checkpoints. To populate old Scene checkpoints, use the selective **Apply to open Scene…** action. Existing v1–v3 catalogs are projected to the current schema in memory without writing settings until saved; v3 catalogs gain Town without resetting existing customizations.
2. Only explicit local offers make **For hire / passage** available. Selecting transport remains a read-only planning preview until explicit checkpoint boarding/transfer movement is implemented.
3. No currency, hire booking, vehicle purchase, crew enrollment, or Actor changes occur.
4. Sea hazards and pirate/monster categories are *descriptive checkpoint types* in this build; encounter generation is intentionally not automated.
5. Water/Sea are separate offer categories but share Atlas's existing `water` surface in road compatibility checks. Air Dock supplies airship offers, and checkpoint settings include Air Travel.
6. The expanded checkpoint RPG icon picker is still the existing bundled Font Awesome Free catalog plus an Atlas-owned pickaxe SVG. No external icon service or new license is required.
7. Native D&D 5e rest application at prompts and paused journeys is retained for a later **beta.4d**, as agreed in the preceding milestone discussion.

## Live acceptance checklist — Foundry VTT v14, GM and player

1. Open World Checkpoint Presets → Port → Transportation; add/remove a water or sea method, change local capacity/hire fare, save and reopen. Confirm World transportation preset is unchanged.
2. Open a placed Port checkpoint; change an offer independently; save/reopen and confirm Scene flag persists. Repeat with Stables and Mines, including pickaxe display.
3. Use **Apply to open Scene…**, same-type scope, choose *only Transportation*, verify other appearance/discovery fields untouched. Repeat with *Marker size* and check 12px/24px as intended; ensure no movement of nodes or fog history.
4. Place party token near a checkpoint with a hire offer. Navigation Travel by should list offered methods and owned Group resources; moving departure away should remove offers. Reset fare should restore checkpoint estimate, not the World rate.
5. Verify an incompatible land/water route still raises a blocking advisory; ensure Walking guided travel and World Clock/Journey Journal still function.
6. Check both GM and non-GM clients for stable checkpoint icons, roads, hover labels, weather and fog; test switching Scenes and loading legacy World settings.
7. Test no available checkpoint offer: only Walking and owned methods should remain. Transport purchases, bookings and currency changes must not occur.

**Publication:** Stacked draft PR only. Do not merge without explicit owner approval. CI verification and live Foundry testing required.

## Shared transportation editor (beta.4c.5)

- **One interface:** World Transportation Presets, checkpoint offer Edit, and Navigation Travel Method Edit all open the World `General | Services | Ownership` dialog.
- **Separate save scopes:** World changes save the transportation catalog; checkpoint changes save only a *draft* of specific overrides until the parent checkpoint/preset dialog is saved; Navigation changes affect the current journey estimate only.
- **Live inheritance:** A checkpoint's untouched values are read from the latest World preset. Navigation applies optional journey-only values over that checkpoint/World baseline. Only values different from the baseline are stored as overrides.
- **No duplicate form:** Checkpoint cards remain concise (name, quote, pencil, remove), and the pencil opens a separate full-sized dialog.
- **Town migration:** `checkpoint-town` is added to existing pre-v4 catalogs on read, without mutating the stored catalog. After an explicit v4 save, deleting Town remains an intentional choice.
- **UI spacing:** Checkboxes begin directly under their section descriptions; Purchase price uses the same three-column width as Crew wage rather than stretching across half the dialog.

Live acceptance should include changing a World fare while a checkpoint inherits it, overriding that fare locally, and then modifying the journey estimate. Verify the three scopes never overwrite one another.
