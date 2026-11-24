# 0.3.12-dev.2 — Party-owned Transportation correction checklist

**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/fix/0.3.12-m01-group-shared-editor-and-lists-dev2/module.json

Dev.1 **failed** owner visual acceptance. Dev.2 changes the real shared editor + native Group display; **not** a new transport catalog and **not** a rider-allocation feature.

## GM — Foundry v14 / D&D 5e
- [ ] Open the Group Actor → Party-owned Transportation. Verify compact **Land Travel / Water Travel / Air Travel** sections like Map Marker Transportation. There is **no Player Characters tab**; the actual native Group characters still determine traveler totals. NPCs not explicitly marked Mount remain editable under Other NPCs / Needs Setup. Native Vehicles remain the only source of Vehicle resources.
- [ ] Edit a Horse and a Vehicle: one **actual shared dialog** with **General, Services (disabled), Ownership**, rather than the former Group-only form. Confirm `Quantity Available`, World Transportation profile by stable ID, native capacity/speed inheritance and ownable upkeep/purchase/GM note. No duplicate editable World catalog; existing Group-owned values survive reopen.
- [ ] General and Ownership customizations only override when explicitly checked; unchecked fields inherit current World values (including a renamed preset's ID). Services must be non-interactive via click, keyboard and form submission; no hired-service settings are written on Group Apply.
- [ ] Apply child change, then cancel/close parent: nothing persists. Repeat and Save Party Transportation Assignments; only scoped `guidedGroupTransportation` setting changes, without Scene/Actor/Token/currency/Journal/World time writes. Different Group saves preserve each other, same Group stale or World catalog changes block.
- [ ] Standard accessible Edit and Remove icons. Remove a Warship, confirm, **do not save** and reopen: still included. Remove and save: native Warship remains in D&D5e Group but is excluded from prospective Atlas capacity/fare; reload preserves exclusion. Re-enable, Save and confirm capacity returns. Canceled confirmation does nothing.
- [ ] Legacy v1-v4 saved data defaults to included without write-on-read. No name-based auto-link to a World profile. Missing/deleted profile remains recognizable; cannot silently change to another ID.
- [ ] 200% Foundry UI scale, keyboard focus, narrow modal, child cancellation, no horizontally clipped Save, Refresh/dirty protection.

## Non-GM
- [ ] No Group editor launcher or saving rights. No hidden GM metadata exposed.

## Explicitly NOT included
- #459 uniquely Assigned To mounts affecting per-player eligibility. This is a **gameplay calculation** and requires separate pure matching, stable rider IDs, snapshot/recovery and GM/non-GM live acceptance, not merely an extra dropdown.
- Native Actor edits/deletions, World preset edits, boarding, fares, Journey authorization/recovery, Terrain Region appearance #417, and startup reliability #453.

## Gates
- GitHub `npm run check`, `npm run architecture:check`, JavaScript syntax, PR patch whitespace, local `git diff --check` where checkout is available. Automated green is not a live Foundry v14 GM/non-GM acceptance.
