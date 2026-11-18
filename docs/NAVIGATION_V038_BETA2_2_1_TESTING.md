# Atlas v0.3.8-beta.2.2.1 — Mount discovery and native coin presentation

Stacked draft on v0.3.8-beta.2.2. **Do not merge** until GM and non-GM Foundry v14 acceptance.

## What changed

- The D&D 5e Group transportation resource editor now appears **before** the long Land/Water/Air preset lists.
- Navigation seat-deficit / unclassified-NPC advisories expose **Review mounts & NPC roles** and **Refresh seats**.
- Camel NPC role and number available remain explicit Atlas World-level assignments; one Group NPC Actor may represent multiple physical mounts.
- Hired passenger fares and matching Group method recurring-cost estimates show a D&D 5e high-denomination breakdown using available `CONFIG.DND5E.currencies` and its conversion ratios.
- Non-integral CP estimates are rounded **up** to whole available coins only for the displayed payable estimate. Exact computed CP is also shown.
- No Actor or Group inventory, currency, roster, token, or World clock is changed by these previews.

## Owner test (GM)

1. Set up a Group Actor with three character members and two Camel NPC Actors, plus a Warship.
2. On a planned Camel route, confirm that the seat warning identifies the shortage and shows **Review mounts & NPC roles**.
3. Click that button. Verify the new Transportation Presets window opens in **Transportation** with **Group transportation resources** near the top, before **Land travel**.
4. For **each Camel** select `Role: Mount`, `Number available: 1` and `Riders per unit: 1`, with Land surface. **Save Group transportation assignments**.
5. Return to Navigation and click **Refresh seats**. With three travelers and two mounts, expected: **2 land seats, 1 additional needed**, and **no NPC roles needing review**.
6. Set either Camel's `Number available` to 2 and save. Refresh. Expected: **3 land seats**, no shortage. Check the native Group roster was not modified.
7. Switch to Warship. The existing **60 water seats** should remain unaffected. A Warship on a land route remains a distance/time preview, not guidable.
8. Select **Ship passage (hired)**. For the previously observed `1,335.88 CP` quote, expect **1 PP · 3 GP · 3 SP · 6 CP**, plus exact `1,335.88 CP` and note that the displayed whole-coin amount is rounded up to `1,336 CP`.
9. Confirm **no currency is deducted**, no money moves between character/Group inventories, and guided non-walking travel remains unavailable.

## Non-GM / regression checks

- Non-GM clients cannot edit Atlas World transportation assignments; Group World setting values may nevertheless be synchronized by Foundry, so **do not put GM secrets in them**.
- Check the selected-party token, road rendering, checkpoints, Atlas fog, weather, World clock, walking navigation, and existing saved preset overrides.
- Reopen Transportation Presets after saving; both Camel role assignments and quantities should persist. Changing the native Group roster should only affect live read-only projection, not mutate the Group.

## Important distinction

D&D 5e's native **Convert All Currency** changes an Actor/Item's carried currency. Atlas **does not call it** for a fare quote. Atlas uses the system's denomination conversion data and computes an independent display-only breakdown to preserve the current planning-only behavior.
