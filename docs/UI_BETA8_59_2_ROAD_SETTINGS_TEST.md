# beta.8.59.2 — Road Settings layout and diagnostic candidate

**Status:** draft, Sandbox only, not a verified fix for the reported Road Settings opening error.

## Source
Stacked on beta.8.59.1 (Map Directory HTMLCollection fix) and draft PR #388. The owner provided a screenshot of the **Paint Territory canvas palette** as the editor appearance reference; that image contains **no Road Settings error message** or stack trace. Available previous logs record other failures, not this Road Settings opening failure. We cannot safely attribute a root cause yet.

## Implemented
- Road Settings keeps native Foundry v14 `ApplicationV2` window and original form, dirty-close guard, staging, explicit GM Save/Cancel and Region-authorized actions.
- A clear Road Settings title, description and independently scrolling content align with Paint Territory's readable hierarchy; the form footer remains within the native window.
- The Road Settings opening promise now logs the original render exception with `[fvtt-atlas-navigation] Road Settings render failed` if native rendering rejects; normal rejections remain unchanged.
- No Road graph/appearance schema, World preset, native Region shape/behavior/priority, Token, Actor, Journal, Journey or time writes were added.

## Required owner live test — Foundry v14 Sandbox

1. Install **0.3.9-beta.8.59.2**, reload Foundry and confirm version.
2. On the original Scene, exit any active Road/Territory authoring draft before opening Road Settings. Open it from Workshop > Map Directory and from the canvas Road action.
3. If the window **fails**, open **F12 → Console**, preserve the first red exception and full stack beginning with the Road Settings action (not generic Foundry/plugin deprecation warnings). Include the toast message, module version, Foundry v14 build and clicked Road path. Stop dependent UI acceptance. Report these details so the actual failure can be fixed rather than guessed.
4. If the window **opens**, compare its header, guidance, tabs, scroll position and footer with the supplied Paint Territory reference. Test normal and 200% text zoom and a narrow window. The editor must remain native ApplicationV2; authoring/canvas menus may be separate overlays.
5. Change Road appearance, preset and name, then **Cancel** and reopen to confirm nothing persisted. Repeat with an explicit **Save** and verify one Road write, retained World preset/Journal permissions and reloaded values.
6. Verify Map Directory from beta.8.59.1 still works, and non-GM players see no hidden Road, Map Marker, Territory or Journal information.

## Known limit
This build addresses styling and adds diagnostics. It **does not claim to resolve an unreported Road Settings exception**. Do not treat automated validation as owner live acceptance or merge/release without owner approval.

**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.59.2-road-settings-diagnostics/module.json

**Archive:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.9-beta.8.59.2-road-settings-diagnostics.zip

**Rollback:** beta.8.59.1 test branch or the last owner-live-accepted beta.8.57.
