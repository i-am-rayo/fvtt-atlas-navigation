# beta.7.16.3.2 — GM-approved checkpoint-hired land travel

**Status:** Focused draft hotfix, stacked on beta.7.16.3.1 (draft PR #177). Automated verification is not Foundry v14 acceptance. Do not merge to stable until the Product Owner approves.

**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/hotfix/v0.3.8-beta.7.16.3.2-hired-land-service/module.json

**Branch ZIP:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/hotfix/v0.3.8-beta.7.16.3.2-hired-land-service.zip

## Observed issue and bounded change

At **Port Barthos**, the GM selected a **Cart** explicitly offered there. The road toward **South-East Gate** was land-compatible, the method and estimated hire cost displayed correctly, but the Journey's **Travel Route** button was disabled by a blanket rule: `Hired land services require an approved checkpoint leg for native movement.` The route completed using a party-owned Riding Horse instead. The console contained a separate Foundry minimum-window-size warning; it did not explain this policy rejection.

The new rule permits a GM-approved, hired, land-only terminal route from a checkpoint that **actually offers that method**. It requires the assigned token as Point A, existing Atlas road compatibility, and the existing GM confirmation dialog. After the dialog, Atlas verifies that the offer and effective terms have not changed before the first Journey Journal/native movement operation. A pause/reload preserves the already approved Cart arrangement and speed even when the token is no longer near the hiring checkpoint. This does not authorize a second booking or a method substitution.

No payments, reservations, extra draft animals, Actor resource edits, bypass of native movement, or unapproved water/air segments are introduced. The old Walking/party-owned path and multi-surface checkpoint transitions remain separate. Existing Journey schema v1 captures method ID, name, hired/owned arrangement and operation; no migration or write-on-read.

## Foundry v14 GM and non-GM acceptance checklist

1. Back up the test World, install `0.3.8-beta.7.16.3.2`, use a GM with the assigned party token, and keep a non-GM observer connected. Open a route from **Port Barthos** along land-only `Dirwest-Port Barthos` toward **South-East Gate**, with Cart offered in Port Barthos Checkpoint Transportation.
2. Select **Cart** under **Port Barthos**. Confirm the **Travel Route** button is enabled, the cost is an estimate only, and starting the leg shows a **GM confirmation** naming a **hired** Cart. Cancel once to ensure no Journal, native movement or World-time change; then approve and complete it.
3. The party token must follow native curved road movement smoothly and stop at the correct Point B. The Journal must say **Cart (hired)**, not Riding Horse/Walking or party-owned. World time should advance only for confirmed movement if the module setting is enabled. Neither Actor funds, Group mounts, nor checkpoint offers should change automatically.
4. Repeat and pause or involuntarily redraw the Canvas during the hired Cart leg. After safe recovery, the **approved hired Cart** and its saved speed must remain selected even though the party token is outside Port Barthos's offer radius. The current leg must not demand a new booking or revert to the Group Riding Horse. A pending native intent, changed Scene/road revision/TokenDocument anchor, or failed time/Journal write still stops safely.
5. Remove the Cart offer or change its hire terms **before approval**. The method should become ineligible at departure, or a change during the confirmation dialog should block travel without starting a new Journal or moving the token. A non-GM must not initiate travel or edit/checkpoint-book a service.
6. Confirm a Cart is not eligible on a water/air road or from a distant checkpoint that does not offer it. Verify existing Ship Passage boarding/disembarking, the checkpoint decision, owned Riding Horse, Walking, fog, native Regions/Behaviors, weather, and completed-Journey cleanup are unaffected.

**Stop and retain logs** if there is any unapproved movement, duplicate World time, unexpected paid fare, wrong Journal arrangement, or unsafe recovered position. This hotfix does not redesign the Journey Journal UI; underway-rest display remains deferred.
