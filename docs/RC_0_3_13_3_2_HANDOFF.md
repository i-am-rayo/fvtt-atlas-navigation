# Atlas Navigation — RC.3.2 stabilization handoff

2026-11-25. Development candidate, not production release. Continue cumulative draft [PR #540](https://github.com/i-am-rayo/fvtt-atlas-navigation/pull/540) on `codex/atlas-crew-staffing`. Main remains 0.3.12 at `9508f93e3d2265323a3be2e7cb24c0e05ac699c7`. Read [prior engineering handoff](RC_0_3_13_3_1_HANDOFF.md), AGENTS.md and UI standards. Verify the latest branch/CI before use.

## PO evidence from RC.3.1
Tested commit `7637582e6b12d275737aa35dcac27acb7cb298e2`, CI [45545916435](https://github.com/i-am-rayo/fvtt-atlas-navigation/actions/runs/45545916435). Partial acceptance only.

| Area | Actual PO observation | Remaining acceptance |
| --- | --- | --- |
| Workspace | Add Road opens drawing and cancels; toolbar saved Road opens exact Settings with Road name focused. Marker draft discarded. Workspace restoration inconsistent. | Retest restoration and both entrypoints. |
| Inherited offers | Cart stages inherited; finite quantity 1 staged; discard prompted. | Save/reopen, missing preset, paired number/range parity. |
| Party roster | Warship unit 1: two named crew plus 30 hired hands, 32/60 Optimal, 31 paid. Discard prompted. | Shared Group save/reopen, duplicate assignments, live saved staffing quote. |
| Crew policy | Inherited 15/30/45/60 and 2 GP per paid crew per operating day. Customize left fields disabled by mouse and keyboard. | Change/apply/save/reopen/reset policy; cancel. |
| Units/transport | Deselecting sole operating unit blocks departure; generic misleading message. Owned checkpoint preview only. | Specific error, ordinary land, mixed/cargo cases. |
| Mounts | Three Riding Horses plus one Warhorse separate from four passenger seats; owned boarding 0 CP. | Hired percentages/overrides and finite stalls. |
| Confirmation | Owned water preview/review matched 84 PP using unconfigured legacy roster. Back to plan worked; named destinations correct. Modal narrow, inconsistent display denomination. | Compact review and exact breakdown; no write on decline. |
| Multi-leg/recovery | Next stop Port Barthos, final Dirwest. No committed Journey or interruption exercised. | Live arrival, onward decision, interruption/reload; #528/#537 separate scope. |
| Keyboard/player | Road name and Back to plan focus worked; policy keyboard failure. GM only. | Full keyboard, compact/zoom/reduced motion, separate non-GM session. |

## Implemented corrections and evidence

1. DialogV2 native render callback reconnects Party policy mode to rendered inputs. Preserve explicit draft/apply/save and roster. Range defaultValue serializes, then sliders synchronize from numeric fields on render. Empty operating units rejected before misleading derived speed/crew estimates; same specific error at approval.
2. Shared approval view uses native expandable traveler detail, owned-service counts, responsive width, scrolling content. Exact component coin formatting is opt-in for preview/review; nonrepresentable fractional CP remains exact. Existing method rounding, owned zero boarding, history CP presentation and immutable approvals unchanged.
3. Declining linked/standalone marker creation exits single placement and removes handlers without writes. Explicit Exit placement. Road/marker dock awaits existing focus lease release before refreshing Workspace and restoring initiating control. Saved Road opens exact Settings once, with scene/GM guard and warning on unsafe handoff. Closed Workspace is not reopened.
4. Browser regression uses runner Chromium against actual editor modules with a simulated Foundry DialogV2 HTML serialization boundary and actual FormData/events. No new runtime dependency. It exercises policy inheritance/customization/save/reopen/reset and Cart range synchronization; not a live Foundry test.

Red/green evidence: [functional regressions](https://github.com/i-am-rayo/fvtt-atlas-navigation/actions/runs/45550043423) → [green](https://github.com/i-am-rayo/fvtt-atlas-navigation/actions/runs/45550218235); [Chromium](https://github.com/i-am-rayo/fvtt-atlas-navigation/actions/runs/45550325108); [confirmation red](https://github.com/i-am-rayo/fvtt-atlas-navigation/actions/runs/45550469557), [historical presentation and authoring red](https://github.com/i-am-rayo/fvtt-atlas-navigation/actions/runs/45550748285); [cumulative green](https://github.com/i-am-rayo/fvtt-atlas-navigation/actions/runs/45551017372) at `b8a1003bfcc6cda0006022a7f13dd65666564d28`: 1415 Node, 4 architecture, Chromium, diff check, candidate archive/manifest. Packaging version follows in the next commit; verify its own CI independently. Earlier transient failures are not acceptance evidence.

## Next gate
Use [RC.3.2 testing guide](TEST_0_3_13_RC_3_2.md). No PO acceptance of RC.3.2 yet. Native Foundry window/keyboard behavior, actual saves, canvas movement and player access remain unverified. Do not implement unrelated recovery changes while these acceptance gates are open. No merge/tag/release without PO approval.
