# Atlas UI standards

Owner-approved direction, recorded 2026-11-17. Applies to the upcoming beta.8.55 follow-up and all future Atlas UI work. This document defines presentation contracts; it does not authorize gameplay changes, native document mutations, releases or migrations.

## Scope and precedence

Use these standards for Atlas-owned applications, dialogs, directories, settings and contextual controls. Reuse existing ApplicationV2/DialogV2 lifecycle, shared controls, validation, draft state and persistence handlers. Do not override unrelated Foundry or other-module UI. The current action order below supersedes the less-specific beta.8.53 footer wording in AGENTS.md. Existing permission, dirty-close, validation and explicit-confirmation protections remain.

## Action vocabulary and order

Use consistent bundled monochrome icons (existing Font Awesome Free assets where available), not platform-dependent emoji artwork. The owner's emoji describe meaning. Standard actions are icon-only with localized tooltips and accessible names that identify the item. Section, tab, field and navigation labels remain text.

| Action | Icon meaning | Placement and behavior |
| --- | --- | --- |
| Locate / Show on map | Map pin | First left action, available from every applicable item settings/list surface; transient pan/highlight only |
| Visibility | Eye when shown; eye-slash when hidden | Second left action; icon indicates current state |
| Settings | Gear | Third left action; opens configuration |
| Edit / Paint / Modify in Scene / Move / Change | Pencil | Fourth left action; invokes existing edit workflow |
| Save | Floppy disk | Right action group, immediately before Delete when both exist |
| Delete | Trash | Last, far right; danger styling and existing confirmation |
| Link | Chain link | Contextual action, before the right save/delete group |
| Unlink | Broken chain | Contextual action; never relabel Delete as Unlink |
| Add / New / Create | Plus | Beside its named section or an explicitly named creation menu |

Footer layout: [Locate] [Visibility] [Settings] [Edit] [contextual actions] ... [Save] [Delete].
Use only applicable actions; do not add no-op buttons to fill slots. DOM and keyboard order must match visual order. For item rows, put the applicable action group at the far right of that row; preserve ordering within the group. Destructive actions retain a distinct gap/separator and danger styling.

Additional common mappings: Duplicate = copy; Refresh = circular arrow; Import = inward arrow; Export = outward arrow; Reset to defaults = undo; Close = X. These actions require distinct accessible labels and tooltips. Reset and Refresh must not be interchangeable. A regeneration action may use circular arrows but must say “Regenerate …” and keep its existing preview/confirmation.

Visibility accessible text must communicate both state and operation (for example, “Hide Dirwest from players; currently shown”) and a consistent pressed-state model. Remove redundant visible Shown/Hidden text only where the state icon is present. Never use icon/color alone as the accessible name.

“Save as preset” is distinct from Save current item. Use a separate contextual preset command with an explicit accessible label and tooltip, or a named menu entry; do not present two indistinguishable floppy buttons. Preserve create-new versus overwrite choice, scope and confirmation. Native dialog Cancel/close/dirty-draft handling must remain available; do not remove cancellation safety merely to achieve the icon layout. Map any retained Cancel to a clearly named close/cancel affordance without changing submission semantics.

## One action-button size

Reuse createAtlasIconButton / createSettingsIconButton and styles/atlas-ui.css. Adopt the existing standard 2rem square action target and separately sized 0.8rem glyph for Atlas action buttons, including toolbar, footer, inline plus, picker and transportation controls. Centralize tokens instead of adding per-window overrides. Icons are centered, with consistent border, padding, hover, disabled and visible keyboard-focus treatment. Do not shrink hit targets to shrink glyphs. Text zoom must remain usable; never reduce targets below 24 CSS px.

Inside native Foundry fieldset legends, the same 2rem target / 0.8rem Font Awesome glyph applies to Add Land Travel Method, Add Map Marker and Generate Region. Prefer one sufficiently scoped shared CSS selector (including the icon pseudo-element where relevant) over per-dialog inline dimensions or `!important`. Record actual computed styles at standard and 200% text zoom before declaring #406 visually resolved. [Live checklist](TEST_0_3_11_DEV_1_ISSUE_406.md).

This applies to UI action glyphs, not configurable map markers, map labels or decorative artwork. Keep units and content typography separate from action icon sizing.

## Numeric sliders and direct entry

Every bounded numeric slider has a synchronized numeric input immediately beside it and a visible unit where applicable. Use the existing shared scripts/settings-number-range.js control/model, or native Foundry range-picker if it already provides this behavior; do not build competing controls.

Use one shared width token for numeric entry across Atlas (initial design value: 5rem), with the same box sizing, height and alignment. The 5rem value is a design starting point, not an owner-specified measurement; validate legitimate longest values, negative values, decimals and text zoom before finalizing the global token. Do not introduce per-panel widths. Responsive layouts may wrap the pair as a unit; keep entry readable.

Retain min/max/step, units, nullable values, conversions and deliberately different slider-versus-number bounds. Reject invalid/nonfinite/out-of-range/step-invalid input at the existing save boundary; never silently save an earlier slider value. Updating either control synchronizes the other and any local preview without recursive event loops or new persistence. Preserve existing explicit commit boundaries for client settings and live controls. No schema migration or rounding of stored values on open.

## Forms, presets and customization

Use “Customization” consistently for Road Style and Checkpoint Marker & labels tabs. Use “Banner” consistently for user-facing checkpoint name/detail presentation, including Off / On hover / Always. Persisted field/API names need not change. Distinguish the marker itself from its banner.

After creation, preset editing displays the current preset identity and a Change preset action using the pencil convention. Reuse the checkpoint preset selection pattern for other applicable Atlas preset selectors. Keep an explicit None/inherited/default state and existing validation. Selecting an item preset does not edit the World preset. Saving current settings as a preset is a separate action with create/overwrite choices. Creation forms may retain their initial preset selector.

In Road Settings, the existing **Travel preset** field appears before **Road name** and mirrors the Map Marker current-name/visible **Change preset…** control on the same line (never a stacked value or icon-only pencil). The selected value remains staged until the Road's explicit Save; **None (Land fallback)** remains honest, and unavailable World IDs must be visibly flagged rather than displayed as None. No selector action modifies World presets or native Region Behaviors. [#411 live test](TEST_0_3_11_DEV_5_ISSUE_411.md).

Use consistent label/control alignment, row spacing, section headings and color-picker dimensions. Settings-only previews are draft-driven and do not mutate live documents. Window initial dimensions should expose ordinary controls and preview on supported desktop sizes, bounded by the viewport. Keep tabs and footer accessible, avoid horizontal scrolling, and allow a single predictable content scroll region on smaller screens. Do not promise no scrolling at every zoom/viewport, continually resize on every input, or overwrite user-resized dimensions.


**Map Marker type is not a preset-selection command.** Changing a placed marker's Type must not automatically apply any World preset, reassign the current preset ID, or reset appearance, discovery, Journal, transportation or visibility drafts. Only an explicit **Change preset** selection can apply another preset's defaults; Save/Cancel remain the commit boundary. See [issue #412 test checklist](TEST_0_3_10_DEV_1_ISSUE_412.md).

### GM language and menu scope

Use **Add Territory**, **Add Road**, **Add Map Marker** and **By Territory / All Roads / All Map Markers** in Atlas Workspace. Show display categories as **Land / Water / Air**, while preserving stored lowercase surface IDs. Use **Map Marker Presets** for World marker defaults and short, distinct menu tasks for **Transportation Presets**, **Surface Presets**, **Road Appearance**, and **Announcement Previews**. The menu copy must identify explicit GM save/application boundaries and must not imply that World presets retroactively rewrite placed markers or native Region Behaviors. Genuine in-world categories such as Security Checkpoint and all internal `checkpoint*` keys remain unchanged. [#410 live checklist](TEST_0_3_10_DEV_3_ISSUE_410.md).

## Navigation, lists and state

Center labels horizontally and vertically inside navigation buttons. Directory view controls must be visibly grouped and labeled as views/filters, with a strong selected state, keyboard support and appropriate semantics. Keep Add actions separate from filter controls.

Place row actions inline at the far right without losing nesting indentation or the disclosure hit area. Action clicks must not toggle the row disclosure. Preserve open groups, search/filter values, scroll, focus and window position through ordinary actions/rerenders. Locate must not strand the Workspace minimized or change Scene. On narrow screens wrap actions within the same item rather than overlap names.

Placed Map Marker Settings uses one persistent bottom footer outside the scrolling tab body: [Locate] [staged visibility] [Move] on the left, and [Save as preset…] [Save Map Marker] [Delete Map Marker] on the right, Delete last in DOM order. Locate only invokes the existing transient Atlas camera/focus callback and does not leave the editor or change its draft; new unsaved markers must disable Locate with an explanatory accessible label. The preset Save remains an independent World confirmation. [#415 live checklist](TEST_0_3_11_DEV_4_ISSUE_415.md).

Sort checkpoint display lists A–Z with locale-aware comparison and deterministic ties; never reorder the graph or stored checkpoint sequence for a visual sort. Native Region priority lists remain in priority order and retain drag/keyboard semantics.

### Explicit manual Show/Hide approval

Manual Road, Map Marker, party knowledge and Territory boundary Show/Hide actions must identify the exact item, the affected player-facing channel, and the independent permissions they **do not** change. Use native v14 `DialogV2.confirm` with a `div` content root and safe text nodes for user-authored names. **Direct** directory changes confirm before existing GM/revision-checked persistence; **staged** editor eye controls confirm a draft-only change and must never commit until Save. Cancel, Escape or X is a no-op, and repeated clicks must not duplicate writes. Automatic discovery and rendering are not manual approval flows. Display icons depict the current shown/hidden state with matching accessible state. [#409 live checklist](TEST_0_3_10_DEV_2_ISSUE_409.md).

## Ownership and player safeguards

UI reorganizations must retain the beta.8.55 banner contract: existing showRoadName remains canonical; additive banner fields use existing owners, one explicitly selected eligible native Region, no cached names or automatic nearest-territory choice. Selected details are visible to GM and players for shown checkpoints, subject to existing hidden Road/Region filtering. Do not grant Journal access, publish Region geometry, infer confidentiality from UI filtering, or introduce write-on-read. World presets never blindly copy Scene Region IDs.

Every new/modified UI PR must identify the controls audited, exceptions and reasons, and test the applicable shared standards. Runtime acceptance requires actual Foundry v14 evidence; unit tests alone are not live acceptance.

## Follow-up standards: Map Markers, directories and editors

The owner’s post-beta.8.58 annotations establish the following additional presentation direction. See [UI_STANDARDIZATION_BETA8_58_HANDOFF.md](UI_STANDARDIZATION_BETA8_58_HANDOFF.md) for numbered instructions and acceptance tests.

- Use **Map Marker** / **Map Markers** for the generic entity formerly called Checkpoint. “Point of Interest” is a possible alternative, but Map Marker is the selected recommendation because it also covers travel/service stops. Retain specific in-world category names such as Security Checkpoint, Toll Gate and Milestone. Rename user-facing labels/help/tooltips/accessible text and current user documentation; preserve internal checkpoint identifiers, schemas, flags, API names, import/export keys and historical evidence. No blind global replacement or rename migration.
- Search belongs at the right of Atlas list toolbars, with a magnifier at the input's right and an accessible label. Filters and A–Z/Z–A sort belong at the left; wrap responsively. Use shared controls and existing search timing. Audit all Atlas-owned equivalents.
- Group long selectors by meaningful domain categories and sort labels within groups. Reuse the existing Map Marker type taxonomy everywhere. Territory options use real ancestry and readable paths, with a no-continent group; never fabricate membership. Ordered enums, route order, history and Region priority are explicit exceptions to alphabetization.
- Distinguish entity names, secondary type metadata and compact counts. Expandable rows need visible chevrons; parent row actions stay aligned regardless of expansion. Use named collection sections (Settlements, Other territories, Roads, Map Markers) and indentation rather than pretending Roads are geographic peers of villages. Counts use a documented unique-ID projection.
  Group the label, optional type and read-only unique-ID counts inside the same wrapping summary identity area, before every action/shortcut. Keep the right-side controls outside that identity group. Narrow layouts wrap metadata without changing count definitions, native disclosure semantics or item focus order. See [#408 checklist](TEST_0_3_11_DEV_2_ISSUE_408.md).
- Contextual lists use bordered panels/fieldsets with title, count and adjacent plus; contents and empty state live inside the boundary.
- Settings changes names and configuration. Pencil Edit means map geometry/position changes where applicable. Undo uses a curved-back arrow; Redo uses a curved-forward arrow. Keep history draft-scoped and distinct from Reset defaults.
- Editor help has a short purpose sentence and readable gesture/key rows. Explain “unconnected end” and similar concepts in plain language; verify gestures against current code. Movement modes need a visible instruction/control dock.
  Canvas editor title bars may move only their own client-side controls; moving or resizing must not invoke map painting/point edits, mutate drafts, or commit native documents. Keep the title keyboard reachable (arrows to reposition), viewport-clamp it, and dispose input/resize listeners with the existing session. Prefer existing native ApplicationV2 for new editors; a transient DOM painter should retain its original lifecycle instead of nesting a competing application. Keep dynamic status to counts/selection/hover and put full batch-transfer warnings immediately before Stage/Save. [#407 GM test checklist](TEST_0_3_11_DEV_3_ISSUE_407.md).
- A child operation that minimizes an open Workspace must restore that same window on completion/cancel/clean close, preserving view state. Track ownership of minimization; do not resurrect user-closed windows or override manual window choices.
- Footers stay at the bottom of the application window outside the scrolling content, with stable placement across tabs. Do not fix them to the browser viewport or cover preview/content.
- Place related color swatches beside their controlling checkbox/select when practical, preserving the color when disabled. Road border swatch stays visible; changing its draft color does not turn the border on. Apply consistent spacing, accessible names and responsive wrapping.
- Dynamic Road territory banner text is exploratory, not approved persistence semantics. Obtain a reviewable design decision about anchor, overlaps and player filtering before implementation.

**Map Marker Banner information layout (#414):** Keep the existing Banner Display selector and Banner Text Color swatch in a single responsive row with separate accessible labels and tab stops, matching Road and World preset presentation. Banner Off disables subordinate controls without clearing drafted color; preview and explicit Save retain their existing ownership and validation. [v14 test matrix](TEST_0_3_11_DEV_6_ISSUE_414.md).

**World presets UI batch (#419, #421–#423):** In the Workshop Settings provide one Presets destination with links to existing GM World editors, retaining focus/context. World Road Appearance, Transportation and Surface catalog collections all use Land | Water | Air tabs (not new stored categories). Preserve independently mounted forms and active category on rerender, keyboard arrows/Home/End and visible tab focus, and do not write or clear drafts on tab switch. A category-specific plus belongs beside the Surface Presets legend; Water retains all existing subdivisions. Road Appearance keeps one Save below independently scrollable categories and must reveal invalid hidden form values rather than silently omit validation. [Batch v14 checklist](TEST_0_3_11_DEV_7_WORLD_CATALOG_BATCH.md).

**World Map Marker preset editor parity (#420):** Share the placed Map Marker compact icon chooser rather than permanently expanding a gallery. Group World Customization fields into Map Marker settings, Banner information and read-only Map preview, with matching labels, shared slider/color controls and an always-visible bottom Save. Preview only portable World preset draft inputs and generic sample text. Do **not** read Scene IDs, imply a native Region, auto-apply World defaults to placed Map Markers, or add the proposed border-enabled field before #413's validated legacy/runtime contract. [Owner v14 checklist](TEST_0_3_11_DEV_8_ISSUE_420.md).

**Contextual native Atlas tools (#418):** The Atlas Workspace Settings no longer carries an Advanced map operations disclosure. The existing **Map directory → Tools** buttons open the original Territory, Road and Map Marker management views without rewriting their GM permissions, native save/recovery boundaries, or stored state. Preserve the unique Hex/Grid Batch, valid interrupted-transfer **Resume / Roll Back**, legacy graph and marker discovery links. Never remove native recovery access merely to simplify Settings; test route parity and v14 GM/non-GM behavior. [#418 capability matrix](TEST_0_3_11_DEV_9_ISSUE_418.md).

**Map Marker border enabled (#413):** Pair a clearly labeled **Map Marker border** checkbox and **Map Marker border color** swatch on one responsive row in both placed Map Marker Settings and World preset editor, matching Road border controls. Off hides only the applicable marker artwork border and disables—but never resets—the retained color input. On restores the same saved/draft color. Legacy appearances without the flag render as before; GM/player canvas and previews must match dot, bundled Font Awesome and custom image behavior. This is an appearance attribute, not native Region geometry or player visibility. [v14 acceptance](TEST_0_3_11_DEV_10_ISSUE_413.md).

**Map Directory views (#418 correction, dev.11):** Provide only By Territory, All Roads and All Map Markers as routine navigation; don't append a duplicate Tools selector. Show read-only **native Region color** beside Territory, **resolved Road appearance color** beside Road, and **selected dot/Font Awesome/SVG/custom image** beside Map Marker. Road titles show count of explicitly attached Map Markers; Marker titles show actual configured transportation method names. No arrow/disclosure on a record with no nested Road markers or transportation methods. Preserve title/metadata before actions and accessible per-record controls. Exceptional GM native batch, interrupted transfer recovery, border analysis and legacy graph operations remain contextual and non-mutating on view. [Owner acceptance](TEST_0_3_11_DEV_11_DIRECTORY_VIEWS.md).
