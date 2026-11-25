# 0.3.13-rc.2 — #518 editor action safety

Based directly on RC.1 ffc5f26dd00d53baf722d95252aa193aa7b219b0. Owner requested new UI/UX scope only, no main publication. RC.1 remains intact. First #518 slice: Road and Map Marker editor safe primary actions; Party Transportation order; directory danger separation; Cancel-default Atlas deletion confirmations and updated UI standards. #527 additional crew and #193 scene-entry camera work are separate slices. #537/#528 and rejected cross-Level experiments excluded.

## Live Foundry v14 acceptance

Use a backed-up test Scene and independent GM/non-GM sessions. Native viewport >=1024x768 CSS pixels. Resize editor windows, verify native dark/light theme, keyboard navigation and 200% zoom when viewport permits.

1. Road Settings: Locate/visibility/Edit/Connection, separated Delete, Cancel, named Save Road. Tab order matches visual order. Save retains native form submission/validation. Cancel dirty draft -> Continue editing preserves it; discard does not persist. Verify native form validity and Enter only on appropriate control.
2. Map Marker Settings: Locate/visibility/Move/Save as preset, separated Delete, Cancel/Save Map Marker. New unsaved marker has Create Map Marker and Cancel, no Delete. Locate remains transient; Cancel uses dirty-close guard. Separate World preset command remains independent.
3. Party Transportation: contextual preset/refresh controls, Cancel then named Save. Existing draft and Group membership protections unchanged.
4. In directory, Road/Map Marker Delete is visually separated from other record actions; named tooltips and focus remain. On narrow windows verify wrapping and primary actions remain discoverable.
5. On sacrificial records only: Road/Map Marker dependent deletion, generated Terrain Region deletion, custom Map Marker/Transportation/Surface preset deletion. Confirm initial focus is Cancel, Enter on Cancel and Escape/X cause no deletion or dependent writes. Names and dependent choices visible; deliberately approve only on sacrificial record. Verify stale-change protections still block. Atlas-owned DialogV2 configuration only, no global native dialog overrides.
6. Verify prior accepted RC.1 workflows, no changes to Journey movement, time, pricing, Scene schema, Fog or native Group authority.

Scope limits: broad remaining Atlas footer/row audit (including every preset editor) and browser visual evidence are not complete. Automated tests assert DOM order and explicit DialogV2 defaults; actual native focus must be tested live. No new design framework. No merge/tag/release.

Manifest: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feat/0.3.13-rc2-editor-actions/module.json
Archive: https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/feat/0.3.13-rc2-editor-actions.zip
Draft PR #538.
