# 0.3.12-dev.26.1 — mixed transportation editor & continuous land Map Marker hotfix

## Scope

Two confirmed live regressions in dev.26:
1. The mixed-party transportation cards suppressed the editor when several methods were checked. Selected non-Walking cards now expose their own accessible Edit pencil, separate from the checkbox, and open the existing native-style transportation dialog. Journey-only edits stage a key-specific `arrangement|methodId` override for calculations; Save to Map Marker goes through the existing GM-only checked Scene writer. No World/Actor, fare, time, token or Journal write occurs on editor open, Cancel or preview. A replan clears stale trip-only quote drafts.
2. `validateCheckpointTransportOffers` rejected `continuousEnabled` for every land offer even though dev.26 allowed it on vehicles in the World catalog and journey rules. That obsolete surface restriction is removed; `checkpointOfferMethod` retains the **vehicle-kind and matched-surface** guards. A rotating-driver carriage can now be configured as continuous at a land Map Marker.

**Not changed:** A mixed convoy containing walkers or other standard-duty travelers still uses its Group-wide approved normal operating schedule. Enabling a single carriage's continuous *capability* does not convert the whole mixed convoy to 24-hour operation or grant passenger rests. Eligible single-vehicle legs use the dev.26 operation selector. Pricing, capacity, route/TokenDocument authority, GM approvals, legacy Journals and recovery rules are unchanged.

## Automated gates

- `node --test`: regression cases for land carriage saved Map Marker, mount rejection, GM-only persistence, individually addressed mixed editor, independent checkbox, editable method key, no World/Map Marker mutation on preview, non-GM denial and shared dialog launch
- `npm run check`; `npm run architecture:check`; syntax; test manifest and package both `0.3.12-dev.26.1`
- GitHub diff reviewed for unrelated changes and added-line whitespace; `git diff --check` locally if a checkout is available
- CI success does not equal GM live acceptance or integration

## GM Foundry v14 acceptance

1. Load the hotfix test manifest and refresh the client. Select Walking + Carriage from a land Map Marker with a carriage offer. Observe a pencil **inside the selected Carriage tile**, not in the Walking tile. Confirm keyboard focus and screen-reader label.
2. Click Carriage pencil. Confirm existing **Edit Carriage** with **Save for this trip** and **Save to Dirwest/Map Marker**. Cancel; verify assignments, cost, World and Scene flags unchanged.
3. Change Carriage fare, speed or continuous *capability* and choose **Save for this trip**. Verify the correct Carriage method's moving-time/fare estimate changes where applicable; no changes to Walking, another method, or Map Marker flags. Repeat with Wagon; each draft is independent. Remove one method and confirm only its draft is discarded.
4. Reopen and choose **Save to Map Marker** after enabling **Allow continuous travel** on Carriage. Verify no water/air-only error. Close/reopen Dirwest Map Marker and verify carriage continuous capability is retained; World carriage defaults remain unchanged. Mounts must still reject continuous operation.
5. Replan from a different departure Map Marker: prior trip-local carriage override must not silently apply to the new offer. Reopen and verify new local values.
6. Verify a pure eligible carriage checkpoint leg can select Standard, Overtime (if enabled), or Continuous; verify the expected schedule, GM confirmation, non-duplicated fare, World time and Journey history.
7. Verify mixed Walking+Carriage does **not** claim the entire party travels continuously when only the carriage is configured to run continuously.
8. Non-GM: no edit access, no Map Marker/World writes and no movement/Journal changes; test permission checks after dialog has opened. Confirm Canvas redraw recovery and previous Journey remain unaffected.

## Separate Foundry warning

The supplied second screenshot reports a 913 × 1061 effective viewport. Foundry 14 warns at widths under 1024 CSS pixels; enlarging the browser or reducing browser zoom resolves that independent environment warning. It is not the Atlas continuous-transport error.

**Status:** Draft hotfix, stacked on dev.26 PR #487. No merge, tag or release without explicit PO acceptance.
