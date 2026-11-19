# Atlas 0.3.11-dev.18 — Territory editor identity and Road drafting status

**Milestone 01 / Issues #289 and #216.** Cumulative on owner-approved `0.3.11-dev.17`. No gameplay, schema, authority or native persistence change. This is a development build, **not** a release.

**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/fix/0.3.11-m01-289-216-territory-editor-batch/module.json

**ZIP:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/fix/0.3.11-m01-289-216-territory-editor-batch.zip

## Foundry v14 GM and non-GM acceptance

1. In one Scene, open **two different Territory Settings windows** (e.g., The Eyrie and Dirwest). Each must retain its own window title, selected page, minimize/restore state and actions. Closing one must not close the other. Reopen the same Territory and confirm only its own window is reused.
2. In a Territory Settings window, navigate **General / Map Marker & Journal / Map & Visibility / Boundary & Native** by clicking and keyboard Left/Right/Home/End. Check focus, selected state, accessible tab/panel relationship and narrow-window layout; switching must not invoke a native Region or Scene write.
3. With a Territory Settings window on **General**, rename its native Region through the official Foundry Region editor. After committing the native rename, the open Atlas window header should update **without switching tabs or reopening**. Open another Territory's Settings and confirm only the renamed item's header changes; no unsaved Atlas page/navigation state is overwritten. Renaming in another Scene must not update this header.
4. Start **drawing a new named Road** from Atlas Workshop. The modeless Road Editor header should identify the staged Road name, while the point count/draft status remains visible and accessible. Draw/undo/redo, Locate, Cancel and Finish; the original road graph must change **only** through the existing approved Finish action. Cancel must not write.
5. Non-GM: verify no new Territory/Road authoring controls are available and player-private data is not exposed. Confirm existing visibility, native Shapes/Behaviors, fog, Journal, Actor/Token, Journey movement, and World time are unchanged by opening or navigating these windows.
6. Run a quick regression of accepted dev.17 Map Marker/Workspace keyboard tabs, Road footer order and linked Terrain Region icon actions. The separate-editor sequential Save contract of dev.14 must continue to work.

## Automated gates

Focused tests verify per-Region window IDs, keyboard tab/panel association, native Region title updates scoped by Scene, listener cleanup, new-Road draft title and screen-reader status semantics. Run `npm run check`, `npm run architecture:check`, syntax/patch checks and `git diff --check` when locally available. Automated passing tests are not owner Foundry v14 acceptance.
