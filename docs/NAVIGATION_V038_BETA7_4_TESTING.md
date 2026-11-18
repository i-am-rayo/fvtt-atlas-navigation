# Atlas Navigation — v0.3.8-beta.7.4 GM acceptance checklist

Stacked development branch: `hotfix/v0.3.8-beta.7.4-journey-destination-footer-icons`

## Scope

This hotfix addresses a regression observed in live Paedor testing: Port Barthos was marked as the entire Journey's destination, although the selected Point B was beyond Port Barthos (water travel onward to Hearth's Heart Dock).

- The Journal root destination stays the originally selected Point B.
- Each leg still ends at its actual checkpoint and remains separately confirmed.
- A recovered paused Journey can continue toward the saved Point B without selecting the endpoint again.
- Old Journals whose destination was erroneously saved as the first checkpoint offer explicit onward continuation. The GM must select a new B in that legacy case; the patch cannot infer coordinates never saved in the Journal.
- Once the party occupies its final checkpoint, it may complete the Journey without a duplicate tiny leg; it can also explicitly start a new onward route.
- Navigation footer actions use icons with title tooltips and accessible names; Exit Navigation is removed in favor of the native window X.
- No native token movement, World time, currency, Actor, road, checkpoint, fog, or Scene flag changes occur merely from continuing or choosing a destination.

## Manual Foundry v14 tests

1. **Multi-surface route** — With a party token at South-East Gate, choose Point B beyond Port Barthos (e.g. Hearth's Heart Dock). Confirm the first route preview lists Port Barthos as the *first leg*, plus later water legs.
2. **Save full destination** — Approve only the horse/walking leg to Port Barthos. Confirm the Journal leg ends at Port Barthos, but its root `destination` retains original Point B and title refers to the final destination.
3. **Checkpoint continuation** — At Port Barthos select the arrow icon (tooltip `Continue from checkpoint`). The next leg should calculate from the token to the original Point B; no new map click required. Select ship passage and approve.
4. **Canvas rebuild** — While traveling, trigger a Foundry canvas redraw/Scene reactivation. Recover the saved Journey. Check that the original Point B is still retained and all confirmed legs plus World time remain unchanged.
5. **Legacy paused Journal** — Load a beta.7.3 Journal whose root destination incorrectly equals Port Barthos. The checkpoint shows an arrow icon for Continue. Select it; Atlas must request a *new* onward Point B, not generate a 0.07-mile trip to Port Barthos or delete prior legs.
6. **True final checkpoint** — Arrive at the actual original B. Use the checkered-flag icon (tooltip `Complete Journey`). No new native token movement or World-time advancement; Journal status becomes completed.
7. **Icon-only footer** — Hover, tab and activate all relevant states: New Route, Continue, Stop/replan, Complete, Open Journey Journal, Travel, Pause/Resume, Aboard Rest, End. Check labels in tooltips and screen reader. No Exit Navigation footer button; Foundry title-bar X still closes the app.
8. **Non-GM** — Verify no newly exposed GM navigation actions; unchanged player road/fog behavior.

## Boundaries

- This is not a fix for the underlying native canvas rebuild. Follow [known issue #135](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/135).
- No migration rewrites existing Journal metadata. Existing erroneous checkpoint destinations require an explicit new Point B if the previous full route was not saved.
- No production merge or tag before owner live verification.
