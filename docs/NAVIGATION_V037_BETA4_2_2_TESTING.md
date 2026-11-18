# v0.3.7-beta.4.2.2 — Journey Journals and Recovery

This draft builds on beta.4.2.1. It is **GM-only** and requires live testing in Foundry v14 before approval/merge.

## What changes

- **Travel Route** creates one GM-only Foundry Journal Entry before the first token move. A generated **Atlas Journey Summary** page contains the itinerary, confirmed moving and downtime, inserted rest/forced-march decisions, and status. Other Journal pages can be used for freeform GM notes.
- A versioned `flags.fvtt-atlas-navigation.guidedJourney` record on that same Entry stores the recoverable metadata. There is **no second Scene/token/local-storage journey record**. Progress checkpoints use the public native Token movement completion and confirmed World-time ledger.
- The Journal status can be **In progress**, **Paused**, **Interrupted**, **Ended**, or **Completed**. End Journey is terminal; a canvas teardown or Navigation window close is recoverable as Interrupted.
- Reopening Navigation on the same Scene with the same assigned party explorer and unchanged Atlas road revision offers **Recover Saved Journey**. Atlas recalculates a fresh path from the token's **actual current position** to the saved destination, showing the remaining route before movement. Only the GM's new **Travel Route** click resumes; earlier motion and elapsed World-time changes are never replayed.
- The Journal is available through **Open Journey Journal** in the Navigation footer. Standard browser diagnostics now log at `console.info`, so normal Console filtering displays them; Verbose/Trace remain at `console.debug`.

## GM acceptance test

1. Select a Scene with the assigned Atlas party explorer. Enable the existing **Advance Foundry World Time** module setting if you wish to test clock accounting. Choose a route exceeding eight hours of moving time.
2. Click **Travel Route**. Verify one newly created **Atlas Journey** Journal Entry, no extra Scene flags, and the Journal's **Atlas Journey Summary** page. Confirm default player ownership is **None** (GM-only).
3. After a confirmed movement stretch, open the Journal. Confirm distance, moving hours, time advances, and step directions are readable. Pause the journey and ensure the Journal marks it Paused; resume.
4. At the eight-hour travel limit choose **Long Rest**, then verify the Journal places the Long Rest **between the split direction steps** and shows confirmed downtime. If World-time advancement is enabled, check that the Journal's recorded moving and rest time match the clock advances, not the Total Trip estimate.
5. While moving, cause a **full canvas redraw** (for example, the day-rollover weather hook that previously closed Navigation). Confirm Atlas stops safely and the Journal becomes **Interrupted**, without replaying a native move. Reopen Navigation and verify **Recover Saved Journey** is offered.
6. Click **Recover Saved Journey**. Confirm the displayed departure matches the *token's current position* and the destination matches the saved Journal; the token must **not** move yet. Click **Travel Route** and verify travel resumes from this position. Confirm only the new remainder advances World time; earlier movement/rest credits stay in the previous leg.
7. Repeat with **End Journey** and with complete arrival. Both should persist a terminal status in the Journal, and neither should be offered as a recoverable journey on a later Navigation opening.
8. Test **Exit Navigation** mid-route: closing should save **Interrupted**. Test a Scene road edit during interruption: automatic recovery must be refused because the Atlas revision has changed, and the GM can choose a new route.
9. As a player, verify they cannot open the Journal with the default ownership, and no automatic player route execution or fog-discovery bypass is introduced.
10. In a GM browser, set Atlas Debug to **Standard** in Module Settings. Check that journey logs appear in a normal Console Info view, with no separate category checkboxes and no World-level settings write.

## Important limitations

- Recovery is a **deliberate new calculated leg** on the same Journey Journal, not restoration of an in-flight Foundry `TokenDocument.move()` promise. An interrupted native stretch might have repositioned the token without being fully confirmed; the token's live position, not a stale stored chunk, wins.
- Journey Journals currently use a single automatically maintained summary page. Add freeform notes on a **separate Page**, since Atlas regenerates the summary.
- World time only advances through previously authorized confirmed operations. Scene-wide third-party day-rollover hooks may interrupt travel; the Journal prevents route replay but cannot guarantee external modules made no unrelated World-time modifications.
- If Journal creation or a later required checkpoint fails, Atlas must stop rather than continue unrecorded movement. A future beta may add explicit conflict resolution for edited/removed Journals and changed road networks.
- The native Token renderer can still briefly redraw its texture on a full Foundry canvas rebuild; this beta does not bypass native movement/animation internals.
- Actor long-rest resources, Constitution saves, exhaustion, vehicle modes, tolls and player-initiated movement remain outside this beta.

Automated checks: `npm run check` and focused Journal, debug, daily-travel and controller tests. **Live v14 and third-party SimpleTimekeeping regression testing remain required.**
