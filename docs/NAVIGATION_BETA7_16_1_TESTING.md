# 0.3.8-beta.7.16.1 — Focused interrupted-voyage recovery hotfix

**Stacked draft** atop beta.7.16. Automated passing tests do not constitute live Foundry v14 acceptance. Do not merge or tag a release before the Product Owner accepts GM and non-GM live results.

## What changed

- Recovery retains the Journal-approved hired/owned ship or mount selection even if the temporary current-checkpoint offer is no longer available. A failed projection shows the approved method locked and an actionable inline error; a render cannot replace hired passage with Walking or party-owned transport.
- A two-surface projection caused solely by a tiny native off-road terminal attachment can be treated as the same approved sea/air leg **only** if the last two-point attachment lands on the saved arrival checkpoint's exact authored node, its native distance is no more than 2% of a grid cell, its pixel length is no more than a quarter cell, and it does not conceal another checkpoint.
- If the token's remaining native route is inconsistent with the unconfirmed portion of the saved Journal leg, recovery fails closed. Automatic Canvas restart also refuses same-road fallback anchors that do not match the confirmed coordinate tolerance. The Journey Journal is preserved, and the GM must investigate before any movement.
- These are read-only eligibility/preview changes. No route or Scene scale redefinition, new transport booking, automatic fare, Actor rest, World clock write, token teleport, Journal migration, or other feature expansion.

## Owner live-test checklist (Foundry v14)

1. **Back up the World and interrupted Journey Journal first.** Install the draft manifest on a test World. Keep the previously interrupted `Hearth's Heart Dock → Port Barthos` hired-ship Journal, including its approximately **86% confirmed** split leg.
2. Reopen Navigation and **Recover Saved Journey**. If the token is near the dock while the Journal still has roughly 7–8 miles unconfirmed, the UI should display the saved **Ship passage (hired)** method and explain the remaining-distance mismatch. **Travel Route must be disabled**. Confirm the Journal, money, TokenDocument and World clock are unchanged. Do not manually force the final segment through by editing the Journal just to pass the test.
3. On a separate reproducible test Journey, interrupt native Canvas playback near an authored dock when the last Journal-confirmed anchor is accurate. Try an offset smaller than 2% of a grid cell that ends **exactly at the saved checkpoint node**. Recovery should recognize the original approved ship leg, retain the original speed/passenger-rest state, and charge no second fare. A terminal connector to another checkpoint or a larger off-road stretch must be refused.
4. Repeat with a land → water → land route, one bought/chartered ship and one owned Warship or Riding Horse, including a continuous voyage and passenger Short/Long Rest underway. Pause, refresh Canvas, reopen Navigation, and verify no duplicate Journal events, World time, fares, or token movement. The original final Point B and intermediate checkpoint choices must be retained.
5. Confirm native roads, checkpoint markers, Region surfaces/Behaviors, Scene units, Levels, weather and fog remain unchanged. As a non-GM, check that no new GM-authoritative action is available.

## Known issue requiring GM reconciliation

If Canvas teardown moved the native TokenDocument beyond the last confirmed Journal anchor, the saved Journal may contain valid earlier movement but cannot prove the remaining uncommitted travel. This hotfix intentionally **does not** infer miles/time, teleport the token back, or retroactively write Journal progress. Review the actual token, the last confirmed Journal anchor and movement logs in a backed-up World; arrange a separate approved, audited reconciliation if necessary.

The Region-grouped destination directory, Scene scale presets, cosmetic Journal restyling, and wholesale movement-engine refactor remain outside this patch.
