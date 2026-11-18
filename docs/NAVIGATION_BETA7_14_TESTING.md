# v0.3.8-beta.7.14 — GM transport presentation boundaries

This larger **architecture-only** build follows the owner's successful
beta.7.13 Foundry v14 Journey. It extracts two related GM display surfaces:
checkpoint transportation/legacy voyage operation controls, and read-only
transport eligibility/capacity/fare summaries. It does not alter gameplay.

## Foundry v14 owner acceptance

1. Back up the World, install the beta.7.14 branch manifest, check its version
   and reload GM and non-GM clients.
2. In GM Navigation, select a land route using a party-owned mount. Confirm
   the same travel-method groups, method eligibility note, Group seat count,
   cost estimate, operating days and warnings as beta.7.13.
3. For a Group with insufficient mount capacity or unclassified NPC roles,
   verify **Review mounts & NPC roles** opens the existing Group editor and
   **Refresh seats** updates the advisory after changes. Neither action should
   occur during an ordinary Navigation render.
4. Select an offered hired method and edit trip-only fare/operation settings.
   Confirm the **World preset estimate** remains separate from the current
   Journey estimate. **Reset journey overrides** must work when idle and be
   unavailable while an approved movement is active; no currency is deducted.
5. Plan Riding Horse → hired ship → Riding Horse. Verify the current checkpoint
   selector's option grouping, placeholder, selected method, edit pencil and
   disabled/busy states are unchanged. GM-only decisions must still require
   explicit confirmation; tentative later legs must never self-book.
6. Recover an older paused ship Journey with missing operation metadata, if an
   appropriate test Journal is available. The GM must still explicitly choose
   Standard (8h/day) or Continuous (crewed 24h); redraw/close cannot silently
   change its approved method or original Point B. No repeated arrival/booking.
7. Complete a multi-leg route, including an optional Long Rest Aboard and
   ordinary land Long Rest or Continue March. Compare confirmed World time,
   Journal legs/directions, fare estimates and 100% completion controls with
   beta.7.13. No duplicate time, rest or movement after Canvas refresh.
8. On a non-GM client, confirm no new GM controls, private metadata or change
   to roads, checkpoints, exploration fog, weather and native Regions.

## Automated verification

- Direct DOM tests cover recovered operation choices, grouped checkpoint
  options and editable/disabled method controls with no render side effects.
- Direct DOM tests cover method advisories, capacity warnings/review actions,
  monetary breakdown display and disabled/explicit override reset.
- Existing GM controller, transport, Journey and recovery regressions.
- Full Node test suite, architecture graph, syntax and `git diff --check`.

Leave the stacked PR **draft** until owner v14 GM/player acceptance; do not
combine this architecture change with scheduling, payment or Region features.
