# Atlas 0.3.13-dev.10 — Workspace polish

## Baseline and scope

PO accepted the reported dev.9.1 test on 2026-11-24: standardized Wagon confirmation, completed mixed and single-method land journeys, World-time advancement and successful interrupted Journey recovery. This candidate starts at exact commit 52f3cec02e22d3fd044f673a8dfddea3663fb3f3, PR #533. Main and earlier test manifests remain untouched.

Milestone 01, #518. This is a deliberately narrow read-only UX slice, not a Territory or Journey feature change.
- Workspace main pane restores scroll only when the rendered view is the same; deliberate navigation to another view starts at the top.
- Same-view directory search/filter controls, section/view tabs and Refresh use stable scoped focus identities. Preserve search selection/caret; never restore focus when it was outside this Workspace. Only enabled matching controls are restored.
- Container queries adapt to the actual modeless Workspace width, including horizontal navigation and wrapping controls at 670px and below. Native theme and document authority retained.
- No new dependencies, persistence/schema, Scene, native Region, Actor/Group, Journey, time, pricing, Fog or movement changes. Existing settings draft behavior outside this scope is not altered.

## PO Foundry v14 live test
1. At normal viewport, open Atlas Workspace > Map directory. Enter a search query in By Territory, then trigger a same-view refresh (e.g. a separate modeless Scene edit). Confirm the filter value, caret, keyboard focus, row expansion and scroll stay in the directory. No document write occurs from refresh itself.
2. Select All Roads, scroll, choose All Map Markers. Confirm it starts at the top and the selected view button remains focused when activated by keyboard. Return to All Roads: its previous filters remain, with scroll beginning at the top.
3. Open a separate modeless settings window, focus a field there, and trigger Workspace refresh. Confirm focus is not stolen from the editor. Test search and select controls with Tab/Shift+Tab, arrows and text selection.
4. At a supported Foundry viewport, resize only Atlas Workspace from wide to ~650px then ~450px. Confirm Overview / Map directory / Settings move into a compact horizontal nav; headings, filters, creation buttons, directory row labels and action buttons wrap without hiding content. Check long names, vertical scrolling, keyboard focus and dark/light native themes. At 200% browser zoom respect Foundry's minimum usable viewport (1024×768 CSS pixels); window-resize and zoom are separate tests.
5. Check Add Road -> canvas -> Save -> Road Settings, Add Map Marker, native Territory viewing (no transfer), Layers/brush and Journey planner entry are unchanged. Open as non-GM to confirm the authoring restriction remains. No new native Region writes from the polish.
6. Recheck the accepted dev.9.1 confirmation when convenient. Existing timing/Journal presentation observations are tracked under #513; do not change or replay old records.

## Candidate
Manifest: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feat/0.3.13-dev10-workspace-polish/module.json
Archive: https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/feat/0.3.13-dev10-workspace-polish.zip
Draft PR #534. Automated tests do not establish visual fidelity or live Foundry acceptance. No integration, tag or release authorized.
