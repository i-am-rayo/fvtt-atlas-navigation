# 0.3.12-dev.27 — Current-leg traveler roster parity (B1 first slice)

**Status:** Implemented on stacked draft PR #491 based on PO-accepted (not yet integrated) PR #490. Awaiting PO GM/non-GM Foundry v14 live verification. Not merged, tagged, or released.

## Background / user report

The GM completed a land → hired-ship → land Journey with confirmed native movement, World clock, and auto-recovery. The current water-leg cards showed the selected **Ship passage (hired)** but not the Group traveler-selection deck used on land. The GM also wants prior-leg riding horses and a warhorse offered as explicit board/leave decisions. Animal boarding, verified accommodation/cargo capacity and livestock-specific fares are part of **dev.28**, not this first B1 slice, and are tracked under Issue #468.

## Scope implemented

- **Current** water and air checkpoint legs with a selected transportation method show the existing accessible traveler deck, including a **Traveling** column and separate **Not traveling** column (even when only one method is available). Supports pointer drag/drop and keyboard-accessible Move menus, with labels tied to stable Actor IDs.
- The current-leg D&D5e Group selection drives preview *passenger-seat demand and per-person fare counts*. Subsequent legs retain the complete roster for read-only forecasts; nothing commits a future-leg booking or change.
- Excluding one or more Group members is a **preview only**, clearly labeled. The native Group explorer still represents the full Group; Atlas **rejects approval** until a separate Group/explorer representing the participating party is assigned. This avoids claiming one Token can move a split party.
- The check is repeated after the GM approval dialog and before a Journey/Token write, closing the async stale-selection race.
- No silent change to Actor/Group, World catalog, Scene/Region, Token document, World time, currency, hire inventory or historical Journey Journal. No new dependencies.

## GM Foundry test checklist

1. Continue an already completed land leg at an authored port onto a water leg. Choose **Ship passage (hired)**. Confirm travel-method tiles and pencil remain.
2. Confirm **Who goes where?** now shows all Group PCs/NPCs under Ship passage plus the separate **Not traveling** drop column. Move a PC by drag/drop; another by the keyboard Move control; move them back. The on-screen roster updates without writing Actor/Group/Journal.
3. With a passenger-based hired trip fare, confirm that a removed PC decreases the **provisional passenger count and quote**; restoring that PC restores the original estimate. The selected group is not automatically booked or charged. Standard capacity checks still apply.
4. While a member is **Not traveling**, verify the subset warning and confirm Atlas **cannot** start travel with the complete Group token. No position, World time, fare, or Journal state changes.
5. Open the GM confirmation dialog with a complete Group, then change the draft roster before accepting: Atlas rejects the stale proposal before creating the Journal or moving the token.
6. With the **complete** Group selected, explicitly confirm travel and check that the previously accepted checkpoint/native-movement and continuous-travel recovery paths still work.
7. Repeat at an **air** checkpoint with a valid air method. Future legs remain read-only; do not auto-approve or silently transfer the choices to later legs.
8. Repeat as **non-GM**: no GM-only authoring, approval, or Group/Scene/Journal writes become accessible. Verify the same approved prior Journey can be read only where Foundry permissions allow.
9. **Mount limitation (dev.28):** Warhorse and Riding Horse transport resources are not yet represented in the vessel boarding deck. No livestock fare/capacity or leave-behind behavior is inferred from human seat counts. Test only humans/NPCs for dev.27.

## Automated test evidence

- RED workflow [#781](https://github.com/i-am-rayo/fvtt-atlas-navigation/actions/runs/45118561540) for missing one-method split deck.
- RED workflow [#782](https://github.com/i-am-rayo/fvtt-atlas-navigation/actions/runs/45118671500) for absent water route selection.
- RED workflow [#787](https://github.com/i-am-rayo/fvtt-atlas-navigation/actions/runs/45119110233) reproduced a selection mutation **after** GM confirmation.
- GREEN workflow [#788](https://github.com/i-am-rayo/fvtt-atlas-navigation/actions/runs/45119198057): 1,263 Node tests passed, zero failed; architecture checks passed. Final version/manifest head should be verified once documentation is committed.

### Follow-up

**dev.28 (tracked by Issue #468):** stable Group Actor mount ID/quantity carryover from approved land leg to water/air; explicit board/leave decision per physical unit, verified livestock berth/stall/cargo capacity, different configured livestock hire rates when present, default one passenger-equivalent fare per embarked horse otherwise, independently rounded per-method estimate and immutable approved transfer snapshot. Must fail closed when accommodation cannot be verified.
