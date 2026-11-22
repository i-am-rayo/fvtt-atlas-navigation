# Atlas dev.17 — mixed transportation confirmation (#468)

Owner accepted dev.16 on 2026-11-22 and selected A2 (named traveler assignments), B1 (compatible assignments retained as a draft on later legs), C (future legs preview-only; configure at checkpoint arrival). This build implements A2 only; B1/C are explicit requirements for the multi-leg follow-up, not implemented here.

## Foundry v14 acceptance
1. Reproduce Walking + Warhorse + Riding Horse + Cart. Confirmation shows the named travelers under each method, traveler counts, unit counts and per-method estimates. Walking has no fare; cargo-only resources are identified. No-seat companions appear by name without a suffix.
2. Confirm 1 SP + 2 SP + 5 GP = 5 GP · 3 SP in planner, confirmation, and completed Journal. Fractional quotes independently round upward using the same formatter; no funds deducted. Compare moving time and speed.
3. Cancel, reopen, and change a fare or roster while the dialog is open: preserve the existing rejection/revalidation and no-write behavior. Test long names, narrow dialog, keyboard access, walking pace exception and non-GM prevention.
4. Complete the journey; expected native token movement, World time and Journal remain unchanged. Existing recovery guards must remain intact.

## Next slice (not implemented)
Use the existing traveler deck for the current eligible leg of a multi-leg route; retain compatible prior assignments by stable IDs as a draft only; invalid or stale offers require review. Future legs stay previews, with fresh GM authorization per leg. Preserve original final destination, completed-leg snapshots, approved recovery pace and native movement/time guards. Do not remove unresolved-transfer guard without implementing and testing safe per-leg authority and recovery.
