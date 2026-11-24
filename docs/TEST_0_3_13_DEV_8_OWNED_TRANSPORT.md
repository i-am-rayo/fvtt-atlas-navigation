# Atlas 0.3.13-dev.8 — Compact Party-owned transportation and capacity clarity

Milestone 01, second portion of #527. Dev.7 was reported successful by the Product Owner; dev.8 starts at its exact accepted commit 190dd4e681bb6995dcf93346ffbcea77ab773b3d. The rejected Territory stack remains excluded. No changes to Group membership, Actor resources, pricing, movement, Journey approval, Regions, or persisted schemas.

## GM live acceptance (Foundry v14)
1. Open Party-owned Transportation, switch Land/Water/Air. A lone Warship card should occupy only its content height at the top, not stretch across an empty panel. Multiple vehicles remain readable and grouped by surface. Check empty categories.
2. For a linked resource, verify quantity, effective seats per unit, total seats, speed and upkeep with World-versus-Group labels. Native vehicle capacity without a linked profile remains readable; missing speed/upkeep are explicitly not configured. Check metric and imperial display preferences.
3. Use four pooled seats for five seat-requiring travelers. Land summary shows 5 seats needed / 4 available and 1 seat short. Toggle a companion's Needs seat off; the draft now shows four needed without a shortfall. Toggle it back. No persistence before Save.
4. Verify an exclusive personal mount contributes one seat only for its eligible named rider even when its nominal capacity is higher. Unavailable or excluded transport must not be counted. A missing native vehicle capacity must be marked unknown, not zero as a confirmed capacity.
5. Apply a change to quantity, capacity, or a linked profile in the child dialog. Parent cards and capacity summary update from the same validated draft; row stays visible until deliberate tab switch. Change an assigned rider's eligibility: invalid draft must display capacity preview unavailable, retain the draft and refuse Save until corrected.
6. Cancel the draft, then reopen. Confirm unchanged saved data; repeat and Save Party Transportation once, then reopen and verify persistence. Native Group/Actor data unchanged.
7. Repeat dev.7 role continuity, tab focus, Cancel confirmation and named rider regressions. Check themes, keyboard, resize, 200% zoom, and separate non-GM access. Confirm no new movement, boarding, time, fares or Journal side effects.

## Candidate
- Manifest: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feat/0.3.13-dev8-owned-transport-cards/module.json
- Archive: https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/feat/0.3.13-dev8-owned-transport-cards.zip
- Draft PR #530 is incremental against the immutable dev.7 branch pending separately authorized integration. The release branch and main remain untouched.
- Dev.9 (Map Marker transportation offers) and dev.10 (Workspace polish) are not included.

Automated tests do not replace Foundry GM/non-GM live acceptance. No production release or merge authorized by this candidate.
