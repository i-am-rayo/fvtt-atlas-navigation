# Atlas 0.3.13-dev.9 — Map Marker transportation offer clarity

## Scope and authority

Milestone 01, #517. PO accepted dev.8 (e3f9a637c6476df302476a5244bce5be96fe3a6b). Dev.9 starts from that exact tested commit. Existing Map Marker hire rates, stock, linked World preset IDs, local override delta, pricing/rounding, mount fare policy and save handlers remain unchanged. No native Actor/Group/Region mutations, fare deductions, bookings, approvals or journey execution changes.

## GM Foundry v14 acceptance

1. Open Port Barthos or another Map Marker offering Sailing Ship and Ship passage. Transportation cards lead with effective hire rate and explicit frequency (trip, travel day, mile/km) and charging unit (passenger, mount or vehicle). Verify finite stock, unlimited stock, and zero stock. A non-hired method must not imply availability.
2. Check passenger seats per unit, animal spaces (including 0 prohibited, unlimited and positive values), global mount fare policy or explicit local/World rate, speed, required crew and operating schedules. Verify source labels distinguish inherited World values, local overrides, and marker availability defaults. Check both metric and imperial rate and speed presentation. The card is a reference rate, not a rounded trip charge.
3. Add Cart from the A–Z Land picker. The inherited offer is staged, not automatically opened for customization or saved. Check the unsaved draft status.
4. Explicitly Edit the Cart offer. Hire & availability opens first with fare and charging basis, then availability, passenger capacity, animal accommodation where relevant, crew and operating schedule. General and Ownership stay available. Check keyboard tabs and responsive native theme/zoom. Edit controls do not write World presets or reserve stock.
5. Edit a rate or finite quantity and click Apply to Map Marker draft. Confirm the card updates and indicates local overrides; close/cancel the parent, discard, reopen: saved offer remains unchanged. Repeat and explicitly Save Map Marker; reopen and confirm only intended overrides persist. Use Clear Map Marker overrides to restore World inheritance, then Save. Verify an untouched inherited value follows subsequent World preset edits.
6. In World Map Marker preset settings, stage an offer only. Its status identifies Save preset, its child applies to Map Marker preset draft, and closing prompts for the unsaved draft. Confirm Cancel/Save paths and existing Map Markers remain unchanged unless deliberately bulk-applied.
7. For missing presets, the card shows an unavailable warning and disables Edit; the stored offer remains inspectable/removable. Do not create a replacement automatically. Verify stale World edits are rejected on Apply.
8. Check dev.7/8 Party role and transport regression; Journey per-leg adjustment and existing active approvals remain unchanged. No fare, time, Token, Journal, native Group or Actor write happens from previews. Independent non-GM must not be able to author transportation offers.
9. Recheck Map Marker settings at 200% zoom, long names, small viewport and light/dark themes. Native runtime visual checks are PO acceptance gates.

## Candidate

- Manifest: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feat/0.3.13-dev9-marker-offer-ux/module.json
- Archive: https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/feat/0.3.13-dev9-marker-offer-ux.zip
- Draft PR #531 targets the immutable accepted dev.8 branch for incremental review pending separate integration authorization.
- Dev.10 Workspace polish is the next stack. Full Journey UX #513 and Territory feature work are out of scope.

CI and a verified manifest are not a replacement for Foundry live acceptance. No main merge, tag or release is authorized.
