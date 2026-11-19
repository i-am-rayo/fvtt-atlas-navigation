# Atlas 0.3.12-dev.4 — Group transportation picker and quantity

## Foundry v14 GM live acceptance
- [ ] Open the Party-owned Transportation editor for a mount and a Vehicle. World profile select has the unlinked option followed by **Land / Water / Air** headings; each group displays names **A–Z** and no redundant surface suffix.
- [ ] Presets are still selected by immutable World ID. Reload after Save, rename a World profile without changing its ID, and confirm that the correct profile remains selected. Missing/deleted IDs remain visible as unavailable rather than silently changing.
- [ ] **Quantity Available** is a synchronized slider and number input (minimum 1, maximum 100, whole-number step 1). Slider edits update the number, direct numeric input updates slider, values 1/3/100 survive child Apply and parent Save/Reopen. Invalid 0, decimal and 101 are blocked by the validated Group Save flow.
- [ ] Cancel child and parent without Save; verify no World settings write. Confirm Group Save still has same-Group stale protection and separate-Group merge safety. No native Actor, Token, Scene, Region, Journal, currency or World-time writes.
- [ ] Compare the General / Services(disabled) / Ownership layout and compact NPC row against owner-approved dev.3; check keyboard, narrow window and 200% UI scaling.

## Non-GM
- [ ] Party-owned Transportation editor remains unavailable and direct-save guard enforced. No hidden GM metadata.

## Automated
- `npm run check`, `npm run architecture:check`, syntax, patch whitespace. Actual owner live acceptance remains required.

Out of scope: #459 Assigned To per-rider availability; Territory #417, startup #453, merges/releases.
