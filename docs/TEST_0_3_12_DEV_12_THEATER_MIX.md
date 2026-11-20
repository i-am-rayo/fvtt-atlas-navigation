# 0.3.12-dev.12 — Theater-of-mind mixed travel

Stacked on PR #472 and driven by the GM's successful dev.11 screenshot feedback.
**No merge, release, or implicit conversion of historic Journey records.**

## Behavior
- A GM selects multiple compatible land methods in one checkbox fieldset.
- Remove the five per-member drop-downs. **Personal mount assignments** already
  configured in the D&D 5e Party-owned Group roster are reused automatically:
  Cassian's Camel is reserved for Cassian when Camel is selected, without needing
  another assignment in Navigation.
- Other travelers and common seats are allocated **in aggregate**. When Walking is
  selected, unallocated travelers walk and all travel together at the approved pace.
- A hired Cart or Wagon with no aggregate riders is cargo-only. A hired coach
  priced per passenger must have a numeric **Riders** total (not rider names).
  Hire **Units** is also an aggregate count, bounded by checkpoint supply.
  Atlas never guesses *which* unnamed characters board a hired service.
- The Journey Journal stores **schemaVersion 3 theater-of-mind** totals and
  named preassigned mounts, not fictitious per-person coach assignments.
  Prior schemaVersion 1 cargo, v2 manually assigned, and single-method Journeys
  remain readable through their existing validators and recovery paths.
- A preview never books vehicles, deducts coins, alters Actors, advances World
  time or moves native Tokens; GM approval and the existing post-confirmation
  revalidation remain mandatory.

## Foundry v14 owner checklist
1. Select Walking + Camel + Cart with a Camel already assigned to Cassian.
   Confirm the compact **Mixed travel — party overview** section has no per-party
   dropdowns; it should show Cassian as preassigned to Camel and the other
   Group travelers walking. The Cart defaults to cargo-only.
2. Select Walking + Coach. Enter an aggregate number of coach riders, such as 3.
   Validate coach seats and per-passenger fare count 3, while the rest walk.
   No new Actor assignment or seat document is written.
3. Test party of 3 PCs and 2 NPCs where one NPC requires no separate seat.
   The complete Group is still represented, but only 4 seats are required.
4. Check two-seat Cart: quantity 1 and 4 required seats do not let everyone
   board. A single cargo Cart plus walkers remains valid. Finite stock=0
   or selecting more units than available must block travel.
5. Select a hired Coach + an owned personal mount, and also try all-riding
   with Walking unchecked. Insufficient aggregate coverage must block travel
   rather than infer silent walkers.
6. Verify rider and unit counts, named personal mount ownership, fare,
   recommended slowest pace and GM override after changing World/Group/Map Marker
   fields while a confirmation dialog is open. Reject changed approval.
7. Confirm travel, pause and recover/reload. Journal must preserve schema-v3
   aggregate seat counts, approved speed, costs, owned mount identities and
   confirmed native movement/World-time history. No duplicate charges or rest.
8. Test a v2 approved Journey and v1 cargo-only recovery; no write-on-read.
   Verify GM/non-GM permissions, keyboard and narrow window behavior, route
   transfers, fog and Canvas refresh.

## Gates
Node/DOM/recovery tests, `npm run check`, `npm run architecture:check`,
syntax and `git diff --check`, then actual Foundry v14 GM/non-GM acceptance.
