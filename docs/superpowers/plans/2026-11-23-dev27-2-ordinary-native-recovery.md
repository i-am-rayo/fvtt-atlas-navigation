# dev.27.2 — Ordinary Native Movement Recovery Plan

> **For agentic workers:** Use systematic-debugging, test-driven-development, and verification-before-completion. No PR merge, release, tag or acceptance without the PO.

**Goal:** Make every ordinary (standard/overtime) guided Atlas movement interval durable, bounded and reconcileable after Foundry canvas teardown, using the already-approved v14 native movement identity/route proof. Do not silently credit a token position, World time, rest, or fare.

**Architecture:** Keep native TokenDocument.move in the existing `coordinateNativeTokenMovement` adapter and the validated `pendingNativeMove` in the authoritative Journey Journal. The normal-travel day/rest planner retains authority to split into short intervals and apply GM rest decisions. Reuse the existing callback-driven durable intent → native evidence → approved World-time → Journal commit sequence, with one native interval per normal chunk. Reconciliation accepts any **validated bounded** approved movement, not only an operation labeled continuous. No changes to legacy Journals on read.

**Tech stack:** JavaScript ESM, Foundry v14 public TokenDocument / Hooks, Node `node:test`, GitHub Actions.

**Scope:**
- [ ] RED: a nonterminal normal interval must commit a durable intent before `token.move`, and keep status moving (not claim arrival).
- [ ] RED: normal bounded recovery with exact native identity/path and clock succeeds; foreign movement, missing proof, changed World time, level or route fails without replay.
- [ ] GREEN: reuse `runNativeContinuousLeg` as a bounded-step executor for scheduled ordinary chunks with separate terminal semantics; retain dynamic rest/forced-march choices.
- [ ] GREEN: allow bounded normal/overtime pending intents through the same read-only recovery assessor; reconcile partial only if native proof and clock are unambiguous.
- [ ] Verify unchanged continuous route, final checkpoint, GM/non-GM, saved Journal and redraw behavior.
- [ ] `npm run check`, `npm run architecture:check`, full Node tests, syntax, branch version/module.json URLs, PR diff and CI checks.
- [ ] Draft stacked PR and GM live test checklist; no merge/release.

**Review focus:** native operation ID reuse; fractional/rounded waypoint disagreement; canvas interruption after TokenDocument position change but before clock/Journal; failed World time write; stale arrival/checkpoint or moved token by non-Atlas agent; rest between native intervals; clock-disabled 0-second receipts; no forced 1px tolerance increase.

**Safety:** If an ID, waypoint chain, elevation, route revision, World-time state, or Journal revision is not provable, preserve the record and halt with GM diagnostics. Do not teleport, create Group Actors, charge fares, rerun rests or replay native movement.
