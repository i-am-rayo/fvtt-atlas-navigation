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

B4 and E have passed in Sandbox. Resume at approval and departure for Dirwest via Port Barthos. Use the [release-candidate checklist](TEST_0_3_13_RC_3_2.md#release-candidate-checklist) to run the remaining checks in one batch. Playback, checkpoint continuation, recovery, the finished Journal and separate player permissions still need live verification. Keep #528 and #537 in their separate scope. Overall RC.3.2 acceptance remains open and merge, tag or release requires PO approval.

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

## Missing World preset follow-up

The orphaned offer card now explains how to replace the offer through the existing draft controls and names the parent Save action. The automated editor test covers the warning, disabled Edit, preservation on render, draft-only removal and restoration from the saved snapshot. B4 remains open for live Foundry verification using a disposable orphaned offer. The Road Settings display checks above passed in Sandbox.

## B4 fixture creation blocker

The Sandbox retest could not create either disposable land preset because World Save returned “Invalid transportation preset.” The warning and replacement workflow remain Not run in Foundry. The editor now submits the surface of the selected catalog section, which is already held by the editor and has no form input. The Chromium regression exercises custom preset creation through the serialized editor form and checks the saved catalog. Retest creation using a disposable World preset before continuing B4.

### Live B4 fixture setup — 2026-11-25 (JST)

| Step | Result | Expected | Observed |
| --- | --- | --- | --- |
| Create disposable land preset | Pass | The World catalog saves a custom method and lists it in Land. | Saved **B4 Disposable QA Transport** with an explicit passenger capacity of 1. The Land catalog listed the new method with Edit and Delete actions. |
| Attach and save the test offer | Pass | The QA marker persists the disposable offer alongside its existing Cart offer. | After **Save Map Marker**, the Sandbox directory showed **Transportation (2): Cart, B4 Disposable QA Transport** for **RC.3.2 B Cart QA**. |
| Make the temporary preset unavailable | Not run | Remove only the disposable World preset and leave its saved marker offer available for the recovery test. | The confirmation dialog for **B4 Disposable QA Transport** was open at the end of the session. Permanent deletion awaits owner confirmation. |
| Verify warning, disabled Edit, and replacement persistence | Not run | Open the orphaned offer, verify the warning and disabled Edit, remove the old offer, add an available method other than the existing Cart, save, and reopen to verify the replacement. | Pending creation of the orphaned offer state. |

Overall B4 is **Partial**. The live fixture creation blocker is resolved. The temporary preset and its offer remain in place for the next session.

## Combined retest candidate

The Chromium fixture now exercises creating a World method, resolving its offer, removing the method from the test catalog, and replacing the orphan through the Map Marker draft. Reopen is simulated from the draft payload. B4 remains Partial in live Foundry pending owner-approved deletion of the temporary preset and replacement verification. Use the [combined Sandbox retest](TEST_0_3_13_RC_3_2.md#combined-sandbox-retest) to cover B4, Journey execution and Journal, reload, and player permissions under one installed candidate.

### Combined live retest checkpoint — 2026-11-25 (JST)

Environment observed in the GM session: Sandbox, Atlas `0.3.13-rc.3.2` active in core Module Management, Foundry 14 Stable build 370, D&D 5e 6.1.1. The exact installed archive commit and a current disposable World backup were not verified.

| Combined check | Result | Expected | Observed |
| --- | --- | --- | --- |
| B4 — Orphaned offer | Partial | The orphan shows a warning and disabled Edit, and its replacement persists while the existing Cart retains its overrides. | Reopened **RC.3.2 B Cart QA**. Cart still showed **4 available** and **3 required crew**. **B4 Disposable QA Transport** still resolved with Edit enabled. Owner confirmation for permanently deleting only that disposable World preset is pending. The orphan warning, disabled Edit and replacement were not exercised. |
| Journey — Departure and arrival | Partial | Approval uses the intended route, roster and fare, and playback reaches the checkpoint and records progress. | Planned **Dirwest** via **Port Barthos** with Warship Unit 1. The review showed **6 travelers, 4 seats, 4 mounts, 1 vessel**, **31/60 crew, optimal, 31 paid**, and **43 PP · 4 GP**. The wage row showed **31 paid × 2 GP/day**. **Back to plan** preserved the destination and four mount decisions. No departure was approved. |
| Journey — Onward leg and finished Journal | Not run | Continue with explicit approval and reconcile the finished Journal against the confirmed legs. | The Journey stopped at the approval preview. |
| Journey — Reload and recovery | Not run | Compare confirmed Token position, Journal progress, and World time across reload on a separately approved disposable run. | No separately approved recovery run or verified disposable backup was available in this session. |
| Separate player session | Not run | Verify visible Journals and map records and absence of GM-only controls through a non-GM account. | Only the authenticated GM session was available for this retest. |

### Live B4 completion — 2026-11-25 (JST)

**B4 — Pass.** Tested as GM on **RC.3.2 B Cart QA** in Sandbox on the installed Atlas `0.3.13-rc.3.2` candidate. The earlier environment check recorded Foundry 14 Stable build 370 and D&D 5e 6.1.1. The exact installed archive commit remains unverified.

| Step | Result | Expected | Observed |
| --- | --- | --- | --- |
| Make the disposable preset unavailable | Pass | Only the approved temporary World preset disappears while its saved offer remains on the marker. | Deleted **B4 Disposable QA Transport** with owner approval. Its catalog row disappeared. Reopening the marker still showed the orphaned offer. |
| Warning and Edit state | Pass | Show a missing-preset warning with replacement instructions and disable editing the orphan. | The **Missing World method** card explained removal, adding an available method, and **Save Map Marker**. The orphan's Edit button was disabled and its Remove button was available. |
| Replace through the draft | Pass | Remove only the orphan, add an available method, and commit through the parent save. | Removing the orphan showed **Unsaved transportation changes**. Added **Riding Horse** under Land Travel and clicked **Save Map Marker**. |
| Verify persistence and preserve Cart overrides | Pass | On reopen, show the replacement without the orphan and retain Cart's existing overrides. | The directory listed **Transportation (2): Cart, Riding Horse**. The reopened marker showed the new Riding Horse offer, no missing-preset card, and Cart still at **4 vehicles available** and **3 required crew**. |

The B4 result above supersedes the earlier Partial status. The Journey execution, reload, Journal, and separate player checks retain their earlier status.

### Live Journey verification — 2026-11-26 (JST)

Tested the GM Sandbox session in Foundry 14 Stable build 370 and D&D 5e 6.1.1. The exact installed Atlas archive commit was not verified. The preceding live session verified Atlas `0.3.13-rc.3.2`.

| Check | Result | Expected and observed |
| --- | --- | --- |
| 1. Departure and checkpoint arrival | Partial | Approved the water leg from Party departure point to **Port Barthos**, with **Dirwest** as final destination. Approved **Warship Unit 1**, **6 travelers**, **4 passenger seats**, **31/60 crew, optimal, 31 paid**, and all **4 mounts** (3 Riding Horses and 1 Warhorse) embarking. Quoted fare **43 PP · 4 GP**, entirely crew wages, and **0 CP** boarding. Planned **135.22 mi** and **54h 5m** of movement. Playback reached **14%** and stopped before Port Barthos at the daily travel-hour boundary. Arrival and single first-leg credit remain unverified. |
| 2. Onward leg and finished Journal | Not run | Expected explicit onward approval, arrival at Dirwest, and reconciled completed Journal. The first leg was held at the travel-hours decision after the discrepancy below. |
| 3. Separate reload and recovery | Not run | Expected matching token, confirmed Journal progress and World time before and after reload, with no duplicate credit. Preserved the first run and did not reload or start a separate recovery journey. |
| 4. Player permissions | Not run | Expected permitted map and Journal access and no GM route/approval actions. A separate authenticated non-GM session was unavailable. |
| 5. Travel variants | Not run | Ordinary land, mixed and cargo-only travel, hired mount fares at 0%, 50% and 200%, local override and finite stalls remain open. |
| 6. Accessibility and layout | Partial | At **800 × 600**, Journal, camp, rest, march and end controls were within the viewport. Shift+Tab from End Journey focused Continue March, and the browser matched `:focus-visible`. Restored the original viewport. The 200% browser zoom, reduced-motion and compact review-detail checks remain open. |

**Evidence to preserve:** Journal `JournalEntry.15cC0k0kk6TjdWuY` (“Deap sea to Dirwest”) contained one Leg 1 section while in progress. At the daily travel-hours prompt the Journey panel showed **14%**, **7h 58m** traveled, and **+7h 58m** World time advanced. The visible World clock read **07:58 PM**, from a **12:00 PM** baseline. Closing and reopening the Journal still showed **0% confirmed**, **0m** confirmed movement, and **0m** World time recorded. The Journal was reopened and left beside the held Journey. No rest, forced march, continuation, or reload was applied after the discrepancy. Whether the Journal is intentionally updated only at later boundaries remains unverified.

### Live Journey continuation and remaining checks — 2026-11-26 (JST)

| Check | Result | Observed |
| --- | --- | --- |
| 1. Departure and checkpoint arrival | **Fail** for single-leg Journal recording. Arrival passed. | The approved Warship reached **Port Barthos**. Several overnight stops returned to **Resume leg**, showing **Previously approved — no new fare**. The Journal represented the one approved water leg as five sections, the first four partially confirmed. At Port Barthos the Journal credited **55h 8m moving** and **96h downtime**. The initial movement estimate was **54h 5m**. |
| 2. Onward and finished Journal | **Partial** | Explicitly approved Walking for four travelers and Riding Horse for Lucious at **1 SP**. Arrival at **Dirwest** passed. The completed Journal and Journey summary agreed on **64h 28m moving + 112h downtime = 176h 28m**. The Journal recorded the original water estimate **43 PP · 4 GP** once and the land estimate **1 SP** once, with no currency deducted. It represented the two approved legs as **six sections**, and the onward review labeled its origin **Party departure point** instead of **Port Barthos**. |
| 3. Separate reload and recovery | **Blocked before reload** | Started the separate **Dirwest → Millstone** Walking run. At its first daily limit the Journey showed **33%** and **+8h** World time, with the clock at **04:28 AM**. The new Journal still recorded **0% / 0m**. Stopped at that disagreement as requested. No reload or continuation was performed, and exact native token coordinates were not captured. Journey Journal `JournalEntry.jHbMAXIoNLFIx5eT`. |
| 4. Player permissions | **Blocked** | The available Foundry sessions were the authenticated GM and a separate join page. A signed-in non-GM account was unavailable, so player access and GM control absence could not be verified. |
| 5. Travel variants | **Partial** | Ordinary Walking began and moved, and the mixed Walking/Riding Horse leg completed. Cargo-only, hired 0/50/200% fare calculations, a local fare override, and finite stalls remain unverified. Attempted to open the QA Cart editor during the held Walking run, but Workspace did not open. |
| 6. Accessibility and layout | **Partial** | Active Journey footer remained in bounds at **800 × 600** and **400 × 300**. Keyboard focus matched `:focus-visible` at both tested widths. The compact viewport was restored. Actual 200% browser zoom, reduced-motion behavior, and review details in a compact window remain unverified. |

The completed Journey remains in `JournalEntry.15cC0k0kk6TjdWuY`. The separate Walking run remains held at its travel-hours prompt to preserve the pre-reload discrepancy.

### Follow-up candidate and retest instructions

The next draft candidate publishes the confirmed readable Journal at the daily travel decision when no native move is pending. Onward review uses the confirmed arrival checkpoint from the same Scene as its origin. These changes preserve the stored movement ledger, pricing, and World-clock writes. The readable Journal still lists resumed segments separately. Review how to present them together before changing that rendering or the stored record format.

1. Preserve the completed Journey and held Walking run as evidence. In the approved disposable World, install the new candidate from the existing branch manifest after CI passes. Verify Atlas `0.3.13-rc.3.2` in Add-on Modules and record the candidate commit separately.
2. In a fresh disposable run, stop at the first daily travel-hours prompt. Compare the reopened Journal with the Journey panel, Token position and World clock. Record confirmed progress, moving time and World time credited. Continue to a checkpoint and verify the onward From label names that checkpoint.
3. When the confirmed records agree, use a separately approved run to verify reload and continuation without duplicate credit. Finish any open player, transportation and accessibility rows from the release checklist. Keep the historical discrepancy records intact.

#### Fresh daily-hours boundary retest — 2026-11-26 (JST)

Started a fresh **West Gate → Millstone** Walking Journey in **Sandbox (Copy)** (`DnaYpY0ilR20GWLc`). The copy was viewed without activating it for players. The original completed Journal and held Walking run were preserved. The exact installed archive commit was unverified.

**Pass for Journal, panel, and clock agreement.** At the first daily limit, the Journey panel showed **43% and +8h World time**. The reopened Journal (`JournalEntry.wcFNyjFpAoXTv5Cv`) showed **43% confirmed, 8h moving, 0m downtime, and 8h World time recorded**. The visible World clock advanced from **04:28 AM to 12:28 PM**. The run was left at the prompt with the Journal open.

Exact native token coordinates and the onward **From Port Barthos** check remain unverified. Separate reload, player access, transportation, and accessibility checks were not run in this session.

### Journal continuation display candidate

The fresh daily-hours Journal, panel, and clock check passed in Sandbox (Copy). This follow-up groups explicitly recorded continuations under their approved leg in the readable Journal. Segment progress, directions, stops and fare history remain visible. Independent approvals still get their own leg numbers. The renderer leaves the saved ledger intact.

After CI is green, install the updated branch build once in the authorized test World using the existing RC.3.2 manifest. Preserve the earlier evidence Journals. Use a new disposable Journey with an overnight stop and a checkpoint transfer. Verify that the resumed segment sits under Leg 1, the onward approval starts Leg 2, the review says From Port Barthos, and the finished totals and fares still match the confirmed travel. Use the same install for separately authorized reload and non-GM checks. Record the installed build evidence and exact native Token coordinates if available.

#### Journal continuation candidate retest status — 2026-11-26 (JST)

**Blocked before installation.** [Stabilization checks for `953357e`](https://github.com/i-am-rayo/fvtt-atlas-navigation/actions/runs/45650636174) failed. The branch advanced to [`a70b012`](https://github.com/i-am-rayo/fvtt-atlas-navigation/commit/a70b0129a90164a4cd562adc76b17321d4d00be3) with a fare-deduplication correction. GitHub did not return a workflow run or commit status for that revision when checked. The handoff requires green CI before installing the candidate.

**Not run:** fresh overnight Warship Journey, grouping the continuation under Leg 1 and showing its approved fare once, Port Barthos onward origin and Leg 2, finished Journal reconciliation, separate reload, and non-GM permissions. No candidate installation or Foundry changes were made in this retest attempt.
