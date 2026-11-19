# Atlas 0.3.12-dev.5 — Unique mount Assigned To

## Foundry v14 GM live acceptance
- [ ] Confirm dev.4 profile categories and Quantity slider remain unchanged; this is a cumulative dev.5 build.
- [ ] In a D&D5e native Group Actor with two PCs, open Party-owned Transportation > NPC explicitly set **Rideable Mount** > Edit > General. Confirm **Assigned To** offers None and current eligible Group members with stable ID distinction, even for duplicate names. Quantity Available=1.
- [ ] Select one PC and Apply. Close parent without Save; reopen and verify no association persisted. Repeat and **Save Party Transportation Assignments**; reopen and check the correct named assignee appears in the compact resource summary, stored by Actor ID and survives renaming.
- [ ] One horse assigned to PC A must not count for PC B when planning only B. It contributes one seat when A travels, even if the World profile says more seats. A shared second horse or pooled resource remains available for other travelers. Method availability/capacity and quotes must never double-count A or charge for A's unused personal mount.
- [ ] For a mount assigned to PC A, changing its quantity to 2, changing role to Pack animal/Not traveling, or excluding it must fail without writes **until Assigned To is explicitly cleared**. No automatic per-unit assignment for pooled mounts. A rider cannot be assigned to two personal mounts; GM may explicitly transfer A from one mount to another in one staged Save.
- [ ] Remove A from native Group or change its traveling role after opening the editor: stale or ineligible assignee save must fail and preserve the existing data; after reopening show the unavailable rider rather than silently reassigning. Rename and duplicate names retain stable IDs.
- [ ] After Save, verify only Atlas Group World setting changed. No native Group membership, Actor, Token, Scene, Region, currency, Journal, World time or approved Journey action is committed by a preview.
- [ ] Check 200% UI scale, keyboard/focus, cancellation, multiple Group windows and stale same-Group rejection. Test a selected-PC route preview and a full-party convoy.

## Non-GM
- [ ] No Group assignment controls or direct-save authority; hidden GM data is not exposed through a player-facing view.

## Automated and release gates
- `npm run check`, `npm run architecture:check`, JS syntax, PR whitespace/`git diff --check`. Record actual owner live observations separately. Keep PR draft, issue #459 open and main unchanged until accepted.
- Post-update startup #453 and Territory #417 are separate; do not conflate with this build.
