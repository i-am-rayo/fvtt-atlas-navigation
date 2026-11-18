# Atlas Checkpoint UI annotations — implementation handoff

Date: 2026-11-17  
Status: **Instructions only. Implementation, installation and release are not part of this PR.**  
Product Owner: repository owner  
Baseline: [PR #357 — beta.8.52](https://github.com/i-am-rayo/fvtt-atlas-navigation/pull/357)  
Reviewed baseline commit: `2ab2ab69f9b51b3830f666991b20fbcfd01fb0b8`  
Baseline branch: `test/v0.3.9-beta.8.52-checkpoint-settings-footer`

## Purpose and handoff boundary

The owner supplied nine annotated screenshots of Checkpoint Settings and requested consistent Atlas UI controls, clearer connection information and configurable checkpoint banners. The owner then explicitly stopped implementation in this chat and requested a documentation-only PR so implementation can continue from a regular web chat.

This document is the complete actionable brief for those **nine latest annotations**. Earlier explorer/prototype and Workspace work is already represented by preceding PRs and must be preserved rather than rebuilt.

No runtime code, manifest, package version, data schema or installation changes are included in this documentation PR. An unpublished local experiment was started before the owner changed the scope; it is **not** part of this PR, not a required implementation, and not evidence that these requirements are delivered. Start from the reviewed remote baseline and current repository state.

The source screenshots were supplied in the owner conversation. They are not embedded in this repository; their relevant visible labels and observations are transcribed below so this brief is usable without access to that conversation. Example place names are evidence, not strings to hard-code.

## Confirmed owner decisions

- Remove visible “Shown” / “Hidden” words from the Checkpoint footer, retaining the eye / crossed-eye action.
- Put the icon chooser **left of** the marker-type dropdown.
- Establish one shared size for Atlas action icons, including transportation edit/remove and Delete.
- Editing actions belong on the **left**; Delete belongs at the **far right**, visually separated from Save.
- Offer multiple optional checkpoint banner details: type, elevation, road name and one explicitly selected available Territory.
- Where City and Continent overlap, the GM must be able to choose the Continent.
- **Confirmed clarification:** selected banner details are for **GM and players on shown checkpoints**, not GM-only.
- Numeric sliders must also provide direct numeric entry, consistently across comparable Atlas controls.
- Keep native Foundry v14 APIs, existing drafts, validation, persistence and data ownership.

## Baseline behavior that must survive

Beta.8.52 already:
- Right-aligns the selected preset name and Change preset action.
- Displays elevation using recognized native Scene units, with the existing fallback when unavailable.
- Preserves exact stored elevation when an unrelated field is saved.
- Keeps Show/Hide staged in the footer until Save Checkpoint.
- Provides a live marker/name/optional Road preview matching the map's main visual hierarchy.
- Retains the existing dirty-close guard and staged geometry/road actions.
- Builds on #356's prototype explorer support and #354's Journey controls.

Do not replace these handlers or revert to an older standalone Navigation branch.

## Annotation 1 — icon-only Show/Hide

**Observed:** General and Marker & labels footers show an eye icon followed by “Shown”.

**Required:**
- Remove the visible status words in both shown and hidden states.
- Keep a single visibility control; do not reintroduce a General-tab selector or duplicate hidden state.
- Keep an accurate accessible name and tooltip describing the action, such as “Hide checkpoint” / “Show checkpoint”.
- Expose state with an appropriate pressed/state attribute as well as eye versus crossed-eye imagery.
- Preserve discovery method and existing lore/visited history. This is presentation cleanup, not a new discovery model.
- Clicking changes the editor draft only; Save Checkpoint remains the persistence boundary.

**Acceptance:** the footer has no visible Shown/Hidden text; keyboard and screen-reader users can identify the action/state; closing without save preserves the original state.

## Annotation 2 — chooser before the marker dropdown

**Observed:** the icon chooser is at the far right of “Checkpoint marker”, after the type dropdown.

**Required:**
- Use one aligned control group: **[icon chooser] [marker-type dropdown]**.
- Keep the field label distinct from the controls.
- Preserve the bounded native icon popover, icon search/categories, selection and focus return.
- Show the chooser only where applicable to the selected marker type; preserve Default dot and Custom Foundry image behavior.
- Do not resize the whole ApplicationV2 window when opening the chooser.
- Maintain sensible keyboard order and a responsive layout without clipped dropdowns.

**Acceptance:** chooser appears left of the dropdown at normal and narrow widths; selecting an icon updates the draft and live preview without saving or collapsing other content.

## Annotations 3 and 4 — shared action-icon size

**Observed:** Transportation's “Edit Carriage at this checkpoint” and “Remove Carriage from checkpoint” controls are oversized. The owner asks for a global standard.

**Required:**
- Define the standard once in shared Atlas action-control styles/primitives.
- Apply it to transportation edit/remove/add, Checkpoint footer Move/Show/Delete, chooser trigger, and other comparable Atlas action buttons.
- Audit native fieldset legends and window-specific CSS overrides; they must not silently inflate the same control.
- Distinguish **glyph size** from **click target size**. Smaller glyphs must retain usable pointer targets and keyboard focus.
- Preserve accessible labels/tooltips and recognizable destructive coloring.
- This standard applies to action controls, not authored map-marker sizes, logos or preview artwork.
- Record the standard in repository UI guidance / AGENTS.md during implementation.

**Concrete starting recommendation:** 2rem square action target with approximately .8rem glyph, consistent padding and visible focus outline. This value is an implementation recommendation, not an owner-specified measurement. Verify actual rendered size against the existing Workspace and the user's Foundry font scaling; retain at least a usable 24 CSS-pixel target.

**Acceptance:** edit/remove/add/visibility/delete actions look consistently sized across inspected Atlas windows. No giant plus signs, stretched transportation icons or inconsistent legend buttons.

## Annotation 5 — distinguish the connected Road

**Observed:** Terrain Region shows “Millstone-Dirwest Road” as plain paragraph text, visually blending with the instruction below.

**Required:**
- Present actual Road identity as labeled data: for example a “Connected road” caption with the Road name in a clearly separated row or compact block.
- Keep guidance and warning text below or beside that data with a subordinate hierarchy.
- Display multiple connected Roads accurately; do not imply a single Road when the checkpoint is a shared junction.
- Show a clear “No connected road” / independent-checkpoint state when applicable.
- Preserve existing Connect/Disconnect availability, shared-topology safeguards and stale-data validation.

**Acceptance:** the GM immediately understands which Road is connected, which text is guidance, and why a connection action may be unavailable. Long and multiple Road names wrap cleanly.

## Annotation 6 — parallel Territory/Region actions

**Observed:** “Link Territory” and “Create Terrain Region…” are stacked vertically.

**Required:**
- Place them in a shared horizontal action row at normal editor widths.
- Use consistent height, spacing and alignment.
- Permit wrapping on narrow windows rather than overflow or tiny controls.
- Keep the distinction between a geographic Territory association and generated travel Terrain Region clear.
- Preserve the existing command paths, preview/confirmation, ownership and native Region protections.

**Acceptance:** both actions appear side by side where space allows; narrow layout remains usable; merely opening the tab changes no Region or association.

## Annotation 7 — footer order and Delete placement

**Observed:** Delete is at the far left; Move, Show/Hide, preset save and checkpoint save sit to the right.

**Required:**
- Editing/utility controls start on the left.
- Delete is the last, far-right destructive action, separated from Save.
- Use the same shared icon size for Delete as for other comparable action buttons.
- Preserve explicit labels for Save Checkpoint and Save as preset; those are separate operations.
- Preserve deletion confirmation/dependency guards, unsaved-change handling and the native window close control.
- Update the Road/Checkpoint shared footer standard and relevant repository instructions.
- Make DOM order and keyboard order agree with visual order where practical; do not rely solely on CSS reordering.
- Inventory other Atlas editor footers and apply/document the same rule without changing their gameplay handlers.

**Suggested layout:**

```text
[Move] [Show/Hide] [Save as preset…] [Save Checkpoint]     [Delete]
editing and save actions                                 danger
```

**Acceptance:** Delete is far right and clearly separated from Save; keyboard traversal is logical; no accidental save/delete coupling or duplicate submit handler.

## Annotation 8 — configurable checkpoint banner content

**Observed:** Marker & labels has only “Include road name with label”. The owner wants multiple optional details, including a chosen enclosing Territory.

**Required UI:**
- Replace the single-purpose section with a clearly labeled “Include in checkpoint banner” group.
- Allow independent inclusion of:
  - checkpoint type;
  - elevation;
  - Road name;
  - one selected available geographic Territory.
- Keep checkpoint name as the primary identity.
- Offer None / No territory and distinguish available choices by name and geographic kind where helpful.
- When a checkpoint belongs to an overlapping City and Continent, offer both; never silently choose the smallest, largest or first result.
- Reuse existing validated membership/explicit-association logic. Do not invent ownership from names, duplicate native geometry or create associations just to populate a label.
- Handle unsupported geometry, missing/deleted Regions, unavailable data and ambiguous overlaps honestly.
- Existing saved selections that are no longer candidates must be reviewable/clearable rather than silently replaced.
- Creation drafts without a placed checkpoint must not pretend containment has already been established.

**Preview and runtime:**
- Use the same formatting rules for editor preview and actual map labels.
- Retain the baseline hierarchy: prominent checkpoint name, subordinate optional information.
- Respect Off / On hover / Always and current zoom behavior.
- Format elevation with the existing Scene-aware measurement rules; never overwrite canonical meters merely to format text.
- Avoid duplicated hover information when an optional detail is already in the banner.
- Long labels, multiple included details, font icons, images and default dots must remain readable.

**GM/player boundary — explicitly approved:**
- Selected details appear to GM and players when the checkpoint is shown.
- Hidden/unknown checkpoints must remain excluded from the player overlay.
- Including a Road name does not authorize revealing an otherwise hidden Road; preserve existing Road-name filtering.
- Selecting a Territory name does not publish its boundary, alter native Region visibility or grant Journal permissions.
- Resolve unavailable or unauthorized native data safely; do not fabricate stale names or silently grant access.
- Keep the repository's distinction between visual hiding and confidentiality of client-readable Scene flags explicit.

**Persistence design instructions:**
- Inspect current appearance/schema, preset, import/export and player-projection code before choosing a representation.
- Prefer the existing presentation owner and revision-checked save path; do not add a competing checkpoint store.
- Specify and test backward-compatible defaults: existing checkpoints retain their current labels until explicitly edited.
- Validate allowed fields/types and selected identifiers; opening a window must not migrate or write.
- Preserve the new options through unrelated edits, resets, preset application, import/export and bulk operations as appropriate.
- Do not blindly save a Scene-specific Territory ID into a reusable World preset. Define portable preset behavior separately from per-Scene selection.
- Define handling for Region rename/deletion, checkpoint movement, copied/imported IDs and downgrade compatibility.
- If an additive field/schema change is needed, document it and preserve old data. Do not treat this handoff as approval to silently migrate all Scenes.

**Acceptance:** a shown City checkpoint can display its selected Continent, type, elevation and allowed Road name; the preview agrees with GM/player output; hidden checkpoints/Road names remain protected; save/reload preserves selections; legacy checkpoints and unrelated fields remain unchanged.

## Annotation 9 — slider plus numeric input everywhere applicable

**Observed:** “Marker size (12–64 px)” has a slider and “24 px” readout but no editable number.

**Required:**
- Add direct numeric entry beside marker size while retaining the slider.
- Audit comparable Atlas range controls and standardize the interaction.
- Synchronize slider → number and number → slider without recursive events, duplicate saves or stale previews.
- Match units, limits and step semantics. Handle empty, nonfinite, out-of-range and invalid-step drafts explicitly.
- Keep existing authoritative validation and persistence callbacks; adding a number field must not introduce an early write.
- Maintain disabled/read-only behavior, accessible names, keyboard entry and responsive layout.
- Reuse native Foundry range-picker controls where they already provide number entry.
- Do not force arbitrary numeric fields into sliders when they lack a meaningful bounded range.

**Audit inventory from the reviewed source:**
- Checkpoint marker size, Region radius/width, reveal radius and elevation.
- Party discovery radius.
- Atlas Layers fill opacity.
- Manual exploration brush radius.
- Territory paint brush radius.
- Transportation numeric controls.
- Navigation visual playback speed and target duration.
- Native/World setting range controls.

Preserve each control's units and existing operation boundary. For example, a presentation-only playback adjustment must not become a new Token movement, World-time or Journey mutation path.

**Acceptance:** direct marker entry updates its slider and live preview; every audited slider has either paired numeric entry or a documented justified exception. Invalid drafts cannot silently save a different value. Existing Save/Apply/confirmation semantics survive.

## Source map for the implementing chat

Verify current contents first; these are starting points, not instructions to replace whole files.

| Concern | Source |
| --- | --- |
| Main Checkpoint UI, drafts, footer, presets, preview | `scripts/checkpoint-appearance-editor.js` |
| Shared icon controls and styles | `scripts/ui-action-button.js`, `scripts/settings-controls.js`, `styles/atlas-ui.css` |
| Road/Checkpoint footer layout | `styles/road-settings-dialog.css` and Road editor footer construction |
| Marker icon popover | `scripts/checkpoint-icon-control.js` |
| Checkpoint numeric controls | `scripts/checkpoint-form-controls.js`, `scripts/settings-input.js` |
| Transportation controls | `scripts/checkpoint-transportation-editor.js`, `scripts/navigation-transport-form-controls.js` |
| Appearance validation and storage | `scripts/checkpoint-appearance.js`, `scripts/road-storage.js`, `scripts/atlas-model.js` |
| GM/player canvas labels | `scripts/road-canvas.js`, `scripts/player-overlay-model.js` |
| Scene units | `scripts/navigation-measure-units.js` |
| Territory choices | `scripts/territory-checkpoint-membership.js`, `scripts/territory-checkpoint-link.js`, `scripts/territory-geography-storage.js` |
| Checkpoint types | `scripts/checkpoint-types.js` |
| World presets and bulk application | `scripts/checkpoint-preset-editor.js`, `scripts/checkpoint-preset-model.js`, `scripts/checkpoint-bulk-apply.js` |
| Other slider surfaces | `scripts/atlas-layers.js`, `scripts/atlas-manual-fog-panel.js`, `scripts/territory-authoring-canvas.js`, `scripts/navigation-playback-controls-view.js`, `scripts/scene-config.js` |

Read `AGENTS.md`, `docs/CODEX_FOUNDRY_UX_AUDIT.md`, `docs/UX_AUDIT_2026-11-12.md`, `docs/CHECKPOINT_SETTINGS_BETA8_52.md`, architecture and data-model guidance before implementation. Recheck newer PRs so subsequent work is not overwritten.

## Recommended implementation sequence

1. **Presentation-only PR:** annotations 1–7, shared action size and documented footer standard. No schema or gameplay changes.
2. **Numeric-control PR:** annotation 9, shared numeric-entry behavior plus focused callback/validation tests. Preserve native handlers.
3. **Banner-content PR:** annotation 8, explicit data contract, editor/preview/runtime integration and player filtering. Keep this separately reviewable because it changes persisted presentation and player-visible metadata.

Each PR should be independently testable and remain draft until the required acceptance is complete. A smaller number of commits/PRs is acceptable if boundaries remain clear; do not mix unrelated Journey or persistence refactoring into presentation work. The earlier Sunday November 15 milestone is historical as of this handoff; do not claim a new delivery date without owner agreement.

## Validation and evidence required for implementation

- Run relevant behavioral tests, `npm run check`, `npm run architecture:check`, syntax checks for changed/new JS/MJS, and `git diff --check`.
- Test real DOM event behavior, not fixtures that overwrite multiple listeners or omit required browser attributes.
- Add targeted regressions for staged visibility, footer order, numeric synchronization/invalid drafts, legacy appearance validation, selected Territory, opt-in elevation/type and filtered player output.
- Preserve current architecture gates and native Foundry v14 compatibility; do not lower a failing quality bar.
- Capture before/after General, Marker & labels, Terrain and Transportation views, plus one narrow-window example and icon popover.
- Verify keyboard focus, tooltip/accessibility names, dirty-close behavior, stable window size and retained scroll/expanded state.
- Distinguish automated tests, read-only browser inspection, owner persistence tests and two-client GM/player verification. Never label an unperformed check as passed.

### Product Owner checklist

- [ ] All nine annotations map to a visible change or explicitly documented limitation.
- [ ] Icon-only visibility and chooser-left layout are correct.
- [ ] Action glyphs/targets are consistent across audited windows.
- [ ] Editing is left; Delete is far right, including keyboard order.
- [ ] Road identity is distinct from instructions; Territory/Region actions are parallel.
- [ ] Marker size supports direct numeric entry; audited slider pairs preserve their handlers.
- [ ] Banner supports type/elevation/Road/selected Territory with accurate preview.
- [ ] GM and player shown-checkpoint output agrees; hidden checkpoints and hidden Road names stay excluded.
- [ ] Existing data, native Regions, Journals, Tokens and Journey controls are preserved.
- [ ] Automated checks and relevant Foundry v14 acceptance evidence are attached.
- [ ] No merge or stable release occurs without owner approval.

## Foundry testing and installation boundary

Authorized test surface from this review: designated Foundry GM tab, World **00. Master Lore**, Scene **Sandbox**, document ID **Scene.urz1d8NZFFhjo38J**. Earlier conversation referred to a different World display title; reconfirm the actual World ID/title, Scene ID and installed version before any future interaction. Do not guess the World slug from the display name.

Ordinary QA stays read-only in that World/Scene: do not save gameplay data, move Tokens, run Journeys, or alter native Regions/Journals. Persistence and two-client checks require an explicitly authorized disposable fixture or owner execution.

Only when the owner requests installation, use the designated tab: Settings → Return to Setup → Add-on Modules → Install Module → approved module.json. Verify the installed Atlas version before launching the owner-designated World. Use the existing authenticated session; the owner completes password entry. Join as Rayo and verify Sandbox's name and document ID. Never put credentials in files, PRs or audit evidence.

## Copy-ready prompt for a regular web chat

> Implement the requirements in docs/CHECKPOINT_UI_ANNOTATION_HANDOFF_2026-11-17.md in i-am-rayo/fvtt-atlas-navigation. First read AGENTS.md, the referenced audit/design documents, PR #357 (beta.8.52) and newer active PRs. Preserve their changes. The nine annotations and the owner's GM-and-player banner decision are the acceptance contract. Use existing native Foundry v14 controls, drafts, validation and persistence owners. Start with the presentation-only changes, then numeric controls, then separately reviewable banner persistence/player rendering. Provide focused draft PRs, tests, a source-to-annotation checklist, and any remaining Foundry acceptance steps. Do not merge, publish a stable release or make live gameplay changes. Do not rely on unpublished local experiments from the earlier desktop chat.
