# Beta.8.55 UI follow-up — implementation handoff

Date: 2026-11-17
Status: instructions only; this PR does not implement or install changes.
Baseline: test/v0.3.9-beta.8.55-checkpoint-public-banner at 87c2106e931ad3c58ae9a66b93699d779f29d349.
Verified manifest version: 0.3.9-beta.8.55.
Manifest: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.55-checkpoint-public-banner/module.json

## Assignment

Implement the owner's 20 annotated observations below in focused follow-up draft PRs. First read AGENTS.md and [ATLAS_UI_STANDARDS.md](ATLAS_UI_STANDARDS.md). This new handoff supplements the prior nine-annotation PR #358; do not replay changes already shipped in beta.8.53–55. Inspect current active work and baseline before editing. This PR only records standards and instructions for ChatGPT Web; it supplies no claim of implementation or live acceptance.

The numbered entries preserve the owner's annotation numbering. Screenshot evidence is transcribed as the observed controls and behavior below; image binaries are not included in this PR. Use the owner's screenshots in the originating chat for visual reference where available. Do not claim screenshots are committed or new live testing has occurred.

## Standards to establish first

The linked standard is normative for upcoming and future Atlas-owned UI. Use existing shared action-button helpers and numeric-range controls. Primary order is Locate, visibility, Settings, Edit on the left; Save then Delete on the far right. All action icons share one target/glyph size. All numeric sliders pair with direct entry of one shared width. Accessible names, focus and tooltips are mandatory for icon-only actions. Text remains for navigation, tabs, field/section labels and menu choices.

Use Customization for the Road and Checkpoint appearance tabs and Banner for checkpoint name/details presentation. Preserve storage/API names and existing handlers. Do not introduce schema changes to rename presentation text.

## Annotation instructions and acceptance

### 1. Checkpoint Customization layout

Instruction: Replace the mixed Marker & labels content with three clearly headed sections, in order: Checkpoint settings (size, marker choice/icon, color, border color); Banner information (display mode, selected details, territory and text color); Map preview. Rename the tab Customization. Set sensible initial ApplicationV2 dimensions bounded by the viewport so ordinary desktop users can see the options and preview without unnecessary scrolling; keep footer reachable and preserve user resizing.

Acceptance: All three sections are distinct; preview is not clipped beneath the footer at the documented desktop test size. Small viewports and 200% text zoom remain usable with controlled scrolling.

### 2. Road-name option availability

Instruction: Hide the Road name inclusion option when the checkpoint has no associated road. Determine association through the existing checkpoint/road model, including supported multi-road relationships; do not infer it from name text or proximity. Preserve dormant preference on open and reconnect, without saving data simply because a control is hidden.

Acceptance: Unassociated checkpoints show no road-name option; associated checkpoints do. Hidden/missing road names never leak into the player banner or preview.

### 3. Color row spacing

Instruction: Give Checkpoint color and Checkpoint border color identical row spacing, label alignment, swatch dimensions and control-column placement through shared form styles.

Acceptance: Rows align visually with marker size and surrounding controls; no one-off margins or stretched color inputs.

### 4. Banner Off dependencies and terminology

Instruction: Use Banner throughout user-facing checkpoint controls. When its mode is Off, disable dependent detail switches, territory selection and banner text styling, and suppress banner text in preview/runtime. Keep their draft values so switching back restores them; do not clear stored preferences. Marker styling remains usable.

Acceptance: Off, On hover and Always produce matching preview/runtime behavior. Off dependencies are visibly and accessibly disabled. Keyboard and Save validation handle disabled values without erasing them.

### 5. Road travel preset editing

Instruction: For an existing Road, show current travel preset identity plus Change preset using the shared checkpoint pattern. Reuse existing selector, None/fallback and assignment handlers. Extend the documented pattern to applicable post-creation preset selectors across Atlas after inventory.

Acceptance: Changing selection does not save the Road or modify World preset data; Cancel/close preserves the old assignment; Save uses the current validation and revision checks.

### 6. Road Show to players

Instruction: Replace the checkbox/text action with the standard eye/eye-slash control, in the standard action position, keeping its draft/commit behavior and permission checks.

Acceptance: Icon shows current draft state; tooltip/accessible text explains state and next action. Opening or toggling the draft does not unexpectedly persist or change other objects.

### 7. Checkpoint footer

Instruction: Apply the complete standard footer: applicable Locate, visibility, settings/edit actions on the left; contextual Save as preset separate; Save then Delete at the far right. Use the same icon size and accessible naming, including icon-only Save.

Acceptance: DOM/tab order matches layout. Save as preset cannot be confused with Save Checkpoint. Delete retains confirmation and dirty-close safeguards remain.

### 8. Road footer

Instruction: Apply the same action order and sizes to the native Road dialog without replacing its existing DialogV2 submit ownership. Map edit/link actions to shared icons. Keep cancellation/close and dirty-draft protection available; do not silently submit when invoking another action.

Acceptance: Save Road calls its existing handler once; other icons do not submit. Delete is last/right and remains clearly destructive; Escape/close cancels safely.

### 9. Road Customization and preview

Instruction: Rename Style to Customization to match Checkpoints. Divide settings into Road settings (stroke color, border and border color, line width, opacity, pattern) and Road name styling (display mode, text appearance). Add a distinct live Map preview below, using existing rendering/style rules and draft inputs.

Acceptance: Preview reflects width, opacity, pattern, border and name styling without Scene writes. Name Off/Hover/Always behaves consistently. No duplicate rendering/persistence subsystem is introduced.

### 10. Road line width

Instruction: Replace the read-only 4 px output with the shared slider plus manual numeric entry and separate px unit. Keep current bounds, step and override/inheritance semantics.

Acceptance: Both input directions synchronize; invalid edits block Save rather than fall back to stale values; preview matches.

### 11. Road opacity

Instruction: Replace the read-only 90% output with the same shared slider/input standard and % unit. Preserve current internal representation and exact existing conversion.

Acceptance: 0%, 100% and allowed intermediate values round-trip correctly, numeric input width matches other Atlas controls, and no accidental 100× conversion occurs.

### 12. Road Checkpoints section

Instruction: Replace standalone Add checkpoint and separate heading with a single Checkpoints (count) heading and compact plus action, followed by associated checkpoint rows. Apply shared row icon order, sizes and applicable Locate.

Acceptance: One identifiable Add action; correct count/empty state; rows have accessible item-specific actions, with no changes to creation/deletion ownership.

### 13. Checkpoint alphabetical display

Instruction: Sort associated checkpoint rows A–Z using locale-aware names with deterministic ID ties. Sort a display copy only.

Acceptance: Mixed case, accents, duplicates and renamed checkpoints produce stable results; route/graph traversal and persisted ordering are unchanged.

### 14. Road Regions section and Locate

Instruction: Use a Region (count) section heading with compact plus for the existing Generate Region workflow. Add Locate to each applicable Region row and shared contextual Settings/regenerate/delete controls. Retain concise priority guidance and drag handles.

Acceptance: Locate transiently highlights the correct Region without switching Scene, moving geometry or minimizing the Workspace irrecoverably. Generation still previews/confirms. Region order stays authoritative priority order, never A–Z as a side effect of annotation 13.

### 15. Workspace navigation alignment

Instruction: Center Overview, Map directory and Settings text horizontally and vertically within each button rectangle. This is label alignment, not a request to vertically center the entire navigation stack in the window.

Acceptance: Equal padding and centered baselines at normal/zoomed text sizes; selected/focus styles and readable text remain.

### 16. Remove redundant Manage map records

Instruction: Remove the redundant disclosure/section once every action it exposes has an equivalent reachable control in the directory toolbar. Inspect for unique actions first and retain any needed unique command in the appropriate toolbar/menu.

Acceptance: No duplicate management section; all previously available creation/management capabilities remain reachable with existing handlers.

### 17. Directory views and creation toolbar

Instruction: Restyle By territory, All roads and All checkpoints as a clearly labeled grouped view/filter control with an obvious active selection. Present creation actions as a separate, consistent group; use plus controls tied to named Territory/Road/Checkpoint context or a clearly labeled Add menu, avoiding indistinguishable plus buttons. Keep search/type/travel filters organized below.

Acceptance: A first-time GM can distinguish view selection, search/filter and creation. Keyboard semantics, selected state, filter composition, responsive layout and existing state restoration all work.

### 18. Inline directory row actions

Instruction: Move each item's existing applicable action menu/buttons to the far right of its own row, preserving territory indentation and disclosure structure. Use shared order and icon sizes; do not duplicate the item heading just to expose controls.

Acceptance: Long names wrap/truncate accessibly without collisions. Icon clicks never expand/collapse parents; focus, scroll, nested expansion and search state survive actions. No invalid nested interactive markup.

### 19. Visibility text redundancy

Instruction: Remove visible Shown/Hidden suffixes from directory rows where the standard state icon is present, including Roads and Checkpoints. Preserve type/travel metadata and accessible state.

Acceptance: State remains evident via eye/eye-slash, tooltip and accessible name, including collapsed rows. No row loses its only visibility indicator.

### 20. World travel settings tabs

Instruction: Within Workspace Settings > Exploration & travel, present Travel rules and Journey & playback as tabs using the existing shared tab conventions. Reuse current fields, drafts, handlers and World-setting ownership; retain other exploration/transportation entry points.

Acceptance: Keyboard navigation and active tab state work; switching tabs does not lose drafts or save. World settings retain their current scope; no Journey execution, clock advance or Token motion occurs.

## Source inspection guide

Verify current paths and symbols before editing; this is a navigation guide, not permission to replace whole components.

- AGENTS.md, docs/ARCHITECTURE.md, docs/DATA_MODEL.md and relevant existing UX audit/design documents: authority, ownership and prior approved direction.
- scripts/checkpoint-appearance-editor.js, scripts/checkpoint-icon-control.js and checkpoint form/preset/transport helpers: form sections, dependent controls, picker, preview and footer.
- scripts/ui-action-button.js, scripts/settings-controls.js, scripts/settings-number-range.js, styles/atlas-ui.css: extend shared controls and tokens first.
- Road settings dialog implementation and styles/road-settings-dialog.css: native submit lifecycle, tabs, preview, checkpoints and generated Region priority.
- Scene Workspace implementation and styles/atlas-scene-workspace.css: navigation, directory filters/rows, redundant disclosure and travel tabs.
- Existing checkpoint appearance/banner resolution, Road storage, player overlay and preview models: keep canonical persisted values, unit handling and hidden-data filters unchanged.
- Existing tests for each affected surface, package.json validation commands and localization strings.

Search for all Atlas action buttons, range inputs/native range-picker controls, preset selectors and footer builders. Record an inventory of migrated controls and justified exceptions in the implementation PR, not just screenshot-specific fixes. Avoid blanket CSS rules against Foundry/global buttons or numeric inputs.

## Suggested implementation PR sequence

1. Shared UI contract adoption: common action/number tokens, action order and accessible controls; inventory; footers and numeric pairs (5–8, 10–11). Do not duplicate helpers.
2. Road and Checkpoint Customization: three checkpoint sections, banner dependencies, Road preview, conditional road option and consistent fields (1–4, 9). Reuse beta.8.55 banner projection and existing draft model.
3. Directory and linked-item lists: checkpoint A–Z, compact headings, Region Locate, centered navigation, toolbar, inline actions and status text (12–19).
4. World travel tabs: focused layout/lifecycle change (20), retaining existing World/Journey handlers.

Adjust boundaries to minimize overlapping edits, but keep each PR independently testable and explicitly state its dependencies. Do not create a broad architecture refactor, new persistence owner, dependency, schema migration or gameplay feature to deliver these presentation changes. Do not merge or publish a stable release.

## Regression and acceptance plan

Run relevant unit/DOM tests, npm run check, npm run architecture:check, changed-JavaScript syntax checks, and git diff --check. Report exact commands/results and any unavailable checks. Keep tests behavior-focused: action routing and no accidental submission; bidirectional numeric synchronization and invalid drafts; Off-dependent controls with preference restoration; model/preview parity; player filtering; stable view state; list ordering without mutation; tabs without duplicate saves.

Required visual evidence for implementation PRs:
- Before/after Checkpoint Customization, Road Customization, both footers, checkpoint/Region lists, directory and travel tabs.
- Normal desktop viewport plus narrow viewport and 200% text zoom; state exact viewport/zoom, show complete window and footer.
- Open icon picker, long item names, populated/empty lists, selected/unselected filters and keyboard focus.
- Demonstrate all three checkpoint banner modes, no-road/associated-road states, and GM/player output for shown checkpoints.
- Show smaller glyphs with usable targets; consistent numeric input widths and manual entry.
- Restore expansion, scroll and focus after ordinary item actions and tab changes.
- Road preview and checkpoint preview must agree with runtime appearance without writing live data during preview.

Preserve beta.8.55 safeguards: shown checkpoint details may be seen by GM and players, while hidden Road/native Region details remain filtered; eligible territory selection is explicit, no automatic selection; no Journal permission changes; no Scene Region IDs copied into World presets; no write-on-read or new schema migration. “Banner Off” hides banner content, not the checkpoint marker or the selected metadata stored in the draft.

Owner acceptance checklist:
- [ ] Common action icons/order/size and numeric entry width are consistent across audited Atlas UI.
- [ ] Checkpoint has the three sections and readable initial size; color rows align.
- [ ] Road option is conditional; Banner Off disables its dependent options without clearing preferences.
- [ ] Preset selection and both editor footers follow the shared standard without losing save/cancel safety.
- [ ] Road Customization has organized sections, paired numeric controls and accurate live preview.
- [ ] Checkpoints use compact heading/add action and A–Z display; Regions keep priority and offer Locate.
- [ ] Directory buttons are centered, views visibly grouped, actions inline, redundant section/status words removed.
- [ ] Travel rules and Journey & playback are tabs with unchanged data authority.
- [ ] Keyboard, responsive, dirty drafts, stale validation and GM/player regression evidence is supplied.

## Foundry scope for a later implementer

This documentation task authorizes no live operations. A web chat without browser/runtime access must explicitly mark live acceptance pending. The earlier authorized runtime was Sandbox, Scene.urz1d8NZFFhjo38J in the owner-designated World. One new screenshot selector references Scene 8TW7O2dzM0x2PqtE; screenshot evidence is NOT authorization to interact with that Scene. Reconfirm the intended World, Scene document ID and installed version before any later live testing. Do not change Scenes, move Tokens, run Journeys, create/delete Regions, change Journals or save persistent gameplay data during read-only UI QA. Persistence tests require an owner-authorized disposable fixture or explicit test scope.

Only an owner-requested installation permits the separate Setup workflow. Use the designated Foundry tab, approved manifest, verify installed version, return to owner-designated World, have owner enter passwords, and verify Scene before testing. Never store credentials in repository/audit artifacts.

## Copy-ready prompt for ChatGPT Web

Read AGENTS.md, docs/ATLAS_UI_STANDARDS.md and docs/UI_STANDARDIZATION_BETA8_55_HANDOFF.md in i-am-rayo/fvtt-atlas-navigation. Start from the verified beta.8.55 branch/commit in this handoff, inspecting newer active PRs before making changes. Implement all 20 numbered requirements in focused draft PRs following the proposed sequence. Reuse current Foundry v14 controls, drafts, validators, preview models and persistence handlers. Adopt the global icon order/size, paired numeric controls with shared input width, Customization/Banner terminology and preset editing pattern. Preserve player hidden-content filters, Region priority, topology, IDs, World/Scene ownership and dirty-close protections. Include behavioral regression results and a screenshot/owner-acceptance checklist; state clearly when live Foundry testing is unavailable. Do not merge, publish a stable release, install a module or mutate a live World as part of this handoff without the applicable owner authorization.
