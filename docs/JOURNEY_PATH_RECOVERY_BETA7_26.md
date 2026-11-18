# v0.3.8-beta.7.26 — Approved Journey path recovery

**Status:** Local implementation and automated verification; Foundry v14 GM and
player acceptance not yet performed. Stacked on beta.7.25. Issue [#189](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/189)
remains open pending successful reproduction and retest.

## Problem and decision

The legacy recovery guard compared a saved `completedPercent` (measured along
the visual/native token waypoints) with a newly solved `route.distance`
(Foundry Grid measurement of authored Road segments). On a curved or otherwise
recalculated route those values are not comparable. A correctly confirmed
position can therefore fail safe-recovery without any actual move or transfer
problem. The reported interrupted voyage is consistent with this class of
mismatch, but the complete live root cause is **not yet confirmed**.

For **newly started** Journeys, each authorized leg now carries an optional,
validated `approvedPath` snapshot in the existing version-1 Journey Journal:
Road and segment IDs, ordered Road/off-road polyline legs, and image-local
coordinates. This is the minimum evidence needed to check the remaining
approved geometry after a canvas tear-down; it is *not* an alternative Scene
graph, native TokenDocument position, or credit ledger. Existing v1 Journals
remain compatible, without read-time migration or writes.

## Recovery invariants

1. A native token's current location must still coincide with the **last
   confirmed Journal anchor** (the existing strict threshold: 0.35 cell or
   two image pixels, whichever is greater). Movement that was not durably
   committed is never inferred, even if the token looks nearly arrived.
2. The fresh route must end at the exact saved checkpoint/Point B, follow the
   original Road segment sequence, and progress monotonically along that
   path. Ambiguous self-crossings and changed branches fail closed.
3. Up to **two native Grid cells** of *sideways route discrepancy* may be
   accepted when the approved Road identities, direction, and remaining pixel
   length also match. A ten-cell detour fails; this is not a general license
   to reroute vessels or to teleport the token.
4. The previous transportation method, arrangement, operation, surface,
   arrival checkpoint, and zero-rebooking rule stay authoritative.
5. No canvas frame, projected % completion, or clock estimate may confirm
   World time, funds, passenger rest, Journal events, or native movement.
6. A pre-beta.7.26 Journey with no saved approvedPath retains its historical
   strict distance check; do not invent a missing route snapshot.

## Targeted automated coverage

- Snapshot validation, immutable copy, schema compatibility, and corruption.
- Matching confirmed suffix despite a percentage/native-distance mismatch.
- Two-cell lateral allowance, ten-cell deviation, branch change, wrong Point B,
  backwards travel, ambiguous route revisit, and unconfirmed manual move.
- Continued vessel reuses previous method and incurs **zero** additional fare.
- Existing legacy recovery tests, controller/canvas lifecycle regressions,
  overall `npm run check`, `npm run architecture:check`, and `git diff --check`.

## Owner Foundry v14 test checklist

Use a **fresh test Journey** (old Journals cannot be retrofitted safely).

1. As GM, plan A → B → checkpoint C on a multi-segment curved water/land
   corridor. Confirm the transportation, record initial World time, native
   TokenDocument coordinates, Journey Journal and available fares.
2. Travel partway; trigger a **real** canvas teardown/redraw (also test
   reconnect and Scene switch). Reopen the same Scene as the active GM.
3. Confirm the last saved Journal anchor and native token position coincide.
   Resume: the **same** segment sequence, surface, method and checkpoint must
   remain selected, without replaying elapsed time or incurring a second fare.
4. Test transfer C → next method → final B, including a passenger rest on
   continuous passage. Compare total World time, events, native positions,
   Journal summary, and fare before and after each redraw.
5. Deliberately relocate the token **ten hexes** as GM: auto-continuation must
   refuse and preserve the interrupted Journal. Return it to its **confirmed**
   position only through an explicit GM-approved action; no auto-teleport.
6. Change the authored Road identity or arrival checkpoint in a *copy* of the
   test Scene: recovery must refuse rather than silently adopt a shorter path.
7. With a non-GM connected, check visibility, no Atlas edit permission, player
   token updates, Fog/Regions/weather, and no misleading journey completion.
8. Repeat once with a pre-beta.7.26 interrupted Journal: compatibility reads
   must work but unsupported auto-recovery must remain guarded.

**Known limitations:** The lateral allowance applies to route comparison,
not manual token drift or a changed native travel surface. There is no new
GM-driven "return to confirmed anchor" UI in this beta. We need explicit
design/approval for that authoritative token mutation. The logged historical
#189 Journey may remain blocked because it has no earlier approvedPath data.

**Release gate:** No merge or final release until owner explicitly accepts
the new GM/non-GM recovery and transfer behavior in Foundry v14.
