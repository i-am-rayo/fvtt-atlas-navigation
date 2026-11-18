# v0.3.8-beta.7 — GM-confirmed checkpoint travel (test build)

**Status:** Stacked draft on `test/v0.3.8-beta.6.1`. This is a Foundry v14 **test build**. Do not merge until the owner validates it with GM and non-GM clients.

## Implemented boundary

- For **multi-surface routes**, only the *current* selected, compatible leg may move the assigned party token. Atlas requires a real authored arrival checkpoint and refuses unresolved transfers, missing ownership/hire offers, excess party capacity, stale Scene geometry or absent token permission.
- **Travel to [checkpoint]** shows a GM confirmation before anything moves. The confirmation identifies method and arrangement; rates remain estimates only. It never books, buys, deducts currency, marks ownership, changes Actor stats or bypasses Foundry movement rules.
- Confirmed travel reuses the existing v14 `TokenDocument.move()` movement loop, short pauseable chunks, actual token-animation completion, native collision checks, controlled World-time advancement, rest decisions and serialized Journey Journal checkpoints.
- The native route is **clipped to the first transport leg**, ending at its authored checkpoint. Future water/air/land/off-road legs are never part of the native movement request.
- On verified arrival, Atlas saves the current Journal leg as **paused**, retains its history, and offers **Stop and replan** or **Continue from checkpoint**. Neither choice moves the token. Continuing refreshes A from the live placed token and asks for a new method; the next GM-confirmed leg is appended to the same Journey Journal.
- The Journal includes the selected method and appropriately escaped narration only after native movement is confirmed; arrival narration appears only at 100% progress. Old schema-1 records without transportation details remain readable.
- On reopening Navigation, a paused Journal with a confirmed checkpoint arrival can be recovered into the two-choice decision. An unverified token position cannot skip the checkpoint gate.
- Existing land-only Walking guided movement remains supported and does not require this new checkpoint workflow.

## GM acceptance steps

1. On a **copy** of the campaign World, create connected land → water → land roads with authored checkpoint nodes at both transfers. Ensure the Group token has permission to move and a valid mount or checkpoint hire offer.
2. Start with a current land leg ending at a port. Verify **Travel to Port Barthos** is enabled only for a valid selection with sufficient owned seating or a real checkpoint offer.
3. Choose Travel. Cancel the confirmation, and verify **no token movement, Journal creation, Scene/world flag write, Actor modification, currency deduction or World-time change**.
4. Confirm it. Verify only the route to the port is moved via short native token stretches, Foundry animations finish before later chunks, and the route **does not advance onto the water road**.
5. After arrival, verify the token is at the port, the Journey Journal has a confirmed 100% leg, and two buttons appear: **Stop and replan** / **Continue from checkpoint**. Verify onward travel is disabled until a choice is made.
6. Choose Continue. Confirm the next method selector is based on the token's new checkpoint location and lists only actually available resources/services. Approve a hired water vessel if native token movement permits it. If native movement rejects the route, Atlas should stop safely; it must not teleport or override collision/movement restrictions.
7. On arrival at the second dock, verify the same decision gate. Choose Stop and replan: the Journal must be marked ended, with all earlier confirmed legs and approved World time intact.
8. Repeat and close/reload Navigation **at the checkpoint**. Recover the paused Journey and verify the two-choice gate returns without moving the token.
9. Test an invalid transfer (no checkpoint), stale road revision, moved party token during confirmation, undersized mount and missing hire offer. All must fail closed before movement.
10. Test a normal land-only walking journey and a land-only route ending off-road. They must still run through the existing guided engine and not require a transfer checkpoint.
11. With two clients, observe fog, weather, checkpoint visibility, road rendering, World time, Journey Journal writes, and canvas-rebuild recovery. World CLI helper notifications are external to this module unless stack traces implicate Atlas.

## Known limitations and next stabilization work

- Water/air/vehicle travel uses Foundry's **native token movement**. A Game System or Region Behavior that forbids a move may block it; this beta never fabricates movement modes or bypasses those rules.
- Only a route with a clearly authored **surface transition and arrival checkpoint** uses transport-assisted guided travel. Single-surface vehicle/ship journeys still use planning estimates; expanding support requires another explicit compatibility gate.
- The current method and pricing are confirmations and estimated costs, **not economic transactions**. Crew, overtime, continuous operation, party inventory and payment remain GM-managed.
- A Scene switch or canvas interruption mid-leg uses the existing recoverable-Journal lifecycle. Resume only after validating the token and saved route in the live test World.
- This release is for movement correctness. The navigation and Journal visual redesign should follow completed journey stabilization.
