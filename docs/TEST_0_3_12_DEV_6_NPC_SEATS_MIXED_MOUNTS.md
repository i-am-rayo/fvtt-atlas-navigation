# Atlas 0.3.12-dev.6 — Owner acceptance: NPC seats and mixed mounts

**Status:** draft implementation, automated-tested; actual Foundry v14 GM/non-GM acceptance still required. Stacked on dev.5, not merged into main.

## GM: Group settings, tabs and draft safety
- [ ] Existing v6 personal mount `assignedTo` by stable Actor ID survives install, reopens, and a character rename. Old v1–v6 NPC passengers default to **Needs seat: Yes** without a write on open.
- [ ] Party-owned Transportation shows keyboard-accessible **Land | Water | Air | NPC | Need Setup** tabs, preserving unsaved edits when switching. Need Setup shows `! (N)` when unconfigured NPCs exist and removes the warning when configured. NPC tab categorizes Companions/Passengers, Crew, Pack Animals and Not Traveling.
- [ ] From Need Setup choose Companion / passenger: NPC moves to NPC tab and gains a **Needs seat** checkbox (default Yes). Switch to No, stage without Save and close: no persistence. Repeat, Save, reopen: No persists. Toggle is hidden for unassigned/mount/crew/pack/ignored roles.
- [ ] No vehicle or NPC displays a trash/Delete control. Remove a member through the **native Group** sheet; Atlas projection stops including the removed Actor. Legacy Atlas `enabled:false` entries are visible as excluded and can explicitly **Restore**; this is staged until Save.
- [ ] Footer: **Transportation Presets** and Refresh at left, accessible floppy-disk Save at far right. Tab/role/checkbox actions make **no** World/Actor/Token/Journal writes. Refresh with a dirty draft asks for confirmation. Same-Group stale changes and changed native Group roster are rejected; independent Groups merge safely.
- [ ] A newly configured individual NPC passenger can be selected as an assigned mount rider without stale choices after changing role in a staged editor. Reassign/clear personal mounts remains explicit, unique and validated.
- [ ] Test narrow window, 200% zoom, keyboard Arrow/Home/End on tabs, icon accessible names, and a separate non-GM client.

## GM: the exact three seat scenarios
Set up 3 PCs (Cassian, Lucious, Torrus); Nyx (NPC companion, Needs seat **No**), Jonathan (NPC passenger, **Yes**), and a second VIP NPC (**Yes**). Use one Group Actor, not duplicate synthetic traveler Actors.

| Scenario | Party travelers | Seats required | Fleet A: 3 unassigned horses | Fleet B: 3 unassigned horses + Hamilton (assigned to Cassian) |
|---|---|---:|---|---|
| 1 | 3 PCs + Nyx | 3 | **OK** (3) | **OK** (4) |
| 2 | 3 PCs + Jonathan | 4 | **Insufficient by 1** | **OK** (4) |
| 3 | 3 PCs + Nyx + Jonathan + second VIP | 5 | **Insufficient by 2** | **Insufficient by 1** |

- [ ] Party status and Navigation display **3 PCs | N NPCs** and separate **seats needed**, not a misleading all-passengers-seat count.
- [ ] **Select party members** lists the three PCs **and each named NPC**, including Nyx (shares seat) and Jonathan (needs seat). Deselecting an NPC removes it from preview, not from native Group; incomplete Group trips remain preview-only and cannot move the whole explorer Token.
- [ ] Choose **Mounted (general)** to combine compatible horses and camel. Preview shows 4 units/4 seats only if Cassian travels with his reserved Hamilton. Choosing horses-only or camel-only remains a different matching method, not a mixed convoy.
- [ ] Deselect Cassian: Hamilton does not donate a shared seat or slow the convoy. Re-select him: one reserved seat returns. A Group can't double-assign the same rider to two mounts; changing a personal mount to a pool still requires clearing its assignee.
- [ ] Assign horses 3.5 mph and Hamilton 2.5 mph (or Group speed overrides): **Mounted (general)** convoy pace uses **2.5 mph** when both participate; horses alone use **3.5 mph**. Inline GM FYI explains the slowest mount, without a notification banner.
- [ ] Quotes, upkeep and passenger counts do not charge Nyx a separate passenger fare or charge for an absent reserved camel. No preview books transportation, advances the World calendar, spends currency, boards members or changes native documents.
- [ ] Existing approved Journey/Journal and pending-native-move recovery remain authoritative across canvas refresh and client reconnection; no retroactive fare, time, movement or duplicate event.

## Non-GM and release gates
- [ ] Non-GM cannot open or commit Group transport settings or see private Group metadata; no client-only visibility enforcement substituted for permissions.
- [ ] Run `npm run check`, `npm run architecture:check`, JS syntax and `git diff --check` locally if available. Verify PR patch whitespace, exact branch module/ZIP, and mainline version.
- [ ] Leave PR draft, issues #459/#457 open and `main` untouched until actual owner live acceptance. Territory appearance #417 and unrelated first-load issues are excluded.
