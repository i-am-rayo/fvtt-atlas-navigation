# v0.3.8-beta.7.11.1 — Approved transport recovery hotfix

Focused follow-up to beta.7.11's **owner-observed Canvas-redraw interruption**.
The Journal preserved the 8h Riding Horse movement and 8h Long Rest, but the
new Navigation instance recalculated the remaining leg as Walking before
checking it against the saved approved checkpoint. This build restores the
Journal-owned method before rerouting. The same fail-closed checkpoint guard
remains; its errors now identify the failed route/transfer condition.

## GM + non-GM acceptance — Foundry VTT v14

1. Back up the World. Install this branch's test manifest, confirm
   `0.3.8-beta.7.11.1`, and reload both GM and non-GM clients.
2. Start at Hearth's Heart with the assigned party explorer. Select a
   **Riding Horse** and a route to South-East Gate via Hearth's Heart Dock.
   Confirm movement and proceed to the 8-hour limit; approve a **Long Rest**.
3. Cause a normal Canvas refresh/rebuild while this checkpoint-bound leg is
   unfinished (including immediately after the approved rest). Atlas may
   interrupt and save the Journey. When Canvas is ready, it should prepare
   or automatically resume the **same approved Riding Horse leg**. Check
   the selected method, speed, next checkpoint, and remaining route. It must
   not silently use Walking or prompt for a new hire/fare.
4. Confirm the Journal retains the original ultimate Point B, the approved
   intermediate checkpoint, the prior 8h movement and 8h Long Rest, and
   **exactly one** World-time advancement for each approved event. Continue
   to the checkpoint, then onward with a fresh GM choice. No duplicate rest,
   fare, movement or Journal event may appear.
5. Repeat the interruption during a hired ship passage with a passenger
   rest in progress, and during a plain overland journey. Verify selected
   transportation, rest duration, original destination, and no extra booking.
6. Negative safety check: if an approved road, arrival checkpoint, surface
   or configured travel method genuinely changed, Atlas must **stop** with
   an actionable reason and retain the recoverable Journal, not substitute
   a different route or force movement.
7. On the non-GM client, verify native token position, Journey visibility,
   roads, checkpoint visibility, fog, native Regions, weather and permissions
   remain consistent. Test a second refresh and a manual Stop → Resume.

## Automated coverage and scope

- Pure saved transport validation for interrupted checkpoint legs and method
  retirement/kind mismatch.
- Controller regression for Walking-vs-Riding-Horse route calculation and
  the saved checkpoint, original Point B, elapsed moving/rest hours and fare.
- Explicit checkpoint/surface guard failure reasons without loosening guards.
- Full repository checks, architecture import graph, syntax and diff checks.

This hotfix does **not** suppress native Canvas rebuilding, auto-rest Actors,
change the Journey schema, alter GM permissions or introduce new transport
features. beta.7.12 and R-01 remain separate until live acceptance.
