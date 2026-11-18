# Atlas 0.3.11-dev.4 — Map Marker Locate and footer alignment

**Issue:** [#415](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/415) · **Milestone 01:** Atlas Workspace & UI/UX Stabilization · **Platform:** Foundry VTT v14.

**Test manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/fix/0.3.11-m01-415-map-marker-locate-footer/module.json

**Archive:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/fix/0.3.11-m01-415-map-marker-locate-footer.zip

**Cumulative base:** owner-accepted 0.3.11-dev.3 (#407, PR #430), including owner-accepted dev.2 (#408, PR #429) and dev.1 (#406, PR #428). All parent PRs remain draft and unmerged; this test build is not a production release.

## Scope

A previously placed Map Marker Settings window now offers **Locate Map Marker** as its first footer action, followed by the existing staged visibility eye and Move Map Marker action. The injected callback uses the existing Atlas `selectCheckpoint` / `centerAtlasOn` camera and focus logic. It never closes the editor, invokes Move, changes an unsaved draft, or commits a Scene/Region/Token/Journal/World write.

The footer remains a direct sibling of all four independently scrolling tabs; its right-aligned action group holds distinguishable **Save as preset…**, **Save Map Marker**, and **Delete Map Marker** in DOM/keyboard order. Creating a new, unsaved Map Marker shows **Locate unavailable until Map Marker is saved** as a disabled action; there is no Delete on new creation. Existing contextual Road connection controls remain in the Terrain Region panel with the same dirty-close protection.

No new data owner, native Region Behavior, schema, migration, permission rule, automatic preset application, transportation runtime, or Journey workflow is introduced.

## GM live acceptance — backed-up Foundry v14 World

1. Open a **placed Map Marker → Settings**. Locate is first on the left, the existing visibility eye follows, and Move follows; World preset Save, Map Marker Save, Delete are grouped at the far right with Delete last. All buttons retain tooltips, 2rem targets, keyboard focus, and accessible names.
2. Type an unsaved custom marker name and adjust appearance/elevation. Click **Locate**. The map should pan/zoom to that marker and retain Atlas focus/highlight. The editor stays open and every draft value remains unchanged; no Scene/World/Journal write occurs.
3. Repeatedly click Locate; verify no duplicate save, reposition, exploration change, or map-drawing action. With a different active Scene or removed Map Marker, expect an actionable error and no persistence.
4. Toggle the visibility eye and cancel its confirmation; then approve. Confirm the state changes only in the **draft** and stays unsaved until Map Marker Save. Check existing party-discovery variant separately.
5. Open each General / Customization / Terrain Region / Transportation tab. The footer stays at the bottom outside the scrolling page; verify no action changes category, Road linkage, or existing preset automatically.
6. Resize the window narrow and test 200% text zoom. The groups wrap without overlap, Save as preset remains visually distinct, and right-side Save/Delete remain right-aligned. Tab and keyboard order follows the actual DOM.
7. Use **Save as preset…** and confirm that its World-preset create/overwrite dialog remains separate from Save Map Marker. Cancel and dirty-close keep existing protections. Test Move / Road connection separately to ensure their previous approval flow is preserved.
8. Start creation of a **new independent or Road-linked Map Marker**. Its Locate control must be disabled with an honest tooltip; the footer must not offer Delete. Creation still uses the existing guarded Save and cancel behavior.
9. As a non-GM or an unauthorized Scene editor, verify the Map Marker Settings window is denied and no GM-only action becomes available.

## Automated gates

Targeted `tests/checkpoint-appearance.test.mjs` DOM coverage checks Locate routing, zero-write/draft preservation, no close, new-marker disabled Locate, and stable left/right DOM/keyboard order. Existing GM/permission, preset, Journal, transport and Road graph suites must stay green.

Run `npm run check`, `npm run architecture:check`, syntax, and `git diff --check` before merging. GitHub CI does not substitute for this live Foundry v14 acceptance.

**Stop condition:** Any Locate click that closes the draft, changes Scene state, invokes Move, or fails to keep the footer visible at high text zoom blocks approval. Report the active Scene, screenshot and console trace; do not bypass the stored revision guard to make the UI respond.
