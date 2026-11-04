# v0.3.8-beta.7.2 — Continuous transport and recovered voyages

**Testing target:** Foundry VTT v14, D&D 5e. This is a stacked, draft test build; it does not merge or alter existing World records on installation.

## Changes

- A hired or party-owned water/air vehicle with **Continuous travel** enabled in the current leg method uses an uninterrupted operating schedule. The 8-hour player travel cap and 16-hour overnight downtime do not force a vessel to stop. Ordinary land travel retains daily limits.
- The GM may select **Short Rest Aboard** or **Long Rest Aboard** while the vessel is moving, if the route has enough remaining hours. Completion is recorded only after the party token has completed sufficient native movement. Passengers can rest while the vessel moves. No Actor rest effects or currency charges are automated; World time is advanced once for confirmed movement only.
- Recovered interrupted water voyages retain the original approved method, operating schedule (when saved), final checkpoint, and original fare in Journal history. The continuation leg has a zero additional booking estimate and is locked to the saved method. Atlas refuses to continue if its live route no longer ends at the approved checkpoint or the method no longer exists.
- Active Navigation routes use a 15px dark outline and 9px cyan stroke (slightly narrower for off-road links), with an alpha pulse on the existing graphics; no canvas redraw is requested by the pulse.
- Journey Journal lists passenger rest aboard as overlapping movement, not downtime.

## Live GM test checklist

1. On a suitable multi-surface route, choose **Ship passage (hired)** and enable **Continuous travel** using the current-leg editor; save for **this journey**. Verify the current leg total equals sailing time, not additional days of idle downtime.
2. Confirm native guided travel. At the 8-hour and 24-hour marks the ship should continue without automatically asking for overnight camp.
3. During sailing, choose **Short Rest Aboard (1h)**, then **Long Rest Aboard (8h)** when enough movement remains. Check the Journal only marks each completed after the specified ship movement; World time and token advance once and the vessel never stops for the passenger rest.
4. While sailing, trigger/reproduce a Foundry canvas rebuild; confirm an interrupted Journal is retained. Recover using **Recover Saved Journey** if automatic recovery is unavailable. Check **Ship passage (hired)** and **Continuous** are restored, and the next Travel button is enabled for the saved checkpoint.
5. For an older beta.7.1 Journal, use the **Operating schedule for recovered voyage** selector to confirm Continuous for a genuinely crewed vessel. Verify the Journal keeps the first passage's fare, adds a continuation leg without another booking, and does not replay earlier movement or World time.
6. Test a normal walking journey: daily limit, camp and Long Rest should still stop movement and advance World time separately. Test player/GM map route visibility and a Scene refresh.
7. Verify the glowing cyan route remains visible above an authored road in daylight and water areas and the pulse does not rebuild the canvas.
8. For safety, change an authored checkpoint or remove the method mid-journey in a disposable test World: recovery must stop with an explanatory message; it must not move the party.

## Known boundaries

- A rebuild initiated by Foundry or another module can still interrupt an in-progress native animation; this build addresses safe continuation rather than suppressing canvas rebuilds.
- For interrupted Journeys created by **older beta builds** with no saved operating schedule, the GM now sees an explicit **Operating schedule for recovered voyage** selector. Standard operation is the safe fallback unless the World preset already supports continuous travel; the GM may explicitly reapprove rotating-crew continuous operation for the remainder, without changing the World preset.
- Passenger rests aboard are **journey annotations only**, not D&D 5e Actor rest automation. A pending rest interrupted before its full duration is not marked completed.
- Hired services remain GM estimates; no payment, booking, boarding, or Actor resources are automatically modified.
