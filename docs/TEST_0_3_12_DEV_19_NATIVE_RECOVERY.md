# Atlas dev.19 — recover an unexecuted native checkpoint

Based on the owner dev.18 interrupted vessel snapshot: checkpoint 4 intent, actual TokenDocument at (3963,1769), clock 28978218042 equals intent baseline, 43,256 seconds already credited, prior native movement chain identifies the same operation. Neither checkpoint 4 movement nor its 14,418-second clock delta is credited by reconciliation. This slice intentionally does not reconcile at-end or conflicting evidence.

## Foundry v14 acceptance

1. Back up the World. Install dev.19 over dev.18; keep the existing saved Journey and token/time untouched. Open Navigation in the same Scene as active GM. If native state is stopped/completed and the confirmed anchor and chain still match, Recover Saved Journey should be available. If evidence is missing or changed, it must remain blocked; capture the state and do not forget the Journey.
2. Click Recover. Verify token coordinates and World time stay identical, approved Ship passage (hired), fare, pace, final Dirwest destination and passenger rest bookkeeping are preserved. Manual recovery loads a preview; only Travel Route starts the remaining approved leg. The old native checkpoint intent is cleared, but completed movement/time are unchanged.
3. Continue toward Port Barthos; verify the remaining movement, World clock, Journal and checkpoint decision. No second fare or prior-leg replay. Verify fresh voyages across day rollover with Simple Timekeeping weather enabled; redraw auto-recovery only after old writes settle and facts match. Manual pause and unknown/changed coordinate/time/native movement state must not cause auto movement.
4. Verify a second Recover action cannot duplicate credits and non-GM cannot reconcile. No weather, fog, Regions, roster, tariffs or Scene graph changes. If unable to recover, capture the saved native movement state (token.movement.state) and current coordinates/time, and keep the Journal.

Global method cards, named roster retention across surfaces, shared operating schedule A1, and unified confirmations remain separate pending work. No downgrade or main merge.
