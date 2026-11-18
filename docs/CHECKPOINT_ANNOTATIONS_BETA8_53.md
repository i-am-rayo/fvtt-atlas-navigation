# Beta.8.53 — Checkpoint UI annotations 1–7 (presentation-only)

Source: PR #358 handoff, stacked on doc-only `codex/checkpoint-ui-annotation-handoff`, which preserves verified beta.8.52 PR #357. No Scene/Region/Token/Actor/Journal schema or authority change.

Implemented:
1. Visibility footer uses only eye / eye-slash, retains staged hidden value, tooltip, aria-label and aria-pressed.
2. Checkpoint marker icon chooser appears **before** marker-type dropdown in a separate responsive group; popover remains native and bounded.
3–4. Single shared Atlas action standard: 2rem square target, ~.8rem glyph, visible focus. Applies to Checkpoint Move/Show/Delete, chooser, transportation add/edit/remove and shared icon primitives, without scaling actual map markers or picker gallery samples.
5. Connected Road information uses a distinct labeled Road/Roads block, one name per line and independent state; warnings and safeguards remain separate.
6. Territory linking and Region generation buttons share one wrapping horizontal row; existing command and confirmation behavior untouched.
7. Editor utilities and save actions first; Delete last and far right, in actual DOM keyboard order. Road DialogV2 retains native Save button and staged Cancel flow.

Intentionally not implemented in this PR: annotation 8 banner persistence/player projections and annotation 9 numeric-slider standardization. Those need separate contracts/tests.

Automated verification: node tests, syntax checks, `npm run check`, `npm run architecture:check`, `git diff --check`, no import cycles. CI output and Foundry v14 acceptance are separate evidence.

GM live acceptance (backed-up test Scene): General and Marker footer icon-only in Shown/Hidden states, keyboard title and dirty Cancel; Marker tab chooser left of dropdown, search & focus return with no window resize; Transportation all four modes add/edit/remove hit target ~32 CSS pixels including fieldset legends; Road connection area shows multiple names if shared junction and independent text if no edges; Terrain two actions adjacent or wrapped when narrow; Checkpoint footer Move/Save as preset/Save/Delete order and Road footer native Cancel/Save submission; verify no stale state or premature writes. Non-GM check hidden data, Journal permission and on-canvas visibility remain unchanged.

**Manifest**: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.53-checkpoint-editor-consistency/module.json

Draft/unmerged pending owner visual and GM/non-GM acceptance.
