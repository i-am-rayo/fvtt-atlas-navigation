# v0.3.8-beta.7.12 — Read-only transfer preview boundary

Architecture-only build stacked on owner-tested beta.7.11. The current transfer
leg's descriptive frame, named roads, read-only status, cost/time narration,
checkpoint advisories and GM preview of *unapproved later legs* are presented
by `navigation-transfer-preview-view.js`. The controller retains every method
selector, recovered operating-schedule choice, editor callback, rules check,
fare calculation and Journey action.

## Foundry VTT v14 — GM and non-GM live checklist

1. Back up the World, install beta.7.12 from its branch manifest, verify the
   displayed version, and reload the GM and player client.
2. Plan Riding Horse → hired Ship passage → Riding Horse to a distant final
   Point B. Check **Current journey leg**, departure and arrival checkpoint
   names, authored road list, method picker, edit button, estimated moving
   time/cost and narration are identical to beta.7.11.
3. Expand **GM preview · possible later leg(s)**. Verify that later legs are
   explicitly tentative and displayed in their prior order, but do not
   automatically book transport, move the token or alter the saved destination.
4. Select/edit an allowed method, authorize travel and arrive at a checkpoint.
   Verify that selection changes, method availability, fees, continuation,
   same-checkpoint loop prevention and final Journey completion work as before.
5. Refresh Canvas during an active hired voyage. Verify the **Recovered
   voyage** explanation, previously approved method, original destination,
   completed fare/rest records and recovered operating-schedule selector for
   older Journal data continue to work without a duplicate charge or time.
6. Long Rest Aboard and Short Rest Aboard must retain their underway semantics
   and ordering. On the following land leg, confirm normal rest, Continue
   March and World-clock/Journal totals remain unchanged.
7. On a player client, confirm roads, checkpoints, fog, native Regions and
   weather still render as before. The GM preview or edit controls must not
   appear as a new player authoring or transport-approval surface.

## Automated verification

- Direct DOM tests for the preview frame, approved leg labels, road/quote
  details, recovery notice, tentative later-leg order and zero action wiring.
- Full Node suite, architecture graph, syntax and whitespace checks.
- Verify branch manifest and archive URL. Leave the PR stacked and in draft
  until explicit owner approval to merge.

**Separate:** The R-01 inactive-GM travel observation remains under
investigation. Player pamphlet, player rest requests, native Region
containment, calendar scheduling and Scene import/export are future features.
