# v0.3.8-beta.7.11.2 — Checkpoint continuation and recovery controls

Follow-up to the owner-observed beta.7.11.1 successful Canvas recovery and
subsequent **Port Barthos** checkpoint decision blockage. An approved ship
leg reached the port and was correctly saved as Paused; its saved Point B
could then produce a 0.05-mi route back to the already reached checkpoint.
This build retains the duplicate-arrival safety check, but removes the
transient duplicate preview when choosing Continue and allows the GM to
reopen the saved checkpoint decision from the Journal.

## Foundry v14 GM + non-GM acceptance

1. Back up the World. Install this branch's test manifest; verify
   `0.3.8-beta.7.11.2`. Reload both GM and player clients.
2. Start at Hearth's Heart with Riding Horse, travel to Hearth's Heart Dock,
   and explicitly book hired ship passage toward Port Barthos. Refresh the
   Canvas during the horse leg and during the ship leg, including after an
   approved Long Rest or Long Rest Aboard. Atlas should recover the same
   saved transport and complete each unfinished leg without new bookings.
3. On confirmed arrival at Port Barthos, the Journey should be **Paused**
   with a checkpoint decision. Verify Stop and replan, Continue, and Complete
   Journey (when Port Barthos is truly the selected Point B) actions as
   appropriate. None of those actions should move the token just by opening
   the menu.
4. If Continue still targets Port Barthos through a tiny duplicate water
   route, it should request a **new onward Point B** instead of displaying
   an unusable second voyage. The old World-time and Journal history must
   remain intact. Click a different destination and choose an appropriate
   available method at the new departure checkpoint.
5. If the GM manually selects the already completed arrival port again,
   Atlas must **still block** duplicate water/air booking. Use the new
   **Review checkpoint choices** control (also available during a pending
   onward preview) to reopen the existing saved port decision. Do not create
   another Journal leg or fare while reviewing.
6. Confirm a genuine onward **land** leg after disembarkation is still
   available (Walking or approved mounted travel) and that a genuinely
   distinct onward **water/air** checkpoint requires a new GM approval.
7. Verify the Journey Journal records each approved leg only once; World
   time, passenger rests, previous fares, original destination, fog,
   native Region/road appearance, and player permissions remain correct.

## Architecture boundaries

- Saved Journey Journal and TokenDocument position remain authoritative.
- The method-selection recovery contract is generic for Walking, mounts,
  hired or owned ships/vehicles and configured air travel methods.
- A fully arrived checkpoint **does not automatically continue** to the
  next leg: changing mode, fare and destination requires a GM decision.
- No persisted schema, actor resource, Canvas teardown, booking or native
  Region Behavior changes. No weakening of the repeated checkpoint guard.
- Test automation covers the blocked duplicate preview, reopening a saved
  checkpoint decision, accessible GM footer action, and all method surfaces.

beta.7.12 and the R-01 native Canvas lifecycle investigation remain separate.
