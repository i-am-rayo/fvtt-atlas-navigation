# Atlas v0.3.9-beta.8.58 — Combined UI owner-test candidate

## Baseline and authority
Owner live-accepted beta.8.57 (7/7 checks) is the baseline. Draft PRs #370–#374 are stacked without merging. This candidate includes four UI workstreams from #362 plus the separately requested Road Settings migration to a modeless ApplicationV2 window. A successful GitHub run is automated-only, not live Foundry acceptance.

No new Scene Atlas schema, World catalog schema, migration, Journey transition, Token/Actor resource ownership, Journal permission override or native Region geometry/Behavior implementation. Preview, sorting and navigation remain read-only; only existing explicit GM-authorized handlers may write.

## Implemented
- **Road Settings window**: existing Road Settings now uses a modeless ApplicationV2 form instead of DialogV2.input; the same application-layer Road Save/stale-guard and linked-item actions remain. A close guard handles unsaved changes; the submit result must be collected before a Save authorizes close. New-Road authoring and small native prompts still use DialogV2.
- **Road Customization**: Road settings, Road name styling and Map preview sections. Paired slider/direct numeric width (px) and opacity (percent), with retained internal opacity ratio; standalone illustrative SVG line preview. Original validation, nullable Road appearance override/inheritance and World preset ownership stay intact. Existing Road preset identity plus Change action, staged eye/eye-slash visibility, Locate/Edit/Connection/Save/Delete footer.
- **Road-linked lists**: compact Count/Add headers; alphabetical Checkpoint display as a pure copy, with native Region routing priority untouched; existing Checkpoint select/locate and transient native Region Locate actions. Retain Region drag order, generation/regeneration confirmation and native Behavior safeguards.
- **Map Directory**: separate Create/Manage/View controls, no redundant Manage disclosure, inline action icons and no redundant Shown/Hidden suffixes. Existing filters, expansion state, GM edit actions and player projection remain unchanged.
- **Exploration & Travel**: Travel rules and Journey & playback are real tabs. Tab switching preserves mounted local drafts and only existing Save buttons commit World settings. No World time or travel action on tab change.

## Deliberate compatibility boundaries
- Opacity follows the existing schema range 0.10–1.00; **0% is not legal** and this UI release does not weaken the Road appearance validator.
- The direct numeric field accepts validated legacy fractional Road widths/opacity values without rounding on open. Sliders retain their prior tick intervals. Stored appearance and Road graph IDs are not migrated.
- The SVG Road preview is a settings illustration, not a second PIXI road renderer. GM must compare its pattern/border/name behavior against the actual Scene canvas; any mismatch is a review blocker, not permission to silently change stored geometry.
- New-Road creation still uses a native DialogV2 form; its numeric slider/number sync and border toggle are delegated to live cloned nodes. Verify both that workflow and existing-Road ApplicationV2 authoring.
- Other beta.8.55 UI annotations not specifically addressed by these PRs, including full global action inventory and text-zoom evidence, remain open.

## Required owner acceptance — backed-up Sandbox World, GM and non-GM
1. Install the beta.8.58 test manifest, restart/refresh Foundry, and verify reported version **0.3.9-beta.8.58**. Keep beta.8.57 as known-good rollback.
2. Open Road Settings from Road canvas and Map Directory; verify the modeless window, title, resize, minimize/maximize and focus. Open two different Road Settings windows and verify no ID collision. Open the Checkpoint and Territory editors unchanged.
3. Change Road name, visibility, preset, width, opacity, labels and Journal link. **Save once** and reopen; verify exact values, including 10%, 35%, 100% opacity and fractional width. Verify no duplicate Scene revisions, no unrelated native Region/Checkpoint edits, no silent preset/World rewrites.
4. Edit a Road, choose header X/Cancel with dirty changes. Test Continue editing, Discard, and Save. Confirm invalid/out-of-range/empty numeric drafts never authorize a save/close; test a stale Road changed by another GM (must refuse rather than overwrite).
5. Open **Customization** on an existing Road: all three sections appear, colors/width/opacity/pattern/border/labels update the draft preview, Off/Hover/Always behave, Cancel discards. Compare canvas render after explicit Save; note exact differences. Try normal, narrow and 200% text zoom.
6. Change travel preset via pencil and None/fallback, Cancel without saving, reopen, then Save. Verify existing World presets remain untouched. Toggle footer eye: icon and accessible label change as a draft, then commit only on Save; confirm hidden Road text remains filtered for a non-GM player.
7. Create a Road through its separate native new-Road prompt: numeric entry/slider sync, border toggle, Save and Cancel. Authoring topology and checkpoints must remain unchanged unless the GM explicitly draws/saves them.
8. Open the Road-linked **Checkpoints** list with mixed-case/accented names. Check A–Z display without persisted order mutation. Use Checkpoint Locate/Settings and compact Add. Check Regions retain route priority, drag reorder works only on explicit GM action, and native Region Locate highlights the correct region transiently without switching Scenes or changing Behaviors.
9. Open **Map Directory**. Confirm visible Create/Manage/View groups and original creation/managing commands, search/filter state, nested expansion/scroll, inline item actions on collapsed rows, icon clicks not toggling parent rows, no redundant Shown/Hidden suffixes, and accessibility with long names, keyboard and narrow viewport.
10. In **Settings > Exploration & travel**, switch Travel rules ↔ Journey & playback with unsaved inputs; values remain intact. Switching never writes World settings, runs a Journey, charges fares, moves Tokens, rests Actors or advances World time. Explicit Save retains the original World scope.
11. Non-GM check: no Road/Checkpoint/Territory settings authority or hidden Road/Region/Journal exposure through any new UI. Verify Fog, Region priorities and current Journey recovery are unaffected.
12. Report screenshots/logs with module version, Foundry v14 build, World and Scene IDs, tested actions and any failure. Do not merge, install on production or publish a stable release without explicit owner authorization.

## Rollback and links
Manifest: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.58-ui-combined/module.json
Archive: https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.9-beta.8.58-ui-combined.zip
Previous accepted beta.8.57 manifest: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.57-footer-ui/module.json
