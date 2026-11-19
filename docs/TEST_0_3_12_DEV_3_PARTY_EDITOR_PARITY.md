# Atlas 0.3.12-dev.3 — Party-owned Transportation UI corrections

**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/fix/0.3.12-m01-party-editor-parity-dev3/module.json

Owner feedback from five 2026-11-19 screenshot annotations. Dev.2 was **not accepted** as final UI parity; this is the cumulative corrective build stacked on dev.2 PR #462. It is not a merged release.

## Foundry v14 GM acceptance

- [ ] Open Party-owned Transportation with an existing Group, native NPC Mounts and Vehicles (including long names). Land / Water / Air sections remain; Actor names align left and Role selection plus Edit icon align to the far right **on one row**, followed by compact transport details. Long names truncate before obscuring controls; verify keyboard focus and 200% scale.
- [ ] NPC rows do **not** show Atlas Delete; native Group membership and the explicit NPC role ("Not traveling" etc.) control whether they travel. Role change between Mount and other NPC moves the row between travel type and Needs Setup without data loss; the Party and vehicle capacity projections continue to use role eligibility. Vehicle rows still have confirmed Group-only Remove and Re-enable, never native Actor deletion.
- [ ] Open Map Marker Transportation > Edit an offer, then Group's Edit the corresponding resource. Both use the **same** General / Services / Ownership dialog layout and controls. In Group, Services is visible but disabled/inert and cannot be selected by click or keyboard. Group adds only **Transportation profile** and **Quantity Available** fields to General; no extra visible Customize rows.
- [ ] Verify General shows native Actor name, World profile selection, pace slider, capacity and GM note. World-owned Required crew is **not** editable in Group. Changing speed/capacity/note records Group-only override; an untouched value inherits the linked World preset, even after the World profile later changes.
- [ ] Ownership has the same World/Map Marker feed/supplies/upkeep layout, without extra Customize fields, sale offers or crew-wage input for an already-owned resource. Changing coin amounts, recurrence, or charge basis records Party-only override. Zero is a valid explicit cost. Existing legacy purchase overrides must **survive unrelated edits**, without showing a misleading purchase control.
- [ ] The Group-only Reset action restores inheritance; **Apply to Party draft** only stages changes. Close parent without Save and reopen: no write. Save parent and reopen: Group World-setting values persist, no Actor, Map Marker, Scene/Region, Journey Journal, Token, currency or World time writes.
- [ ] Confirm World preset deletion or rename: stable ID and unavailable value retained/indicated, no automatic name-based relink. Same-Group concurrent edit rejects stale Save; different Groups can save independently. Native roster changes require reopen.
- [ ] Confirm existing saved v1–v4 Group records still read without migration-on-read. Confirm v5 excluded vehicles remain excluded after reload, and Re-enable requires Save.

## Non-GM

- [ ] No Party transportation editing launcher or direct save authority; no hidden metadata exposure.

## Out of scope

- **#459** Assigned To per-rider mount eligibility (requires pure capacity/Journey approval and recovery tests).
- Territory #417, startup delivery issue #453, and the public release/integration.

## Required gates

Run `npm run check`, `npm run architecture:check`, JavaScript syntax checks and `git diff --check` in a checkout when available. Distinguish automated success from actual owner GM/non-GM live acceptance.
