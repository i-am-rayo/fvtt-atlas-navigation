# PR #376 — UI standardization coverage and owner acceptance matrix

**Audit date:** 2026-11-18. **Baseline:** owner confirmed the focused Road Settings SVG-opening fix in `v0.3.9-beta.8.59.3` works. This is **not** an acceptance of all beta.8.59 or PR #376 behaviors. All source PRs in this stack remain draft/unmerged.

The original #376 handoff is `docs/UI_STANDARDIZATION_BETA8_58_HANDOFF.md`; preserve that as the authoritative 27-item requirements list. This document measures implementation coverage and distinguishes automated evidence from Foundry v14 live evidence. The audit is a control inventory, not a substitute for GM and non-GM screenshots or runtime verification.

## Per-annotation implementation status

**Code** means functionality is present in the indicated stacked branch, not that it was live-accepted. **Partial** means material implementation or full-surface audit remains. **Design** means no runtime change is authorized.

| # | Owner requirement | Coverage / source | Remaining acceptance or gap |
|---|---|---|---|
| 1 | Workspace navigation text alignment | Code #377 | GM narrow width and 200% text-zoom visual check |
| 2 | Remove redundant Manage menus without losing services | Code #378 | Audit and live-confirm unique Advanced operations, permission access, and recovery tools |
| 3 | Directory chevrons / metadata / unique counts | Code #378 | Live nested, overlapping, filtered and duplicate-ID counts, keyboard disclosure |
| 4 | Parent row actions do not move on expansion | Code #378 | Long labels, collapsed/expanded nested rows, keyboard focus |
| 5 | Continents / settlements / other / roads / markers hierarchy | **Partial** #378 | Named sections and read-only projection exist; contextual section-level Plus shortcuts are not yet uniform; don't invent implicit native Region membership |
| 6 | Right-side search magnifier, accessible label | Code #378, Map Marker manager | Live audit of both Atlas-owned search inputs including narrow wrap; other non-search filters are not candidates |
| 7 | Left filters and A–Z/Z–A sorting | Code #378, Map Marker manager, Road marker list | Live accent/duplicate names, existing expansion state; native Region priority remains explicitly unsorted |
| 8 | Road secondary metadata and associated marker children | Code #378 | Multi-Road marker association, Road with zero markers, exact link and player filtering |
| 9 | Meaningful grouped selector options | Code: `settings-select.js`, #378, original grouped travel presets | Audit long custom World lists; avoid sorting Off/Hover/Always, history, Region priority or other semantically ordered options |
| 10 | One Map Marker type category taxonomy | Code #378 via `CHECKPOINT_TYPE_GROUPS` | Live custom category/filter parity and literal Security Checkpoint preservation |
| 11 | Settings versus Move action vocabulary | Code #378, existing authoring adapters | GM verifies gear edits name and pencil enters movement; no duplicate name editor |
| 12 | Reversible Workspace minimization/return | **Partial** #379, `atlas-canvas-editor-focus.js`, territory canvas | Canvas focus leases tested, but complete multi-editor/dirty-close, user-closed/manual-minimized and batch-transfer live acceptance is not recorded |
| 13 | Shared icon-only Save in applicable editors | Code #367–#368, #379, World marker preset, Road/Marker editors | World travel rules use *named* Save buttons because each owns separate explicit World-setting scope; verify keyboard focus and no duplicate commits |
| 14 | Shared map-pin Locate | Code #373, #379, #395; temporary canvas highlighting reused | Territory Settings' General **Locate on map** remains an explanatory named action row; no new fake Locate. Test v14 camera pan/highlight and no Scene switch |
| 15 | Real per-session Undo/Redo | Code #379 in the Road-point editor, with new-Road redo reuse | **Additional regression/live coverage needed:** multiple steps, branch invalidation, typing-field shortcut exemption, cancel/reset and stale-save refusal |
| 16 | Readable purpose and gesture help | **Partial** #379 Road dock; existing Paint Territory help | Other specialized canvas editors retain their own context-rich help; audit at 200% zoom, avoid changing documented gestures without code evidence |
| 17 | Map Marker movement dock and explicit confirmation | Code #379 reuses native Road/standalone movement boundary | GM confirms both independent/connected movements, near-Road choice, cancel, Focus lease and native confirmation. Save is in the **confirmation dialog**, not a second dock Save |
| 18 | Transportation plus glyph size | Code #380 via shared `createAtlasIconButton` | Narrow/zoom and native legend specificity |
| 19 | Quick GM Add Map Marker Scene tool | Code #383 using original `beginCheckpoint` | GM/player tool visibility, empty Scene, Road endpoint, Snap/Cancel and v14 toolbar |
| 20 | Compact Layers and mode explanations | Code #380 | GM/non-GM Layers visibility, keyboard selection and decorative swatches at 200% zoom |
| 21 | Border checkbox + retained swatch | Code #381 | Off→color edit→On, Save/Cancel and new Road cloned form |
| 22 | Preview Road name above line | Code #381; focused SVG crash fix #390 | **Latest hotfix owner-passed for opening only**. Visual equivalence across zoom/label modes and canvas still needs acceptance |
| 23 | Optional Territory subtitle beneath Road name | **Design only** #384 | Owner selects dynamic anchor vs explicit Region vs list, audience (GM/public) and Hover/Always. Do not add data or player read-model fields yet |
| 24 | Related color controls together | Code #381 Road, #394 World Map Marker banner mode/color | **Partial full-form audit**: some controls are independent colors without an enable/mode pair; avoid creating meaningless nested labels |
| 25 | Bordered Road-associated Map Markers section | Code #382 | Header/count/Plus, A–Z display, zero entries and Save/Cancel in v14 |
| 26 | Bordered native Regions section | Code #382 | Priority order, drag, Locate, preview/confirm, native Behavior preservation |
| 27 | Window-bottom footers outside scrolling content | Code #382 Road and Map Marker Settings, #393 World Map Marker preset | **Partial whole-suite audit**: Territory Settings is action-row driven with no global Save; World travel settings have independent explicit tab Save actions. Test narrow/200% and dirty X; avoid manufacturing an inert footer |

## Control inventory and deliberate exceptions

| Control family | Current owner / implementation | Coverage and exceptions |
|---|---|---|
| Search | `atlas-map-directory.js` and `scene-config.js` Map Marker manager | Both are actual `type=search` controls with accessible labels and decorative right magnifier. Other selectors are not searches. Directory state and manager list state are transient |
| Sortable lists | Directory Territory/Road/Marker projections, Road-associated markers, legacy Map Marker manager | Locale-aware A–Z/Z–A and stable IDs; no stored Road/Marker topology order change. Generated native Regions remain priority ordered; Journey legs and draft operations remain chronological |
| Grouped selectors | `settings-select.js`, `settings-controls.js`, `checkpoint-types.js`, geographic Territory select | Map Marker type and Road travel catalog use validated taxonomy; Territory options use real ancestor paths. Flat enums (Off/Hover/Always, authored Region priority, World rule modes) intentionally stay in semantic order |
| Numeric / units | `settings-number-range.js`, `checkpoint-form-controls.js`, Road appearance, World transportation | Pair numeric entry with sliders and validate at explicit Save. Road opacity stays 10–100% UI / 0.10–1.00 stored; do not silently round fractional Road widths or switch native measurement units |
| Icon controls | `ui-action-button.js`, `settings-controls.js` | Standard 2rem action target and ~0.8rem glyph for Save/Locate/visibility/Settings/Move/Add. Territory Settings uses named **descriptive action rows** for substantive native actions; those are not icon-only action bars |
| Color pairs | Road border and Road name text; World Map Marker preset banner | Paired controls stay independently focusable and retain color while display mode is Off. Unrelated colors such as Region's native color remain separate native ownership |
| Window/action footer | Road Settings, Map Marker Settings, World Map Marker preset, Road Editor dock | Native `ApplicationV2` remains authoritative; body scroll and footer are siblings. Territory Settings has no single Save because its native/Atlas actions have independent permissions and commits; its rows cannot safely be consolidated into one Save without new staged-state design |
| Editor ownership | Canvas Focus lease, Road dock, Territory Paint, Region generator, Map Marker Settings | Callers retain original GM permissions, dry-run/native confirmation and write guards. Do not force restoration of manually minimized or closed windows; multi-editor transitions require owner v14 evidence |
| Map Marker naming | Former generic Checkpoint surfaces, World presets, Territory links, transport, Layers, Scene control, portability | User-facing name is **Map Marker**. All internal `checkpoint` data/flags/keys/API and specific in-world Security Checkpoint category stay unchanged; historical code/docs may retain canonical technical terms |

## Outstanding owner-scope decisions and safety gates

1. **Do not merge or release** until beta.8.60 GM and non-GM acceptance confirms the changes on a backed-up Sandbox World. Node CI passing is not Foundry acceptance.
2. **Road Territory subtitle (#23):** design at `docs/ROAD_TERRITORY_BANNER_DESIGN_BETA8_59.md`. Recommended first pass: opt-in GM-only at actual Road label/hover anchor, no text for unrelated overlapping Regions, no persisted derived name, public names never inferred from hidden native Region metadata. Runtime remains blocked pending Product Owner approval.
3. **Lifecycle (#12/#15/#17):** validate real navigation/authoring overlap, dirty-close prompts, user/manual minimized window behavior, keyboard shortcuts and multi-step undo/redo against real Foundry canvas. Any failure halts dependent UI stabilization; never disable a revision guard to achieve visual alignment.
4. **Remaining presentation polish (#5/#16/#24/#27):** review section-level Add entrypoints, appropriate editor gesture text, paired colors only where controls are truly related and any remaining editor lacking a stable window-bottom footer. Constrain every change to its owner and add regression before shifting Save ownership.
5. **Last accepted result:** beta.8.59.3 Road Settings hotfix opens successfully. Beta.8.60 UI changes (PR #392 onward) are new and not live-tested.

## Owner test evidence to request with the next candidate

- GM: Workspace nav and Directory, sorted/filtered nested rows, native Region priority, Road Settings and SVG preview, World Map Marker preset Customization and Save/Cancel at narrow/200% text zoom, Territory Map Marker Locate, Focus lease behavior during canvas drafts
- Non-GM: no GM creation, editor, hidden Map Marker, Road, Region or Journal read-model exposure through a renamed label, new select, count or preview
- Game state: Scene Atlas revision/flags, native Regions, TokenDocuments, Actor resources, World time and Journey Journal unchanged by UI open/cancel/preview
- Evidence: Foundry v14 build, module version, screenshot of full window/footer, console stack for any failed Save/Cancel/render, and exact entrypoint
