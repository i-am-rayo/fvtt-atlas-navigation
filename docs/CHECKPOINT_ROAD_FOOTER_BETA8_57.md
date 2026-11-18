# v0.3.9-beta.8.57 — Road and Checkpoint footer acceptance

## Baseline and boundaries
Stacked on the owner's fully accepted beta.8.56 six-point Foundry v14 Checkpoint UI test. PRs #367 and #368 are the only new runtime slices. No schema, migration, GM authority, Region geometry/Behaviors, Scene flags, Journal, Actor, Token or Journey gameplay changes.

- Checkpoint Settings **Save Checkpoint** is a shared compact floppy icon. Its existing explicit save workflow, validation and disabled/save-once behavior remain.
- Checkpoint Save has right alignment immediately preceding **Delete**, with Delete last in actual DOM/tab order. **Save as preset…** is separate and retains World-setting ownership.
- Road Settings retains **Foundry DialogV2's original native** `data-action="ok"` submit button; it receives a shared floppy icon and `Save Road` accessible name. No substitute button or handler is introduced.
- Road footer places the native Save immediately before Delete at the far right. Existing Edit, Connection and Cancel remain earlier in DOM/focus order.

## Owner Foundry v14 acceptance — backed-up Sandbox only
1. Verify module version **0.3.9-beta.8.57** and retain beta.8.56 as recovery baseline.
2. Open existing and new Checkpoint Settings. Icon-only Save has a **Save Checkpoint** or **Create Checkpoint** tooltip/accessible name; Delete stays last/right. Tab/Shift+Tab order matches layout; focus remains visible.
3. Edit Checkpoint marker/name and save once. Reopen and confirm persistence; no duplicate revisions, Journal side effects or unexpected Region regeneration. Confirm GM permission guards and stale revision error still refuse unsafe Save.
4. Change Checkpoint settings then Cancel/close. Verify dirty confirmation and that discarded changes are not persisted. Save as preset separately; confirm it does not save the current Checkpoint.
5. Open Road Settings on an existing Road. Check Save floppy icon/tooltip, Cancel, Edit/Connection and far-right Delete at normal/narrow width and 200% text zoom. No overlap or clipped footer.
6. Rename or restyle a Road and click native Save once. Confirm Road persists, Dialog closes appropriately, and no duplicate writes/events occur. Reopen to verify. Check Cancel/close does not persist drafts.
7. Test Road Delete confirmation; cancelling must leave Road, graph, Checkpoints and Regions unchanged. If confirming deletion, use only an owner-approved disposable fixture and verify permission/topology guards.
8. Verify non-GM cannot acquire editing permissions or see hidden Road/Checkpoint/Territory data merely because an icon or footer changed. Check GM and player UI without modifying production content.

## Validation/report
GitHub stabilization CI must succeed on the final beta.8.57 head. `npm run check` and `npm run architecture:check` are required; no unit test substitutes for GM/non-GM Foundry v14 acceptance. No merge or stable release before owner approval.

Manifest: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.57-footer-ui/module.json
Archive: https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.9-beta.8.57-footer-ui.zip
