# Atlas beta.8.60 — UI continuation Sandbox acceptance

**Status:** Foundry v14 GM/non-GM Sandbox candidate, draft/unmerged, not a stable release. Owner confirmed the beta.8.59.3 Road Settings SVG opening hotfix works. That does not constitute live acceptance of the other beta.8.59 or new beta.8.60 workflows.

## Changes since beta.8.59.3

- **#392:** complete more remaining generic **Map Marker** text in World presets, Territory associations/Journals, Map Marker transportation, Scene manager, Layers, portability, notifications and related settings. Internal checkpoint storage/API keys and literal Security Checkpoint type remain unchanged.
- **#393:** World Map Marker preset tabs scroll independently of the native ApplicationV2 window-bottom Save footer; original Save/Cancel/dirty-close/World catalog ownership remains.
- **#394:** World preset tab uses **Customization** instead of Marker & labels; banner display mode and text color are adjacent but separately labeled/focusable, with Off retaining the color draft.
- **#395:** native Territory Map Marker membership row Locate uses the shared accessible map-pin icon; existing GM map-focus handler and no-write read model remain.
- **#396:** docs/UI_STANDARDIZATION_BETA8_60_COVERAGE.md records implementation against all 27 requirements, pending live checks and deliberate exceptions; no runtime code.

No new Scene/World schema, Road graph or stable Map Marker ID change, native Region geometry/Behavior/priority write, Token/Actor/Journal operation, Journey commit, World time change, or migration.

## Required owner verification (backed-up Sandbox only)

1. Install Atlas **0.3.9-beta.8.60** and confirm the version in Foundry. Open Road Settings from Map Directory and canvas. Confirm prior SVG preview/crash repair, explicit Save/Cancel and reload still work.
2. Open Map Marker Settings. Confirm Customization, banner Off/On, Journal/preset controls and new user-facing labels. Cancel a draft: no write. Save one owner-approved disposable marker once: no duplicate revision or permission change.
3. Open World Map Marker Presets. Verify General / Customization / Terrain Region / Transportation tabs; banner mode and Banner text color appear side by side, separate focus stops, color retained while Off. Switch tabs after typing without saving; draft persists. At narrow window and **200% text zoom**, footer stays at the window bottom, content scrolls without covering Save. Explicit Save affects the World preset catalog only; Cancel and dirty-close do not save.
4. In Territory Settings > Map Marker & Journal, check a Territory with eligible Map Marker(s). Locate map-pin should pan/highlight transiently, not write native Region Shapes/Behaviors/priority, change Journal permissions or link associations. Confirm an empty Territory still presents an honest read-only membership report.
5. Check Map Directory nested/unclassified Territory views, Road-associated marker counts, A–Z/Z–A, search and categories at normal/narrow width. No prior HTMLCollection exception or hidden GM metadata exposure.
6. Exercise existing Road Editor Undo/Redo, Map Marker movement dock and Workspace restoration only with owner-approved disposable fixtures. Cancel/Escape and invalid/stale Save must not move tokens, alter Scene data, advance World time or change Journal progress.
7. As non-GM, verify Atlas editing controls are not available and previously hidden Road, Map Marker, Territory and linked Journal details remain hidden. Check native Fog/Regions unchanged.
8. If any error occurs, stop dependent acceptance and send version, Foundry v14 build, original UI action, first red console stack, and full-window screenshots including footer and any dirty-close prompt.

## Still outstanding

- **#23 Road/Territory subtitle:** proposal-only at docs/ROAD_TERRITORY_BANNER_DESIGN_BETA8_59.md. Product Owner must decide dynamic anchor versus explicit/list semantics, public/GM audience and hover mode before runtime implementation.
- **#5 collection-level Plus actions:** not uniformly implemented; do not infer native Region containment from display grouping.
- **#12/#15/#17:** actual Foundry multi-editor focus/manual minimization, multi-step Redo branch invalidation, GM confirmation and stale-write acceptance still pending.
- **#16/#24/#27:** specialized editor help, color and independent setting Save controls have documented exceptions and remaining audit items in docs/UI_STANDARDIZATION_BETA8_60_COVERAGE.md. Do not add fake global Save to separately committed native Region actions.

## Manifest / rollback

Manifest:
https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.60-pr376-ui-audit/module.json

Archive:
https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.9-beta.8.60-pr376-ui-audit.zip

Previous owner-verified Road opening baseline:
https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.59.3-road-svg-fix/module.json

No merge, force-push, production installation or release without explicit Product Owner authorization.
