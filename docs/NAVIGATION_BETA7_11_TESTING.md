# v0.3.8-beta.7.11 — Navigation decision notice presentation boundary

Architecture-only build stacked after the owner-tested beta.7.10. Three
read-only notices now share `navigation-prompts-view.js`; the controller owns
the rules and eligibility checks, and `navigation-footer.js` owns all GM
actions. **This does not add a new rest choice or change Journey behavior.**

## GM and non-GM acceptance — Foundry VTT v14

1. Back up the World, install this branch's manifest, confirm the displayed
   beta.7.11 version, and reload the GM and player client.
2. Start a land Journey after the party has reached the daily travel limit
   (for example, after a continuous ship leg). The **Daily travel limit
   reached — choose how to proceed** panel must show the same four options,
   hours, distance estimate and optional forced-march DC as beta.7.10.
   Confirm the existing GM footer buttons actually perform the chosen action.
3. Approve a Short Rest and then a Long Rest in a pause/limit workflow. The
   previously accepted Journal timing and World-time accounting must stay
   unchanged. Confirm a **Continue March** records the same extra hour.
4. Complete a hired ship transfer to an intermediate authored checkpoint.
   **Checkpoint reached** must offer stop/replan or continue with a new
   method; no extra token movement, boarding or fare may occur just from
   showing the notice.
5. Arrive at the saved final checkpoint. The notice must refer to the
   **original destination**, offer completion, and not invent a short
   duplicate return leg. Attempting another voyage to the same checkpoint
   must still show the **Already at** warning.
6. Refresh Canvas during an ongoing leg and verify the approved Riding Horse
   or hired ship is preserved on recovery. Check continued progress, no
   duplicate fares/World time, and unchanged Journal metadata.
7. On the non-GM client verify roads, checkpoint discoveries, Atlas fog,
   native Regions, weather and player visibility. These decision prompts
   must not confer player GM privileges or add an authoring UI.

## Automated validation

- DOM regression tests for each notice and both checkpoint outcomes; no
  action callback can be registered by their renderer.
- Existing controller, daily travel, checkpoint transfer, Journal,
  continuous voyage, Summary, Footer and Directions regressions.
- Full Node checks, syntax checks and import dependency graph.
- Verify version and branch manifest/archive URLs; leave PR draft and
  stacked until explicit owner merge approval.

**Still separate:** R-01, inactive-GM movement perception, awaits diagnosis
and a product decision. Future player progress/rest request, schedules,
Region containment and Scene import/export are not part of this release.
