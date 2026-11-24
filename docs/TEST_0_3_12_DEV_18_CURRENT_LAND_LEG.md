# Atlas dev.18 — mixed transportation current land leg

Baseline: Product Owner accepted dev.17 on 2026-11-22. A2/B1/C remain authoritative. This draft enables the existing named traveler deck for the current land leg of a multi-surface journey; water/air mixed methods are still deferred.

## Foundry v14 GM acceptance
1. From Hearth's Heart select Dirwest (land → water → land). Current leg shows the method cards and traveler assignments. Future legs are previews only. Select Walking, Warhorse, Riding Horse and Cart when available, drag/keyboard assign the travelers, change hire units and pace. Confirm only the distance/time/fare for Hearth's Heart → Hearth's Heart Dock. Compare itemized rounded cost with confirmation and Journal.
2. Cancel confirmation, and attempt invalid capacity/stock or a subset. No native Token, Actor, currency, World time or Journal changes. Change eligible resources/route while confirmation is open: reject stale approval.
3. Approve a valid mixed leg. Native movement stops at the dock; Journal retains the original Dirwest destination, confirmed participant names, costs, time and actual checkpoint. No implicit booking, boarding, charge or onward movement.
4. Before arrival, pause/reload/canvas refresh: approved manifest, pace, checkpoint and confirmed position remain authoritative. If native movement is ahead of the confirmed anchor, keep the existing recovery guard; never manually bypass it. Confirm no duplicate time/movement or new fare. At the dock Continue: the water leg remains the existing single-method selector. Confirm water→land continuation; when eligible previous land assignments exist for the immediately preceding leg, retain them only as a draft and revalidate available methods, roster and stock. Later land leg should expose cards; ultimate destination remains unchanged.
5. Verify intermediate land checkpoint does not complete the full Journey. Confirm the final destination correctly; test ordinary single-land dev.17 journeys and legacy saved transport/convoy records.
6. Test as a non-GM: no GM-only planner/confirmation, hidden-route data or movement authorization. No changes to Fog, Regions, weather, Actor membership, Scene graph or system data.

Do not downgrade a Journey containing the new mixed checkpoint-bound transport metadata to a pre-dev.18 reader. Backup the World before using development builds.

## Scope deliberately deferred
Mixed water/sea/air transportation; native-anchor reconciliation beyond the existing guard; broader checkpoint workflow or fare policy changes. No main merge or final release without owner approval.
