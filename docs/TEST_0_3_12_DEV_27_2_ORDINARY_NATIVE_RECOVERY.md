# Atlas 0.3.12-dev.27.2 — GM / Non-GM Live Verification

**Status:** Draft stacked PR #495, GitHub Node/architecture CI verified; **not yet tested or accepted by PO in live Foundry v14**. No merge, tag, main release, or automatic upgrade. This build supersedes the dev.27.1 **draft** only for testing.

## Purpose and evidence

On 2026-11-23, a GM's Hearth's Heart → Dirwest Journey completed mixed land and water legs; canvas redraws during continuous native ship sailing recovered successfully. A later **ordinary** land TokenDocument.move advanced the live Token ahead of the last durably confirmed Journal anchor, then Foundry rebuilt canvas. Since ordinary chunks had no pending-native receipt, recovering that leg correctly failed closed but could not continue. Root cause tracked by Issue #189. Increasing the 1px native waypoint tolerance is not the remedy.

This slice reuses the continuous native verified movement coordinator for **ordinary and overtime** scheduled chunks. It preserves per-day rest and forced-march decisions and preview/approval/authority. A normal chunk now saves a durable pending move (unique v14 native movement ID, TokenDocument identity, ordered from/to path, authorized clock delta and Atlas revision) **before** move(); records native endpoint/path evidence, accounts exact World time once and saves the confirmed Journey anchor/percent before submitting the next interval. Visual skip/speed changes still apply only to subsequent normal chunks. On interrupted native evidence or conflicting clock, fail closed; no replay, teleport, fare/rest/clock duplication. The Journal remains the sole durable store.

## Test procedures — GM

1. **Prepare backed-up World.** Foundry v14 stable, configured Scene Roads/Checkpoints, assigned Group explorer Token, World-time setting enabled, SimpleTimekeeping weather/day-change Scene updates enabled for the reproduction. Do not test against a valued live Journey without a backup. Confirm version `0.3.12-dev.27.2`.
2. **Ordinary road movement and rest.** Approve a land leg longer than the configured daily limit using Walking, Cart or Riding Horse; verify each native chunk advances only approved TokenDocument coordinates and confirmed World time. At the limit, explicitly approve Long Rest and check that rest adds World downtime exactly once. Confirm later chunks continue.
3. **Canvas redraw during moving chunk.** Trigger the same World-time/weather Scene redraw as before, including after a native token movement update but before the UI animation finishes. Atlas must suspend and re-open; with exact native movement evidence and World-time state, it should reconcile and continue from a verified anchor without replaying the move or adding clock time twice. Check new Journal leg % / directions / target sequence.
4. **Repeat redraw** during a normal leg, during animation, after the World time update, and during the durable Journal write where possible. No duplicate rest events, doubled hire estimate, changed A/B/C/D targets, or newly authorized next-leg movement.
5. **Stop / Pause boundary.** Pause during native movement; the current interval may finish and checkpoint but no successor starts without resuming. End Journey during animation; the saved pending native evidence and recovery guard must prevent a replay or fabricated completion.
6. **Negative control — manual Token movement.** Move the Group Token manually mid-Journey or change route/Scene revision, level/elevation, ownership or World-time externally. Atlas must **stop and require GM review** rather than accept mere proximity as proof, continue from an unverified token position or overwrite the Journal.
7. **Checkpoint completion.** Arrive at authored dock; the previous land leg must be fully durably confirmed and the next water leg must await new explicit GM approval. Ship/water continuous operation must still recover on redraw as in dev.27.1. Ensure approved method, fare estimates and World time match Journal.
8. **Non-GM and inactivity.** A player must not authorize movement, modify World settings/Scene flags or advance World time. Inactive GM must not auto-resume/commit. Player read visibility must honor native Journal permissions.
9. **Legacy / blocked old Journey.** Open a prior Journey created with dev.27.1 that has *no* `pendingNativeMove` and Token ahead of last confirmed anchor: it must remain blocked, never auto-upgraded to fictitious native evidence. Do not use Forget Saved Journey or manually move token solely to satisfy an anchor.
10. **Unrelated pending requirements.** Moving a PC to **Not traveling** is currently preview-only (Issue #494 narrative Journey authority). Mount boarding/fees (#492) and unified confirmation dialogs (#493) are outside this P0 build.

## Automated verification and release gate

- Node tests include ordinary bounded checkpoint status; native ID/path / endpoint and foreign-movement guards; durable World clock vs pending Journal ledger; recovery of validated bounded `normal` operation; delayed animation and skip-visual preference; GM-rest/day behavior; existing continuous voyage tests.
- Verify `npm run check`, `npm run architecture:check`, `node --test`, version/manifest/archive alignment and `git diff --check` or equivalent. GitHub CI evidence is linked from PR #495.
- Green automation **does not** equal user acceptance. If automatic recovery still stalls or skips clock/movement, stop dependent features and attach exported console logs, Journal and native token movement diagnostics.

## Known safety boundary

Exact native operation identity and ordered public movement evidence take precedence over geometric tolerance. If valid receipt is absent or inconsistent, Atlas deliberately retains the Journal and blocks resume. Old journeys without a durable intent **cannot be retrospectively reconciled** from positions alone. Restoration after an interruption does not auto-approve the next leg, charge money, change Actor stats, or edit Foundry Group membership.
