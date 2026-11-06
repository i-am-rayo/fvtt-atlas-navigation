# v0.3.8-beta.7.15 — A/B/C recovery metadata and native Level setup

**Status: automated verification only; Foundry v14 GM/non-GM acceptance pending.**
Build stacked on owner-tested beta.7.14; keep its PR in draft. This build is a
safe foundation, not a migration of existing journeys or a replacement for
native Foundry elevation, Regions, or Levels.

## Data ownership and invariants

- New Journey Journals persist ordered, Scene-local **A/B/C… coordinate
  targets** from the approved original route, including transfer checkpoint ID,
  Atlas road ID and segment ID. Final Point B remains separate from each
  checkpoint-bound leg. An approved transport method remains on each confirmed
  Journey leg and is also associated with a reached target when applicable.
- Progress checkpoints store the confirmed **TokenDocument** center translated
  into image-local coordinates, plus the nearest authored road/segment and
  checkpoint IDs and an optional native token Level/elevation snapshot.
  Rendered animation coordinates are not authoritative.
- On a canvas refresh/recovery, Atlas accepts small coordinate drift or a
  nearby position on the recorded authored road/checkpoint. Distant/off-road
  disagreement stops without moving, charging, resting, or advancing time.
- After a confirmed checkpoint, Continue selects the next saved A/B/C target.
  It must not replace the original Journey destination or silently replay the
  checkpoint. Altering the saved route requires explicit Stop and Replan.
- Older schema-1 Journals without these optional fields continue to load using
  the existing recovery behavior. **No write-on-read migration occurs.**
- A new GM-only World setting, **Atlas — Enable Native Scene Level Setup**,
  is disabled by default. When enabled, the Scene's Atlas tab offers a read-only
  preview of Surface, Aerial, Underwater and Underground native Level proposals.
  The GM must supply elevations in **Scene native Grid units** and explicitly
  confirm creation. Atlas creates only selected *missing, non-overlapping*
  native Level documents with `Scene.createEmbeddedDocuments("Level", ...)`.
  Existing Levels, Regions, native elevations, checkpoint `elevationMeters`,
  Tokens, roads and fog are unchanged. No automatic surface-to-Level mapping
  or slopes are implemented in this foundation.

## Required Foundry v14 acceptance

1. **Back up the World**, install using the beta.7.15 branch manifest, reload
   both GM and player clients; verify version and no console errors.
2. By default, confirm native Level setup is hidden. Enable the World setting
   as GM; open Scene Configuration → Atlas. Enter elevation bands for Surface,
   Aerial, Underwater, Underground. Preview each; cancel creation, verify the
   Scene has *no additional Levels*. Re-preview, confirm creation; verify each
   level exists in Foundry's own Levels tab with correct boundaries.
3. Retry an identical name, overlapping ranges, invalid/blank elevations and
   check the refusal leaves all existing Levels unchanged. Verify that Scene
   Regions, road geometry, fog/weather and token native elevation stay the same.
4. On a fresh **land → port → ship → dock → land** journey, inspect the
   Journal's `guidedJourney.routeTargets`: A, B, C, etc., actual coordinates,
   stable road/segment/checkpoint IDs, and the original destination. Do not
   edit the Journal flags.
5. Stop at each checkpoint. Confirm only its approved travel method persists
   and Continue selects the next saved target, preserving the original final B.
   At Port Barthos specifically, attempt the previously blocked final leg.
   **Report whether it still tries to route to Port Barthos again.**
6. Refresh the canvas during partial land or vessel travel. Recover and resume
   from the native token's *current* position without replaying fare, movement,
   rest or World time. Slight token-placement drift should recover; an
   intentionally distant off-road move should refuse with a diagnostic and
   leave its Journal intact.
7. Complete a journey, verify total World time equals confirmed moving plus
   approved downtime, Journal status is Completed, and Play is absent.
   Repeat with Walking, owned mount and hired ship.
8. Repeat relevant views as **non-GM**: no Atlas authoring or Level creation
   controls, no hidden metadata or gameplay writes. Verify native Scene
   effects, manual Regions, fog and weather retain their behavior.

If the Port Barthos loop remains, keep beta.7.15 in draft and inspect the
actual B/C coordinates and solver's road projections in the log. Do not
work around repeated-checkpoint protection by silently skipping it.

## Automated checks

- New pure tests: native Level proposal/validation and A/B/C planning,
  Journal persistence, checkpoint advancement, token drift/road fallback.
- New DOM tests: preview has no side effects; native document creation is
  GM-gated and requires explicit confirmation.
- Existing controller, World settings, transport, Native Levels graph and
  Journey Journal tests; full `npm run check` and `npm run architecture:check`.
