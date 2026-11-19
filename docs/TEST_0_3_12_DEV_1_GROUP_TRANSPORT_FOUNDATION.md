# Atlas 0.3.12-dev.1 — Group transport foundation

## Owner live Foundry v14 GM test
- [ ] Install development manifest and confirm first boot. If Atlas fails before refresh, capture Network before retry and attach to #453.
- [ ] D&D5e Group Actor → Travel Pace → Manage Party Transportation. Vehicles/NPC/PC categories still exist in this foundation build; do not expect dev.2 compact lists yet.
- [ ] On a Vehicle and a rideable NPC, click **Edit [Actor] transportation**. Child dialog uses the World preset selector, **Quantity Available**, capacity/speed and owned upkeep/purchase/notes; there are no inline override fields in the Group overview.
- [ ] Change quantity 1→3, link an existing World preset, set one explicit override; use **Apply to Party draft**, then close parent without Save. Reopen: no change persisted.
- [ ] Repeat and **Save Party Transportation Assignments**; reopen: Actor ID, profile ID, quantity, capacity and overrides are correct. World transportation catalog and native Group Actor/Vehicle remain unchanged.
- [ ] With a new Group vehicle, leave capacity blank and choose a World preset with capacity set; the Group projection should inherit it. Existing explicit capacity must survive profile edit. Change World preset only after closing drafts; inherited fields change and explicit overrides stay. Unknown capacity should remain unknown.
- [ ] Quantity Available rejects 0, 101, fractional and missing numbers. Zero upkeep is a legitimate explicit override, unlike blank inherited upkeep.
- [ ] Two Group settings open: saving different Group must not overwrite the other. Same Group stale edit, changed roster and updated World presets must fail safely with no partial write.
- [ ] NPC classification remains manual (do not classify every NPC as a mount), and all PC travelers remain counted. Vehicle list comes from native Group membership only. No automatic boarding, fares, Token/Actor/Scene/Region/Journal/World-time updates.
- [ ] Validate keyboard/200% scale, Cancel in child, Cancel/Close parent, and restoration after reopen.

## Non-GM
- [ ] No Group transportation edit launcher; direct launch and save are blocked. No hidden GM metadata is exposed.

## Automated
- `npm run check`, `npm run architecture:check`, JS syntax, Git patch whitespace; tests must cover child Apply only, capacity inheritance, parent Save, stale writes and non-GM guards.
- Document actual live findings separately. Do not merge/publish/close #456 or #458 before owner acceptance.

**Scope boundaries:** #457 compact travel lists/Remove and PC tab removal, #459 assigned rider metadata, #417 native Territory appearance, #453 first-boot reliability remain open for subsequent authorized batches.
