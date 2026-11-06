# v0.3.8-beta.7.15.2 — focused voyage recovery hotfix

**Status:** draft, automated verification only. Foundry v14 GM and non-GM
live acceptance is still required. Stack this branch over beta.7.15.1;
back up the World and preserve the existing Journey Journal before testing.

## Scope and confirmed behavior

- After a verified native TokenDocument move reaches its expected endpoint
  **and** its Canvas animation completes, Atlas remembers the image-relative
  recovery coordinate, road ID, segment ID, checkpoint ID (if nearby),
  native Level ID and elevation (when available). It keeps this anchor in
  memory between periodic Journal writes.
- Canvas teardown or interruption now checkpoints the **last verified**
  native position alongside credited progress, without requiring an active
  canvas. The in-flight TokenDocument coordinate cannot become an approved
  anchor just because Foundry updated it ahead of visual movement.
- During an active checkpoint-bound ship/air/mount leg, the Navigation method
  selector is **read-only** and shows the Journal-approved method. Speed and
  travel-time estimates use the saved current leg and schedule, not the
  transient Walking method. The editor cannot create a fresh transport preview
  or booking while that leg is active.
- This update does **not** relax the strict coordinate/road/checkpoint
  mismatch guard, auto-complete incomplete native movement, replay confirmed
  time/rests/fares, change native Scene/Levels/Regions or solve the pending
  measurement-scale presets. No existing Journal is migrated on read.

## Owner GM acceptance — Foundry v14

1. Install this branch's manifest in a **backed-up test World**, refresh GM
   and non-GM clients, verify beta.7.15.2 and no module import/manifest errors.
2. Reproduce Riding Horse → Port Barthos (B) → Continue from Checkpoint →
   Ship passage (hired) → Hearth's Heart Dock (C). Confirm the active selector
   explicitly says **Ship passage (hired)**, is disabled during travel, and
   speed/time agree with the approved Journey Journal (not Walking).
3. While the vessel is between **completed** native movement stretches,
   trigger a Scene/canvas refresh. Verify the Journal's `lastConfirmedAnchor`
   is the latest completed sea-road location and matches the last credited
   percent, not the old port. Let automatic recovery resume from that spot;
   confirm it neither repeats distance nor duplicates World time/rest/fare.
4. Repeat with a refresh **while a native chunk is still in flight**, if
   practical. If the native TokenDocument is already ahead of the last
   confirmed chunk, Atlas must **fail closed**, preserve the Journal, and
   explain why GM intervention is needed; it must not silently credit or
   replay unconfirmed movement. The GM can reconcile the token safely.
5. Pause/Resume on land and water. Reopen the Navigation panel, refresh the
   canvas, and recover a partially completed Journey. Ensure the A/B/C/D
   saved targets and previous approved transport remain intact. Arriving at C
   must stop for a fresh GM checkpoint decision, without rerouting to B or
   booking a second passage automatically.
6. Confirm Journey progress, native token position, saved Journal times,
   World clock, passenger rests, permissions, roads, checkpoints, fog,
   weather, Regions and native Levels. As a non-GM, verify no new authoritative
   action or hidden metadata becomes accessible.

## Known safety boundary

Foundry may commit a TokenDocument's next waypoint before its movement
animation has finished. Atlas can only credit a fully confirmed native chunk;
if teardown happens mid-chunk and the token has materially advanced, automatic
recovery remains blocked intentionally. Never erase or overwrite the Journey
Journal to force a restart. The GM should review and reconcile the position
before requesting a manual recovery. Any further mid-chunk reconciliation
protocol needs a separate explicitly approved design and regression pass.
