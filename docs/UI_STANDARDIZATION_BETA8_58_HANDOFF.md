# Map Markers and editor usability — beta.8.58 follow-up handoff

Status: documentation-only. No code, installation or live testing is performed by this PR.

## Baseline and task

Repository: i-am-rayo/fvtt-atlas-navigation.
Verified latest candidate when this handoff was prepared: PR #375, branch `test/v0.3.9-beta.8.58-ui-combined`, commit `534f740b692ca568264210751583eabd0e67740c`, manifest version 0.3.9-beta.8.58.
This baseline incorporates #370–#374 and follows the earlier documentation PR #362. Its Road Settings is already a modeless ApplicationV2 window; do not restore the old existing-Road DialogV2 implementation. New-road/small native prompts may still use DialogV2. Review newer active work before implementation.

The owner asks for instructions for ChatGPT Web, not implementation in this PR. Capture the generic entity rename plus all 27 annotations below. Prior fixes may be incomplete in actual runtime; reproduce rather than assume a previous PR title proves acceptance. Screenshot observations are transcribed here; image binaries are not committed. No new browser observation is claimed.

Read AGENTS.md, ATLAS_UI_STANDARDS.md, UI_STANDARDIZATION_BETA8_58_TEST.md, architecture/data model and relevant current source/tests first.

## Primary terminology change

Adopt **Map Markers** (singular **Map Marker**). This is clearer than generic Checkpoints, which can be confused with a specific toll/security stop. “Points of Interest” is a reasonable alternative but is narrower for service/route markers; proceed with the owner's Map Markers direction.

Audit user-facing window titles, tabs, directory views, counts, creation/settings/movement actions, tooltips, ARIA labels, empty states, notifications, presets, help, player text and current user documentation. Examples: All Map Markers, Map Marker Settings, Add Map Marker, Move Map Marker, Map Marker type, Map Marker presets. Update localized display strings and tests coherently.

Do not rename authored user content or genuine category names such as Security Checkpoint. Preserve internal checkpoint filenames/classes, IDs, storage keys, flags, schema fields, APIs and serialized import/export structure for compatibility. Developer diagnostics may retain technical identifiers with a glossary. Historical PR/test documents remain historical. No data migration, search-and-replace of payloads, or duplicate entity type.

## Annotated implementation requirements

### 1. Center navigation text

Required: Overview text still sits against the bottom border. Correct computed height, padding, line-height and alignment for all Workspace navigation buttons, including inherited Foundry rules; use shared scoped styles, not a one-off positional nudge.

Acceptance: Labels are horizontally and vertically centered at normal and 200% text zoom, with focus/selection outlines intact.

### 2. Remove redundant Manage menus

Required: Remove Manage Territories / Roads / Checkpoints from the directory toolbar after tracing every command they expose. Build a capability matrix mapping each to individual Settings, contextual creation, or another retained entry point. Remove duplicate menu shells only when parity is established. Preserve unique bulk/recovery/import commands in an appropriate location and explain any retained exception. Do not delete a shared service merely because its menu is removed.

Acceptance: All ordinary management is reachable through directory items; no orphaned unique commands or dead handlers. Document any justified retained function.

### 3. Disclosure and summary hierarchy

Required: Add an unmistakable disclosure chevron, with expanded/collapsed state, to expandable territory rows. Present name as primary, type as secondary, and Map Markers/Roads counts as smaller readable metadata. Suggested text: Reshara · Continent · Map Markers (1) | Roads (2). Use the actual model, not these example numbers.

Acceptance: Keyboard disclosure works; counts match the displayed subtree and use unique entity IDs to avoid double-counting shared Roads. Define whether counts are filtered; recommended filtered unique descendant counts, explained accessibly. Empty items show an honest empty state.

### 4. Keep parent actions aligned

Required: Keep each territory action group within its own summary row so expansion cannot move parent actions down beside child content. Use row layout independent of the details body.

Acceptance: Parent actions remain aligned with the parent name through expand/collapse, long names and nested rows; buttons do not toggle disclosure.

### 5. Group geographic hierarchy

Required: Distinguish entity rows from collection sections. Suggested tree: Continents > named continent > Settlements / Other territories / Roads / Map Markers. Use Settlements for City, Town, Village and Settlement; Area and other non-settlement territories remain separately represented. Collection headings use counts and contextual plus actions; preserve geographic nesting.

Acceptance: Every entity remains reachable, including root territories without a continent, unclassified items, nested/overlapping territories and multi-territory Roads. Grouping is a read-only projection, not a new ownership tree. Add under a group may preselect context but cannot silently create geographic membership or geometry.

### 6. Global search layout

Required: Use a search input with a magnifying glass on its right; align the search group at the far right of the toolbar. Apply to all Atlas-owned search boxes after inventory. Keep a programmatic label even if the visible label becomes compact; do not rely only on placeholder text.

Acceptance: Search semantics remain unchanged. For live search the icon is decorative; if submission is required it is an accessible Search button. No accidental form submit. Narrow layouts wrap without losing the field or focus.

### 7. Filters left, alphabetical sort

Required: Put Territory type and similar filters on the left. Add A–Z / Z–A name sorting to comparable directory/list menus, with A–Z default and stable ID ties. Sort within hierarchy/groups, retaining filter/expansion state.

Acceptance: Locale-aware name sorting uses copies only. Never alphabetize persisted graph order, Journey legs, undo history or native Region priority. Document exceptions rather than adding meaningless sorting to every select.

### 8. Road metadata and children

Required: Distinguish travel type (Land/Air/Water as applicable) from Road name through secondary typography. Expand a Road to show its associated Map Markers with count and standard row actions.

Acceptance: Use canonical Road-marker associations, not text or proximity guesses; deduplicate stable IDs. Empty state and multi-road association cases work; visibility rules and persisted relationships remain unchanged.

### 9. Categorized dropdowns

Required: Group long related selectors using real domain categories. Territory selectors use the highest existing geographic ancestor (usually continent), then alphabetical choices with clear ancestor paths; include no-continent/unclassified groups. Use native optgroups when adequate; do not invent nested optgroups.

Acceptance: All eligible options and current selections remain available, duplicate names are disambiguated, invalid/stale values handled safely. Inventory all Atlas selectors; retain semantic order for Off/Hover/Always, priority or other ordered enums. Do not invent categories for flat options with no meaningful grouping.

### 10. Shared Map Marker type categories

Required: Use exactly the same category grouping, labels and options for directory Map Marker type filtering as the Map Marker Settings type chooser. Reuse one source of truth; preserve All and General/Unspecified choices.

Acceptance: New/renamed types stay synchronized across both interfaces, including localization and filter matching. Do not confuse category names like Security Checkpoint with the generic renamed entity.

### 11. Settings versus Move

Required: Remove the redundant name-edit action for a Map Marker: its gear Settings owns name changes. The pencil action means Move on map and invokes the existing movement workflow, with that explicit accessible name.

Acceptance: Gear opens Settings; pencil enters the documented movement mode. No second name editor or duplicate persistence handler.

### 12. Restore Workspace on cancel/close

Required: When an Atlas child editor/action minimizes an open Workspace, restore that same Workspace when the operation ends via Cancel, clean header close, Escape when it exits, or confirmed discard. Apply consistently to all relevant editors; restore after successful completion as appropriate to the flow.

Acceptance: Restore only the window minimized by that operation, preserving position/size/tab/filter/scroll/expansion/focus. Do not recreate an intentionally closed Workspace, override a user's manual minimize, or restore prematurely while a child/dirty-close prompt remains active. Failed Save/Continue editing keeps the editor active.

### 13. Save icon in editors

Required: Replace Save Points and equivalent editor action text with the shared floppy Save icon at the standard right-side position, retaining item-specific tooltip/accessible name and existing save boundary.

Acceptance: No duplicate commits, implicit submits or lost invalid/stale-edit guards. Inventory all Atlas editors.

### 14. Locate icon in editors

Required: Replace Locate Road and equivalent applicable editor actions with the standard map-pin icon in the first left position, using existing transient locate logic.

Acceptance: No Scene switch or authored data change; usable from all applicable settings/editor surfaces with matching size/name and predictable window restoration.

### 15. Undo and Redo

Required: Use curved-back Undo and curved-forward Redo icons. Add real redo through the existing editor draft/history mechanism, not a second document-history system. Scope history per editing session; new edits after Undo clear the redo branch.

Acceptance: Test edit→undo→redo, multiple steps, empty-stack disabled states, new-edit invalidation, cancel/discard and successful save/reset boundaries. Include supported keyboard shortcuts without intercepting text-field native undo. No history entry mutates persisted data before Save or replays stale document writes.

### 16. Plain-language editor help

Required: Replace dense instructions with a short purpose sentence and compact action rows, showing keys with recognizable key styling. Explain technical terms once. Verify actual gestures in source before writing copy; do not change behavior to match the user's illustrative wording.

Acceptance: Example if accurate: Drag a point — move the road. Double-click the road line — add a bend. Shift-click an unconnected end — continue this road. An unconnected end is where the road stops without joining another road. Use platform-appropriate Ctrl/Cmd, Alt/Option and Escape explanations. Help remains concise, readable and consistent in all editors.

### 17. Map Marker movement dock

Required: Provide a small editor/dock while moving a Map Marker, even when movement is the only operation. Show purpose, short instructions, applicable Locate, Save/Cancel and supported history controls, reusing existing session and draft handlers.

Acceptance: Explain verified behavior for independent versus Road-linked markers and approaching a Road. Do not promise auto-attachment or silently connect/move Road graph nodes. Preserve existing explicit link/snap confirmation and shared-node restrictions; invalid moves remain blocked. Cancel/close restores Workspace and discards staged changes as existing contract requires. If movement currently commits immediately, isolate the lifecycle change and design its draft/commit boundary before coding.

### 18. Transportation plus size

Required: Fix the oversized Add Land Travel method plus and other transportation add controls through the shared icon target/glyph tokens. Inspect legend/font-size inheritance and specificity.

Acceptance: Glyph matches other action icons while target remains usable; no per-field compensating size patches or unintended native UI changes.

### 19. Quick Add Map Marker

Required: Add a GM-only Add Map Marker Scene-control tool beside the Atlas Road authoring tools. Reuse the existing creation workflow and permission/active-Scene checks; use the supported v14 tool registration convention.

Acceptance: Click enters the same creation process as Workspace, with cancel/restore behavior and no record saved until the existing explicit creation boundary. No new authoring owner or player tool exposure.

### 20. Compact Layers palette and samples

Required: Reduce excessive padding/blank space in Atlas Layers while keeping readable sections and numeric input standards. Give Road View, Terrain View and Corridor View a brief explanation beside each option, verified against current render behavior. Add compact illustrative previews if they materially clarify the difference.

Acceptance: Examples must distinguish authored road appearance, sampled terrain display and native generated corridor boundaries without claiming rule changes. Palette remains client-preference UI; previews do not create Regions or change data/publication. Keyboard, narrow layout and existing player-preview boundaries remain intact.

### 21. Inline Road border controls

Required: Put the border enable checkbox/toggle and its color swatch together on one row. Keep the swatch visible and its chosen color retained when border is Off; allow draft color selection without enabling the border. Only the toggle controls whether the border renders.

Acceptance: Off→On restores chosen color; preview matches enable state; color changes do not implicitly enable border or write documents.

### 22. Road preview name placement

Required: Position the Road name in the preview at the same relative anchor/offset as the actual Scene label (owner observes it directly above the road), rather than below the sample or behind the footer. Inspect current renderer and share small presentation calculations where practical.

Acceptance: Compare preview and Scene at documented zoom/size for label modes, pattern, border and widths. Preview remains an illustration, not a second authoritative renderer, and does not alter road geometry to make the sample match.

### 23. Road banner metadata — design spike first

Required: Explore optional travel type and territory text below the Road name. The owner explicitly expressed uncertainty about a Road crossing several territories. Produce a focused design proposal before persisting new fields or shipping dynamic territory selection.

Acceptance: Compare: explicit selected territory; deterministic list of eligible associated territories; dynamic territory at a defined label/hover anchor. Specify anchor, overlaps, borders, no-region case, ordering, hidden territory filtering, GM/player audience and performance/cache invalidation. Reuse existing spatial/association logic, do not assume whole-road containment or arbitrarily select the smallest Region. Preserve native ownership, and propose additive validation/import/preset behavior only if needed. Keep this optional feature separate from the straightforward preview fix; request owner approval of unresolved semantics before implementation.

### 24. Related color controls together

Required: As a global Atlas form standard, place a related color swatch beside its option where practical, e.g. Road name display [mode] [text color]. Preserve accessible labels for both; keep distinct tab stops and consistent swatch size.

Acceptance: Responsive wrapping remains readable. Off modes preserve chosen colors without activating display. No nested labels containing unrelated interactive controls; inventory analogous Road/Map Marker/Layers forms.

### 25. Bordered Map Markers section

Required: Use a real visual fieldset/panel with Map Markers (count) and adjacent plus in its legend/header, and all associated rows contained within the border. This supersedes the old Checkpoints heading as part of the rename.

Acceptance: Header and plus remain together, list rows are clearly inside the section, empty state is included, and A–Z/Z–A display remains non-mutating.

### 26. Bordered Regions section

Required: Use the same bordered section treatment for Regions (count) [+], including guidance and rows inside the panel.

Acceptance: Retain existing priority order, drag controls, Locate, preview/confirmation and native Region safety. Do not alphabetize this priority list.

### 27. Stable bottom footer

Required: Anchor action footers at the bottom of each Atlas application window, outside the scrolling tab content, across all applicable forms/editors. The owner means window bottom, not the browser/desktop bottom. Use a bounded application layout with scrollable body and non-shrinking footer.

Acceptance: Switching short/long tabs does not move the footer vertically. Resize/text zoom keeps controls reachable without overlaying content; footer follows shared order, dirty-close and submit lifecycle. Avoid position:fixed relative to the viewport and auto-height tab jumps.

## Directory layout proposal

This is a presentation tree over existing relationships, not a replacement data model:

```text
[Type filter] [Sort A–Z / Z–A]                    [Search … 🔍]
Continents (count) [+]
  ▾ Reshara · Continent · Map Markers (n) | Roads (n)   [actions]
    Settlements (count) [+]
      ▸ Genasi Village · Village                       [actions]
      ▸ The Eyrie · City                               [actions]
    Other territories (count) [+]   (when applicable)
    Roads (count) [+]
      ▸ Millstone–The Eyrie · Land                     [actions]
        Map Markers (count)
    Map Markers (count) [+]
Other / unclassified territories and records remain reachable.
```

Do not force every territory into a continent or turn a Road crossing several territories into several saved Roads. A marker can be reachable from both its Road and geographic grouping without duplicating its data. Use deterministic stable keys for expansion/focus. Ancestor visibility during filtering must keep matches discoverable. Explain whether counts are filtered; default to unique entities in the displayed subtree rather than summing duplicated references.

## Suggested focused PRs

1. Terminology and common presentation: Map Marker display rename, search/sort/category contracts, centered labels, icon size enforcement, inline colors and stable footers. Update shared standards/locale strings, not data identifiers.
2. Directory hierarchy and capability parity: annotations 2–11, including clearly grouped entities, chevrons/counts, inline action stability and actual removal of redundant management entry points after inventory.
3. Editor lifecycle and controls: annotations 12–19, especially restoration ownership, movement dock and real redo. Keep behavioral history/lifecycle changes independently testable from typography. Reuse existing sessions; do not invent another authoring engine.
4. Layers and Road layout fidelity: annotations 20–22 and 24–27, samples, real preview label placement, bounded sections and common layouts.
5. Separate design proposal for annotation 23. Show options, risks and a small mockup; do not let an unapproved dynamic-territory implementation block the low-risk corrections.

Split overlapping shared changes sensibly and declare dependencies. Scope is UI and explicit draft behavior, not new gameplay, topology ownership or automatic mutations. Do not silently bump release version, install, merge or publish stable releases. The next implementer should propose a test build only after scoped changes and checks.

## Source inspection and implementation inventory

Locate current implementations with repository search rather than assuming paths from screenshots:
- Workspace/directory builders, associated tests and styles/atlas-scene-workspace.css: sections, summaries, row actions, managers, filtering, category selectors and state.
- scripts/ui-action-button.js, scripts/settings-controls.js, scripts/settings-number-range.js and styles/atlas-ui.css: shared action/numeric/search/form conventions.
- scripts/checkpoint-appearance-editor.js, marker type taxonomy and related movement/creation handlers: display rename, Settings versus Move, dock, quick tool and transportation plus.
- Road ApplicationV2 settings form, Road editor dock/session/history and styles/road-settings-dialog.css: footer lifecycle, undo/redo, cancel/close and preview.
- Existing Road appearance form/renderer and Layers palette: compare actual label anchor and sample presentation; reuse current style rules without building another renderer.
- Scene-control registration, localization resources and public/player projection: GM gating, current terminology, safe hidden-data behavior.

Deliver an inventory of search fields, sortable lists, grouped selects, editor/dock controls, numeric controls, plus buttons, color pairs and footers audited, with remaining exceptions and reasons. Use native controls/shared helpers before new abstractions. Do not blanket-style native Foundry or unrelated modules.

Preserve the beta.8.58 legal opacity range (0.10–1.00 internally / 10–100% display) and exact legacy fractional input behavior; prior generic examples do not authorize 0% or rounding. Native Region order encodes priority. Existing-Road ApplicationV2 Save/stale guards, World catalog ownership, player-hidden Road/Region filtering and Journal permissions remain authoritative.

## Validation and acceptance

For implementation PRs run relevant behavior/DOM regressions, npm run check, npm run architecture:check, changed-JS syntax checks and git diff --check. Report exact results; do not label unrun live checks as passed.

Required regression cases:
- Rename coverage and backward-compatible read/write/import/export using existing checkpoint keys; authored names and literal checkpoint categories stay unchanged.
- Root/nested/unclassified/overlapping territories, shared Roads, multi-road/independent markers, empty lists, duplicate/accented names and filtered unique counts.
- A–Z/Z–A affects display copies only; Region priority, graph ordering and Journey ordering unchanged.
- Grouped selectors preserve stable values and eligibility; category taxonomy consistent with Settings.
- Keyboard disclosure and action clicks, no accidental submission/disclosure toggle, expanded parent action alignment, preserved focus/search/scroll.
- Workspace restoration through Cancel, Escape exit, clean X, dirty-close Keep editing/Discard, failed Save, nested windows and user-closed/minimized Workspace.
- Draft Undo/Redo and invalidation, text-field shortcut exemption, no document writes until existing Save boundary; stale save protection.
- Independent and linked marker movement instructions and actual semantics agree; no silent attachment when merely near/on a Road.
- GM-only quick creation tool and movement actions; no new authoring authority for players.
- Color draft retained while disabled; preview reflects actual label anchor, visibility modes and border state.
- Stable footer at normal/narrow size and 200% text zoom, readable simple help and full accessible icon names.

Before/after screenshots for implementation: Workspace nav, directory collapsed/expanded/filter/sort, marker move dock, Road edit dock, Layers, Road Customization and linked-marker/Region tabs. Include a complete window view demonstrating bottom footer stability across short/long tabs, not just cropped controls. Compare sample and live Road label at documented zoom. Include GM/non-GM checks for visible markers/roads and hidden details; new metadata must not leak via previews/counts/dropdowns.

Product Owner checklist:
- [ ] Generic entity reads Map Marker throughout ordinary UI; compatibility is unchanged.
- [ ] Navigation text centers; redundant management entries are removed with capability parity.
- [ ] Hierarchy, chevrons, metadata and counts are readable; row actions stay attached.
- [ ] Search, sort and categorization are consistent across audited Atlas surfaces.
- [ ] Settings and Move have distinct jobs; edit/move tools explain actions simply.
- [ ] Cancel/close restores the originating Workspace correctly.
- [ ] Undo/Redo, Save/Locate icons, plus sizes and quick Add Map Marker behave consistently.
- [ ] Layers is compact and understandable; preview matches Road label placement.
- [ ] Related color controls share rows; bordered linked lists and stable bottom footers match the examples.
- [ ] Dynamic Road territory banner has a separately reviewed design, not guessed behavior.
- [ ] Automated evidence and pending/live v14 checks are clearly distinguished.

## Runtime authorization boundary

No runtime interaction is needed to author this handoff. For later live verification reconfirm actual World ID, authorized Scene ID and installed version; earlier authorization named Sandbox / Scene.urz1d8NZFFhjo38J. Screenshots or selectors from another Scene do not authorize switching to it. Keep read-only QA separate from explicitly authorized disposable-fixture persistence tests. Do not move Tokens, run Journeys, alter native Region geometry/Behaviors, change Journals or save campaign data during read-only review. Owner-requested installation follows the documented designated-tab workflow, with owner password entry and post-install version/Scene verification. Keep credentials out of docs.

## Copy-ready ChatGPT Web prompt

In i-am-rayo/fvtt-atlas-navigation, read AGENTS.md, docs/ATLAS_UI_STANDARDS.md and docs/UI_STANDARDIZATION_BETA8_58_HANDOFF.md. Inspect PR #375 and newer work before implementation. Implement the Map Markers user-facing rename and the 27 numbered annotations in focused draft PRs; annotation 23 requires a design proposal and owner decision before dynamic metadata implementation. Preserve existing checkpoint storage/API identifiers, data ownership, native Region priority, World settings, player filtering, explicit authoring confirmation and current ApplicationV2/draft handlers. Audit shared controls across Atlas instead of applying screenshot-only patches. Include regression results, before/after screenshot checklist and a precise list of pending live Foundry checks. Do not merge, install or publish stable releases as part of the handoff. Reconfirm authorized World/Scene/version before any later live testing.
