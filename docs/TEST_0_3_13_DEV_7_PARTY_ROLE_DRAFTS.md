# Atlas 0.3.13-dev.7 — Party transportation role continuity and draft clarity

## Scope
Milestone 01, first part of #527. Based on the PO-accepted dev.3 commit (0aa9a5d). The failed dev.4–dev.6 Territory stack is excluded. No native Group/Actor writes, boarding, travel, currency, capacity calculation, preset ownership or Region changes are introduced.

## GM live test
1. Open Party-owned Transportation from the native D&D5e Group. Select Need Setup, change an unclassified NPC such as Nyx to Companion / passenger. The row must stay visible and its role/seat controls remain usable without automatic tab changes.
2. Toggle Needs seat, change role again, then deliberately switch tabs. The row must appear in the final selected category, and staged values must remain intact. Repeat from NPC to Rideable Mount and back; test keyboard tab navigation and focus.
3. Edit a personal mount. Assigned To should display current eligible Party member names, never raw Actor IDs. Duplicate names have distinct numbered labels, values remain stable IDs; an unavailable existing rider is clearly indicated. Verify a newly eligible NPC can be assigned from the child dialog. Pooled mounts still must not have exclusive riders.
4. Apply to Party draft: the parent shows Unsaved changes, while persisted Group assignments and World presets remain unchanged. The row should stay in place if the transport profile changes its surface until switching tabs or saving.
5. Click Cancel after a change. Decline discard and verify the draft remains. Confirm discard, reopen, and verify the old assignments. Also test Refresh, child-dialog dismissal and unchanged Cancel.
6. Repeat and click Save Party Transportation once. Reopen and verify roles, Needs seat, quantities, linked profile IDs and named rider assignment. Native Group membership and Actor data must be unchanged. Verify stale roster/assignment and incompatible reserved-rider checks still refuse invalid saves.
7. Test keyboard focus, native light/dark themes, resize and 200% zoom; the labeled Save and Cancel must remain reachable and not clip. Verify the GM-only editor is inaccessible from an independent non-GM client.
8. Regression: dev.3 A–Z dropdowns, Road creation → Settings, existing travel preview and recovery behavior. No changes to journey costs or gameplay authority.

Dev.8 will address compact vehicle/Warship cards and capacity shortfall presentation; dev.9 will address Map Marker offer clarity. These are deliberately not included.

## Test installation
Manifest: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feat/0.3.13-dev7-party-role-drafts/module.json
Archive: https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/feat/0.3.13-dev7-party-role-drafts.zip

Draft PR #529 targets release/0.3.13-uiux. A green CI run does not replace GM/non-GM live acceptance. Before integrating, repoint the manifest/archive to the integration branch and verify the integrated candidate. No merge or release without PO authorization.
