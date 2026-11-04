# v0.3.8-beta.6.1 — Current-leg decisions and scoped transport edits

Status: stacked draft hotfix based on `test/v0.3.8-beta.6`.
Target: Foundry VTT v14, D&D 5e. **Do not merge without GM approval.**

## What changes

- On routes crossing different surfaces, Navigation hides the global Travel method
  selector. A single **Current journey leg** contains the usable selector instead.
  Normal single-mode Navigation retains its familiar global selector.
- Current-leg choices reuse the grouped optgroup layout from single-method Navigation:
  **Party** (walking and owned mounts/vehicles), followed by actual nearby checkpoint
  names such as **Port Barthos** (locally offered hire/passage). Unavailable methods
  never appear simply because they are defined in the World catalog.
- The final off-road attachment after a road or sea lane is split out as an
  **Unclassified** leg; it cannot inherit the ship's speed or fare. All genuinely
  available transport types appear for that unclassified leg when it becomes current.
  A transition from sea to unclassified terrain without an authored landing checkpoint
  remains blocked; Atlas does not invent an arrival or disembarkation.
- The pencil for a selected non-walking current-leg method opens the **same**
  General / Services / Ownership editor as the World and checkpoint presets.
  The dialog scrolls inside a bounded window, keeping its action buttons in view.
  **Save for this trip** adjusts only this temporary Navigation estimate.
  For a locally hired offer, **Save to <checkpoint>** updates that Scene's checkpoint
  offer, subject to GM permissions and stale-source checks. Neither action
  charges currency or edits the Group Actor or World preset.
- Instead of soliciting plans for every future mode immediately, Navigation shows
  only the current decision and estimate. A collapsed GM preview names possible
  later legs without committing transport, hiring, payment or route movement.
  Directions and summary cards describe only the current stretch to the next
  decision checkpoint. Refresh the assigned party token when it arrives and
  reconsider where to go and how to travel.

## Foundry v14 GM acceptance checks

1. At a route with **land → water → off-road**, verify the only actionable
   selector is for the first land leg. No separate global Travel method appears.
2. Open the selector and verify group headings (e.g. Party, Port Barthos) and
   that walking, owned mounts and hired cart appear only where available.
3. Open the pencil on a hired current-leg method. Verify all three tabs, native
   five-coin fields and **both visible Save buttons**. Change the fare and
   choose **Save for this trip**; the estimate must change, while reopening
   the checkpoint editor shows its original local fare.
4. Reopen, edit and choose **Save to Port Barthos**. Verify the checkpoint's
   local override changes, the World preset and Group Actor do not, and the
   route reflects the updated price. Reopen with another GM or changed
   checkpoint data before saving: stale edits must be refused.
5. Verify the collapsed GM preview includes a distinct unclassified segment
   after the water leg, not part of the ship fare. At the real landing, refresh
   the party token, select its next destination, and verify the newly current
   unclassified stretch has broad **available** transport choices.
6. Remove the landing checkpoint in a test copy; the planner must warn that a
   surface transition is unsupported. A boat must never continue across
   unclassified terrain automatically.
7. Confirm only the current-leg distance/time and directions show in the
   primary cards; later legs must not contribute a misleading fixed trip total.
8. Confirm ordinary single-mode Navigation, travel pauses, Journal records,
   gridless/hex/square scenes, persistent Atlas fog and weather still behave
   as before. Check with both GM and non-GM clients.

## Next milestone: v0.3.8-beta.7

Guided travel will need an explicit, persisted **checkpoint arrival state**
before offering **Stop and replan** or **Choose transport and continue**.
At arrival, verify the assigned token position, accessible authored checkpoint,
surface compatibility and GM confirmation; never book, board, deduct currency,
teleport or advance time simply because a future leg is visible. The previous
confirmed leg and Journal record must remain intact when the party changes plans.

This beta.6.1 hotfix is a **safe planning UI**, not that runtime transition
engine. Only a GM preview of future terrain/methods is available.
