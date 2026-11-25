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

## Latest verified candidate — 2026-11-25

- Implementation checkpoint: [`2914792`](https://github.com/i-am-rayo/fvtt-atlas-navigation/commit/2914792b3358eab8671f166b782aea332f88fb22) on the working branch. The CI correction checks the displayed paid crew count, daily rate and total together in the existing owned checkpoint test.
- [Stabilization checks 45570920417](https://github.com/i-am-rayo/fvtt-atlas-navigation/actions/runs/45570920417) passed 1,417 Node tests, the architecture job, the Chromium serialization regression, PR whitespace checks and candidate manifest/archive validation. The manifest version is `0.3.13-rc.3.2`.
- [#527](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/527), [#513](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/513) and [#517](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/517) remain open for live acceptance. [#528](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/528) and [#537](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/537) remain separate scope.

## Product Owner live GM retest — Sandbox

The Product Owner reported four Pass and two Partial results from the [RC.3.2 testing guide](TEST_0_3_13_RC_3_2.md). The exact installed commit and Foundry and system build numbers were not included in the report.

| Test | Result | Owner-reported evidence and remaining checks |
| --- | --- | --- |
| A — Policy | Pass | Crew policy editor passed. |
| B — Range controls | Partial | Cart started at 0 crew and 1 available vehicle. Range and number inputs stayed in sync, and the local override appeared in the draft. Save and reopen the offer, then test the missing-preset case. |
| C — Operating units | Pass | Operating-unit validation passed. |
| D — Review | Pass | Confirmation dialog passed. |
| E — Canvas | Partial | Road and marker cancellation restored Workspace and focus. Verify successful Road saves from Map Directory and the toolbar, explicit Exit placement, and cancellation after closing the originating Workspace. |
| F — Persisted staffing | Pass | Persisted staffing and the live Journey quote passed. The walkthrough returned via Back to plan. |

## Next gate

Resume test B at the missing-preset case using a disposable orphaned offer. Cart Save and reopen and the remaining test E steps passed in the follow-up below. Playback, checkpoint continuation, recovery, the finished Journal and separate player permissions still need live verification. Keep #528 and #537 in their separate scope. Overall RC.3.2 acceptance remains open and merge, tag or release requires PO approval.

## Follow-up live GM retest — 2026-11-25 (JST)

- Environment: authorized Sandbox scene, Foundry VTT 14 Stable build 370, Dungeons & Dragons Fifth Edition 6.1.1. Core Module Management showed active FVTT Atlas Navigation `0.3.13-rc.3.2`.
- Installed archive commit: unverified. The installed UI exposes the version, and the branch archive URL is mutable. GitHub independently verified [implementation checkpoint `2914792`](https://github.com/i-am-rayo/fvtt-atlas-navigation/commit/2914792b3358eab8671f166b782aea332f88fb22) and [passing CI](https://github.com/i-am-rayo/fvtt-atlas-navigation/actions/runs/45570920417). At the time of this retest, the branch was two documentation-only commits ahead.
- Overall for this retest: **B Partial**, **E Pass**. This is live GM evidence for the listed steps. The earlier walkthrough above remains the record for A, C, D and F.

| Step | Result | Expected | Observed |
| --- | --- | --- | --- |
| B1 — Cart defaults | Pass | Crew range and number start at 0. Switching to finite availability starts both controls at 1. | Crew displayed 0/0 and finite availability displayed 1/1. |
| B2 — Paired inputs and staging | Pass | Each input updates its paired control. Applying stages the offer for explicit marker save. | ArrowRight moved crew to 1/1 and availability to 2/2. Numeric entry updated both pairs to 3/3 and 4/4. Apply returned to the marker draft. |
| B3 — Explicit save and reopen | Pass | The offer survives an explicit marker save and both controls reopen with the persisted overrides. | Clicked **Create Map Marker**, then found **RC.3.2 B Cart QA** in Map Directory and reopened its Transportation tab. The offer showed **Local overrides**, **4 vehicles available** and **3 required crew**. The reopened editor showed 3/3 and 4/4. |
| B4 — Missing preset | Not run | An offer with an unavailable World preset displays its missing-preset state and offers a recovery path. | The Cart test used an existing World preset. A disposable orphaned offer fixture was unavailable. No shared preset was removed. |
| E1 — Cancel from filtered Map Directory | Pass | Restore the directory view, search and Add Road focus. | **All Roads**, search **RC.3.2 E** and focus on **Add Road** returned. Both saved QA roads were visible under that filter. |
| E2 — Save a two-point Road from Map Directory | Pass | Open exactly one Road Settings for the newly persisted Road with **Road name** focused. | After **Finish Road** and **Create Road Without Connections**, one settings window opened for `aQAjbbBdWy8m15DB` with Name focused. The renamed **RC.3.2 E Directory Road QA** appeared in the directory. |
| E3 — Save a two-point Road from toolbar | Pass | Open exactly one Road Settings for the newly persisted Road with **Road name** focused. | **Finish Road** opened one settings window for `u0bBIo0cwtF3Wkz2` with Name focused. The renamed **RC.3.2 E Toolbar Road QA** appeared in the directory. |
| E4 — Discard linked marker | Pass | Return to Workspace and Add Map Marker focus after cancelling the linked draft, with no second placement cancellation. | The draft identified the directory QA road as **Named road**. **Cancel** dismissed the draft and placement dock and restored the filtered directory and Add Map Marker focus. |
| E5 — Discard independent marker | Pass | Return to Workspace and Add Map Marker focus after cancelling the independent draft, with no second placement cancellation. | The form identified an independent marker. **Cancel** dismissed the form and dock and restored the filtered directory and Add Map Marker focus. |
| E6 — Explicit Exit placement | Pass | Exit before opening a form, restore Workspace and focus, and create no marker. | **Exit placement** closed the dock and restored Add Map Marker focus. Workspace still reported 40 markers. |
| E7 — Close originating Workspace | Pass | Cancel an active Road draft without recreating the intentionally closed Workspace. | Closed the minimized Workspace with drawing active and verified its window was absent. **Cancel** removed the canvas dock and the Workspace stayed absent. |
| Cumulative playback, checkpoint continuation, recovery/reload, finished Journal and separate player permissions | Not run | Verify committed Journey and player behavior in their designated live tests. | This follow-up covered the B/E gate in the GM Sandbox session. |

Screenshot evidence captured in the live test session: reopened Cart offer showing **4 available / 3 required**, and toolbar Road Settings showing **Road name** focused with the Foundry 370 and D&D 5e 6.1.1 badges. The captures include surrounding Sandbox map content and were kept in the test session. The browser error log showed no entries when checked at the end.

Sandbox started at 47 roads and 39 markers. The two named test roads and one independent Cart QA marker were intentionally saved and left identifiable for follow-up. The saved marker count reached 40 and the road count reached 49. The toolbar screenshot also shows a duplicated travel preset value and missing spacing between the authored-distance label and value.

## Road Settings follow-up

The preset row shows the selector when choosing a preset and a single summary when a valid preset is collapsed. The missing-preset warning remains visible when a saved selection is unavailable. The authored-distance row now uses the same wrapping and spacing as the preset row. Verify both display corrections in Foundry during the next Sandbox check.

The existing Checkpoint Transportation test covers the missing World preset warning and disabled Edit action without writes. B4 still needs an orphaned offer in a disposable live fixture. E remains Pass for the tested save and cancellation workflows.

### Live Sandbox verification — 2026-11-25 (JST)

Opened the existing **RC.3.2 E Toolbar Road QA** (`u0bBIo0cwtF3Wkz2`) from Map Directory → All Roads → Road Settings → General.

| Check | Result | Expected | Observed |
| --- | --- | --- | --- |
| Travel preset display and Change preset… | Pass | Show the effective preset once in both the summary and picker states. | The saved **None (Land fallback)** appeared once in the selector. Staging **Dirt Road** showed one summary with **Change preset…**. Clicking the button hid the summary and focused the selector, which showed **Dirt Road** once. Opening the fallback picker also showed one selected fallback option. |
| Authored Road distance spacing | Pass | Keep the label visually separate from its value. | **Authored Road distance** and **12.92 km** rendered as distinct, aligned elements with a visible gap of about 297 CSS px in the tested window. Both remained readable after opening the preset editor. |

Discarded the staged preset and reopened the same Road. The saved fallback and **12.92 km** were still present. This closes the two Road Settings display checks. B4 remains open.
